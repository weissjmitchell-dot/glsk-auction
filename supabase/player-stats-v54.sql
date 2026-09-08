-- GREAT LAKE STATE KEEPERS — PLAYER STATS FOUNDATION
-- League Office v5.4
--
-- Adds a season-by-season player stats table for League Office roster/trade cards.
-- This is the storage/display foundation for live Yahoo stats once Yahoo Fantasy API
-- approval/OAuth is connected.
--
-- Safe to run on the current GLSK database.
-- Does not alter rosters, contracts, drafts, trades, bid balances, or transactions.
--
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_player_stats (
  id bigserial primary key,
  room_id uuid not null references public.rooms(id) on delete cascade,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  player_key text not null,
  player_name text not null,
  nfl_team text,
  position text,
  games_played integer not null default 0,
  fantasy_points numeric(10,2),
  season_rank integer,
  position_rank integer,
  passing_yards integer,
  passing_td integer,
  interceptions integer,
  rushing_attempts integer,
  rushing_yards integer,
  rushing_td integer,
  receptions integer,
  receiving_yards integer,
  receiving_td integer,
  fumbles_lost integer,
  stats_payload jsonb not null default '{}'::jsonb,
  source text not null default 'pending_yahoo',
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(season_id,player_key)
);

create index if not exists league_player_stats_room_season_idx
  on public.league_player_stats(room_id,season_id,position);

alter table public.league_player_stats enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_player_stats'
      and policyname='public read player stats'
  ) then
    create policy "public read player stats"
    on public.league_player_stats
    for select
    to anon,authenticated
    using(true);
  end if;
end $$;

grant select on public.league_player_stats to anon,authenticated;
revoke insert,update,delete on public.league_player_stats from anon,authenticated;

-- Create one placeholder stats row for every current active roster player.
insert into public.league_player_stats(
  room_id,season_id,player_key,player_name,nfl_team,position,source
)
select
  re.room_id,
  s.id,
  re.player_key,
  re.player_name,
  re.nfl_team,
  re.position,
  'pending_yahoo'
from public.league_roster_entries re
join public.league_seasons s
  on s.room_id=re.room_id and s.is_current
join public.rooms r on r.id=re.room_id
where r.code='GLSK26'
  and re.active=true
on conflict(season_id,player_key) do update
set player_name=excluded.player_name,
    nfl_team=excluded.nfl_team,
    position=excluded.position,
    updated_at=now();

-- Future Yahoo/OAuth importer can securely upsert normalized stats through this RPC.
create or replace function public.league_commish_upsert_player_stats(
  p_room_code text,
  p_commish_pin text,
  p_stats jsonb
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

  for v_row in select * from jsonb_array_elements(coalesce(p_stats,'[]'::jsonb))
  loop
    v_key:=coalesce(
      nullif(v_row->>'player_key',''),
      public._league_player_key(v_row->>'player_name',v_row->>'nfl_team',v_row->>'position')
    );

    insert into public.league_player_stats(
      room_id,season_id,player_key,player_name,nfl_team,position,
      games_played,fantasy_points,season_rank,position_rank,
      passing_yards,passing_td,interceptions,
      rushing_attempts,rushing_yards,rushing_td,
      receptions,receiving_yards,receiving_td,fumbles_lost,
      stats_payload,source,source_updated_at,updated_at
    )
    values(
      v_room,v_season,v_key,
      coalesce(v_row->>'player_name',v_key),
      v_row->>'nfl_team',
      upper(v_row->>'position'),
      coalesce(nullif(v_row->>'games_played','')::integer,0),
      nullif(v_row->>'fantasy_points','')::numeric,
      nullif(v_row->>'season_rank','')::integer,
      nullif(v_row->>'position_rank','')::integer,
      nullif(v_row->>'passing_yards','')::integer,
      nullif(v_row->>'passing_td','')::integer,
      nullif(v_row->>'interceptions','')::integer,
      nullif(v_row->>'rushing_attempts','')::integer,
      nullif(v_row->>'rushing_yards','')::integer,
      nullif(v_row->>'rushing_td','')::integer,
      nullif(v_row->>'receptions','')::integer,
      nullif(v_row->>'receiving_yards','')::integer,
      nullif(v_row->>'receiving_td','')::integer,
      nullif(v_row->>'fumbles_lost','')::integer,
      v_row,
      coalesce(nullif(v_row->>'source',''),'yahoo'),
      coalesce(nullif(v_row->>'source_updated_at','')::timestamptz,now()),
      now()
    )
    on conflict(season_id,player_key) do update
    set player_name=excluded.player_name,
        nfl_team=excluded.nfl_team,
        position=excluded.position,
        games_played=excluded.games_played,
        fantasy_points=excluded.fantasy_points,
        season_rank=excluded.season_rank,
        position_rank=excluded.position_rank,
        passing_yards=excluded.passing_yards,
        passing_td=excluded.passing_td,
        interceptions=excluded.interceptions,
        rushing_attempts=excluded.rushing_attempts,
        rushing_yards=excluded.rushing_yards,
        rushing_td=excluded.rushing_td,
        receptions=excluded.receptions,
        receiving_yards=excluded.receiving_yards,
        receiving_td=excluded.receiving_td,
        fumbles_lost=excluded.fumbles_lost,
        stats_payload=excluded.stats_payload,
        source=excluded.source,
        source_updated_at=excluded.source_updated_at,
        updated_at=now();

    v_count:=v_count+1;
  end loop;

  return jsonb_build_object('ok',true,'rows_upserted',v_count);
end;
$$;

grant execute on function public.league_commish_upsert_player_stats(text,text,jsonb)
to anon,authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_player_stats'
  ) then
    alter publication supabase_realtime add table public.league_player_stats;
  end if;
end $$;

commit;

select
  count(*) as roster_stat_rows,
  count(*) filter(where source='pending_yahoo') as awaiting_live_stats
from public.league_player_stats ps
join public.rooms r on r.id=ps.room_id
where r.code='GLSK26';
