-- GLSK League Office v5.3 — Trade-rule update
-- Supplemental draft picks are no longer tradable.
-- Rookie rights are not a separate trade asset; active rights automatically
-- follow the player when that player is traded.
-- Only next-season Rookie Draft picks may be traded.
-- Safe to run on the existing database.

begin;

create or replace function public._league_validate_trade(p_trade_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_trade public.league_trades%rowtype; v_season public.league_seasons%rowtype; v_room_id uuid;
  a record; v_owner uuid; v_other uuid; v_give_bid integer:=0; v_receive_bid integer:=0;
  v_prop_cap integer; v_partner_cap integer; v_prop_out integer:=0; v_prop_in integer:=0; v_part_out integer:=0; v_part_in integer:=0;
  v_limit integer;
begin
  select * into v_trade from public.league_trades where id=p_trade_id;
  if v_trade.id is null then return jsonb_build_object('ok',false,'error','Trade not found.'); end if;
  select * into v_season from public.league_seasons where id=v_trade.season_id;
  v_room_id:=v_season.room_id; v_limit:=v_season.salary_cap_points;
  select coalesce(sum(cap_cost),0) into v_prop_cap from public.league_contracts where season_id=v_season.id and team_id=v_trade.proposer_team_id and status='active';
  select coalesce(sum(cap_cost),0) into v_partner_cap from public.league_contracts where season_id=v_season.id and team_id=v_trade.partner_team_id and status='active';

  for a in select * from public.league_trade_assets where trade_id=p_trade_id loop
    v_owner:=case when a.direction='proposer_to_partner' then v_trade.proposer_team_id else v_trade.partner_team_id end;
    v_other:=case when a.direction='proposer_to_partner' then v_trade.partner_team_id else v_trade.proposer_team_id end;

    if a.asset_type='player' then
      if not exists(select 1 from public.league_roster_entries where room_id=v_room_id and team_id=v_owner and player_key=a.asset_key and active=true) then
        return jsonb_build_object('ok',false,'error',coalesce(a.player_name,a.asset_key)||' is no longer owned by the sending team.');
      end if;
      if a.direction='proposer_to_partner' then
        select coalesce(cap_cost,0) into v_prop_out from public.league_contracts where season_id=v_season.id and team_id=v_owner and player_key=a.asset_key and status='active';
        v_prop_out:=coalesce(v_prop_out,0);
        v_part_in:=v_part_in+v_prop_out;
      else
        select coalesce(cap_cost,0) into v_part_out from public.league_contracts where season_id=v_season.id and team_id=v_owner and player_key=a.asset_key and status='active';
        v_part_out:=coalesce(v_part_out,0);
        v_prop_in:=v_prop_in+v_part_out;
      end if;

    elsif a.asset_type='rookie_rights' then
      return jsonb_build_object('ok',false,'error','Rookie rights cannot be traded separately. Active rookie rights automatically follow the player when the player is traded.');

    elsif a.asset_type='supplemental_pick' then
      return jsonb_build_object('ok',false,'error','Supplemental Draft picks are not tradable.');

    elsif a.asset_type='rookie_pick' then
      if a.pick_id is null or not exists(
        select 1 from public.league_future_picks fp
        where fp.id=a.pick_id
          and fp.room_id=v_room_id
          and fp.owner_team_id=v_owner
          and fp.status='active'
          and fp.draft_year=v_season.season_year+1
          and fp.draft_type='rookie'
      ) then
        return jsonb_build_object('ok',false,'error','That Rookie Draft pick is not currently tradable by the sending team.');
      end if;

    elsif a.asset_type='bid_dollars' then
      if a.direction='proposer_to_partner' then
        v_give_bid:=v_give_bid+coalesce(a.bid_amount,0);
      else
        v_receive_bid:=v_receive_bid+coalesce(a.bid_amount,0);
      end if;
    end if;
  end loop;

  if v_give_bid>(select remaining_budget from public.teams where id=v_trade.proposer_team_id) then return jsonb_build_object('ok',false,'error','Proposer does not have enough bid dollars.'); end if;
  if v_receive_bid>(select remaining_budget from public.teams where id=v_trade.partner_team_id) then return jsonb_build_object('ok',false,'error','Partner does not have enough bid dollars.'); end if;

  select coalesce(sum(c.cap_cost),0) into v_prop_out
  from public.league_trade_assets a join public.league_contracts c on c.season_id=v_season.id and c.team_id=v_trade.proposer_team_id and c.player_key=a.asset_key and c.status='active'
  where a.trade_id=p_trade_id and a.direction='proposer_to_partner' and a.asset_type='player';
  select coalesce(sum(c.cap_cost),0) into v_part_out
  from public.league_trade_assets a join public.league_contracts c on c.season_id=v_season.id and c.team_id=v_trade.partner_team_id and c.player_key=a.asset_key and c.status='active'
  where a.trade_id=p_trade_id and a.direction='partner_to_proposer' and a.asset_type='player';
  v_prop_in:=v_part_out; v_part_in:=v_prop_out;

  if v_prop_cap-v_prop_out+v_prop_in>v_limit then
    return jsonb_build_object('ok',false,'error','Trade blocked: proposer would be over the '||v_limit||'-point contract cap.','proposer_cap_after',v_prop_cap-v_prop_out+v_prop_in,'partner_cap_after',v_partner_cap-v_part_out+v_part_in);
  end if;
  if v_partner_cap-v_part_out+v_part_in>v_limit then
    return jsonb_build_object('ok',false,'error','Trade blocked: partner would be over the '||v_limit||'-point contract cap.','proposer_cap_after',v_prop_cap-v_prop_out+v_prop_in,'partner_cap_after',v_partner_cap-v_part_out+v_part_in);
  end if;

  return jsonb_build_object('ok',true,'proposer_cap_before',v_prop_cap,'partner_cap_before',v_partner_cap,
    'proposer_cap_after',v_prop_cap-v_prop_out+v_prop_in,'partner_cap_after',v_partner_cap-v_part_out+v_part_in,
    'proposer_bid_send',v_give_bid,'partner_bid_send',v_receive_bid);
end;
$$;

revoke all on function public._league_validate_trade(uuid) from public,anon,authenticated;

commit;

-- Verification: the current future-pick ledger may still contain Supplemental picks
-- for historical/ownership tracking, but the trade validator now permits Rookie picks only.
select
  draft_type,
  count(*) as pick_assets_tracked
from public.league_future_picks fp
join public.rooms r on r.id=fp.room_id
where r.code='GLSK26' and fp.status='active'
group by draft_type
order by draft_type;
