-- 2026-11-21: Unaccepted GLSK trade offers are private to the two teams involved.
-- Trade assets inherit this check via their existing RLS policy.
-- Commissioners see accepted trades awaiting review and their outcomes.
-- A commissioner who is personally involved in a proposal can still see it as a team owner.

create or replace function public._league_owner_can_view_trade(p_trade_id uuid)
returns boolean
language sql stable security definer
set search_path = public, auth, pg_temp
as $function$
  select exists (
    select 1
    from public.league_trades tr
    join public.league_seasons s on s.id=tr.season_id
    join public.league_owner_accounts a
      on a.room_id=s.room_id
     and a.user_id=auth.uid()
     and a.active=true
    where tr.id=p_trade_id
      and (
        a.team_id=tr.proposer_team_id
        or a.team_id=tr.partner_team_id
        or tr.status='approved'
        or (
          a.is_commissioner and (
            tr.status in ('pending_commish','denied')
            or (tr.status='cancelled' and tr.accepted_at is not null)
          )
        )
      )
  );
$function$;
