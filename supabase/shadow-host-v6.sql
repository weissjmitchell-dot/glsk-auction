-- GREAT LAKE STATE KEEPERS — SHADOW HOST / WEEKLY PLAY FOUNDATION
-- League Office v6
--
-- Adds:
--   • configurable starting-lineup slots
--   • owner lineup submission with per-player game-start locks
--   • weekly head-to-head schedule
--   • live weekly player-score storage
--   • live matchup totals
--   • shadow standings from finalized GLSK weeks
--   • commissioner-only Yahoo reconciliation storage
--
-- IMPORTANT:
-- This creates the host infrastructure but DOES NOT invent GLSK lineup/scoring rules.
-- The commissioner configures the official starting slots in League Office.
-- Live player points can be fed by Yahoo once API access is approved, or by another
-- stats/scoring feed later.
--
-- Safe to run on the existing GLSK database.
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_game_settings (
  season_id uuid primary key references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  current_week integer not null default 1 check(current_week between 1 and 25),
  regular_season_weeks integer,
  playoff_start_week integer,
  lineup_lock_mode text not null default 'individual_game_start',
  scoring_source text not null default 'pending',
  updated_at timestamptz not null default now()
);

create table if not exists public.league_lineup_slots (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  slot_code text not null,
  label text not null,
  slot_order integer not null,
  allowed_positions text[] not null,
  active boolean not null default true,
  unique(season_id,slot_code),
  unique(season_id,slot_order)
);

create table if not exists public.league_week_states (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null check(week between 1 and 25),
  phase text not null default 'regular' check(phase in ('regular','playoffs','championship','consolation')),
  status text not null default 'scheduled' check(status in ('scheduled','live','final')),
  starts_at timestamptz,
  finalized_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(season_id,week)
);

create table if not exists public.league_schedule (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null check(week between 1 and 25),
  matchup_no integer not null,
  phase text not null default 'regular' check(phase in ('regular','playoffs','championship','consolation')),
  home_team_id uuid not null references public.teams(id) on delete cascade,
  away_team_id uuid not null references public.teams(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,week,matchup_no),
  check(home_team_id<>away_team_id)
);

create index if not exists league_schedule_week_idx
  on public.league_schedule(season_id,week);

create table if not exists public.league_lineups (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null check(week between 1 and 25),
  team_id uuid not null references public.teams(id) on delete cascade,
  slot_code text not null,
  player_key text not null,
  player_name text not null,
  position text not null,
  updated_at timestamptz not null default now(),
  unique(season_id,week,team_id,slot_code),
  unique(season_id,week,team_id,player_key)
);

create index if not exists league_lineups_team_week_idx
  on public.league_lineups(season_id,week,team_id);

create table if not exists public.league_weekly_player_scores (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null check(week between 1 and 25),
  player_key text not null,
  player_name text not null,
  nfl_team text,
  position text,
  fantasy_points numeric(10,2) not null default 0,
  game_started boolean not null default false,
  game_final boolean not null default false,
  nfl_game_status text,
  source text not null default 'pending',
  raw_stats jsonb not null default '{}'::jsonb,
  source_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(season_id,week,player_key)
);

create index if not exists league_weekly_scores_week_idx
  on public.league_weekly_player_scores(season_id,week);

-- Commissioner-only comparison data. No public SELECT policy is created.
create table if not exists public.league_reconciliation_matchups (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null,
  schedule_id bigint not null references public.league_schedule(id) on delete cascade,
  yahoo_home_score numeric(10,2),
  yahoo_away_score numeric(10,2),
  note text,
  checked_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(season_id,week,schedule_id)
);

alter table public.league_game_settings enable row level security;
alter table public.league_lineup_slots enable row level security;
alter table public.league_week_states enable row level security;
alter table public.league_schedule enable row level security;
alter table public.league_lineups enable row level security;
alter table public.league_weekly_player_scores enable row level security;
alter table public.league_reconciliation_matchups enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_game_settings' and policyname='public read game settings') then
    create policy "public read game settings" on public.league_game_settings for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_lineup_slots' and policyname='public read lineup slots') then
    create policy "public read lineup slots" on public.league_lineup_slots for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_week_states' and policyname='public read week states') then
    create policy "public read week states" on public.league_week_states for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_schedule' and policyname='public read schedule') then
    create policy "public read schedule" on public.league_schedule for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_lineups' and policyname='public read lineups') then
    create policy "public read lineups" on public.league_lineups for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_weekly_player_scores' and policyname='public read weekly player scores') then
    create policy "public read weekly player scores" on public.league_weekly_player_scores for select to anon,authenticated using(true);
  end if;
