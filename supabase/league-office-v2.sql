-- GREAT LAKE STATE KEEPERS — LEAGUE OFFICE v2
-- Owner contract assignment workflow + contract-year display support.
-- Safe migration: does not reset drafts, rosters, PINs, balances, existing contracts or deadlines.
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

-- Owners may assign NEW contracts to players currently on their own roster
-- while a Contracts deadline is open. Existing imported/legacy contracts
-- cannot be overwritten by an owner.
create or replace function public.league_owner_upsert_contract(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_player_key text,
  p_length_years integer,
  p_deadline_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_season uuid;
  v_season_year integer;
  v_cap integer;
  v_cost integer;
  v_used integer;
  v_player public.league_roster_entries%rowtype;
  v_deadline public.league_deadlines%rowtype;
  v_existing public.league_contracts%rowtype;
  v_id bigint;
begin
  select * into v_room
  from public.rooms
  where code=p_room_code;

  if v_room.id is null or not public._valid_team_pin(p_team_id,p_pin) then
    raise exception 'Team authorization failed.';
  end if;

  if not exists(select 1 from public.teams where id=p_team_id and room_id=v_room.id) then
    raise exception 'Team not found.';
  end if;

  v_season:=public._league_current_season_id(p_room_code);
  select season_year,salary_cap_points into v_season_year,v_cap
  from public.league_seasons where id=v_season;

  select * into v_deadline
  from public.league_deadlines
  where id=p_deadline_id
    and season_id=v_season
    and deadline_type='contracts'
    and status='open';

  if v_deadline.id is null then
    raise exception 'Contract assignments are not open.';
  end if;

  if now()>v_deadline.due_at and v_deadline.auto_lock then
    raise exception 'The contract deadline is locked.';
  end if;

  select * into v_player
  from public.league_roster_entries
  where room_id=v_room.id
    and team_id=p_team_id
    and player_key=p_player_key
    and active=true;

  if v_player.id is null then
    raise exception 'That player is not on your active roster.';
  end if;

  select cap_cost into v_cost
  from public.contract_options
  where season_id=v_season
    and years=p_length_years
    and active=true;

  if v_cost is null then
    raise exception 'That contract length is not enabled.';
  end if;

  select * into v_existing
  from public.league_contracts
  where season_id=v_season
    and player_key=p_player_key
    and status='active';

  if v_existing.id is not null
     and not (
       v_existing.team_id=p_team_id
       and v_existing.source='owner_assignment'
       and v_existing.start_year=v_season_year
     ) then
    raise exception 'That player already has an active contract.';
  end if;

  select coalesce(sum(cap_cost),0) into v_used
  from public.league_contracts
  where season_id=v_season
    and team_id=p_team_id
    and status='active'
    and player_key<>p_player_key;

  if v_used+v_cost>v_cap then
    raise exception 'Contract would exceed the % point salary cap.',v_cap;
  end if;

  insert into public.league_contracts(
    season_id,team_id,player_key,player_name,start_year,end_year,
    length_years,cap_cost,status,source
  )
  values(
    v_season,p_team_id,v_player.player_key,v_player.player_name,
    v_season_year,v_season_year+p_length_years-1,
    p_length_years,v_cost,'active','owner_assignment'
  )
  on conflict(season_id,player_key) do update
  set team_id=excluded.team_id,
      player_name=excluded.player_name,
      start_year=excluded.start_year,
      end_year=excluded.end_year,
      length_years=excluded.length_years,
      cap_cost=excluded.cap_cost,
      status='active',
      source='owner_assignment',
      updated_at=now()
  returning id into v_id;

  -- Editing an assignment after submitting makes the team pending again
  -- so the final submission timestamp always reflects the final choices.
  update public.league_deadline_team_status
  set status='pending',submitted_at=null,updated_at=now()
  where deadline_id=p_deadline_id
    and team_id=p_team_id;

  insert into public.league_audit_log(
    season_id,actor_team_id,action,entity_type,entity_id,details
  )
  values(
    v_season,p_team_id,'owner_assign_contract','league_contracts',v_id::text,
    jsonb_build_object(
      'player_key',v_player.player_key,
      'player',v_player.player_name,
      'years',p_length_years,
      'cost',v_cost,
      'deadline_id',p_deadline_id
    )
  );

  return jsonb_build_object(
    'ok',true,
    'contract_id',v_id,
    'cap_used',v_used+v_cost,
    'cap_limit',v_cap,
    'year',1,
    'length_years',p_length_years
  );
end;
$$;

create or replace function public.league_owner_remove_contract(
  p_room_code text,
  p_team_id uuid,
  p_pin text,
  p_contract_id bigint,
  p_deadline_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_season uuid;
  v_season_year integer;
  v_deadline public.league_deadlines%rowtype;
  v_contract public.league_contracts%rowtype;
begin
  select * into v_room
  from public.rooms
  where code=p_room_code;

  if v_room.id is null or not public._valid_team_pin(p_team_id,p_pin) then
    raise exception 'Team authorization failed.';
  end if;

  v_season:=public._league_current_season_id(p_room_code);
  select season_year into v_season_year
  from public.league_seasons where id=v_season;

  select * into v_deadline
  from public.league_deadlines
  where id=p_deadline_id
    and season_id=v_season
    and deadline_type='contracts'
    and status='open';

  if v_deadline.id is null then
    raise exception 'Contract assignments are not open.';
  end if;

  if now()>v_deadline.due_at and v_deadline.auto_lock then
    raise exception 'The contract deadline is locked.';
  end if;

  select * into v_contract
  from public.league_contracts
  where id=p_contract_id
    and season_id=v_season
    and team_id=p_team_id
    and status='active';

  if v_contract.id is null then
    raise exception 'Contract assignment not found.';
  end if;

  if v_contract.source<>'owner_assignment' or v_contract.start_year<>v_season_year then
    raise exception 'Only your new contract assignments can be removed.';
  end if;

  delete from public.league_contracts
  where id=v_contract.id;

  update public.league_deadline_team_status
  set status='pending',submitted_at=null,updated_at=now()
  where deadline_id=p_deadline_id
    and team_id=p_team_id;

  insert into public.league_audit_log(
    season_id,actor_team_id,action,entity_type,entity_id,details
  )
  values(
    v_season,p_team_id,'owner_remove_contract','league_contracts',p_contract_id::text,
    jsonb_build_object(
      'player_key',v_contract.player_key,
      'player',v_contract.player_name,
      'deadline_id',p_deadline_id
    )
  );

  return jsonb_build_object('ok',true);
end;
$$;

grant execute on function public.league_owner_upsert_contract(text,uuid,text,text,integer,uuid)
to anon,authenticated;

grant execute on function public.league_owner_remove_contract(text,uuid,text,bigint,uuid)
to anon,authenticated;

commit;

select
  ls.season_year,
  (select count(*) from public.league_deadlines d
    where d.season_id=ls.id and d.deadline_type='contracts' and d.status='open') as open_contract_deadlines,
  (select count(*) from public.league_contracts c
    where c.season_id=ls.id and c.status='active') as active_contracts,
  (select count(*) from public.league_contracts c
    where c.season_id=ls.id and c.status='active' and c.source='owner_assignment') as owner_assignments
from public.league_seasons ls
join public.rooms r on r.id=ls.room_id
where r.code='GLSK26' and ls.is_current;
