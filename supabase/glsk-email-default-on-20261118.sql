-- GLSK email alerts: enable by default for existing and newly claimed owner accounts.
-- Existing per-user opt-outs (enabled=false) are preserved.
-- No emails are sent by this migration. Only new events can trigger email delivery.

alter table public.league_email_preferences
  alter column enabled set default true;

create or replace function public._league_initialize_owner_email_preferences()
returns trigger
language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if new.active is true then
    insert into public.league_email_preferences(
      room_id,user_id,category,enabled
    )
    select new.room_id,new.user_id,c.category,true
    from (values
      ('trades'),('roster_moves'),('drafts'),('contracts'),
      ('rookie_rights'),('message_board'),('league_chat'),
      ('deadlines'),('matchups'),('injuries'),
      ('player_availability'),('other_activity')
    ) as c(category)
    on conflict(room_id,user_id,category) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public._league_initialize_owner_email_preferences() from public,anon,authenticated;

drop trigger if exists trg_glsk_default_owner_email_preferences on public.league_owner_accounts;
create trigger trg_glsk_default_owner_email_preferences
after insert or update of active,room_id,user_id
on public.league_owner_accounts
for each row
execute function public._league_initialize_owner_email_preferences();

insert into public.league_email_preferences(room_id,user_id,category,enabled)
select a.room_id,a.user_id,c.category,true
from public.league_owner_accounts a
cross join (values
  ('trades'),('roster_moves'),('drafts'),('contracts'),
  ('rookie_rights'),('message_board'),('league_chat'),
  ('deadlines'),('matchups'),('injuries'),
  ('player_availability'),('other_activity')
) as c(category)
where a.active=true
  and exists (select 1 from public.rooms r where r.id=a.room_id and r.code='GLSK26')
on conflict(room_id,user_id,category) do nothing;