end $$;

grant select on public.league_game_settings,public.league_lineup_slots,
  public.league_week_states,public.league_schedule,public.league_lineups,
  public.league_weekly_player_scores
to anon,authenticated;

revoke insert,update,delete on public.league_game_settings,public.league_lineup_slots,
  public.league_week_states,public.league_schedule,public.league_lineups,
  public.league_weekly_player_scores,public.league_reconciliation_matchups
from anon,authenticated;

-- Seed current 2026 weekly settings only. No lineup/scoring assumptions.
insert into public.league_game_settings(season_id,room_id,current_week,scoring_source)
select s.id,s.room_id,1,'pending'
from public.league_seasons s
join public.rooms r on r.id=s.room_id
where r.code='GLSK26' and s.is_current
on conflict(season_id) do nothing;

insert into public.league_week_states(season_id,room_id,week,phase,status)
select s.id,s.room_id,1,'regular','scheduled'
from public.league_seasons s
join public.rooms r on r.id=s.room_id
where r.code='GLSK26' and s.is_current
on conflict(season_id,week) do nothing;

-- ---------------------------------------------------------------------------
-- Commissioner: configure lineup slots.
-- p_slots example:
-- [{"slot_code":"QB1","label":"QB","slot_order":1,"allowed_positions":["QB"]}]
-- ---------------------------------------------------------------------------
create or replace function public.league_commish_set_lineup_slots(
  p_room_code text,
  p_commish_pin text,
  p_slots jsonb
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
  v_count integer:=0;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  if exists(select 1 from public.league_lineups where season_id=v_season) then
    return jsonb_build_object('ok',false,'error','Lineup slots cannot be changed after weekly lineups have been submitted.');
  end if;

  delete from public.league_lineup_slots where season_id=v_season;

  for v_row in select * from jsonb_array_elements(coalesce(p_slots,'[]'::jsonb))
  loop
    if jsonb_array_length(coalesce(v_row->'allowed_positions','[]'::jsonb))=0 then
      return jsonb_build_object('ok',false,'error','Every lineup slot needs at least one eligible position.');
    end if;

    insert into public.league_lineup_slots(
      season_id,room_id,slot_code,label,slot_order,allowed_positions,active
    )
    values(
      v_season,v_room,
      v_row->>'slot_code',
      v_row->>'label',
      (v_row->>'slot_order')::integer,
      array(select upper(x) from jsonb_array_elements_text(v_row->'allowed_positions') x),
      true
    );
    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'slots_saved',v_count);
end;
$$;

grant execute on function public.league_commish_set_lineup_slots(text,text,jsonb)
to anon,authenticated;

