-- GLSK Auction v5 migration: add a commissioner-only full draft reset.
-- Safe to run on the existing live database. It DOES NOT reset anything when installed.
-- The reset only happens later if the commissioner presses Reset Draft in the app.

begin;

create or replace function public.commish_reset_draft(p_room_code text, p_commish_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room public.rooms%rowtype;
  v_player_count integer;
  v_team_count integer;
begin
  select * into v_room
  from public.rooms
  where code = p_room_code
  for update;

  if v_room.id is null then
    return jsonb_build_object('ok', false, 'error', 'Room not found.');
  end if;

  if not public._valid_commish_pin(v_room.id, p_commish_pin) then
    return jsonb_build_object('ok', false, 'error', 'Commissioner authorization failed.');
  end if;

  -- Clear test/auction history for this room.
  delete from public.bids where room_id = v_room.id;
  delete from public.sales where room_id = v_room.id;

  -- Restore every team to its exact original auction budget.
  update public.teams
  set remaining_budget = starting_budget
  where room_id = v_room.id;
  get diagnostics v_team_count = row_count;

  -- Restore all 40 players to the original rank-ordered nomination queue.
  update public.players
  set status = 'queued',
      queue_order = rank,
      sold_team_id = null,
      sold_price = null
  where room_id = v_room.id;
  get diagnostics v_player_count = row_count;

  -- Return the room to the same state it had before Start Draft was pressed.
  update public.rooms
  set status = 'setup',
      active_player_id = null,
      active_bid = 0,
      active_bidder_team_id = null,
      auction_ends_at = null,
      pause_remaining_seconds = null,
      sold_count = 0
  where id = v_room.id;

  return jsonb_build_object(
    'ok', true,
    'teams_restored', v_team_count,
    'players_restored', v_player_count
  );
end;
$$;

grant execute on function public.commish_reset_draft(text,text) to anon, authenticated;

commit;

select 'Reset Draft function installed — no auction data was changed.' as status;
