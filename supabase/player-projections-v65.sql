-- GREAT LAKE STATE KEEPERS — PLAYER PROJECTIONS FOUNDATION
-- League Office v6.5
--
-- Adds provider-ready weekly player projections for the Lineup page:
--   • individual Week projections
--   • Weeks 1–4 aggregates
--   • Remaining Games aggregates
--   • Season Total aggregates
--   • projected fantasy points / min / max / position rank
--   • passing, rushing and receiving projection fields
--   • opponent, kickoff and bye-week metadata
--
-- This does NOT invent projections. Rows remain empty until MySportsFeeds
-- (or another approved provider) is connected.
--
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_player_projections (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  week integer not null check(week between 1 and 25),
  player_key text not null,
  player_name text not null,
  nfl_team text,
  position text,

  opponent_team text,
  is_home boolean,
  game_start_at timestamptz,
  bye_week integer,

  projected_fantasy_points numeric(10,2),
  projected_max numeric(10,2),
  projected_min numeric(10,2),
  projected_position_rank integer,

  passing_yards numeric(10,2),
  passing_td numeric(10,2),
  interceptions numeric(10,2),

  rushing_attempts numeric(10,2),
  rushing_yards numeric(10,2),
  rushing_td numeric(10,2),

  targets numeric(10,2),
  receptions numeric(10,2),
  receiving_yards numeric(10,2),
  receiving_td numeric(10,2),

  return_yards numeric(10,2),
  return_td numeric(10,2),
  fumbles_lost numeric(10,2),

  raw_projection jsonb not null default '{}'::jsonb,
  source text not null default 'pending',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique(season_id,week,player_key)
);

create index if not exists league_player_projections_week_idx
  on public.league_player_projections(season_id,week,position);

create index if not exists league_player_projections_player_idx
  on public.league_player_projections(season_id,player_key,week);

alter table public.league_player_projections enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_player_projections'
      and policyname='public read player projections'
  ) then
    create policy "public read player projections"
    on public.league_player_projections
    for select
    to anon,authenticated
    using(true);
  end if;
end $$;

grant select on public.league_player_projections to anon,authenticated;
revoke insert,update,delete on public.league_player_projections from anon,authenticated;

-- Secure importer endpoint for the future live projection provider.
create or replace function public.league_commish_upsert_player_projections(
  p_room_code text,
  p_commish_pin text,
  p_projections jsonb
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
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  if v_season is null then
    return jsonb_build_object('ok',false,'error','Current season not found.');
  end if;

  for v_row in select * from jsonb_array_elements(coalesce(p_projections,'[]'::jsonb))
  loop
    if nullif(v_row->>'week','') is null then
      return jsonb_build_object('ok',false,'error','Projection row is missing week.');
    end if;

    v_key:=coalesce(
      nullif(v_row->>'player_key',''),
      public._league_player_key(v_row->>'player_name',v_row->>'nfl_team',v_row->>'position')
    );

    insert into public.league_player_projections(
      season_id,room_id,week,player_key,player_name,nfl_team,position,
      opponent_team,is_home,game_start_at,bye_week,
      projected_fantasy_points,projected_max,projected_min,projected_position_rank,
      passing_yards,passing_td,interceptions,
      rushing_attempts,rushing_yards,rushing_td,
      targets,receptions,receiving_yards,receiving_td,
      return_yards,return_td,fumbles_lost,
      raw_projection,source,source_updated_at,updated_at
    )
    values(
      v_season,v_room,(v_row->>'week')::integer,v_key,
      coalesce(v_row->>'player_name',v_key),
      v_row->>'nfl_team',
      upper(v_row->>'position'),
      v_row->>'opponent_team',
      nullif(v_row->>'is_home','')::boolean,
      nullif(v_row->>'game_start_at','')::timestamptz,
      nullif(v_row->>'bye_week','')::integer,

      nullif(v_row->>'projected_fantasy_points','')::numeric,
      nullif(v_row->>'projected_max','')::numeric,
      nullif(v_row->>'projected_min','')::numeric,
      nullif(v_row->>'projected_position_rank','')::integer,

      nullif(v_row->>'passing_yards','')::numeric,
      nullif(v_row->>'passing_td','')::numeric,
      nullif(v_row->>'interceptions','')::numeric,

      nullif(v_row->>'rushing_attempts','')::numeric,
      nullif(v_row->>'rushing_yards','')::numeric,
      nullif(v_row->>'rushing_td','')::numeric,

      nullif(v_row->>'targets','')::numeric,
      nullif(v_row->>'receptions','')::numeric,
      nullif(v_row->>'receiving_yards','')::numeric,
      nullif(v_row->>'receiving_td','')::numeric,

      nullif(v_row->>'return_yards','')::numeric,
      nullif(v_row->>'return_td','')::numeric,
      nullif(v_row->>'fumbles_lost','')::numeric,

      coalesce(v_row->'raw_projection','{}'::jsonb),
      coalesce(nullif(v_row->>'source',''),'external'),
      coalesce(nullif(v_row->>'source_updated_at','')::timestamptz,now()),
      now()
    )
    on conflict(season_id,week,player_key) do update
    set player_name=excluded.player_name,
        nfl_team=excluded.nfl_team,
        position=excluded.position,
        opponent_team=excluded.opponent_team,
        is_home=excluded.is_home,
        game_start_at=excluded.game_start_at,
        bye_week=excluded.bye_week,
        projected_fantasy_points=excluded.projected_fantasy_points,
        projected_max=excluded.projected_max,
        projected_min=excluded.projected_min,
        projected_position_rank=excluded.projected_position_rank,
        passing_yards=excluded.passing_yards,
        passing_td=excluded.passing_td,
        interceptions=excluded.interceptions,
        rushing_attempts=excluded.rushing_attempts,
        rushing_yards=excluded.rushing_yards,
        rushing_td=excluded.rushing_td,
        targets=excluded.targets,
        receptions=excluded.receptions,
        receiving_yards=excluded.receiving_yards,
        receiving_td=excluded.receiving_td,
        return_yards=excluded.return_yards,
        return_td=excluded.return_td,
        fumbles_lost=excluded.fumbles_lost,
        raw_projection=excluded.raw_projection,
        source=excluded.source,
        source_updated_at=excluded.source_updated_at,
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'rows_upserted',v_count);
end;
$$;

grant execute on function public.league_commish_upsert_player_projections(text,text,jsonb)
to anon,authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_player_projections'
  ) then
    alter publication supabase_realtime add table public.league_player_projections;
  end if;
end $$;

commit;

select
  count(*) as projection_rows,
  count(distinct week) as projection_weeks
from public.league_player_projections p
join public.rooms r on r.id=p.room_id
where r.code='GLSK26';