create or replace function public.league_commish_set_current_week(
  p_room_code text,
  p_commish_pin text,
  p_week integer
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
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;
  if p_week<1 or p_week>25 then return jsonb_build_object('ok',false,'error','Invalid week.'); end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  update public.league_game_settings
  set current_week=p_week,updated_at=now()
  where season_id=v_season;

  insert into public.league_week_states(season_id,room_id,week,phase,status)
  values(v_season,v_room,p_week,'regular','scheduled')
  on conflict(season_id,week) do nothing;

  return jsonb_build_object('ok',true,'current_week',p_week);
end;
$$;

grant execute on function public.league_commish_set_current_week(text,text,integer)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Commissioner: set the six weekly matchups.
-- ---------------------------------------------------------------------------
create or replace function public.league_commish_set_week_schedule(
  p_room_code text,
  p_commish_pin text,
  p_week integer,
  p_phase text,
  p_matchups jsonb
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
  v_home uuid;
  v_away uuid;
  v_seen uuid[]:=array[]::uuid[];
  v_count integer:=0;
  v_status text;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;
  if p_week<1 or p_week>25 then return jsonb_build_object('ok',false,'error','Invalid week.'); end if;
  if p_phase not in ('regular','playoffs','championship','consolation') then
    return jsonb_build_object('ok',false,'error','Invalid phase.');
  end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  select status into v_status from public.league_week_states
  where season_id=v_season and week=p_week;
  if v_status='final' then return jsonb_build_object('ok',false,'error','A finalized week cannot be rescheduled.'); end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_matchups,'[]'::jsonb))
  loop
    v_home=(v_row->>'home_team_id')::uuid;
    v_away=(v_row->>'away_team_id')::uuid;

    if v_home=v_away then return jsonb_build_object('ok',false,'error','A team cannot play itself.'); end if;
    if v_home=any(v_seen) or v_away=any(v_seen) then
      return jsonb_build_object('ok',false,'error','A team can only appear once in a weekly schedule.');
    end if;
    if not exists(select 1 from public.teams where id=v_home and room_id=v_room)
       or not exists(select 1 from public.teams where id=v_away and room_id=v_room) then
      return jsonb_build_object('ok',false,'error','Schedule contains an invalid team.');
    end if;
    v_seen:=array_append(array_append(v_seen,v_home),v_away);
  end loop;

  delete from public.league_schedule where season_id=v_season and week=p_week;

  for v_row in select * from jsonb_array_elements(coalesce(p_matchups,'[]'::jsonb))
  loop
    insert into public.league_schedule(
      season_id,room_id,week,matchup_no,phase,home_team_id,away_team_id
    )
    values(
      v_season,v_room,p_week,(v_row->>'matchup_no')::integer,p_phase,
      (v_row->>'home_team_id')::uuid,(v_row->>'away_team_id')::uuid
    );
    v_count:=v_count+1;
  end loop;

  insert into public.league_week_states(season_id,room_id,week,phase,status,updated_at)
  values(v_season,v_room,p_week,p_phase,'scheduled',now())
  on conflict(season_id,week) do update
  set phase=excluded.phase,
      status=case when public.league_week_states.status='live' then 'live' else 'scheduled' end,
      updated_at=now();

  return jsonb_build_object('ok',true,'matchups_saved',v_count);
end;
$$;

