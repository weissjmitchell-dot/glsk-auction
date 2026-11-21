-- GLSK: lock traded players/picks while a proposal is open or pending approval.
-- Bid dollars are fungible: reserve the total amount, not individual dollars.
-- Additive migration: existing trade statuses and records are preserved.
begin;

create or replace function public._glsk_trade_asset_guard()
returns trigger language plpgsql
set search_path = public,pg_temp
as $$
declare
  v_trade public.league_trades%rowtype;
  v_season uuid;
  v_owner uuid;
  v_identity text;
  v_previous uuid;
  v_budget integer;
  v_reserved bigint;
begin
  select * into v_trade from public.league_trades where id=new.trade_id;
  if v_trade.id is null then raise exception 'Trade not found.'; end if;
  if v_trade.status not in ('proposed','pending_commish') then
    raise exception 'Assets on an inactive trade cannot be changed.';
  end if;
  v_season := v_trade.season_id;
  v_owner := case when new.direction='proposer_to_partner'
     then v_trade.proposer_team_id else v_trade.partner_team_id end;

  if new.asset_type='player' then
    if nullif(btrim(coalesce(new.asset_key,'')),'') is null then
      raise exception 'A traded player must have a player identifier.';
    end if;
    v_identity := 'player:' || lower(btrim(new.asset_key));
  elsif new.asset_type='rookie_pick' then
    if new.pick_id is null then raise exception 'A Rookie Draft pick must have a pick ID.'; end if;
    v_identity := 'rookie_pick:' || new.pick_id::text;
  elsif new.asset_type in ('rookie_rights','supplemental_pick') then
    raise exception 'Rookie rights and Supplemental Draft picks are not separately tradable.';
  elsif new.asset_type='bid_dollars' then
    if coalesce(new.bid_amount,0)<=0 then raise exception 'Bid-dollar amounts must be positive.'; end if;
    perform pg_advisory_xact_lock(hashtextextended(
      v_season::text||':bid_dollars:'||v_owner::text,0
    ));
    select remaining_budget into v_budget from public.teams where id=v_owner;
    select coalesce(sum(a.bid_amount),0) into v_reserved
      from public.league_trade_assets a
      join public.league_trades t on t.id=a.trade_id
      where t.season_id=v_season and t.status in ('proposed','pending_commish')
        and a.asset_type='bid_dollars'
        and (case when a.direction='proposer_to_partner'
                  then t.proposer_team_id else t.partner_team_id end)=v_owner
        and (tg_op='INSERT' or a.id<>old.id);
    if v_reserved+new.bid_amount>coalesce(v_budget,0) then
      raise exception 'Only % bid dollars remain available after amounts reserved by pending trades.',
        greatest(0,coalesce(v_budget,0)-v_reserved);
    end if;
    return new;
  else
    raise exception 'Unsupported trade asset type: %',new.asset_type;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_season::text||':'||v_identity,0));
  select t.id into v_previous
    from public.league_trade_assets a
    join public.league_trades t on t.id=a.trade_id
    where t.season_id=v_season
      and t.status in ('proposed','pending_commish')
      and (tg_op='INSERT' or a.id<>old.id)
      and a.asset_type=new.asset_type
      and ( (new.asset_type='player' and lower(btrim(a.asset_key))=lower(btrim(new.asset_key)))
         or (new.asset_type='rookie_pick' and a.pick_id=new.pick_id))
    limit 1;
  if v_previous is not null then
    raise exception 'This player or Rookie Draft pick is already reserved in an open trade. Wait until that trade is approved, denied, rejected, or cancelled.';
  end if;
  return new;
end;
$$;
revoke all on function public._glsk_trade_asset_guard() from public,anon,authenticated;

drop trigger if exists trg_glsk_trade_asset_guard on public.league_trade_assets;
create trigger trg_glsk_trade_asset_guard
before insert or update of asset_type,asset_key,pick_id,bid_amount,direction
on public.league_trade_assets
for each row execute function public._glsk_trade_asset_guard();

-- Handles existing overlapping proposals. The first accepted trade locks its
-- assets; a conflicting proposal cannot also advance to commissioner review.
create or replace function public._glsk_trade_accept_guard()
returns trigger language plpgsql
set search_path = public,pg_temp
as $$
declare
 a record;
 v_identity text;
 v_previous uuid;
 v_owner uuid;
 v_budget integer;
 v_reserved bigint;
begin
 if new.status not in ('pending_commish','approved')
    or new.status=old.status then return new; end if;

 for a in select * from public.league_trade_assets where trade_id=new.id order by id loop
   if a.asset_type='player' then
     v_identity := 'player:'||lower(btrim(a.asset_key));
   elsif a.asset_type='rookie_pick' then
     v_identity := 'rookie_pick:'||a.pick_id::text;
   elsif a.asset_type='bid_dollars' then
     v_owner := case when a.direction='proposer_to_partner'
       then new.proposer_team_id else new.partner_team_id end;
     perform pg_advisory_xact_lock(hashtextextended(
       new.season_id::text||':bid_dollars:'||v_owner::text,0));
     select remaining_budget into v_budget from public.teams where id=v_owner;
     select coalesce(sum(x.bid_amount),0) into v_reserved
       from public.league_trade_assets x
       join public.league_trades t on t.id=x.trade_id
       where t.season_id=new.season_id and t.status='pending_commish'
         and t.id<>new.id and x.asset_type='bid_dollars'
         and (case when x.direction='proposer_to_partner'
                   then t.proposer_team_id else t.partner_team_id end)=v_owner;
     if v_reserved+a.bid_amount>coalesce(v_budget,0) then
       raise exception 'Bid dollars are reserved by another accepted trade.';
     end if;
     continue;
   else
     continue;
   end if;

   perform pg_advisory_xact_lock(hashtextextended(new.season_id::text||':'||v_identity,0));
   select t.id into v_previous
     from public.league_trade_assets x
     join public.league_trades t on t.id=x.trade_id
     where t.season_id=new.season_id and t.status='pending_commish'
       and t.id<>new.id and x.asset_type=a.asset_type
       and ( (a.asset_type='player' and lower(btrim(x.asset_key))=lower(btrim(a.asset_key)))
          or (a.asset_type='rookie_pick' and x.pick_id=a.pick_id))
     limit 1;
   if v_previous is not null then
     raise exception 'An overlapping trade is already awaiting commissioner approval. The same asset cannot be accepted twice.';
   end if;
 end loop;
 return new;
end;
$$;
revoke all on function public._glsk_trade_accept_guard() from public,anon,authenticated;
drop trigger if exists trg_glsk_trade_accept_guard on public.league_trades;
create trigger trg_glsk_trade_accept_guard
before update of status on public.league_trades
for each row execute function public._glsk_trade_accept_guard();

commit;
