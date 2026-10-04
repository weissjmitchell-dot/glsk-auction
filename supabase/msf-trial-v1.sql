-- Install once in Supabase SQL Editor before deploying the trial panel.
-- Requires existing league_owner_accounts and the v6/v6.5 host tables.
-- No provider records or credentials are stored by this migration.
begin;

create table if not exists public.league_msf_trial_checks (
  room_id uuid not null references public.rooms(id) on delete cascade,
  feed text not null check(feed in ('games','players','teams','injuries')),
  requested_at timestamptz not null,
  primary key(room_id,feed)
);
alter table public.league_msf_trial_checks enable row level security;
revoke all on public.league_msf_trial_checks from public,anon,authenticated;

create or replace function public.league_msf_trial_context(p_action text default 'status',p_feed text default 'games')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid; v_claim uuid;
begin
  select id into v_room from public.rooms where code='GLSK26';
  if auth.uid() is null or v_room is null or not exists (
    select 1 from public.league_owner_accounts
    where room_id=v_room and user_id=auth.uid() and active=true and is_commissioner=true
  ) then raise exception 'MSF_FORBIDDEN' using errcode='42501'; end if;
  if p_action is null or p_action not in ('status','claim') or p_feed is null or p_feed not in ('games','players','teams','injuries') then
    raise exception 'MSF_INVALID' using errcode='22023';
  end if;
  if p_action='claim' then
    insert into public.league_msf_trial_checks as checks(room_id,feed,requested_at)
      values(v_room,p_feed,clock_timestamp())
    on conflict(room_id,feed) do update set requested_at=excluded.requested_at
      where checks.requested_at <= clock_timestamp()-interval '3 minutes'
    returning room_id into v_claim;
    if v_claim is null then raise exception 'MSF_COOLDOWN' using errcode='P0001'; end if;
  end if;
  return jsonb_build_object('room_id',v_room,'user_id',auth.uid(),'is_commissioner',true);
end $$;
revoke all on function public.league_msf_trial_context(text,text) from public,anon;
grant execute on function public.league_msf_trial_context(text,text) to authenticated;

-- A restrictive policy applies even when a legacy public-read policy exists.
create or replace function public.league_msf_can_read(p_room uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select auth.uid() is not null and exists (
    select 1 from public.league_owner_accounts
    where room_id=p_room and user_id=auth.uid() and active=true
  );
$$;
revoke all on function public.league_msf_can_read(uuid) from public,anon;
grant execute on function public.league_msf_can_read(uuid) to authenticated;

do $$ declare t text; begin
  foreach t in array array['league_player_stats','league_player_projections','league_weekly_player_scores'] loop
    if to_regclass('public.'||t) is null then raise exception 'Required host table missing: %',t; end if;
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke select on public.%I from public,anon',t);
    execute format('drop policy if exists msf_member_read_guard on public.%I',t);
    execute format('create policy msf_member_read_guard on public.%I as restrictive for select to authenticated using(public.league_msf_can_read(room_id))',t);
  end loop;
end $$;

-- Existing score views must respect the underlying RLS (PostgreSQL 15+).
alter view public.league_matchup_live_scores set (security_invoker=true);
alter view public.league_shadow_standings set (security_invoker=true);
revoke select on public.league_matchup_live_scores,public.league_shadow_standings from public,anon;
commit;