grant execute on function public.league_commish_set_week_schedule(text,text,integer,text,jsonb)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Owner: atomically save a weekly starting lineup.
-- ---------------------------------------------------------------------------
create or replace function public.league_owner_save_lineup(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_week integer,
  p_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_current_week integer;
  v_week_status text;
  v_row jsonb;
  v_slot public.league_lineup_slots%rowtype;
  v_roster public.league_roster_entries%rowtype;
  v_existing public.league_lineups%rowtype;
  v_started boolean;
  v_player_key text;
  v_slot_code text;
  v_count integer:=0;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;
  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;
  if not exists(select 1 from public.teams where id=p_team_id and room_id=v_room) then
    return jsonb_build_object('ok',false,'error','Team not found.');
  end if;

  select s.id,g.current_week into v_season,v_current_week
  from public.league_seasons s
  join public.league_game_settings g on g.season_id=s.id
  where s.room_id=v_room and s.is_current
  order by s.season_year desc limit 1;

  if p_week<>v_current_week then
    return jsonb_build_object('ok',false,'error','Owners can edit only the current GLSK week.');
  end if;

  select status into v_week_status from public.league_week_states
  where season_id=v_season and week=p_week;
  if v_week_status='final' then return jsonb_build_object('ok',false,'error','This week is finalized.'); end if;

  if exists(
    select 1
    from (
      select e->>'player_key' k,count(*) c
      from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) e
      where nullif(e->>'player_key','') is not null
      group by e->>'player_key'
      having count(*)>1
    ) d
  ) then
    return jsonb_build_object('ok',false,'error','A player cannot occupy two starting slots.');
  end if;

  -- Started players already in the lineup are locked into their current slot.
  for v_existing in
    select l.*
    from public.league_lineups l
    join public.league_weekly_player_scores s
      on s.season_id=l.season_id and s.week=l.week and s.player_key=l.player_key
    where l.season_id=v_season and l.week=p_week and l.team_id=p_team_id
      and s.game_started=true
  loop
    if not exists(
      select 1 from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) e
      where e->>'slot_code'=v_existing.slot_code
        and e->>'player_key'=v_existing.player_key
    ) then
      return jsonb_build_object('ok',false,'error',v_existing.player_name||' is locked because his NFL game has started.');
    end if;
  end loop;

  -- Remove only unlocked lineup rows; locked starters stay in place.
  delete from public.league_lineups l
  where l.season_id=v_season and l.week=p_week and l.team_id=p_team_id
    and not exists(
      select 1 from public.league_weekly_player_scores s
      where s.season_id=l.season_id and s.week=l.week and s.player_key=l.player_key
        and s.game_started=true
    );

  for v_row in select * from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb))
  loop
    v_slot_code:=v_row->>'slot_code';
    v_player_key:=nullif(v_row->>'player_key','');
    if v_player_key is null then continue; end if;

    select * into v_slot from public.league_lineup_slots
    where season_id=v_season and slot_code=v_slot_code and active=true;
    if v_slot.id is null then
      return jsonb_build_object('ok',false,'error','Invalid lineup slot: '||coalesce(v_slot_code,''));
    end if;

    select * into v_roster from public.league_roster_entries
    where room_id=v_room and team_id=p_team_id and player_key=v_player_key and active=true;
    if v_roster.id is null then
      return jsonb_build_object('ok',false,'error','A selected player is not on this team.');
    end if;

    if not upper(v_roster.position)=any(v_slot.allowed_positions) then
      return jsonb_build_object('ok',false,'error',v_roster.player_name||' is not eligible for '||v_slot.label||'.');
    end if;

    select coalesce(game_started,false) into v_started
    from public.league_weekly_player_scores
    where season_id=v_season and week=p_week and player_key=v_player_key;

    if coalesce(v_started,false) and not exists(
      select 1 from public.league_lineups l
      where l.season_id=v_season and l.week=p_week and l.team_id=p_team_id
        and l.slot_code=v_slot_code and l.player_key=v_player_key
    ) then
      return jsonb_build_object('ok',false,'error',v_roster.player_name||' cannot be moved after his NFL game has started.');
    end if;

    insert into public.league_lineups(
      season_id,room_id,week,team_id,slot_code,player_key,player_name,position,updated_at
    )
    values(
      v_season,v_room,p_week,p_team_id,v_slot_code,v_roster.player_key,
      v_roster.player_name,v_roster.position,now()
    )
    on conflict(season_id,week,team_id,slot_code) do update
    set player_key=excluded.player_key,
        player_name=excluded.player_name,
        position=excluded.position,
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'starters_saved',v_count);
end;
$$;

