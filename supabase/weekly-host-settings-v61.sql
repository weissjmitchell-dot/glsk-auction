-- GREAT LAKE STATE KEEPERS — 2026 WEEKLY HOST SETTINGS
-- League Office v6.1
--
-- Seeds the Yahoo-based 2026 weekly lineup/scoring settings supplied by the commissioner.
-- It does NOT change GLSK's custom draft-pick trade rules or contract rules.
--
-- Run in Supabase SQL Editor using "Run without RLS".

begin;

create table if not exists public.league_scoring_rules (
  id bigserial primary key,
  season_id uuid not null references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  category text not null,
  rule_key text not null,
  label text not null,
  points numeric(10,4),
  rate_value numeric(10,4),
  rate_unit text,
  threshold_value numeric(10,4),
  notes text,
  rule_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique(season_id,rule_key)
);

alter table public.league_scoring_rules enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_scoring_rules'
      and policyname='public read scoring rules'
  ) then
    create policy "public read scoring rules"
    on public.league_scoring_rules
    for select to anon,authenticated
    using(true);
  end if;
end $$;

grant select on public.league_scoring_rules to anon,authenticated;
revoke insert,update,delete on public.league_scoring_rules from anon,authenticated;

-- Configure season structure from supplied Yahoo settings.
update public.league_game_settings g
set regular_season_weeks=14,
    playoff_start_week=15,
    lineup_lock_mode='individual_game_start',
    updated_at=now()
from public.league_seasons s
join public.rooms r on r.id=s.room_id
where g.season_id=s.id
  and r.code='GLSK26'
  and s.is_current;

-- Seed the exact 2026 starting lineup:
-- QB, WR, WR, WR, RB, RB, TE, W/R/T, K, DEF = 10 starters.
do $$
declare
  v_room uuid;
  v_season uuid;
begin
  select s.room_id,s.id into v_room,v_season
  from public.league_seasons s
  join public.rooms r on r.id=s.room_id
  where r.code='GLSK26' and s.is_current
  order by s.season_year desc
  limit 1;

  if not exists(select 1 from public.league_lineups where season_id=v_season) then
    delete from public.league_lineup_slots where season_id=v_season;

    insert into public.league_lineup_slots
      (season_id,room_id,slot_code,label,slot_order,allowed_positions,active)
    values
      (v_season,v_room,'QB1','QB',1,array['QB'],true),
      (v_season,v_room,'RB1','RB1',2,array['RB'],true),
      (v_season,v_room,'RB2','RB2',3,array['RB'],true),
      (v_season,v_room,'WR1','WR1',4,array['WR'],true),
      (v_season,v_room,'WR2','WR2',5,array['WR'],true),
      (v_season,v_room,'WR3','WR3',6,array['WR'],true),
      (v_season,v_room,'TE1','TE',7,array['TE'],true),
      (v_season,v_room,'FLEX1','W/R/T',8,array['WR','RB','TE'],true),
      (v_season,v_room,'K1','K',9,array['K'],true),
      (v_season,v_room,'DST1','D/ST',10,array['DST'],true);
  end if;
end $$;

