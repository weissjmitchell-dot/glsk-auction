-- Additive only: leaves ownership, transactions, drafts and weekly data intact.
begin;
create table if not exists public.league_app_modes (
 room_id uuid primary key references public.rooms(id) on delete cascade,
 mode text not null default 'assets' check(mode in ('assets','full')),
 updated_at timestamptz not null default now(),
 updated_by uuid
);
alter table public.league_app_modes enable row level security;
revoke all on public.league_app_modes from public,anon,authenticated;
create or replace function public.league_app_mode(p_room_code text default 'GLSK26',p_mode text default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_room uuid; v_commissioner boolean; v_mode text;
begin
 select id into v_room from public.rooms where code=p_room_code;
 select is_commissioner into v_commissioner from public.league_owner_accounts
 where room_id=v_room and user_id=auth.uid() and active=true;
 if auth.uid() is null or v_commissioner is null then raise exception 'Active league account required' using errcode='42501'; end if;
 if p_mode is not null then
  if not v_commissioner then raise exception 'Commissioner access required' using errcode='42501'; end if;
  if p_mode not in ('assets','full') then raise exception 'Invalid app mode' using errcode='22023'; end if;
  insert into public.league_app_modes(room_id,mode,updated_by) values(v_room,p_mode,auth.uid())
  on conflict(room_id) do update set mode=excluded.mode,updated_at=now(),updated_by=excluded.updated_by;
 end if;
 select mode into v_mode from public.league_app_modes where room_id=v_room;
 return jsonb_build_object('mode',coalesce(v_mode,'assets'));
end $$;
revoke all on function public.league_app_mode(text,text) from public,anon;
grant execute on function public.league_app_mode(text,text) to authenticated;
commit;
