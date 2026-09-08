-- GREAT LAKE STATE KEEPERS — MESSAGE BOARD
-- League Office v6.7
--
-- Adds a league discussion board:
--   • owner-created discussion threads
--   • replies
--   • team attribution
--   • realtime updates
--   • commissioner pin / lock / archive controls
--
-- No personal contact information is stored.
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_message_threads (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  author_team_id uuid not null references public.teams(id) on delete cascade,
  title text not null check(char_length(title) between 3 and 120),
  body text not null check(char_length(body) between 1 and 5000),
  pinned boolean not null default false,
  status text not null default 'active'
    check(status in ('active','locked','archived')),
  reply_count integer not null default 0,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_message_threads_season_activity_idx
  on public.league_message_threads(season_id,pinned,last_activity_at desc);

create table if not exists public.league_message_posts (
  id bigserial primary key,
  thread_id bigint not null references public.league_message_threads(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  author_team_id uuid not null references public.teams(id) on delete cascade,
  body text not null check(char_length(body) between 1 and 5000),
  status text not null default 'active'
    check(status in ('active','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists league_message_posts_thread_idx
  on public.league_message_posts(thread_id,created_at);

alter table public.league_message_threads enable row level security;
alter table public.league_message_posts enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_message_threads'
      and policyname='public read active message threads'
  ) then
    create policy "public read active message threads"
    on public.league_message_threads
    for select
    to anon,authenticated
    using(status <> 'archived');
  end if;

  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_message_posts'
      and policyname='public read active message posts'
  ) then
    create policy "public read active message posts"
    on public.league_message_posts
    for select
    to anon,authenticated
    using(status='active');
  end if;
end $$;

grant select on public.league_message_threads,public.league_message_posts
to anon,authenticated;

revoke insert,update,delete on public.league_message_threads,public.league_message_posts
from anon,authenticated;

-- Owner creates a new discussion.
create or replace function public.league_owner_create_message_thread(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_title text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_season uuid;
  v_id bigint;
  v_title text:=btrim(coalesce(p_title,''));
  v_body text:=btrim(coalesce(p_body,''));
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

  if char_length(v_title)<3 or char_length(v_title)>120 then
    return jsonb_build_object('ok',false,'error','Discussion title must be 3–120 characters.');
  end if;

  if char_length(v_body)<1 or char_length(v_body)>5000 then
    return jsonb_build_object('ok',false,'error','Discussion message must be 1–5000 characters.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  insert into public.league_message_threads(
    room_id,season_id,author_team_id,title,body,last_activity_at
  )
  values(v_room,v_season,p_team_id,v_title,v_body,now())
  returning id into v_id;

  return jsonb_build_object('ok',true,'thread_id',v_id);
end;
$$;

grant execute on function public.league_owner_create_message_thread(text,uuid,text,text,text)
to anon,authenticated;

-- Owner replies to an active discussion.
create or replace function public.league_owner_reply_message_thread(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_thread_id bigint,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_thread public.league_message_threads%rowtype;
  v_body text:=btrim(coalesce(p_body,''));
  v_id bigint;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_team_pin(p_team_id,p_pin) then
    return jsonb_build_object('ok',false,'error','Team PIN is invalid.');
  end if;

  if char_length(v_body)<1 or char_length(v_body)>5000 then
    return jsonb_build_object('ok',false,'error','Reply must be 1–5000 characters.');
  end if;

  select * into v_thread
  from public.league_message_threads
  where id=p_thread_id and room_id=v_room;

  if v_thread.id is null then
    return jsonb_build_object('ok',false,'error','Discussion not found.');
  end if;

  if v_thread.status='locked' then
    return jsonb_build_object('ok',false,'error','This discussion is locked.');
  end if;

  if v_thread.status='archived' then
    return jsonb_build_object('ok',false,'error','This discussion is archived.');
  end if;

  insert into public.league_message_posts(
    thread_id,room_id,season_id,author_team_id,body
  )
  values(
    v_thread.id,v_thread.room_id,v_thread.season_id,p_team_id,v_body
  )
  returning id into v_id;

  update public.league_message_threads
  set reply_count=reply_count+1,
      last_activity_at=now(),
      updated_at=now()
  where id=v_thread.id;

  return jsonb_build_object('ok',true,'post_id',v_id);
end;
$$;

grant execute on function public.league_owner_reply_message_thread(text,uuid,text,bigint,text)
to anon,authenticated;

-- Commissioner moderation.
create or replace function public.league_commish_message_thread_action(
  p_room_code text,
  p_commish_pin text,
  p_thread_id bigint,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  if not exists(
    select 1 from public.league_message_threads
    where id=p_thread_id and room_id=v_room
  ) then
    return jsonb_build_object('ok',false,'error','Discussion not found.');
  end if;

  case p_action
    when 'pin' then
      update public.league_message_threads
      set pinned=true,updated_at=now()
      where id=p_thread_id;
    when 'unpin' then
      update public.league_message_threads
      set pinned=false,updated_at=now()
      where id=p_thread_id;
    when 'lock' then
      update public.league_message_threads
      set status='locked',updated_at=now()
      where id=p_thread_id;
    when 'unlock' then
      update public.league_message_threads
      set status='active',updated_at=now()
      where id=p_thread_id and status='locked';
    when 'archive' then
      update public.league_message_threads
      set status='archived',pinned=false,updated_at=now()
      where id=p_thread_id;
    else
      return jsonb_build_object('ok',false,'error','Unknown message-board action.');
  end case;

  return jsonb_build_object('ok',true,'action',p_action);
end;
$$;

grant execute on function public.league_commish_message_thread_action(text,text,bigint,text)
to anon,authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_message_threads'
  ) then
    alter publication supabase_realtime add table public.league_message_threads;
  end if;

  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_message_posts'
  ) then
    alter publication supabase_realtime add table public.league_message_posts;
  end if;
end $$;

commit;

select
  count(*) as discussions,
  coalesce(sum(reply_count),0) as replies
from public.league_message_threads t
join public.rooms r on r.id=t.room_id
where r.code='GLSK26';
