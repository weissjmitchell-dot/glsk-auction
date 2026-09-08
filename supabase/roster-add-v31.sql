-- GREAT LAKE STATE KEEPERS — COMMISSIONER MANUAL ROSTER ADD
-- League Office v3.1
-- Safe migration. Adds a commissioner-only "Add Player to Roster" RPC and
-- applies two pre-Phase-3 roster corrections:
--   • Dalton Kincaid -> The Hebrew Hammer
--   • Houston Texans DST -> The Real McCoy
--
-- It also removes those players from the Phase 3 available pool and recomputes
-- the Phase 3 starting roster counts. It does not reset drafts, PINs, contracts,
-- bid balances, or prior transactions.
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create or replace function public.league_commish_add_player(
  p_room_code text,
  p_commish_pin text,
  p_team_id uuid,
  p_player_name text,
  p_nfl_team text,
  p_position text
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
  v_limit integer;
  v_team_name text;
  v_existing public.league_roster_entries%rowtype;
  v_entry_id bigint;
  v_p3_status text;
  v_row_count integer;
  v_tx uuid;
begin
  select id into v_room from public.rooms where code=p_room_code;
  if v_room is null then
    return jsonb_build_object('ok',false,'error','Room not found.');
  end if;

  if not public._valid_commish_pin(v_room,p_commish_pin) then
    return jsonb_build_object('ok',false,'error','Commissioner authorization failed.');
  end if;

  select name into v_team_name
  from public.teams
  where id=p_team_id and room_id=v_room;

  if v_team_name is null then
    return jsonb_build_object('ok',false,'error','Team not found.');
  end if;

  if nullif(trim(p_player_name),'') is null then
    return jsonb_build_object('ok',false,'error','Player name is required.');
  end if;

  if upper(trim(p_position)) not in ('QB','RB','WR','TE','K','DST') then
    return jsonb_build_object('ok',false,'error','Position must be QB, RB, WR, TE, K, or DST.');
  end if;

  select id,roster_limit into v_season,v_limit
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  if v_season is null then
    return jsonb_build_object('ok',false,'error','Current league season not found.');
  end if;

  v_key := public._league_roster_key(p_player_name);

  select * into v_existing
  from public.league_roster_entries
  where room_id=v_room and player_key=v_key
  for update;

  if v_existing.id is not null and v_existing.active and v_existing.team_id<>p_team_id then
    return jsonb_build_object(
      'ok',false,
      'error',v_existing.player_name||' is already on another team.'
    );
  end if;

  if (v_existing.id is null or not v_existing.active)
     and (select count(*) from public.league_roster_entries
          where room_id=v_room and team_id=p_team_id and active) >= v_limit then
    return jsonb_build_object('ok',false,'error',v_team_name||' already has a full roster.');
  end if;

  if v_existing.id is null then
    insert into public.league_roster_entries(
      room_id,team_id,player_key,player_name,nfl_team,position,
      acquisition_type,source_key,active
    )
    values(
      v_room,p_team_id,v_key,trim(p_player_name),upper(trim(p_nfl_team)),upper(trim(p_position)),
      'manual','manual:'||gen_random_uuid()::text,true
    )
    returning id into v_entry_id;
  else
    update public.league_roster_entries
    set team_id=p_team_id,
        player_name=trim(p_player_name),
        nfl_team=upper(trim(p_nfl_team)),
        position=upper(trim(p_position)),
        acquisition_type=case when v_existing.active then v_existing.acquisition_type else 'manual' end,
        source_key=case when v_existing.active then v_existing.source_key else 'manual:'||gen_random_uuid()::text end,
        active=true,
        updated_at=now()
    where id=v_existing.id
    returning id into v_entry_id;
  end if;

  -- If Phase 3 has not started, keep its pre-draft snapshot and player pool in sync.
  select status into v_p3_status
  from public.phase3_settings
  where room_id=v_room;

  if v_p3_status='setup' then
    update public.phase3_roster_entries
    set team_id=p_team_id,
        player_name=trim(p_player_name),
        nfl_team=upper(trim(p_nfl_team)),
        position=upper(trim(p_position)),
        source='pre_phase3',
        yahoo_pick=null,
        phase3_pick_id=null
    where room_id=v_room
      and public._league_roster_key(player_name)=v_key;

    get diagnostics v_row_count = row_count;

    if v_row_count=0 then
      insert into public.phase3_roster_entries(
        room_id,team_id,player_name,nfl_team,position,source,yahoo_pick,phase3_pick_id
      )
      values(
        v_room,p_team_id,trim(p_player_name),upper(trim(p_nfl_team)),
        upper(trim(p_position)),'pre_phase3',null,null
      );
    end if;

    delete from public.phase3_players
    where room_id=v_room
      and public._league_roster_key(name)=v_key;

    update public.phase3_roster_state rs
    set initial_count=(
          select count(*) from public.phase3_roster_entries e
          where e.room_id=rs.room_id and e.team_id=rs.team_id and e.source='pre_phase3'
        ),
        roster_count=(
          select count(*) from public.phase3_roster_entries e
          where e.room_id=rs.room_id and e.team_id=rs.team_id
        )
    where rs.room_id=v_room;
  end if;

  v_tx := public._league_log_transaction(
    v_season,'add',p_team_id,null,v_key,trim(p_player_name),
    trim(p_player_name)||' added to '||v_team_name||' by commissioner',
    0,0,'league_roster_entries',v_entry_id::text,null,
    jsonb_build_object(
      'position',upper(trim(p_position)),
      'nfl_team',upper(trim(p_nfl_team)),
      'source','commissioner_manual_add'
    )
  );

  return jsonb_build_object(
    'ok',true,
    'player',trim(p_player_name),
    'team',v_team_name,
    'roster_entry_id',v_entry_id,
    'transaction_id',v_tx
  );
end;
$$;

grant execute on function public.league_commish_add_player(text,text,uuid,text,text,text)
to anon,authenticated;

-- ---------------------------------------------------------------------------
-- 2026 pre-Phase-3 roster corrections supplied by the commissioner.
-- This section is idempotent.
-- ---------------------------------------------------------------------------
do $$
declare
  v_room uuid;
  v_season uuid;
  v_hebrew uuid;
  v_mccoy uuid;
  v_key text;
  v_entry bigint;
begin
  select id into v_room from public.rooms where code='GLSK26';
  select id into v_season
  from public.league_seasons
  where room_id=v_room and is_current
  order by season_year desc
  limit 1;

  select id into v_hebrew from public.teams
  where room_id=v_room and name='The Hebrew Hammer';

  select id into v_mccoy from public.teams
  where room_id=v_room and name='The Real McCoy';

  -- Dalton Kincaid -> The Hebrew Hammer.
  -- The original Phase 3 seed already contained him; this confirms/corrects the
  -- canonical shared roster without double-counting him.
  v_key := public._league_roster_key('Dalton Kincaid');

  insert into public.league_roster_entries(
    room_id,team_id,player_key,player_name,nfl_team,position,
    acquisition_type,source_key,active
  )
  values(
    v_room,v_hebrew,v_key,'Dalton Kincaid','BUF','TE',
    'manual','manual-correction:2026:dalton-kincaid',true
  )
  on conflict(room_id,player_key) do update
  set team_id=excluded.team_id,
      player_name=excluded.player_name,
      nfl_team=excluded.nfl_team,
      position=excluded.position,
      active=true,
      updated_at=now()
  returning id into v_entry;

  update public.phase3_roster_entries
  set team_id=v_hebrew,player_name='Dalton Kincaid',nfl_team='BUF',position='TE',
      source='pre_phase3',phase3_pick_id=null
  where room_id=v_room and public._league_roster_key(player_name)=v_key;

  if not found then
    insert into public.phase3_roster_entries(
      room_id,team_id,player_name,nfl_team,position,source
    )
    values(v_room,v_hebrew,'Dalton Kincaid','BUF','TE','pre_phase3');
  end if;

  delete from public.phase3_players
  where room_id=v_room and public._league_roster_key(name)=v_key;

  perform public._league_log_transaction(
    v_season,'add',v_hebrew,null,v_key,'Dalton Kincaid',
    'Commissioner roster correction • Dalton Kincaid confirmed on The Hebrew Hammer before Phase 3',
    0,0,'league_roster_entries',v_entry::text,
    'manual-correction:2026:dalton-kincaid',
    jsonb_build_object('position','TE','nfl_team','BUF','source','pre_phase3_correction')
  );

  -- Houston Texans DST -> The Real McCoy.
  v_key := public._league_roster_key('Houston Texans');

  insert into public.league_roster_entries(
    room_id,team_id,player_key,player_name,nfl_team,position,
    acquisition_type,source_key,active
  )
  values(
    v_room,v_mccoy,v_key,'Houston Texans','HOU','DST',
    'manual','manual-correction:2026:houston-texans',true
  )
  on conflict(room_id,player_key) do update
  set team_id=excluded.team_id,
      player_name=excluded.player_name,
      nfl_team=excluded.nfl_team,
      position=excluded.position,
      acquisition_type='manual',
      source_key='manual-correction:2026:houston-texans',
      active=true,
      updated_at=now()
  returning id into v_entry;

  update public.phase3_roster_entries
  set team_id=v_mccoy,player_name='Houston Texans',nfl_team='HOU',position='DST',
      source='pre_phase3',phase3_pick_id=null
  where room_id=v_room and public._league_roster_key(player_name)=v_key;

  if not found then
    insert into public.phase3_roster_entries(
      room_id,team_id,player_name,nfl_team,position,source
    )
    values(v_room,v_mccoy,'Houston Texans','HOU','DST','pre_phase3');
  end if;

  delete from public.phase3_players
  where room_id=v_room and public._league_roster_key(name)=v_key;

  perform public._league_log_transaction(
    v_season,'add',v_mccoy,null,v_key,'Houston Texans',
    'Commissioner roster correction • Houston Texans DST added to The Real McCoy before Phase 3',
    0,0,'league_roster_entries',v_entry::text,
    'manual-correction:2026:houston-texans',
    jsonb_build_object('position','DST','nfl_team','HOU','source','pre_phase3_correction')
  );

  -- Recompute Phase 3 starting/current counts from the corrected snapshot.
  update public.phase3_roster_state rs
  set initial_count=(
        select count(*) from public.phase3_roster_entries e
        where e.room_id=rs.room_id and e.team_id=rs.team_id and e.source='pre_phase3'
      ),
      roster_count=(
        select count(*) from public.phase3_roster_entries e
        where e.room_id=rs.room_id and e.team_id=rs.team_id
      )
  where rs.room_id=v_room;
end;
$$;

commit;

select
  t.name as team,
  rs.initial_count,
  rs.roster_count,
  rs.max_roster_size,
  rs.max_roster_size-rs.roster_count as open_spots
from public.phase3_roster_state rs
join public.teams t on t.id=rs.team_id
join public.rooms r on r.id=rs.room_id
where r.code='GLSK26'
  and t.name in ('The Hebrew Hammer','The Real McCoy')
order by t.name;
