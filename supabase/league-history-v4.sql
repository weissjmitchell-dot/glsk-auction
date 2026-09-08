
-- GREAT LAKE STATE KEEPERS — LEAGUE HISTORY / RECORDS FOUNDATION
-- League Office v4
--
-- Creates the permanent 2011–2025 historical archive, franchise identity layer,
-- sortable all-time standings source, Yahoo import staging functions, and
-- commissioner franchise-mapping tools.
--
-- This migration DOES NOT invent or alter historical results. It seeds the
-- 15 completed season shells (2011–2025) as pending import.
--
-- Safe to run on the existing GLSK database.
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_franchises (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  display_name text not null,
  current_team_id uuid references public.teams(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists league_franchises_current_team_uq
  on public.league_franchises(room_id,current_team_id)
  where current_team_id is not null;

create index if not exists league_franchises_room_idx
  on public.league_franchises(room_id,display_name);

create table if not exists public.league_franchise_identities (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  franchise_id uuid not null references public.league_franchises(id) on delete cascade,
  provider text not null default 'yahoo',
  provider_key text not null,
  created_at timestamptz not null default now(),
  unique(room_id,provider,provider_key)
);

create table if not exists public.league_history_seasons (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_year integer not null,
  yahoo_game_key text,
  yahoo_league_key text,
  league_name text,
  status text not null default 'pending',
  imported_at timestamptz,
  source text not null default 'yahoo',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id,season_year)
);

create table if not exists public.league_history_team_seasons (
  id bigserial primary key,
  history_season_id uuid not null references public.league_history_seasons(id) on delete cascade,
  franchise_id uuid references public.league_franchises(id) on delete set null,
  yahoo_team_key text not null,
  yahoo_team_id text,
  team_name text not null,
  manager_guid text,
  manager_name text,
  final_rank integer,
  regular_wins integer not null default 0,
  regular_losses integer not null default 0,
  regular_ties integer not null default 0,
  regular_points_for numeric(12,2),
  playoff_wins integer not null default 0,
  playoff_losses integer not null default 0,
  playoff_ties integer not null default 0,
  playoff_appearance boolean not null default false,
  title_game_appearance boolean not null default false,
  is_champion boolean not null default false,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(history_season_id,yahoo_team_key)
);

create index if not exists history_team_seasons_franchise_idx
  on public.league_history_team_seasons(franchise_id,history_season_id);

create index if not exists history_team_seasons_manager_idx
  on public.league_history_team_seasons(manager_guid)
  where manager_guid is not null;

create table if not exists public.league_history_matchups (
  id bigserial primary key,
  history_season_id uuid not null references public.league_history_seasons(id) on delete cascade,
  week integer not null,
  is_playoffs boolean not null default false,
  is_consolation boolean not null default false,
  status text,
  team1_key text,
  team1_name text,
  team1_score numeric(12,2),
  team2_key text,
  team2_name text,
  team2_score numeric(12,2),
  winner_team_key text,
  is_tie boolean not null default false,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists league_history_matchups_uq
  on public.league_history_matchups(
    history_season_id,
    week,
    coalesce(team1_key,''),
    coalesce(team2_key,'')
  );

create table if not exists public.league_history_import_runs (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_year integer,
  provider text not null default 'yahoo',
  status text not null,
  message text,
  rows_imported integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.league_franchises enable row level security;
alter table public.league_franchise_identities enable row level security;
alter table public.league_history_seasons enable row level security;
alter table public.league_history_team_seasons enable row level security;
alter table public.league_history_matchups enable row level security;
alter table public.league_history_import_runs enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_franchises' and policyname='public read league franchises') then
    create policy "public read league franchises" on public.league_franchises for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_franchise_identities' and policyname='public read franchise identities') then
    create policy "public read franchise identities" on public.league_franchise_identities for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_history_seasons' and policyname='public read history seasons') then
    create policy "public read history seasons" on public.league_history_seasons for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_history_team_seasons' and policyname='public read history team seasons') then
    create policy "public read history team seasons" on public.league_history_team_seasons for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_history_matchups' and policyname='public read history matchups') then
    create policy "public read history matchups" on public.league_history_matchups for select to anon,authenticated using(true);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_history_import_runs' and policyname='public read history import status') then
    create policy "public read history import status" on public.league_history_import_runs for select to anon,authenticated using(true);
  end if;
end $$;

grant select on public.league_franchises,public.league_franchise_identities,
  public.league_history_seasons,public.league_history_team_seasons,
  public.league_history_matchups,public.league_history_import_runs
to anon,authenticated;

revoke insert,update,delete on public.league_franchises,public.league_franchise_identities,
  public.league_history_seasons,public.league_history_team_seasons,
  public.league_history_matchups,public.league_history_import_runs
from anon,authenticated;

-- Seed one current franchise record per current GLSK team.
insert into public.league_franchises(room_id,display_name,current_team_id,active)
select t.room_id,t.name,t.id,true
from public.teams t
join public.rooms r on r.id=t.room_id
where r.code='GLSK26'
on conflict(room_id,current_team_id) where current_team_id is not null
do update set display_name=excluded.display_name,active=true,updated_at=now();

-- Seed the 15 completed seasons without inventing any results.
insert into public.league_history_seasons(room_id,season_year,status,source)
select r.id,y,'pending','yahoo'
from public.rooms r
cross join generate_series(2011,2025) y
where r.code='GLSK26'
on conflict(room_id,season_year) do nothing;

create or replace view public.league_history_all_time as
select
  f.id as franchise_id,
  f.room_id,
  f.display_name,
  f.active,
  count(distinct ts.history_season_id)::integer as seasons_played,
  coalesce(sum(ts.regular_wins),0)::integer as regular_wins,
  coalesce(sum(ts.regular_losses),0)::integer as regular_losses,
  coalesce(sum(ts.regular_ties),0)::integer as regular_ties,
  case
    when coalesce(sum(ts.regular_wins+ts.regular_losses+ts.regular_ties),0)=0 then null
    else round(
      100.0*(sum(ts.regular_wins)+0.5*sum(ts.regular_ties))
      /sum(ts.regular_wins+ts.regular_losses+ts.regular_ties),1
    )
  end as regular_win_pct,
  coalesce(sum(ts.playoff_wins),0)::integer as playoff_wins,
  coalesce(sum(ts.playoff_losses),0)::integer as playoff_losses,
  coalesce(sum(ts.playoff_ties),0)::integer as playoff_ties,
  case
    when coalesce(sum(ts.playoff_wins+ts.playoff_losses+ts.playoff_ties),0)=0 then null
    else round(
      100.0*(sum(ts.playoff_wins)+0.5*sum(ts.playoff_ties))
      /sum(ts.playoff_wins+ts.playoff_losses+ts.playoff_ties),1
    )
  end as playoff_win_pct,
  count(*) filter(where ts.playoff_appearance)::integer as playoff_appearances,
  count(*) filter(where ts.title_game_appearance)::integer as title_game_appearances,
  count(*) filter(where ts.is_champion)::integer as championships,
  round(coalesce(sum(ts.regular_points_for),0),2) as regular_points_for
from public.league_franchises f
left join public.league_history_team_seasons ts on ts.franchise_id=f.id
left join public.league_history_seasons hs
  on hs.id=ts.history_season_id and hs.status='imported'
where hs.id is not null or not exists(
  select 1 from public.league_history_team_seasons x where x.franchise_id=f.id
)
group by f.id,f.room_id,f.display_name,f.active;

grant select on public.league_history_all_time to anon,authenticated;

-- Import normalized Yahoo season data. The Yahoo Edge Function will call this
-- after it has fetched and normalized standings + weekly matchup data.
create or replace function public.league_commish_import_history_season(
  p_room_code text,
  p_commish_pin text,
  p_season_year integer,
  p_yahoo_game_key text,
  p_yahoo_league_key text,
  p_league_name text,
  p_teams jsonb,
  p_matchups jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_history_season uuid;
  v_team jsonb;
  v_match jsonb;
  v_franchise uuid;
  v_manager_guid text;
  v_team_name text;
  v_rows integer:=0;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  if p_season_year<2011 or p_season_year>2025 then
    return jsonb_build_object('ok',false,'error','Historical import year must be between 2011 and 2025.');
  end if;

  insert into public.league_history_seasons(
    room_id,season_year,yahoo_game_key,yahoo_league_key,league_name,status,source,updated_at
  )
  values(
    v_room,p_season_year,p_yahoo_game_key,p_yahoo_league_key,p_league_name,'importing','yahoo',now()
  )
  on conflict(room_id,season_year) do update
  set yahoo_game_key=excluded.yahoo_game_key,
      yahoo_league_key=excluded.yahoo_league_key,
      league_name=excluded.league_name,
      status='importing',
      updated_at=now()
  returning id into v_history_season;

  delete from public.league_history_matchups where history_season_id=v_history_season;
  delete from public.league_history_team_seasons where history_season_id=v_history_season;

  for v_team in select * from jsonb_array_elements(coalesce(p_teams,'[]'::jsonb))
  loop
    v_manager_guid:=nullif(v_team->>'manager_guid','');
    v_team_name:=coalesce(nullif(v_team->>'team_name',''),'Unknown Team');
    v_franchise:=null;

    if v_manager_guid is not null then
      select fi.franchise_id into v_franchise
      from public.league_franchise_identities fi
      where fi.room_id=v_room
        and fi.provider='yahoo'
        and fi.provider_key=v_manager_guid
      limit 1;
    end if;

    if v_franchise is null then
      select f.id into v_franchise
      from public.league_franchises f
      where f.room_id=v_room
        and lower(trim(f.display_name))=lower(trim(v_team_name))
      limit 1;
    end if;

    insert into public.league_history_team_seasons(
      history_season_id,franchise_id,yahoo_team_key,yahoo_team_id,team_name,
      manager_guid,manager_name,final_rank,
      regular_wins,regular_losses,regular_ties,regular_points_for,
      playoff_wins,playoff_losses,playoff_ties,
      playoff_appearance,title_game_appearance,is_champion,source_payload
    )
    values(
      v_history_season,v_franchise,coalesce(v_team->>'yahoo_team_key',''),
      v_team->>'yahoo_team_id',v_team_name,v_manager_guid,v_team->>'manager_name',
      nullif(v_team->>'final_rank','')::integer,
      coalesce((v_team->>'regular_wins')::integer,0),
      coalesce((v_team->>'regular_losses')::integer,0),
      coalesce((v_team->>'regular_ties')::integer,0),
      nullif(v_team->>'regular_points_for','')::numeric,
      coalesce((v_team->>'playoff_wins')::integer,0),
      coalesce((v_team->>'playoff_losses')::integer,0),
      coalesce((v_team->>'playoff_ties')::integer,0),
      coalesce((v_team->>'playoff_appearance')::boolean,false),
      coalesce((v_team->>'title_game_appearance')::boolean,false),
      coalesce((v_team->>'is_champion')::boolean,false),
      v_team
    );

    if v_manager_guid is not null and v_franchise is not null then
      insert into public.league_franchise_identities(room_id,franchise_id,provider,provider_key)
      values(v_room,v_franchise,'yahoo',v_manager_guid)
      on conflict(room_id,provider,provider_key) do update
      set franchise_id=excluded.franchise_id;
    end if;

    v_rows:=v_rows+1;
  end loop;

  for v_match in select * from jsonb_array_elements(coalesce(p_matchups,'[]'::jsonb))
  loop
    insert into public.league_history_matchups(
      history_season_id,week,is_playoffs,is_consolation,status,
      team1_key,team1_name,team1_score,team2_key,team2_name,team2_score,
      winner_team_key,is_tie,source_payload
    )
    values(
      v_history_season,
      coalesce((v_match->>'week')::integer,0),
      coalesce((v_match->>'is_playoffs')::boolean,false),
      coalesce((v_match->>'is_consolation')::boolean,false),
      v_match->>'status',
      v_match->>'team1_key',v_match->>'team1_name',nullif(v_match->>'team1_score','')::numeric,
      v_match->>'team2_key',v_match->>'team2_name',nullif(v_match->>'team2_score','')::numeric,
      v_match->>'winner_team_key',
      coalesce((v_match->>'is_tie')::boolean,false),
      v_match
    );
  end loop;

  update public.league_history_seasons
  set status='imported',imported_at=now(),updated_at=now()
  where id=v_history_season;

  insert into public.league_history_import_runs(
    room_id,season_year,provider,status,message,rows_imported,completed_at
  )
  values(
    v_room,p_season_year,'yahoo','success',
    'Historical Yahoo season imported.',v_rows,now()
  );

  return jsonb_build_object(
    'ok',true,
    'season_year',p_season_year,
    'teams_imported',v_rows
  );
end;
$$;

grant execute on function public.league_commish_import_history_season(
  text,text,integer,text,text,text,jsonb,jsonb
) to anon,authenticated;

-- Map an imported historical Yahoo team to a franchise. When a Yahoo manager
-- GUID exists, the mapping automatically propagates to all imported seasons.
create or replace function public.league_commish_map_history_team(
  p_room_code text,
  p_commish_pin text,
  p_history_team_season_id bigint,
  p_franchise_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_guid text;
  v_row public.league_history_team_seasons%rowtype;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select ts.* into v_row
  from public.league_history_team_seasons ts
  join public.league_history_seasons hs on hs.id=ts.history_season_id
  where ts.id=p_history_team_season_id and hs.room_id=v_room;

  if v_row.id is null then return jsonb_build_object('ok',false,'error','Historical team row not found.'); end if;

  if not exists(select 1 from public.league_franchises f where f.id=p_franchise_id and f.room_id=v_room) then
    return jsonb_build_object('ok',false,'error','Franchise not found.');
  end if;

  update public.league_history_team_seasons
  set franchise_id=p_franchise_id,updated_at=now()
  where id=p_history_team_season_id;

  v_guid:=nullif(v_row.manager_guid,'');

  if v_guid is not null then
    insert into public.league_franchise_identities(room_id,franchise_id,provider,provider_key)
    values(v_room,p_franchise_id,'yahoo',v_guid)
    on conflict(room_id,provider,provider_key) do update
    set franchise_id=excluded.franchise_id;

    update public.league_history_team_seasons ts
    set franchise_id=p_franchise_id,updated_at=now()
    from public.league_history_seasons hs
    where hs.id=ts.history_season_id
      and hs.room_id=v_room
      and ts.manager_guid=v_guid;
  end if;

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.league_commish_map_history_team(text,text,bigint,uuid)
to anon,authenticated;

create or replace function public.league_commish_create_history_franchise(
  p_room_code text,
  p_commish_pin text,
  p_display_name text
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room uuid;
  v_id uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then return jsonb_build_object('ok',false,'error','Room not found.'); end if;
  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;
  if nullif(trim(p_display_name),'') is null then
    return jsonb_build_object('ok',false,'error','Franchise name is required.');
  end if;

  insert into public.league_franchises(room_id,display_name,active)
  values(v_room,trim(p_display_name),false)
  returning id into v_id;

  return jsonb_build_object('ok',true,'franchise_id',v_id);
end;
$$;

grant execute on function public.league_commish_create_history_franchise(text,text,text)
to anon,authenticated;

-- Realtime is helpful once an import or franchise mapping completes.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_history_seasons') then
    alter publication supabase_realtime add table public.league_history_seasons;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='league_history_team_seasons') then
    alter publication supabase_realtime add table public.league_history_team_seasons;
  end if;
end $$;

commit;

select
  count(*) filter(where status='imported') as imported_seasons,
  count(*) filter(where status='pending') as pending_seasons,
  min(season_year) as first_season,
  max(season_year) as last_completed_season
from public.league_history_seasons hs
join public.rooms r on r.id=hs.room_id
where r.code='GLSK26';
