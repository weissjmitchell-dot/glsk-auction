-- GLSK 1.3.0: Native Apple Push Notification registration.
-- REVIEW BEFORE APPLYING: This migration has NOT been executed against production.
-- Existing Web Push and email preferences/delivery remain unchanged.
begin;

create table if not exists public.league_native_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  device_token text not null unique
    check(device_token ~ '^[a-fA-F0-9]{64,400}$'),
  device_label text not null default 'iPhone',
  environment text not null default 'production'
    check(environment in ('production','sandbox')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  last_failure_at timestamptz
);
create index if not exists glsk_native_push_owner_idx
  on public.league_native_push_subscriptions(room_id,team_id,enabled);
alter table public.league_native_push_subscriptions enable row level security;
revoke all on public.league_native_push_subscriptions from public,anon,authenticated;

-- Store a device token only for the actively signed-in league owner.
create or replace function public.league_owner_save_native_push_token(
 p_room_code text,p_device_token text,p_device_label text default 'iPhone'
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_room uuid; v_user uuid:=auth.uid(); v_team uuid;
begin
 select id into v_room from public.rooms where code=p_room_code;
 if v_room is null or v_user is null then
  return jsonb_build_object('ok',false,'error','Sign in to GLSK first.');
 end if;
 select a.team_id into v_team from public.league_owner_accounts a
 where a.room_id=v_room and a.user_id=v_user and a.active=true limit 1;
 if v_team is null then
  return jsonb_build_object('ok',false,'error','An active GLSK owner account is required.');
 end if;
 if p_device_token is null or p_device_token !~ '^[a-fA-F0-9]{64,400}$' then
  return jsonb_build_object('ok',false,'error','Invalid iPhone notification token.');
 end if;
 insert into public.league_native_push_subscriptions(
   room_id,user_id,team_id,device_token,device_label,environment,enabled,updated_at)
 values(v_room,v_user,v_team,lower(p_device_token),
        left(coalesce(nullif(trim(p_device_label),''),'iPhone'),80),'production',true,now())
 on conflict(device_token) do update set
   room_id=excluded.room_id,user_id=excluded.user_id,team_id=excluded.team_id,
   device_label=excluded.device_label,environment='production',
   enabled=true,updated_at=now();
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.league_owner_save_native_push_token(text,text,text) from public,anon;
grant execute on function public.league_owner_save_native_push_token(text,text,text) to authenticated;

create or replace function public.league_owner_remove_native_push_token(
 p_room_code text,p_device_token text
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_room uuid; v_user uuid:=auth.uid();
begin
 select id into v_room from public.rooms where code=p_room_code;
 if v_room is null or v_user is null then
  return jsonb_build_object('ok',false,'error','Sign in to GLSK first.');
 end if;
 update public.league_native_push_subscriptions
 set enabled=false,updated_at=now()
 where room_id=v_room and user_id=v_user and device_token=lower(p_device_token);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.league_owner_remove_native_push_token(text,text) from public,anon;
grant execute on function public.league_owner_remove_native_push_token(text,text) to authenticated;

-- Reuse existing webhook secret validation. Never expose device tokens to the browser.
create or replace function public.league_native_push_delivery_payload(
 p_event_id bigint,p_webhook_secret text
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_base jsonb; v_event public.league_events%rowtype; v_tokens jsonb;
begin
 v_base:=public.league_push_delivery_payload(p_event_id,p_webhook_secret);
 if coalesce(v_base->>'ok','false') <> 'true' then
  return jsonb_build_object('ok',false,'error','Event unavailable.');
 end if;
 select * into v_event from public.league_events where id=p_event_id;
 if v_event.id is null then return jsonb_build_object('ok',false,'error','Event unavailable.'); end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'subscription_id',s.id,'device_token',s.device_token
 )),'[]'::jsonb) into v_tokens
 from public.league_native_push_subscriptions s
 join public.league_owner_accounts a on a.room_id=s.room_id
   and a.user_id=s.user_id and a.team_id=s.team_id and a.active=true
 left join public.league_notification_preferences np on np.season_id=v_event.season_id
   and np.team_id=s.team_id and np.category=v_event.category
 where s.room_id=v_event.room_id and s.enabled
   and (v_event.visibility='league' or
        (v_event.visibility='team' and v_event.target_team_id=s.team_id))
   and coalesce(np.enabled,true);
 return jsonb_build_object('ok',true,'event',v_base->'event','subscriptions',v_tokens);
end $$;
revoke all on function public.league_native_push_delivery_payload(bigint,text) from public,authenticated;
-- Vercel's existing notification webhook uses the Supabase publishable key.
grant execute on function public.league_native_push_delivery_payload(bigint,text) to anon;

create or replace function public.league_native_push_report_delivery(
 p_event_id bigint,p_webhook_secret text,p_subscription_id uuid,
 p_success boolean,p_gone boolean
) returns jsonb language plpgsql security definer
set search_path=public,pg_temp as $$
declare v_base jsonb; v_room uuid;
begin
 v_base:=public.league_push_delivery_payload(p_event_id,p_webhook_secret);
 if coalesce(v_base->>'ok','false') <> 'true' then
  return jsonb_build_object('ok',false,'error','Event unavailable.');
 end if;
 select room_id into v_room from public.league_events where id=p_event_id;
 update public.league_native_push_subscriptions
 set enabled=case when p_gone then false else enabled end,
     last_success_at=case when p_success then now() else last_success_at end,
     last_failure_at=case when not p_success then now() else last_failure_at end,
     updated_at=now()
 where id=p_subscription_id and room_id=v_room;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.league_native_push_report_delivery(bigint,text,uuid,boolean,boolean) from public,authenticated;
grant execute on function public.league_native_push_report_delivery(bigint,text,uuid,boolean,boolean) to anon;
commit;