-- Seed scoring rules exactly from the supplied Yahoo commissioner screenshots.
with cur as (
  select s.id season_id,s.room_id
  from public.league_seasons s
  join public.rooms r on r.id=s.room_id
  where r.code='GLSK26' and s.is_current
  order by s.season_year desc
  limit 1
),
rules(category,rule_key,label,points,rate_value,rate_unit,threshold_value,notes,rule_order) as (
  values
  -- Offense
  ('Offense','pass_yds','Passing Yards',1.0,30.0,'yards',null,'30 yards per point',10),
  ('Offense','pass_300_bonus','Passing 300-Yard Bonus',1.0,null,null,300.0,'1 point at 300 passing yards',20),
  ('Offense','pass_400_bonus','Passing 400-Yard Bonus',2.0,null,null,400.0,'2 points at 400 passing yards',30),
  ('Offense','pass_td','Passing Touchdowns',5.0,null,null,null,null,40),
  ('Offense','interceptions','Interceptions Thrown',-2.0,null,null,null,null,50),
  ('Offense','rush_yds','Rushing Yards',1.0,10.0,'yards',null,'10 yards per point',60),
  ('Offense','rush_100_bonus','Rushing 100-Yard Bonus',1.0,null,null,100.0,'1 point at 100 rushing yards',70),
  ('Offense','rush_200_bonus','Rushing 200-Yard Bonus',2.0,null,null,200.0,'2 points at 200 rushing yards',80),
  ('Offense','rush_td','Rushing Touchdowns',6.0,null,null,null,null,90),
  ('Offense','receptions','Receptions',0.5,null,null,null,'Half-PPR',100),
  ('Offense','rec_yds','Receiving Yards',1.0,10.0,'yards',null,'10 yards per point',110),
  ('Offense','rec_100_bonus','Receiving 100-Yard Bonus',1.0,null,null,100.0,'1 point at 100 receiving yards',120),
  ('Offense','rec_200_bonus','Receiving 200-Yard Bonus',2.0,null,null,200.0,'2 points at 200 receiving yards',130),
  ('Offense','rec_td','Receiving Touchdowns',6.0,null,null,null,null,140),
  ('Offense','return_yds','Return Yards',1.0,20.0,'yards',null,'20 return yards per point',150),
  ('Offense','return_td','Return Touchdowns',6.0,null,null,null,null,160),
  ('Offense','two_point','2-Point Conversions',2.0,null,null,null,null,170),
  ('Offense','fumbles_lost','Fumbles Lost',-2.0,null,null,null,null,180),
  ('Offense','off_fumble_return_td','Offensive Fumble Return TD',2.0,null,null,null,null,190),

  -- Kickers
  ('Kickers','fg_0_19','Field Goals Made 0–19 Yards',2.0,null,null,null,null,210),
  ('Kickers','fg_20_29','Field Goals Made 20–29 Yards',2.0,null,null,null,null,220),
  ('Kickers','fg_30_39','Field Goals Made 30–39 Yards',3.0,null,null,null,null,230),
  ('Kickers','fg_40_49','Field Goals Made 40–49 Yards',4.0,null,null,null,null,240),
  ('Kickers','fg_50_plus','Field Goals Made 50+ Yards',5.0,null,null,null,null,250),
  ('Kickers','fg_miss_0_19','Field Goals Missed 0–19 Yards',-2.0,null,null,null,null,260),
  ('Kickers','fg_miss_20_29','Field Goals Missed 20–29 Yards',-2.0,null,null,null,null,270),
  ('Kickers','fg_miss_30_39','Field Goals Missed 30–39 Yards',-1.0,null,null,null,null,280),
  ('Kickers','fg_miss_40_49','Field Goals Missed 40–49 Yards',-1.0,null,null,null,null,290),
  ('Kickers','pat_made','Point After Attempt Made',1.0,null,null,null,null,300),
  ('Kickers','pat_missed','Point After Attempt Missed',-1.0,null,null,null,null,310),

  -- Defense / Special Teams
  ('Defense/Special Teams','dst_sack','Sack',1.0,null,null,null,null,410),
  ('Defense/Special Teams','dst_int','Interception',3.0,null,null,null,null,420),
  ('Defense/Special Teams','dst_fumble_recovery','Fumble Recovery',2.0,null,null,null,null,430),
  ('Defense/Special Teams','dst_td','Touchdown',6.0,null,null,null,null,440),
  ('Defense/Special Teams','dst_safety','Safety',2.0,null,null,null,null,450),
  ('Defense/Special Teams','dst_block_kick','Blocked Kick',2.0,null,null,null,null,460),
  ('Defense/Special Teams','dst_pa_0','Points Allowed: 0',10.0,null,null,0.0,null,470),
  ('Defense/Special Teams','dst_pa_1_6','Points Allowed: 1–6',7.0,null,null,null,null,480),
  ('Defense/Special Teams','dst_pa_7_13','Points Allowed: 7–13',4.0,null,null,null,null,490),
  ('Defense/Special Teams','dst_pa_14_20','Points Allowed: 14–20',1.0,null,null,null,null,500),
  ('Defense/Special Teams','dst_pa_21_27','Points Allowed: 21–27',0.0,null,null,null,null,510),
  ('Defense/Special Teams','dst_pa_28_34','Points Allowed: 28–34',-1.0,null,null,null,null,520),
  ('Defense/Special Teams','dst_pa_35_plus','Points Allowed: 35+',-4.0,null,null,35.0,null,530),
  ('Defense/Special Teams','dst_tfl','Tackles for Loss',1.0,null,null,null,null,540),
  ('Defense/Special Teams','dst_extra_point_return','Extra Point Returned',2.0,null,null,null,null,550)
)
insert into public.league_scoring_rules
  (season_id,room_id,category,rule_key,label,points,rate_value,rate_unit,threshold_value,notes,rule_order,active)
select cur.season_id,cur.room_id,r.category,r.rule_key,r.label,r.points,r.rate_value,r.rate_unit,r.threshold_value,r.notes,r.rule_order,true
from cur cross join rules r
on conflict(season_id,rule_key) do update
set category=excluded.category,
    label=excluded.label,
    points=excluded.points,
    rate_value=excluded.rate_value,
    rate_unit=excluded.rate_unit,
    threshold_value=excluded.threshold_value,
    notes=excluded.notes,
    rule_order=excluded.rule_order,
    active=true,
    updated_at=now();