grant execute on function public.league_owner_save_lineup(text,uuid,text,integer,jsonb)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Live score ingestion endpoint for Yahoo/another provider.
-- ---------------------------------------------------------------------------
create or replace function public.league_commish_upsert_weekly_scores(
  p_room_code text,
  p_commish_pin text,
  p_week integer,
  p_scores jsonb
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

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  for v_row in select * from jsonb_array_elements(coalesce(p_scores,'[]'::jsonb))
  loop
    v_key:=coalesce(
      nullif(v_row->>'player_key',''),
      public._league_player_key(v_row->>'player_name',v_row->>'nfl_team',v_row->>'position')
    );

    insert into public.league_weekly_player_scores(
      season_id,room_id,week,player_key,player_name,nfl_team,position,
      fantasy_points,game_started,game_final,nfl_game_status,source,
      raw_stats,source_updated_at,updated_at
    )
    values(
      v_season,v_room,p_week,v_key,coalesce(v_row->>'player_name',v_key),
      v_row->>'nfl_team',upper(v_row->>'position'),
      coalesce(nullif(v_row->>'fantasy_points','')::numeric,0),
      coalesce((v_row->>'game_started')::boolean,false),
      coalesce((v_row->>'game_final')::boolean,false),
      v_row->>'nfl_game_status',
      coalesce(nullif(v_row->>'source',''),'external'),
      coalesce(v_row->'raw_stats','{}'::jsonb),
      coalesce(nullif(v_row->>'source_updated_at','')::timestamptz,now()),
      now()
    )
    on conflict(season_id,week,player_key) do update
    set player_name=excluded.player_name,
        nfl_team=excluded.nfl_team,
        position=excluded.position,
        fantasy_points=excluded.fantasy_points,
        game_started=excluded.game_started,
        game_final=excluded.game_final,
        nfl_game_status=excluded.nfl_game_status,
        source=excluded.source,
        raw_stats=excluded.raw_stats,
        source_updated_at=excluded.source_updated_at,
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  update public.league_week_states
  set status='live',updated_at=now()
  where season_id=v_season and week=p_week and status='scheduled';

  return jsonb_build_object('ok',true,'scores_upserted',v_count);
end;
$$;

grant execute on function public.league_commish_upsert_weekly_scores(text,text,integer,jsonb)
to anon,authenticated;

create or replace function public.league_commish_finalize_week(
  p_room_code text,
  p_commish_pin text,
  p_week integer
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
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  update public.league_week_states
  set status='final',finalized_at=now(),updated_at=now()
  where season_id=v_season and week=p_week;

  return jsonb_build_object('ok',true,'week',p_week,'status','final');
end;
$$;

grant execute on function public.league_commish_finalize_week(text,text,integer)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Live matchup score view.
-- ---------------------------------------------------------------------------
create or replace view public.league_matchup_live_scores as
select
  sc.id as schedule_id,
  sc.season_id,
  sc.room_id,
  sc.week,
  sc.matchup_no,
  sc.phase,
  sc.home_team_id,
  sc.away_team_id,
  ws.status as week_status,
  coalesce((
    select sum(coalesce(ps.fantasy_points,0))
    from public.league_lineups l
    left join public.league_weekly_player_scores ps
      on ps.season_id=l.season_id and ps.week=l.week and ps.player_key=l.player_key
    where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.home_team_id
  ),0)::numeric(10,2) as home_score,
  coalesce((
    select sum(coalesce(ps.fantasy_points,0))
    from public.league_lineups l
    left join public.league_weekly_player_scores ps
      on ps.season_id=l.season_id and ps.week=l.week and ps.player_key=l.player_key
    where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.away_team_id
  ),0)::numeric(10,2) as away_score,
  (select count(*) from public.league_lineups l where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.home_team_id)::integer as home_starters,
  (select count(*) from public.league_lineups l where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.away_team_id)::integer as away_starters,
  (select count(*) from public.league_lineups l join public.league_weekly_player_scores ps on ps.season_id=l.season_id and ps.week=l.week and ps.player_key=l.player_key where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.home_team_id and ps.game_final=false)::integer as home_players_remaining,
  (select count(*) from public.league_lineups l join public.league_weekly_player_scores ps on ps.season_id=l.season_id and ps.week=l.week and ps.player_key=l.player_key where l.season_id=sc.season_id and l.week=sc.week and l.team_id=sc.away_team_id and ps.game_final=false)::integer as away_players_remaining
from public.league_schedule sc
left join public.league_week_states ws
  on ws.season_id=sc.season_id and ws.week=sc.week;

grant select on public.league_matchup_live_scores to anon,authenticated;

create or replace view public.league_shadow_standings as
with final_matchups as (
  select m.*
  from public.league_matchup_live_scores m
  where m.week_status='final' and m.phase='regular'
),
team_results as (
  select season_id,room_id,home_team_id as team_id,
    case when home_score>away_score then 1 else 0 end as wins,
    case when home_score<away_score then 1 else 0 end as losses,
    case when home_score=away_score then 1 else 0 end as ties,
    home_score as points_for,away_score as points_against
  from final_matchups
  union all
  select season_id,room_id,away_team_id as team_id,
    case when away_score>home_score then 1 else 0 end,
    case when away_score<home_score then 1 else 0 end,
    case when away_score=home_score then 1 else 0 end,
    away_score,home_score
  from final_matchups
)
select
  s.id as season_id,
  s.room_id,
  t.id as team_id,
  t.name as team_name,
  coalesce(sum(r.wins),0)::integer as wins,
  coalesce(sum(r.losses),0)::integer as losses,
  coalesce(sum(r.ties),0)::integer as ties,
  case
    when coalesce(sum(r.wins+r.losses+r.ties),0)=0 then 0
    else round((sum(r.wins)+0.5*sum(r.ties))::numeric/sum(r.wins+r.losses+r.ties),3)
  end as win_pct,
  round(coalesce(sum(r.points_for),0),2) as points_for,
  round(coalesce(sum(r.points_against),0),2) as points_against
from public.league_seasons s
join public.teams t on t.room_id=s.room_id
left join team_results r on r.season_id=s.id and r.team_id=t.id
where s.is_current
group by s.id,s.room_id,t.id,t.name;

grant select on public.league_shadow_standings to anon,authenticated;

-- ---------------------------------------------------------------------------
-- Commissioner-only reconciliation.
-- ---------------------------------------------------------------------------
create or replace function public.league_get_reconciliation_matchups(
  p_room_code text,
  p_commish_pin text,
  p_week integer
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_result jsonb;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null or not public._valid_commish_pin(v_room,p_commish_pin) then
    raise exception 'Commissioner authorization failed.';
  end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'schedule_id',m.schedule_id,
    'week',m.week,
    'matchup_no',m.matchup_no,
    'home_team_id',m.home_team_id,
    'away_team_id',m.away_team_id,
    'glsk_home_score',m.home_score,
    'glsk_away_score',m.away_score,
    'yahoo_home_score',r.yahoo_home_score,
    'yahoo_away_score',r.yahoo_away_score,
    'note',r.note,
    'checked_at',r.checked_at
  ) order by m.matchup_no),'[]'::jsonb)
  into v_result
  from public.league_matchup_live_scores m
  left join public.league_reconciliation_matchups r
    on r.schedule_id=m.schedule_id
  where m.season_id=v_season and m.week=p_week;

  return v_result;
