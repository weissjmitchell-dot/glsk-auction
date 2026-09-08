-- GREAT LAKE STATE KEEPERS — NOTIFICATION CENTER
-- League Office v6.8
--
-- Adds:
--   • realtime in-app notification feed
--   • per-owner notification preferences
--   • unread/read state
--   • player watch list
--   • future Yahoo-ready injury / availability alert ingestion
--   • automatic events for roster transactions, completed drafts, trades,
--     contracts, rookie-rights changes, message board activity, deadlines,
--     and finalized/live matchup weeks
--
-- Commissioner corrections/adjustments are intentionally excluded.
--
-- IMPORTANT:
-- This version is IN-APP notifications. Browser/mobile push while the app is
-- fully closed requires a later Web Push/service-worker layer.
--
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

-- ---------------------------------------------------------------------------
-- Central event stream
-- ---------------------------------------------------------------------------
create table if not exists public.league_events (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete cascade,

  category text not null,
  event_type text not null,
  title text not null,
  body text,

  actor_team_id uuid references public.teams(id),
  subject_team_id uuid references public.teams(id),

  player_key text,
  player_name text,

  visibility text not null default 'league'
    check(visibility in ('league','team')),
  target_team_id uuid references public.teams(id),

  related_type text,
  related_id text,
  external_key text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index if not exists league_events_external_uq
  on public.league_events(season_id,external_key)
  where external_key is not null;

create index if not exists league_events_feed_idx
  on public.league_events(season_id,created_at desc);

create index if not exists league_events_target_idx
  on public.league_events(season_id,target_team_id,created_at desc);

alter table public.league_events enable row level security;

-- Intentionally no direct SELECT policy. Notification delivery is PIN-validated
-- through league_get_notifications().

-- ---------------------------------------------------------------------------
-- Per-team settings + read state
-- ---------------------------------------------------------------------------
create table if not exists public.league_notification_preferences (
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  category text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(season_id,team_id,category)
);

create table if not exists public.league_notification_state (
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  last_read_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(season_id,team_id)
);

create table if not exists public.league_player_watches (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_key text not null,
  player_name text not null,
  nfl_team text,
  position text,
  injury_alerts boolean not null default true,
  availability_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,team_id,player_key)
);

alter table public.league_notification_preferences enable row level security;
alter table public.league_notification_state enable row level security;
alter table public.league_player_watches enable row level security;

-- These tables are intentionally RPC-only because PIN sessions are not Supabase
-- Auth users and therefore cannot be safely separated with ordinary browser RLS.
revoke all on public.league_events from anon,authenticated;
revoke all on public.league_notification_preferences from anon,authenticated;
revoke all on public.league_notification_state from anon,authenticated;
revoke all on public.league_player_watches from anon,authenticated;

-- ---------------------------------------------------------------------------
-- Player status cache for future Yahoo injury/availability synchronization.
-- Public read is okay: this contains NFL player status, not owner-private data.
-- ---------------------------------------------------------------------------
create table if not exists public.league_player_status_updates (
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  player_key text not null,
  player_name text not null,
  nfl_team text,
  position text,
  injury_status text,
  injury_detail text,
  availability_status text,
  source text not null default 'pending',
  source_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(season_id,player_key)
);

alter table public.league_player_status_updates enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_player_status_updates'
      and policyname='public read player status updates'
  ) then
    create policy "public read player status updates"
    on public.league_player_status_updates
    for select to anon,authenticated
    using(true);
  end if;
end $$;

grant select on public.league_player_status_updates to anon,authenticated;
revoke insert,update,delete on public.league_player_status_updates from anon,authenticated;

-- ---------------------------------------------------------------------------
-- Default notification categories.
-- ---------------------------------------------------------------------------
with cur as (
  select s.id season_id,s.room_id
  from public.league_seasons s
  join public.rooms r on r.id=s.room_id
  where r.code='GLSK26' and s.is_current
  order by s.season_year desc
  limit 1
),
cats(category,enabled) as (
  values
    ('roster_moves',true),
    ('trades',true),
    ('drafts',true),
    ('contracts',true),
    ('rookie_rights',true),
    ('message_board',true),
    ('matchups',true),
    ('deadlines',true),
    ('injuries',true),
    ('player_availability',true),
    ('other_activity',true)
)
insert into public.league_notification_preferences(
  season_id,room_id,team_id,category,enabled
)
select c.season_id,c.room_id,t.id,x.category,x.enabled
from cur c
join public.teams t on t.room_id=c.room_id
cross join cats x
on conflict(season_id,team_id,category) do nothing;