-- Preserve host/settings that are useful for later waiver/playoff implementation.
create table if not exists public.league_weekly_host_settings (
  season_id uuid primary key references public.league_seasons(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  scoring_type text not null default 'head_to_head',
  start_scoring_week integer not null default 1,
  fractional_points boolean not null default true,
  negative_points boolean not null default true,
  playoff_teams integer not null default 6,
  playoff_weeks integer[] not null default array[15,16,17],
  playoff_reseeding boolean not null default false,
  playoff_tiebreaker text,
  divisions boolean not null default false,
  median_matchup boolean not null default false,
  second_opponent boolean not null default false,
  max_season_acquisitions integer,
  max_weekly_acquisitions integer,
  max_season_trades integer,
  yahoo_trade_end_date date,
  waiver_time_days integer,
  waiver_type text,
  weekly_waivers text,
  post_draft_players text,
  cant_cut_provider text,
  lock_benched_players boolean not null default false,
  lock_eliminated_teams boolean not null default false,
  public_viewable boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.league_weekly_host_settings enable row level security;

do $$
begin
  if not exists(
    select 1 from pg_policies
    where schemaname='public'
      and tablename='league_weekly_host_settings'
      and policyname='public read weekly host settings'
  ) then
    create policy "public read weekly host settings"
    on public.league_weekly_host_settings
    for select to anon,authenticated
    using(true);
  end if;
end $$;

grant select on public.league_weekly_host_settings to anon,authenticated;
revoke insert,update,delete on public.league_weekly_host_settings from anon,authenticated;

insert into public.league_weekly_host_settings(
  season_id,room_id,scoring_type,start_scoring_week,fractional_points,negative_points,
  playoff_teams,playoff_weeks,playoff_reseeding,playoff_tiebreaker,divisions,
  median_matchup,second_opponent,max_season_acquisitions,max_weekly_acquisitions,
  max_season_trades,yahoo_trade_end_date,waiver_time_days,waiver_type,weekly_waivers,
  post_draft_players,cant_cut_provider,lock_benched_players,lock_eliminated_teams,
  public_viewable,updated_at
)
select
  s.id,s.room_id,'head_to_head',1,true,true,
  6,array[15,16,17],false,'Best regular season record vs opponent wins',false,
  false,false,null,null,null,date '2026-11-28',1,
  'FAB w/ Continual rolling list tiebreak','Game Time - Tuesday',
  'Free Agents','None',false,false,false,now()
from public.league_seasons s
join public.rooms r on r.id=s.room_id
where r.code='GLSK26' and s.is_current
on conflict(season_id) do update
set scoring_type=excluded.scoring_type,
    start_scoring_week=excluded.start_scoring_week,
    fractional_points=excluded.fractional_points,
    negative_points=excluded.negative_points,
    playoff_teams=excluded.playoff_teams,
    playoff_weeks=excluded.playoff_weeks,
    playoff_reseeding=excluded.playoff_reseeding,
    playoff_tiebreaker=excluded.playoff_tiebreaker,
    divisions=excluded.divisions,
    median_matchup=excluded.median_matchup,
    second_opponent=excluded.second_opponent,
    max_season_acquisitions=excluded.max_season_acquisitions,
    max_weekly_acquisitions=excluded.max_weekly_acquisitions,
    max_season_trades=excluded.max_season_trades,
    yahoo_trade_end_date=excluded.yahoo_trade_end_date,
    waiver_time_days=excluded.waiver_time_days,
    waiver_type=excluded.waiver_type,
    weekly_waivers=excluded.weekly_waivers,
    post_draft_players=excluded.post_draft_players,
    cant_cut_provider=excluded.cant_cut_provider,
    lock_benched_players=excluded.lock_benched_players,
    lock_eliminated_teams=excluded.lock_eliminated_teams,
    public_viewable=excluded.public_viewable,
    updated_at=now();

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='league_scoring_rules'
  ) then
    alter publication supabase_realtime add table public.league_scoring_rules;
  end if;
end $$;

commit;

select
  (select count(*) from public.league_lineup_slots ls where ls.season_id=s.id and ls.active) as starting_slots,
  (select count(*) from public.league_scoring_rules sr where sr.season_id=s.id and sr.active) as scoring_rules,
  (select playoff_teams from public.league_weekly_host_settings hs where hs.season_id=s.id) as playoff_teams,
  (select playoff_weeks from public.league_weekly_host_settings hs where hs.season_id=s.id) as playoff_weeks
from public.league_seasons s
join public.rooms r on r.id=s.room_id
where r.code='GLSK26' and s.is_current;