end;
$$;

grant execute on function public.league_get_reconciliation_matchups(text,text,integer)
to anon,authenticated;

create or replace function public.league_commish_save_reconciliation_matchups(
  p_room_code text,
  p_commish_pin text,
  p_week integer,
  p_rows jsonb
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
  v_schedule bigint;
  v_count integer:=0;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null or not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select id into v_season from public.league_seasons
  where room_id=v_room and is_current order by season_year desc limit 1;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    v_schedule=(v_row->>'schedule_id')::bigint;
    if not exists(select 1 from public.league_schedule where id=v_schedule and season_id=v_season and week=p_week) then
      return jsonb_build_object('ok',false,'error','Invalid matchup.');
    end if;

    insert into public.league_reconciliation_matchups(
      season_id,room_id,week,schedule_id,yahoo_home_score,yahoo_away_score,note,checked_at,updated_at
    )
    values(
      v_season,v_room,p_week,v_schedule,
      nullif(v_row->>'yahoo_home_score','')::numeric,
      nullif(v_row->>'yahoo_away_score','')::numeric,
      v_row->>'note',now(),now()
    )
    on conflict(season_id,week,schedule_id) do update
    set yahoo_home_score=excluded.yahoo_home_score,
        yahoo_away_score=excluded.yahoo_away_score,
        note=excluded.note,
        checked_at=now(),
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'rows_saved',v_count);
end;
$$;

grant execute on function public.league_commish_save_reconciliation_matchups(text,text,integer,jsonb)
to anon,authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_lineups') then
    alter publication supabase_realtime add table public.league_lineups;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_weekly_player_scores') then
    alter publication supabase_realtime add table public.league_weekly_player_scores;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_schedule') then
    alter publication supabase_realtime add table public.league_schedule;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_week_states') then
    alter publication supabase_realtime add table public.league_week_states;
  end if;
end $$;

commit;

select
  g.current_week,
  g.scoring_source,
  (select count(*) from public.league_lineup_slots ls where ls.season_id=g.season_id and ls.active) as configured_starting_slots,
  (select count(*) from public.league_schedule sc where sc.season_id=g.season_id and sc.week=g.current_week) as current_week_matchups
from public.league_game_settings g
join public.rooms r on r.id=g.room_id
where r.code='GLSK26';
