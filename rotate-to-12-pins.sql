-- GLSK26 — ROTATE TO 12 TEAM PINS
-- Weiss Tea & Lemonade's TEAM PIN is also the COMMISSIONER/CZAR PIN.
-- This does NOT reset teams, budgets, players, bids, or auction settings.

begin;

create temp table new_team_pins (
  team_id uuid primary key,
  sort_order integer not null,
  label text not null,
  pin text not null
) on commit drop;

insert into new_team_pins (team_id, sort_order, label, pin)
select
  t.id,
  t.sort_order,
  t.name,
  lpad((100000 + floor(random() * 900000))::int::text, 6, '0')
from public.teams t
join public.rooms r on r.id = t.room_id
where r.code = 'GLSK26'
order by t.sort_order;

-- Replace every team's existing PIN hash with the new team PIN.
update public.team_secrets s
set pin_hash = extensions.crypt(p.pin, extensions.gen_salt('bf'))
from new_team_pins p
where p.team_id = s.team_id;

-- Make Weiss Tea & Lemonade's team PIN the commissioner PIN too.
insert into public.room_secrets (room_id, commish_pin_hash)
select
  r.id,
  extensions.crypt(p.pin, extensions.gen_salt('bf'))
from public.rooms r
join public.teams t on t.room_id = r.id and t.name = 'Weiss Tea & Lemonade'
join new_team_pins p on p.team_id = t.id
where r.code = 'GLSK26'
on conflict (room_id) do update
set commish_pin_hash = excluded.commish_pin_hash;

-- Show ALL 12 credentials in ONE CELL so nothing is hidden by the results pane.
select string_agg(
  label || ': ' || pin,
  E'\n'
  order by sort_order
) as "SAVE THESE 12 TEAM PINS — WEISS PIN ALSO = COMMISSIONER PIN"
from new_team_pins;

commit;