with cur as (
  select s.id season_id,s.room_id
  from public.league_seasons s
  join public.rooms r on r.id=s.room_id
  where r.code='GLSK26' and s.is_current
  order by s.season_year desc
  limit 1
)
insert into public.league_notification_state(season_id,room_id,team_id,last_read_at)
select c.season_id,c.room_id,t.id,now()
from cur c
join public.teams t on t.room_id=c.room_id
on conflict(season_id,team_id) do nothing;

-- ---------------------------------------------------------------------------
-- Helper: create/dedupe an event.
-- ---------------------------------------------------------------------------
create or replace function public._league_emit_event(
  p_season_id uuid,
  p_category text,
  p_event_type text,
  p_title text,
  p_body text default null,
  p_actor_team_id uuid default null,
  p_subject_team_id uuid default null,
  p_player_key text default null,
  p_player_name text default null,
  p_visibility text default 'league',
  p_target_team_id uuid default null,
  p_related_type text default null,
  p_related_id text default null,
  p_external_key text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_id bigint;
begin
  select room_id into v_room
  from public.league_seasons
  where id=p_season_id;

  if v_room is null then return null; end if;

  insert into public.league_events(
    room_id,season_id,category,event_type,title,body,
    actor_team_id,subject_team_id,player_key,player_name,
    visibility,target_team_id,related_type,related_id,external_key,metadata
  )
  values(
    v_room,p_season_id,p_category,p_event_type,p_title,p_body,
    p_actor_team_id,p_subject_team_id,p_player_key,p_player_name,
    coalesce(p_visibility,'league'),p_target_team_id,
    p_related_type,p_related_id,p_external_key,coalesce(p_metadata,'{}'::jsonb)
  )
  on conflict(season_id,external_key) where external_key is not null
  do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transactions -> league notifications.
-- Commissioner corrections are explicitly ignored.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_transaction()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_category text;
  v_title text;
  v_team text;
  v_other text;
begin
  if new.status<>'completed' then return new; end if;

  -- User-requested exclusion.
  if new.transaction_type='commissioner_correction' then return new; end if;

  select name into v_team from public.teams where id=new.team_id;
  select name into v_other from public.teams where id=new.other_team_id;

  v_category:=case
    when new.transaction_type in ('add','drop','waiver_add','free_agent_add','waiver_claim') then 'roster_moves'
    when new.transaction_type='trade' then 'trades'
    when new.transaction_type in ('auction','supplemental','phase3','rookie_draft','rookie') then 'drafts'
    when new.transaction_type like 'contract%' then 'contracts'
    when new.transaction_type like 'rookie_rights%' then 'rookie_rights'
    else 'other_activity'
  end;

  v_title:=case
    when new.transaction_type='drop'
      then coalesce(v_team,'A team')||' dropped '||coalesce(new.player_name,'a player')
    when new.transaction_type in ('add','waiver_add','free_agent_add','waiver_claim')
      then coalesce(v_team,'A team')||' added '||coalesce(new.player_name,'a player')
    when new.transaction_type in ('auction','supplemental','phase3','rookie_draft','rookie')
      then coalesce(v_team,'A team')||' selected '||coalesce(new.player_name,'a player')
    when new.transaction_type='trade'
      then coalesce(v_team,'A team')||' and '||coalesce(v_other,'another team')||' completed a trade'
    when new.transaction_type='contract_assigned'
      then coalesce(v_team,'A team')||' contracted '||coalesce(new.player_name,'a player')
    when new.transaction_type='contract_extended'
      then coalesce(v_team,'A team')||' extended '||coalesce(new.player_name,'a player')
    when new.transaction_type in ('contract_removed','contract_voided')
      then coalesce(new.player_name,'A player')||'''s contract changed'
    when new.transaction_type like 'rookie_rights%'
      then 'Rookie rights updated for '||coalesce(new.player_name,'a player')
    else coalesce(new.description,'League activity')
  end;

  perform public._league_emit_event(
    new.season_id,
    v_category,
    new.transaction_type,
    v_title,
    new.description,
    new.team_id,
    new.team_id,
    new.player_key,
    new.player_name,
    'league',
    null,
    coalesce(new.related_type,'league_transactions'),
    coalesce(new.related_id,new.id::text),
    'transaction:'||new.id::text,
    jsonb_build_object(
      'bid_delta',new.bid_delta,
      'cap_delta',new.cap_delta,
      'other_team_id',new.other_team_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_league_notify_transaction on public.league_transactions;
create trigger trg_league_notify_transaction
after insert on public.league_transactions
for each row execute function public._league_notify_transaction();

-- ---------------------------------------------------------------------------
-- Trade lifecycle notifications.
-- Completed/approved trade itself is emitted by league_transactions.
-- Proposal/status notifications are private to involved owners.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_trade_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_proposer text;
  v_partner text;
begin
  select name into v_proposer from public.teams where id=new.proposer_team_id;
  select name into v_partner from public.teams where id=new.partner_team_id;

  if tg_op='INSERT' then
    perform public._league_emit_event(
      new.season_id,'trades','trade_proposed',
      'Trade proposal from '||coalesce(v_proposer,'another team'),
      coalesce(new.note,'Open Trades to review the proposal.'),
      new.proposer_team_id,new.partner_team_id,null,null,
      'team',new.partner_team_id,'league_trades',new.id::text,
      'trade-proposed:'||new.id::text,
      jsonb_build_object('proposer_team_id',new.proposer_team_id,'partner_team_id',new.partner_team_id)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status='pending_commish' then
      perform public._league_emit_event(
        new.season_id,'trades','trade_accepted',
        coalesce(v_partner,'Trade partner')||' accepted the trade',
        'The trade is awaiting commissioner processing.',
        new.partner_team_id,new.proposer_team_id,null,null,
        'team',new.proposer_team_id,'league_trades',new.id::text,
        'trade-accepted:'||new.id::text,
        '{}'::jsonb
      );
    elsif new.status='rejected' then
      perform public._league_emit_event(
        new.season_id,'trades','trade_rejected',
        coalesce(v_partner,'Trade partner')||' rejected the trade',
        null,new.partner_team_id,new.proposer_team_id,null,null,
        'team',new.proposer_team_id,'league_trades',new.id::text,
        'trade-rejected:'||new.id::text,
        '{}'::jsonb
      );
    elsif new.status='denied' then
      perform public._league_emit_event(
        new.season_id,'trades','trade_denied',
        'Trade was not approved',
        coalesce(v_proposer,'Team')||' ↔ '||coalesce(v_partner,'Team'),
        null,new.proposer_team_id,null,null,
        'team',new.proposer_team_id,'league_trades',new.id::text,
        'trade-denied-proposer:'||new.id::text,
        '{}'::jsonb
      );
      perform public._league_emit_event(
        new.season_id,'trades','trade_denied',
        'Trade was not approved',
        coalesce(v_proposer,'Team')||' ↔ '||coalesce(v_partner,'Team'),
        null,new.partner_team_id,null,null,
        'team',new.partner_team_id,'league_trades',new.id::text,
        'trade-denied-partner:'||new.id::text,
        '{}'::jsonb
      );
    elsif new.status='cancelled' then
      perform public._league_emit_event(
        new.season_id,'trades','trade_cancelled',
        coalesce(v_proposer,'A team')||' cancelled the trade proposal',
        null,new.proposer_team_id,new.partner_team_id,null,null,
        'team',new.partner_team_id,'league_trades',new.id::text,
        'trade-cancelled:'||new.id::text,
        '{}'::jsonb
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_league_notify_trade_status on public.league_trades;
create trigger trg_league_notify_trade_status
after insert or update on public.league_trades
for each row execute function public._league_notify_trade_status();

-- ---------------------------------------------------------------------------
-- Message board.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_message_thread()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_team text;
begin
  select name into v_team from public.teams where id=new.author_team_id;

  perform public._league_emit_event(
    new.season_id,'message_board','message_thread',
    coalesce(v_team,'A team')||' posted: '||new.title,
    left(new.body,300),
    new.author_team_id,new.author_team_id,null,null,
    'league',null,'league_message_threads',new.id::text,
    'message-thread:'||new.id::text,
    '{}'::jsonb
  );

  return new;
end;
$$;

drop trigger if exists trg_league_notify_message_thread on public.league_message_threads;
create trigger trg_league_notify_message_thread
after insert on public.league_message_threads
for each row execute function public._league_notify_message_thread();

create or replace function public._league_notify_message_reply()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_team text;
  v_title text;
begin
  select name into v_team from public.teams where id=new.author_team_id;
  select title into v_title from public.league_message_threads where id=new.thread_id;

  perform public._league_emit_event(
    new.season_id,'message_board','message_reply',
    coalesce(v_team,'A team')||' replied to '||coalesce(v_title,'a discussion'),
    left(new.body,300),
    new.author_team_id,new.author_team_id,null,null,
    'league',null,'league_message_threads',new.thread_id::text,
    'message-reply:'||new.id::text,
    jsonb_build_object('post_id',new.id)
  );

  return new;
end;
$$;

drop trigger if exists trg_league_notify_message_reply on public.league_message_posts;
create trigger trg_league_notify_message_reply
after insert on public.league_message_posts
for each row execute function public._league_notify_message_reply();

-- ---------------------------------------------------------------------------
-- Weekly matchup status.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_week_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  if new.status='live' then
    perform public._league_emit_event(
      new.season_id,'matchups','week_live',
      'Week '||new.week||' scoring is live',
      'Open Matchups to follow live GLSK scoring.',
      null,null,null,null,'league',null,
      'league_week_states',new.id::text,
      'week-live:'||new.season_id::text||':'||new.week::text,
      jsonb_build_object('week',new.week)
    );
  elsif new.status='final' then
    perform public._league_emit_event(
      new.season_id,'matchups','week_final',
      'Week '||new.week||' results are final',
      'Standings have been updated from finalized GLSK results.',
      null,null,null,null,'league',null,
      'league_week_states',new.id::text,
      'week-final:'||new.season_id::text||':'||new.week::text,
      jsonb_build_object('week',new.week)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_league_notify_week_state on public.league_week_states;
create trigger trg_league_notify_week_state
after insert or update on public.league_week_states
for each row execute function public._league_notify_week_state();

-- ---------------------------------------------------------------------------
-- Deadlines.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_deadline()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='INSERT' then
    perform public._league_emit_event(
      new.season_id,'deadlines','deadline_created',
      'New deadline: '||new.title,
      'Due '||to_char(new.due_at,'Mon DD, YYYY HH12:MI AM TZ'),
      null,null,null,null,'league',null,
      'league_deadlines',new.id::text,
      'deadline-created:'||new.id::text,
      jsonb_build_object('due_at',new.due_at,'deadline_type',new.deadline_type)
    );
  elsif old.status is distinct from new.status then
    perform public._league_emit_event(
      new.season_id,'deadlines','deadline_'||new.status,
      new.title||' is '||new.status,
      null,null,null,null,null,'league',null,
      'league_deadlines',new.id::text,
      'deadline-status:'||new.id::text||':'||new.status,
      jsonb_build_object('due_at',new.due_at,'status',new.status)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_league_notify_deadline on public.league_deadlines;
create trigger trg_league_notify_deadline
after insert or update on public.league_deadlines
for each row execute function public._league_notify_deadline();

-- ---------------------------------------------------------------------------
-- Injury / availability changes from future Yahoo importer.
-- Initial population is silent; changes after initial sync create events.
-- ---------------------------------------------------------------------------
create or replace function public._league_notify_player_status()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op<>'UPDATE' then return new; end if;

  if old.injury_status is distinct from new.injury_status
     or old.injury_detail is distinct from new.injury_detail then
    perform public._league_emit_event(
      new.season_id,'injuries','injury_update',
      new.player_name||' injury update',
      trim(both ' ' from coalesce(new.injury_status,'')||
        case when nullif(new.injury_detail,'') is not null then ' • '||new.injury_detail else '' end),
      null,null,new.player_key,new.player_name,
      'league',null,'league_player_status_updates',new.player_key,
      'injury:'||new.season_id::text||':'||new.player_key||':'||
        extract(epoch from new.updated_at)::bigint::text,
      jsonb_build_object(
        'old_status',old.injury_status,
        'new_status',new.injury_status,
        'nfl_team',new.nfl_team,
        'position',new.position
      )
    );
  end if;

  if old.availability_status is distinct from new.availability_status then
    perform public._league_emit_event(
      new.season_id,'player_availability','availability_update',
      new.player_name||' availability changed',
      coalesce(new.availability_status,'Status updated'),
      null,null,new.player_key,new.player_name,
      'league',null,'league_player_status_updates',new.player_key,
      'availability:'||new.season_id::text||':'||new.player_key||':'||
        extract(epoch from new.updated_at)::bigint::text,
      jsonb_build_object(
        'old_status',old.availability_status,
        'new_status',new.availability_status,
        'nfl_team',new.nfl_team,
        'position',new.position
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_league_notify_player_status on public.league_player_status_updates;
create trigger trg_league_notify_player_status
after update on public.league_player_status_updates
for each row execute function public._league_notify_player_status();

-- ---------------------------------------------------------------------------
-- Notification delivery RPC.
-- Injury alerts are limited to MY ROSTER + explicitly watched players.
-- Availability alerts are limited to explicitly watched players.
-- ---------------------------------------------------------------------------
create or replace function public.league_get_notifications(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_last_read timestamptz;
  v_events jsonb;
  v_prefs jsonb;
  v_watches jsonb;
  v_unread integer;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  if not exists(select 1 from public.teams where id=p_team_id and room_id=v_room) then
    return jsonb_build_object('ok',false,'error','Team not found.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  select last_read_at into v_last_read
  from public.league_notification_state
  where season_id=v_season and team_id=p_team_id;

  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb)
  into v_events
  from (
    select
      e.id,e.category,e.event_type,e.title,e.body,
      e.actor_team_id,e.subject_team_id,
      e.player_key,e.player_name,
      e.related_type,e.related_id,e.metadata,e.created_at,
      (v_last_read is null or e.created_at>v_last_read) as unread
    from public.league_events e
    where e.season_id=v_season
      and (e.visibility='league' or e.target_team_id=p_team_id)
      and coalesce((
        select p.enabled
        from public.league_notification_preferences p
        where p.season_id=v_season
          and p.team_id=p_team_id
          and p.category=e.category
      ),true)=true
      and (
        e.category<>'injuries'
        or exists(
          select 1
          from public.league_roster_entries re
          where re.room_id=v_room
            and re.team_id=p_team_id
            and re.player_key=e.player_key
            and re.active=true
        )
        or exists(
          select 1
          from public.league_player_watches w
          where w.season_id=v_season
            and w.team_id=p_team_id
            and w.player_key=e.player_key
            and w.injury_alerts=true
        )
      )
      and (
        e.category<>'player_availability'
        or exists(
          select 1
          from public.league_player_watches w
          where w.season_id=v_season
            and w.team_id=p_team_id
            and w.player_key=e.player_key
            and w.availability_alerts=true
        )
      )
    order by e.created_at desc
    limit greatest(1,least(coalesce(p_limit,100),250))
  ) x;

  select count(*)
  into v_unread
  from public.league_events e
  where e.season_id=v_season
    and (e.visibility='league' or e.target_team_id=p_team_id)
    and (v_last_read is null or e.created_at>v_last_read)
    and coalesce((
      select p.enabled
      from public.league_notification_preferences p
      where p.season_id=v_season
        and p.team_id=p_team_id
        and p.category=e.category
    ),true)=true
    and (
      e.category<>'injuries'
      or exists(
        select 1 from public.league_roster_entries re
        where re.room_id=v_room and re.team_id=p_team_id
          and re.player_key=e.player_key and re.active=true
      )
      or exists(
        select 1 from public.league_player_watches w
        where w.season_id=v_season and w.team_id=p_team_id
          and w.player_key=e.player_key and w.injury_alerts=true
      )
    )
    and (
      e.category<>'player_availability'
      or exists(
        select 1 from public.league_player_watches w
        where w.season_id=v_season and w.team_id=p_team_id
          and w.player_key=e.player_key and w.availability_alerts=true
      )
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'category',category,'enabled',enabled
  ) order by category),'[]'::jsonb)
  into v_prefs
  from public.league_notification_preferences
  where season_id=v_season and team_id=p_team_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'player_key',player_key,
    'player_name',player_name,
    'nfl_team',nfl_team,
    'position',position,
    'injury_alerts',injury_alerts,
    'availability_alerts',availability_alerts
  ) order by player_name),'[]'::jsonb)
  into v_watches
  from public.league_player_watches
  where season_id=v_season and team_id=p_team_id;

  return jsonb_build_object(
    'ok',true,
    'events',v_events,
    'preferences',v_prefs,
    'watches',v_watches,
    'unread_count',coalesce(v_unread,0)
  );
end;
$$;

grant execute on function public.league_get_notifications(text,uuid,text,integer)
to anon,authenticated;

create or replace function public.league_owner_set_notification_preference(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_category text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  insert into public.league_notification_preferences(
    season_id,room_id,team_id,category,enabled,updated_at
  )
  values(v_season,v_room,p_team_id,p_category,coalesce(p_enabled,true),now())
  on conflict(season_id,team_id,category) do update
  set enabled=excluded.enabled,updated_at=now();

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.league_owner_set_notification_preference(text,uuid,text,text,boolean)
to anon,authenticated;

create or replace function public.league_owner_mark_notifications_read(
  p_room_code text,
  p_team_id uuid,
  p_pin text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  insert into public.league_notification_state(
    season_id,room_id,team_id,last_read_at,updated_at
  )
  values(v_season,v_room,p_team_id,now(),now())
  on conflict(season_id,team_id) do update
  set last_read_at=now(),updated_at=now();

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.league_owner_mark_notifications_read(text,uuid,text)
to anon,authenticated;

create or replace function public.league_owner_set_player_watch(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_player_name text,
  p_nfl_team text,
  p_position text,
  p_injury_alerts boolean,
  p_availability_alerts boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_key text;
  v_id bigint;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  if nullif(btrim(coalesce(p_player_name,'')),'') is null then
    return jsonb_build_object('ok',false,'error','Choose a player.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  v_key:=public._league_player_key(p_player_name,p_nfl_team,p_position);

  insert into public.league_player_watches(
    season_id,room_id,team_id,player_key,player_name,nfl_team,position,
    injury_alerts,availability_alerts,updated_at
  )
  values(
    v_season,v_room,p_team_id,v_key,btrim(p_player_name),p_nfl_team,upper(p_position),
    coalesce(p_injury_alerts,true),coalesce(p_availability_alerts,true),now()
  )
  on conflict(season_id,team_id,player_key) do update
  set player_name=excluded.player_name,
      nfl_team=excluded.nfl_team,
      position=excluded.position,
      injury_alerts=excluded.injury_alerts,
      availability_alerts=excluded.availability_alerts,
      updated_at=now()
  returning id into v_id;

  return jsonb_build_object('ok',true,'watch_id',v_id,'player_key',v_key);
end;
$$;

grant execute on function public.league_owner_set_player_watch(text,uuid,text,text,text,text,boolean,boolean)
to anon,authenticated;

create or replace function public.league_owner_remove_player_watch(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_watch_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  delete from public.league_player_watches
  where id=p_watch_id and season_id=v_season and team_id=p_team_id;

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.league_owner_remove_player_watch(text,uuid,text,bigint)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Secure status ingestion endpoint for future Yahoo sync.
-- First sync is silent. Subsequent changes trigger owner-relevant alerts.
-- ---------------------------------------------------------------------------
create or replace function public.league_commish_upsert_player_statuses(
  p_room_code text,
  p_commish_pin text,
  p_statuses jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_row jsonb;
  v_key text;
  v_count integer:=0;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;

  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  for v_row in select * from jsonb_array_elements(coalesce(p_statuses,'[]'::jsonb))
  loop
    v_key:=coalesce(
      nullif(v_row->>'player_key',''),
      public._league_player_key(v_row->>'player_name',v_row->>'nfl_team',v_row->>'position')
    );

    insert into public.league_player_status_updates(
      season_id,room_id,player_key,player_name,nfl_team,position,
      injury_status,injury_detail,availability_status,
      source,source_updated_at,updated_at
    )
    values(
      v_season,v_room,v_key,
      coalesce(v_row->>'player_name',v_key),
      v_row->>'nfl_team',
      upper(v_row->>'position'),
      v_row->>'injury_status',
      v_row->>'injury_detail',
      v_row->>'availability_status',
      coalesce(nullif(v_row->>'source',''),'yahoo'),
      coalesce(nullif(v_row->>'source_updated_at','')::timestamptz,now()),
      now()
    )
    on conflict(season_id,player_key) do update
    set player_name=excluded.player_name,
        nfl_team=excluded.nfl_team,
        position=excluded.position,
        injury_status=excluded.injury_status,
        injury_detail=excluded.injury_detail,
        availability_status=excluded.availability_status,
        source=excluded.source,
        source_updated_at=excluded.source_updated_at,
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'rows_upserted',v_count);
end;
$$;

grant execute on function public.league_commish_upsert_player_statuses(text,text,jsonb)
to anon,authenticated;

-- Realtime source tables used by the browser to know it should refresh its
-- PIN-filtered notification feed.
do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_player_status_updates'
  ) then
    alter publication supabase_realtime add table public.league_player_status_updates;
  end if;
end $$;

commit;

select
  (select count(*) from public.league_notification_preferences p
    join public.rooms r on r.id=p.room_id where r.code='GLSK26') as preference_rows,
  (select count(*) from public.league_events e
    join public.rooms r on r.id=e.room_id where r.code='GLSK26') as notification_events,
  (select count(*) from public.league_player_watches w
    join public.rooms r on r.id=w.room_id where r.code='GLSK26') as watched_players;
