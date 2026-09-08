import './league.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';

const state = {
  room:null, teams:[], season:null, roster:[], contracts:[], rules:[], distro:[], deadlines:[], deadlineStatus:[], finance:[], contractOptions:[],
  transactions:[], trades:[], tradeAssets:[], futurePicks:[], rookieRights:[], extensionCosts:[], extensionEligibility:[],
  historySeasons:[], historyTeamSeasons:[], historyAllTime:[], historyFranchises:[], historyImportRuns:[], playerStats:[],
  gameSettings:null, lineupSlots:[], weekStates:[], schedule:[], lineups:[], weeklyScores:[], matchupScores:[], shadowStandings:[], reconciliation:[], scoringRules:[], weeklyHostSettings:null, playerProjections:[],
  lineupDataTab:'stats', lineupStatsRange:'week', lineupProjectionRange:'week', lineupBrowseWeek:null,
  matchupBrowseWeek:null, selectedMatchupId:null, scheduleTeamId:null,
  boardThreads:[], boardPosts:[], boardSelectedThread:null,
  session:loadSession(), tab:'home', loading:true, realtime:null, txFilters:{team:'',type:'',search:''},
  historySort:{key:'championships',dir:'desc'}, historySeason:'all',
};

function loadSession(){ try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');}catch{return null;} }
function saveSession(s){state.session=s; if(s)localStorage.setItem(STORAGE_KEY,JSON.stringify(s));else localStorage.removeItem(STORAGE_KEY);}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(n){return `$${(Number(n||0)/100).toFixed(2)}`;}
function bidMoney(n){return `$${Number(n||0).toFixed(0)}`;}
function teamById(id){return state.teams.find(t=>t.id===id);}
function myTeam(){return state.session?.teamId?teamById(state.session.teamId):null;}
function isCommish(){return Boolean(state.session?.commishPin);}
function rosterFor(id){return state.roster.filter(r=>r.team_id===id&&r.active!==false);}
function contractsFor(id){return state.contracts.filter(c=>c.team_id===id&&c.status==='active');}
function capUsed(id){return contractsFor(id).reduce((s,c)=>s+Number(c.cap_cost||0),0);}
function contractForPlayer(teamId,playerKey){return state.contracts.find(c=>c.team_id===teamId&&c.player_key===playerKey&&c.status==='active')||null;}
function contractYear(c){if(!c)return null;const y=Number(state.season?.season_year||c.start_year)-Number(c.start_year)+1;return Math.max(1,Math.min(Number(c.length_years||1),y));}
function contractLabel(c){if(!c)return 'No active contract';const y=contractYear(c);return `${c.length_years}-year • Year ${y} of ${c.length_years} • ${c.cap_cost} pts`;}
function openContractDeadline(){return state.deadlines.find(d=>d.deadline_type==='contracts'&&d.status==='open')||null;}
function openExtensionDeadline(){return state.deadlines.find(d=>d.deadline_type==='contract_extensions'&&d.status==='open')||null;}
function rightsFor(id){return state.rookieRights.filter(r=>r.owner_team_id===id&&r.status==='active');}
function picksFor(id){return state.futurePicks.filter(p=>p.owner_team_id===id&&p.status==='active').sort((a,b)=>a.draft_year-b.draft_year||a.draft_type.localeCompare(b.draft_type)||a.round-b.round);}
function extensionEligibilityFor(id){return state.extensionEligibility.filter(e=>e.team_id===id&&e.status==='eligible');}
function pickLabel(p){const o=teamById(p.original_team_id);return `${p.draft_year} ${p.draft_type==='rookie'?'Rookie':'Supplemental'} R${p.round}${o?` • orig. ${o.name}`:''}`;}
function myDeadlineStatus(deadlineId){const t=myTeam();if(!t||!deadlineId)return null;return state.deadlineStatus.find(s=>s.deadline_id===deadlineId&&s.team_id===t.id)||null;}

function ruleNum(key,fallback=0){const r=state.rules.find(x=>x.rule_key===key);return r?.numeric_value==null?fallback:Number(r.numeric_value);}
function fmtDate(v){if(!v)return '—'; const d=new Date(v); return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d);}
function fmtDateOnly(v){if(!v)return '—'; const [y,m,d]=String(v).split('-'); return `${Number(m)}/${Number(d)}/${y}`;}
function toast(msg,type=''){let w=document.querySelector('.toast-wrap');if(!w){w=document.createElement('div');w.className='toast-wrap';document.body.appendChild(w);}const n=document.createElement('div');n.className=`toast ${type}`;n.textContent=msg;w.appendChild(n);setTimeout(()=>n.remove(),3200);}

async function rpc(name,args={}){const {data,error}=await supabase.rpc(name,args);if(error)throw new Error(error.message);if(data&&data.ok===false)throw new Error(data.error||'Request failed.');return data;}
async function q(table,select='*',eq=[]){let x=supabase.from(table).select(select);for(const [k,v] of eq)x=x.eq(k,v);const {data,error}=await x;if(error)throw error;return data||[];}

async function loadFinance(){
  state.finance=[];
  if(!state.session||state.session.spectator)return;
  try{
    const {data,error}=await supabase.rpc('league_get_finances',{p_room_code:ROOM_CODE,p_team_id:state.session.teamId||null,p_pin:state.session.pin||'',p_commish_pin:state.session.commishPin||null});
    if(error)throw error; state.finance=data||[];
  }catch(e){console.warn('finance load',e.message);}
}


async function loadReconciliation(){
  state.reconciliation=[];
  if(!isCommish()||!state.gameSettings)return;
  try{
    const {data,error}=await supabase.rpc('league_get_reconciliation_matchups',{
      p_room_code:ROOM_CODE,
      p_commish_pin:state.session.commishPin,
      p_week:Number(state.gameSettings.current_week||1)
    });
    if(error)throw error;
    state.reconciliation=data||[];
  }catch(e){console.warn('reconciliation load',e.message);}
}

async function loadData(){
  const {data:room,error:re}=await supabase.from('rooms').select('*').eq('code',ROOM_CODE).single(); if(re)throw re; state.room=room;
  const [teams,seasons,roster,contracts,rules,distro,deadlines,statuses,options,transactions,trades,tradeAssets,futurePicks,rookieRights,extensionCosts,extensionEligibility,historySeasons,historyTeamSeasons,historyAllTime,historyFranchises,historyImportRuns,playerStats,gameSettings,lineupSlots,weekStates,schedule,lineups,weeklyScores,matchupScores,shadowStandings,scoringRules,weeklyHostSettings,playerProjections,boardThreads,boardPosts]=await Promise.all([
    q('teams','*',[['room_id',room.id]]),q('league_seasons','*',[['room_id',room.id]]),q('league_roster_entries','*',[['room_id',room.id]]),
    q('league_contracts','*'),q('league_rule_settings','*'),q('redistribution_rules','*'),q('league_deadlines','*'),q('league_deadline_team_status','*'),q('contract_options','*'),
    q('league_transactions','*'),q('league_trades','*'),q('league_trade_assets','*'),q('league_future_picks','*',[['room_id',room.id]]),q('league_rookie_rights','*',[['room_id',room.id]]),q('league_extension_costs','*'),q('league_contract_extension_eligibility','*'),
    q('league_history_seasons','*',[['room_id',room.id]]),q('league_history_team_seasons','*'),q('league_history_all_time','*',[['room_id',room.id]]),q('league_franchises','*',[['room_id',room.id]]),q('league_history_import_runs','*',[['room_id',room.id]]),q('league_player_stats','*',[['room_id',room.id]]),
    q('league_game_settings','*'),q('league_lineup_slots','*'),q('league_week_states','*'),q('league_schedule','*'),q('league_lineups','*'),q('league_weekly_player_scores','*'),q('league_matchup_live_scores','*'),q('league_shadow_standings','*'),q('league_scoring_rules','*'),q('league_weekly_host_settings','*'),q('league_player_projections','*',[['room_id',room.id]]),
    q('league_message_threads','*',[['room_id',room.id]]),q('league_message_posts','*',[['room_id',room.id]])
  ]);
  state.teams=teams.sort((a,b)=>a.sort_order-b.sort_order); state.season=seasons.find(s=>s.is_current)||seasons.sort((a,b)=>b.season_year-a.season_year)[0]||null;
  const sid=state.season?.id; state.roster=roster; state.contracts=contracts.filter(x=>x.season_id===sid); state.rules=rules.filter(x=>x.season_id===sid).sort((a,b)=>a.sort_order-b.sort_order);
  state.distro=distro.filter(x=>x.season_id===sid).sort((a,b)=>a.sort_order-b.sort_order); state.deadlines=deadlines.filter(x=>x.season_id===sid).sort((a,b)=>new Date(a.due_at)-new Date(b.due_at));
  state.deadlineStatus=statuses; state.contractOptions=options.filter(x=>x.season_id===sid&&x.active).sort((a,b)=>a.years-b.years);
  state.transactions=transactions.filter(x=>x.season_id===sid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  state.trades=trades.filter(x=>x.season_id===sid).sort((a,b)=>new Date(b.proposed_at)-new Date(a.proposed_at)); state.tradeAssets=tradeAssets;
  state.futurePicks=futurePicks; state.rookieRights=rookieRights; state.extensionCosts=extensionCosts.filter(x=>x.season_id===sid).sort((a,b)=>['QB','RB','WR','TE'].indexOf(a.position)-['QB','RB','WR','TE'].indexOf(b.position));
  state.extensionEligibility=extensionEligibility.filter(x=>x.season_id===sid);
  state.historySeasons=historySeasons.sort((a,b)=>a.season_year-b.season_year);
  const hsids=new Set(state.historySeasons.map(x=>x.id));
  state.historyTeamSeasons=historyTeamSeasons.filter(x=>hsids.has(x.history_season_id));
  state.historyAllTime=historyAllTime;
  state.historyFranchises=historyFranchises.sort((a,b)=>a.display_name.localeCompare(b.display_name));
  state.historyImportRuns=historyImportRuns.sort((a,b)=>new Date(b.started_at)-new Date(a.started_at));
  state.playerStats=playerStats.filter(x=>x.season_id===sid);
  state.gameSettings=gameSettings.find(x=>x.season_id===sid)||null;
  state.lineupSlots=lineupSlots.filter(x=>x.season_id===sid&&x.active).sort((a,b)=>a.slot_order-b.slot_order);
  state.weekStates=weekStates.filter(x=>x.season_id===sid);
  state.schedule=schedule.filter(x=>x.season_id===sid).sort((a,b)=>a.week-b.week||a.matchup_no-b.matchup_no);
  state.lineups=lineups.filter(x=>x.season_id===sid);
  state.weeklyScores=weeklyScores.filter(x=>x.season_id===sid);
  state.matchupScores=matchupScores.filter(x=>x.season_id===sid);
  state.shadowStandings=shadowStandings.filter(x=>x.season_id===sid).sort((a,b)=>Number(b.win_pct)-Number(a.win_pct)||Number(b.points_for)-Number(a.points_for));
  state.scoringRules=scoringRules.filter(x=>x.season_id===sid&&x.active).sort((a,b)=>a.rule_order-b.rule_order);
  state.weeklyHostSettings=weeklyHostSettings.find(x=>x.season_id===sid)||null;
  state.playerProjections=playerProjections.filter(x=>x.season_id===sid).sort((a,b)=>a.week-b.week||String(a.player_name).localeCompare(String(b.player_name)));
  if(state.lineupBrowseWeek==null)state.lineupBrowseWeek=Number(state.gameSettings?.current_week||1);
  if(state.matchupBrowseWeek==null)state.matchupBrowseWeek=Number(state.gameSettings?.current_week||1);
  if(state.scheduleTeamId==null&&myTeam())state.scheduleTeamId=myTeam().id;
  state.boardThreads=boardThreads.filter(x=>x.season_id===sid).sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(new Date(b.last_activity_at)-new Date(a.last_activity_at)));
  state.boardPosts=boardPosts.filter(x=>x.season_id===sid&&x.status==='active').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(state.boardSelectedThread&&!state.boardThreads.some(t=>String(t.id)===String(state.boardSelectedThread)))state.boardSelectedThread=null;
  await loadFinance();
  await loadReconciliation();
}


function pageHeading(title,subtitle='',eyebrow=''){
  return `<div class="office-page-head">${eyebrow?`<div class="office-page-eyebrow">${esc(eyebrow)}</div>`:''}<div class="office-page-title-row"><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div></div></div>`;
}
function rosterPositionClass(pos){const p=String(pos||'').toUpperCase();return ['QB','RB','WR','TE','K','DST'].includes(p)?`roster-pos roster-pos-${p}`:'roster-pos';}
function acquisitionLabel(v){return String(v||'current_roster').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function statForPlayer(playerKey){return state.playerStats.find(s=>s.player_key===playerKey);}
function playerStatLine(r,compact=false){
 const s=statForPlayer(r.player_key);
 if(!s)return compact?'':'<div class="player-stat-line stats-pending">Season stats sync pending</div>';
 const actual=Number(s.games_played||0)>0||s.fantasy_points!=null||s.position_rank!=null||s.season_rank!=null;
 if(!actual)return compact?'':'<div class="player-stat-line stats-pending">Season stats sync pending Yahoo connection</div>';
 const core=[];
 if(s.fantasy_points!=null)core.push(`<strong>${Number(s.fantasy_points).toFixed(1)}</strong> FPTS`);
 if(Number(s.games_played||0)>0)core.push(`${Number(s.games_played)} GP`);
 if(s.position_rank!=null)core.push(`${esc(s.position||r.position||'')}#${Number(s.position_rank)}`);
 else if(s.season_rank!=null)core.push(`#${Number(s.season_rank)} overall`);
 const pos=String(s.position||r.position||'').toUpperCase(),detail=[];
 if(pos==='QB'){if(s.passing_yards!=null)detail.push(`${Number(s.passing_yards)} PYD`);if(s.passing_td!=null)detail.push(`${Number(s.passing_td)} PTD`);if(s.interceptions!=null)detail.push(`${Number(s.interceptions)} INT`);}
 if(['QB','RB','WR','TE'].includes(pos)){if(s.rushing_yards!=null&&Number(s.rushing_yards)>0)detail.push(`${Number(s.rushing_yards)} RYD`);if(s.rushing_td!=null&&Number(s.rushing_td)>0)detail.push(`${Number(s.rushing_td)} RTD`);}
 if(['RB','WR','TE'].includes(pos)){if(s.receptions!=null)detail.push(`${Number(s.receptions)} REC`);if(s.receiving_yards!=null)detail.push(`${Number(s.receiving_yards)} REYD`);if(s.receiving_td!=null)detail.push(`${Number(s.receiving_td)} RETD`);}
 if(compact)return `<span class="trade-player-stats">${core.join(' • ')}</span>`;
 return `<div class="player-stat-line"><span>${core.join(' • ')||'Season stats'}</span>${detail.length?`<span class="player-stat-detail">${detail.slice(0,4).join(' • ')}</span>`:''}</div>`;
}


function currentWeek(){return Number(state.gameSettings?.current_week||1);}
function weekState(week=currentWeek()){return state.weekStates.find(w=>Number(w.week)===Number(week))||null;}
function scoreFor(playerKey,week=currentWeek()){return state.weeklyScores.find(s=>Number(s.week)===Number(week)&&s.player_key===playerKey)||null;}
function lineupFor(teamId,week=currentWeek()){return state.lineups.filter(l=>Number(l.week)===Number(week)&&l.team_id===teamId);}
function matchupForTeam(teamId,week=currentWeek()){return state.matchupScores.find(m=>Number(m.week)===Number(week)&&(m.home_team_id===teamId||m.away_team_id===teamId))||null;}
function weeklyScore(teamId,week=currentWeek()){const m=matchupForTeam(teamId,week);if(!m)return 0;return Number(m.home_team_id===teamId?m.home_score:m.away_score)||0;}
function weeklyPlayerLine(playerKey,week=currentWeek()){
  const s=scoreFor(playerKey,week);
  if(!s)return '<span class="weekly-player-score pending">—</span>';
  const st=s.game_final?'FINAL':s.game_started?(s.nfl_game_status||'LIVE'):'UPCOMING';
  return `<span class="weekly-player-score ${s.game_final?'final':s.game_started?'live':'upcoming'}"><b>${Number(s.fantasy_points||0).toFixed(2)}</b><small>${esc(st)}</small></span>`;
}
function slotEligibleRoster(slot,teamId){
  return rosterFor(teamId).filter(r=>(slot.allowed_positions||[]).includes(String(r.position||'').toUpperCase())).sort((a,b)=>a.player_name.localeCompare(b.player_name));
}
function lineupSlotCounts(){const c={QB:0,RB:0,WR:0,TE:0,FLEX:0,K:0,DST:0};for(const s of state.lineupSlots){const code=String(s.slot_code||'').replace(/[0-9]+$/,'');if(code.startsWith('FLEX'))c.FLEX++;else if(c[code]!=null)c[code]++;}return c;}
function browseWeek(){return Math.max(1,Math.min(18,Number(state.lineupBrowseWeek||currentWeek())));}
function projectionsFor(playerKey){return state.playerProjections.filter(p=>p.player_key===playerKey);}
function projectionFor(playerKey,week=browseWeek()){return state.playerProjections.find(p=>p.player_key===playerKey&&Number(p.week)===Number(week))||null;}
function n(v){return v==null||v===''?null:Number(v);}
function sumNullable(rows,key){const vals=rows.map(r=>n(r[key])).filter(v=>v!=null&&!Number.isNaN(v));return vals.length?vals.reduce((a,b)=>a+b,0):null;}
function projectionBundle(playerKey,range='week',week=browseWeek()){
  let rows=projectionsFor(playerKey);
  if(range==='week')rows=rows.filter(r=>Number(r.week)===Number(week));
  else if(range==='weeks1_4')rows=rows.filter(r=>Number(r.week)>=1&&Number(r.week)<=4);
  else if(range==='remaining')rows=rows.filter(r=>Number(r.week)>=currentWeek());
  else if(range==='season')rows=rows.filter(r=>Number(r.week)>=1);
  if(!rows.length)return null;
  const one=range==='week'?rows[0]:null;
  const keys=['projected_fantasy_points','projected_max','projected_min','passing_yards','passing_td','interceptions','rushing_attempts','rushing_yards','rushing_td','targets','receptions','receiving_yards','receiving_td','return_yards','return_td','fumbles_lost'];
  const out={};
  keys.forEach(k=>out[k]=sumNullable(rows,k));
  out.projected_position_rank=one?.projected_position_rank??null;
  out.opponent_team=one?.opponent_team||null;
  out.is_home=one?.is_home;
  out.game_start_at=one?.game_start_at||null;
  out.bye_week=one?.bye_week??rows.find(r=>r.bye_week!=null)?.bye_week??null;
  out.weeks=rows.length;
  return out;
}
function actualBundle(playerKey,range='week',week=browseWeek()){
  if(range==='season'){
    const s=statForPlayer(playerKey); if(!s)return null;
    return {
      fantasy_points:n(s.fantasy_points),position_rank:s.position_rank??null,
      passing_yards:n(s.passing_yards),passing_td:n(s.passing_td),interceptions:n(s.interceptions),
      rushing_attempts:null,rushing_yards:n(s.rushing_yards),rushing_td:n(s.rushing_td),
      targets:null,receptions:n(s.receptions),receiving_yards:n(s.receiving_yards),receiving_td:n(s.receiving_td),
      games_played:n(s.games_played)
    };
  }
  const s=scoreFor(playerKey,week); if(!s)return null;
  const raw=(s.raw_stats&&typeof s.raw_stats==='object')?s.raw_stats:{};
  const take=(...keys)=>{for(const k of keys){if(raw[k]!=null)return n(raw[k]);}return null;};
  return {
    fantasy_points:n(s.fantasy_points),
    position_rank:raw.position_rank??null,
    passing_yards:take('passing_yards','pass_yards','passingYards'),
    passing_td:take('passing_td','passing_tds','pass_td','passingTouchdowns'),
    interceptions:take('interceptions','interceptions_thrown','ints'),
    rushing_attempts:take('rushing_attempts','rush_attempts','carries'),
    rushing_yards:take('rushing_yards','rush_yards'),
    rushing_td:take('rushing_td','rushing_tds','rush_td'),
    targets:take('targets','receiving_targets'),
    receptions:take('receptions','rec'),
    receiving_yards:take('receiving_yards','rec_yards'),
    receiving_td:take('receiving_td','receiving_tds','rec_td')
  };
}
function fmtStat(v,d=0){return v==null||Number.isNaN(Number(v))?'—':Number(v).toFixed(d);}
function lineupGameLabel(playerKey,week=browseWeek()){
  const p=projectionFor(playerKey,week);
  if(p?.bye_week!=null&&Number(p.bye_week)===Number(week))return {main:'BYE',sub:`Week ${week}`};
  if(!p)return {main:'—',sub:'Schedule pending'};
  const opp=p.opponent_team?`${p.is_home===false?'@':'vs'} ${p.opponent_team}`:'Opponent pending';
  const when=p.game_start_at?new Intl.DateTimeFormat('en-US',{weekday:'short',hour:'numeric',minute:'2-digit'}).format(new Date(p.game_start_at)):'Kickoff pending';
  return {main:opp,sub:when};
}
function projectedTeamTotal(teamId,range='week',week=browseWeek()){
  return lineupFor(teamId,week).reduce((sum,l)=>sum+Number(projectionBundle(l.player_key,range,week)?.projected_fantasy_points||0),0);
}

function topBar(){
 const t=myTeam(),rosterCount=t?rosterFor(t.id).length:0,limit=state.season?.roster_limit||18,cap=t?capUsed(t.id):0;
 return `<header class="topbar office-topbar"><div class="topbar-inner office-topbar-inner">
   <button class="office-brand-button" data-tab="home" aria-label="League Office home">
     <div class="office-mark">GL</div>
     <div class="brand"><div class="brand-kicker">${state.season?.season_year||2026} • League Office</div><div class="brand-title">${esc(LEAGUE_NAME)}</div></div>
   </button>
   <div class="office-user-area">
     ${t?`<div class="office-user-stats"><span><b>${bidMoney(t.remaining_budget)}</b> bids</span><span><b>${rosterCount}/${limit}</b> roster</span><span><b>${cap}/100</b> cap</span></div>`:''}
     <div class="user-chip"><span class="status-dot live"></span><div class="user-chip-text"><div class="user-team">${t?`${esc(t.name)}${isCommish()?' • Commissioner':''}`:state.session?.spectator?'Spectator':'League'}</div><div class="user-budget">${t?'Connected':'League view'}</div></div><button class="btn-link office-leave" data-action="leave">Leave</button></div>
   </div>
 </div></header>`;
}
function bottomNav(){
 const items=[['home','⌂','Home'],['lineup','☑','Lineup'],['matchups','VS','Matchups'],['schedule','◫','Schedule'],['standings','≡','Standings'],['board','✎','Board'],['teams','♟','Teams'],['contracts','▤','Contracts'],['trades','⇄','Trades'],['transactions','☷','Transactions'],['history','★','History'],['rules','⚙','Rules'],['deadlines','◷','Deadlines'],['finances','$','Finances']];
 if(isCommish())items.push(['reconcile','✓','Reconcile']);
 return `<nav class="bottom-nav office-bottom-nav"><div class="bottom-nav-inner">${items.map(([t,i,l])=>`<button class="nav-btn ${state.tab===t?'active':''}" data-tab="${t}"><span>${i}</span>${l}</button>`).join('')}</div></nav>`;
}

function dashboard(){
 const rosterLimit=state.season?.roster_limit||18,full=state.teams.filter(t=>rosterFor(t.id).length>=rosterLimit).length,totalBids=state.teams.reduce((s,t)=>s+Number(t.remaining_budget||0),0),open=state.deadlines.filter(d=>d.status==='open').length;
 const next=state.deadlines.find(d=>d.status==='open'&&new Date(d.due_at)>new Date());
 const me=myTeam();
 return `<section class="office-hero office-home-hero"><div><div class="office-kicker">${state.season?.season_year||2026} League Year</div><h1>League Office</h1><p>One home for rosters, contracts, transactions, rules, deadlines, finances and league history.</p></div>${me?`<div class="home-team-summary"><span>Your Team</span><strong>${esc(me.name)}</strong><div>${rosterFor(me.id).length}/${rosterLimit} roster • ${bidMoney(me.remaining_budget)} bids • ${capUsed(me.id)}/100 cap</div></div>`:''}</section>
 <div class="kpi-grid office-kpi-grid"><div class="card kpi"><div class="kpi-label">Full Rosters</div><div class="kpi-value">${full}<span class="kpi-denom">/12</span></div><div class="kpi-sub">${rosterLimit}-player limit</div></div><div class="card kpi"><div class="kpi-label">Bid Dollars</div><div class="kpi-value">${totalBids}</div><div class="kpi-sub">remaining league-wide</div></div><div class="card kpi"><div class="kpi-label">Contracts</div><div class="kpi-value">${state.contracts.filter(c=>c.status==='active').length}</div><div class="kpi-sub">active contracts</div></div><div class="card kpi"><div class="kpi-label">Open Deadlines</div><div class="kpi-value">${open}</div><div class="kpi-sub">need attention</div></div></div>
 ${next?`<div class="owner-banner office-deadline-banner"><div><span class="banner-label">NEXT DEADLINE</span><strong>${esc(next.title)}</strong></div><div>${fmtDate(next.due_at)}</div></div>`:''}
 <div class="office-grid two office-home-grid"><section class="office-section"><div class="office-section-head"><div><h2>League Snapshot</h2><div class="section-caption">Roster, bid and cap status at a glance</div></div><button class="btn btn-sm btn-outline" data-tab="teams">View Rosters</button></div>${teamCards()}</section><div><section class="office-section"><div class="office-section-head"><div><h2>Draft Rooms</h2><div class="section-caption">Jump back into any 2026 draft phase</div></div></div><div class="draft-links"><a class="draft-link" href="/"><strong>⚡</strong><span>Auction</span><small>Top 40</small></a><a class="draft-link" href="/supplemental"><strong>↔</strong><span>Supplemental</span><small>2-round snake</small></a><a class="draft-link" href="/phase3"><strong>⇅</strong><span>Roster Fill</span><small>To 18 players</small></a></div></section><section class="office-section"><div class="office-section-head"><div><h2>${isCommish()?'Commissioner Center':'League Access'}</h2><div class="section-caption">${isCommish()?'Management controls are unlocked':'Commissioner-only controls stay protected'}</div></div></div><div class="card card-pad office-info-card">${isCommish()?'<strong>Commissioner mode active</strong><p>Manage rosters, contracts, trades, rules, deadlines and finances from the tabs below.</p>':'<strong>Owner mode</strong><p>You can manage your team, submit contracts, propose trades and review league records.</p>'}</div></section></div></div>`;
}
function teamCards(){
 const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;
 return `<div class="team-office-grid compact-team-grid">${state.teams.map(t=>{
   const rc=rosterFor(t.id).length,cu=capUsed(t.id);
   return `<div class="card office-team-card compact-team-card"><div class="team-card-top"><div class="office-team-name">${esc(t.name)}</div><span class="team-roster-pill">${rc}/${lim}</span></div><div class="team-card-bars"><div class="mini-progress"><span style="width:${Math.min(100,rc/lim*100)}%"></span></div><div class="team-card-meta"><span><b>${bidMoney(t.remaining_budget)}</b> bids</span><span><b>${cu}/${cap}</b> cap</span><span><b>${contractsFor(t.id).length}</b> contracts</span></div></div></div>`;
 }).join('')}</div>`;
}
function commissionerAddPlayerForm(){
 if(!isCommish())return '';
 return `<section class="card office-form office-section">
   <div class="office-section-head"><div><h2>Commissioner • Add Player to Roster</h2><div class="small muted">Manual roster correction/add. Before Phase 3 starts, the player is also removed from the Roster-Fill player pool and the team's open spots update automatically.</div></div></div>
   <div class="form-grid">
     <div class="field"><label>Team</label><select id="manual-add-team" class="input">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div>
     <div class="field"><label>Player</label><input id="manual-add-player" class="input" placeholder="Player or D/ST name"></div>
     <div class="field"><label>NFL Team</label><input id="manual-add-nfl" class="input" placeholder="e.g. BUF or HOU" maxlength="4"></div>
     <div class="field"><label>Position</label><select id="manual-add-position" class="input"><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>K</option><option>DST</option></select></div>
   </div>
   <button class="btn btn-primary" data-action="commish-add-player">Add to Roster</button>
 </section>`;
}


function boardThreadById(id){return state.boardThreads.find(t=>String(t.id)===String(id))||null;}
function boardPostsFor(threadId){return state.boardPosts.filter(p=>String(p.thread_id)===String(threadId));}
function boardView(){
 const me=myTeam();
 const threads=state.boardThreads;
 const selected=boardThreadById(state.boardSelectedThread)||threads[0]||null;
 if(selected&&!state.boardSelectedThread)state.boardSelectedThread=selected.id;
 const posts=selected?boardPostsFor(selected.id):[];
 const author=selected?teamById(selected.author_team_id):null;

 return `${pageHeading('Message Board','League discussions, announcements and trash talk in one place.','League Community')}
 ${me&&!state.session?.spectator?`<section class="card card-pad office-section board-compose-card">
   <div class="office-section-head"><div><h2>Start a Discussion</h2><div class="section-caption">Posting as ${esc(me.name)}</div></div></div>
   <div class="board-compose-grid">
     <input id="board-thread-title" class="input" maxlength="120" placeholder="Discussion title">
     <textarea id="board-thread-body" class="input board-textarea" maxlength="5000" placeholder="What do you want to talk about?"></textarea>
     <div class="board-compose-actions"><span>Team name and timestamp will be shown with your post.</span><button class="btn btn-primary" data-action="board-create-thread">Post Discussion</button></div>
   </div>
 </section>`:''}

 <div class="board-layout">
   <section class="card board-thread-list">
     <div class="board-list-head"><div><strong>Discussions</strong><span>${threads.length} active thread${threads.length===1?'':'s'}</span></div></div>
     <div class="board-thread-items">${threads.length?threads.map(t=>{
       const team=teamById(t.author_team_id);
       const active=selected&&String(selected.id)===String(t.id);
       return `<button class="board-thread-item ${active?'active':''}" data-board-thread="${t.id}">
         <div class="board-thread-title-row"><strong>${t.pinned?'📌 ':''}${esc(t.title)}</strong>${t.status==='locked'?'<span class="board-status-chip">LOCKED</span>':''}</div>
         <div class="board-thread-preview">${esc(t.body.length>115?t.body.slice(0,115)+'…':t.body)}</div>
         <div class="board-thread-meta"><span>${esc(team?.name||'League')}</span><span>${Number(t.reply_count||0)} repl${Number(t.reply_count||0)===1?'y':'ies'}</span><span>${fmtDate(t.last_activity_at)}</span></div>
       </button>`;
     }).join(''):'<div class="board-empty"><strong>No discussions yet.</strong><span>Start the first GLSK message-board thread.</span></div>'}</div>
   </section>

   <section class="card board-discussion">
     ${selected?`<div class="board-discussion-head">
       <div><div class="board-thread-flags">${selected.pinned?'<span>PINNED</span>':''}${selected.status==='locked'?'<span>LOCKED</span>':''}</div><h2>${esc(selected.title)}</h2><div class="board-discussion-meta">Started by <strong>${esc(author?.name||'League')}</strong> • ${fmtDate(selected.created_at)}</div></div>
       ${isCommish()?`<div class="board-mod-actions">
         <button class="btn btn-sm btn-outline" data-board-action="${selected.pinned?'unpin':'pin'}" data-thread-id="${selected.id}">${selected.pinned?'Unpin':'Pin'}</button>
         <button class="btn btn-sm btn-outline" data-board-action="${selected.status==='locked'?'unlock':'lock'}" data-thread-id="${selected.id}">${selected.status==='locked'?'Unlock':'Lock'}</button>
         <button class="btn btn-sm btn-reset" data-board-action="archive" data-thread-id="${selected.id}">Archive</button>
       </div>`:''}
     </div>
     <article class="board-root-post"><div class="board-avatar">${esc((author?.name||'GL').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div><div class="board-post-author"><strong>${esc(author?.name||'League')}</strong><span>${fmtDate(selected.created_at)}</span></div><div class="board-post-body">${esc(selected.body).replaceAll('\n','<br>')}</div></div></article>
     <div class="board-replies-head"><strong>${posts.length} ${posts.length===1?'Reply':'Replies'}</strong></div>
     <div class="board-replies">${posts.map(p=>{const team=teamById(p.author_team_id);return `<article class="board-reply"><div class="board-avatar">${esc((team?.name||'GL').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase())}</div><div><div class="board-post-author"><strong>${esc(team?.name||'League')}</strong><span>${fmtDate(p.created_at)}</span></div><div class="board-post-body">${esc(p.body).replaceAll('\n','<br>')}</div></div></article>`;}).join('')||'<div class="board-no-replies">No replies yet.</div>'}</div>
     ${me&&!state.session?.spectator&&selected.status!=='locked'?`<div class="board-reply-compose"><textarea id="board-reply-body" class="input board-textarea" maxlength="5000" placeholder="Reply as ${esc(me.name)}"></textarea><div><span>Keep the discussion going.</span><button class="btn btn-primary" data-action="board-reply" data-thread-id="${selected.id}">Post Reply</button></div></div>`:selected.status==='locked'?'<div class="board-locked-notice">This discussion has been locked by the commissioner.</div>':''}
     `:'<div class="board-empty discussion-empty"><strong>Select a discussion</strong><span>Choose a thread from the left to read and reply.</span></div>'}
   </section>
 </div>`;
}

function teamsView(){
 const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;
 return `${pageHeading('Teams & Rosters','Live roster, bid-dollar and contract status for every franchise.','League Management')}${commissionerAddPlayerForm()}<div class="team-office-grid roster-team-grid">${state.teams.map(t=>{
   const roster=rosterFor(t.id).slice().sort((a,b)=>(a.position||'').localeCompare(b.position||'')||a.player_name.localeCompare(b.player_name));
   const cu=capUsed(t.id);
   return `<details class="card office-team-card roster-team-card"><summary class="team-summary"><div class="team-summary-main"><div class="office-team-name">${esc(t.name)}</div><div class="team-summary-sub">${roster.length===lim?'Roster full':`${lim-roster.length} roster spot${lim-roster.length===1?'':'s'} open`}</div></div><div class="team-summary-metrics"><span><b>${roster.length}/${lim}</b><small>Roster</small></span><span><b>${bidMoney(t.remaining_budget)}</b><small>Bids</small></span><span><b>${cu}/${cap}</b><small>Cap</small></span></div><span class="details-chevron">⌄</span></summary><div class="team-roster-body">${roster.map(r=>{
     const c=contractForPlayer(t.id,r.player_key);
     const canDrop=myTeam()?.id===t.id&&!state.session?.spectator;
     const penalty=c?(contractYear(c)===1?Number(c.cap_cost||0)*2:({2:5,3:10,4:20}[Number(c.length_years)]||0)):0;
     return `<div class="roster-player-row"><span class="${rosterPositionClass(r.position)}">${esc(r.position||'—')}</span><div class="roster-player-main"><div class="contract-player">${esc(r.player_name)}</div><div class="roster-player-meta">${esc(r.nfl_team||'')} <span>•</span> ${esc(acquisitionLabel(r.acquisition_type))}</div>${playerStatLine(r)}${c?`<div class="contract-detail contract-active">${esc(contractLabel(c))}${penalty?` <span>• Drop fine ${penalty}</span>`:''}</div>`:'<div class="contract-detail contract-none">No active contract</div>'}</div><div class="roster-player-actions">${c?'<span class="status-chip contract-chip">Contract</span>':''}${canDrop?`<button class="btn btn-sm btn-reset" data-drop-player="${esc(r.player_key)}" data-drop-name="${esc(r.player_name)}" data-drop-penalty="${penalty}">Drop</button>`:''}${isCommish()?`<button class="btn btn-sm btn-outline" data-exception-drop="${esc(r.player_key)}" data-exception-team="${t.id}" data-drop-name="${esc(r.player_name)}">Retire/Ban</button>`:''}</div></div>`;
   }).join('')||'<div class="empty-tight">No roster entries.</div>'}</div></details>`;
 }).join('')}</div>`;
}

function extensionCostReference(){
 const positions=['QB','RB','WR','TE'];
 return `<section class="card card-pad office-section extension-reference-card">
   <div class="office-section-head"><div><h2>Contract Extension Cost Reference</h2><div class="small muted">Based on the actual top 3 Free Agent Auction bids at each position. Costs are rounded to the nearest whole bid dollar.</div></div>${isCommish()?'<button class="btn btn-sm btn-outline" data-action="refresh-extension-costs">Refresh</button>':''}</div>
   <div class="extension-cost-scroll">
     <div class="extension-cost-grid">
       <div class="extension-grid-head">Position</div>
       <div class="extension-grid-head">Top 3 Auction Bids</div>
       <div class="extension-grid-head">Average Bid</div>
       <div class="extension-grid-head"><strong>2-Year → 3-Year</strong><span>25% of average</span></div>
       <div class="extension-grid-head"><strong>3-Year → 4-Year</strong><span>40% of average</span></div>
       ${positions.map(pos=>{const c=state.extensionCosts.find(x=>x.position===pos);return `
         <div class="extension-pos">${pos}</div>
         <div class="extension-bids">${c&&c.top_bid_3!=null?`${c.top_bid_1} • ${c.top_bid_2} • ${c.top_bid_3}`:'N/A'}</div>
         <div class="extension-average">${c?.average_bid!=null?Number(c.average_bid).toFixed(1):'—'}</div>
         <div class="extension-cost-value">${c?.cost_2_to_3!=null?`<strong>${c.cost_2_to_3}</strong><span>bid dollars</span>`:'—'}</div>
         <div class="extension-cost-value">${c?.cost_3_to_4!=null?`<strong>${c.cost_3_to_4}</strong><span>bid dollars</span>`:'—'}</div>`;}).join('')}
     </div>
   </div>
   <div class="extension-rule-note"><strong>Eligibility reminder:</strong> Only a contracted player acquired by trade during the current season can be extended. A 2-year contract may only become a 3-year contract; a 3-year contract may only become a 4-year contract.</div>
 </section>`;
}
function extensionPanel(){
 const t=myTeam(); if(!t||state.session?.spectator)return '';
 const rows=extensionEligibilityFor(t.id).map(e=>{const c=state.contracts.find(x=>x.id===e.contract_id&&x.status==='active'); if(!c)return null; const r=rosterFor(t.id).find(x=>x.player_key===c.player_key); const cost=state.extensionCosts.find(x=>x.position===r?.position); const bid=e.eligible_to_years===3?cost?.cost_2_to_3:cost?.cost_3_to_4; return {e,c,r,bid};}).filter(Boolean);
 const deadline=openExtensionDeadline();
 if(!rows.length)return '';
 return `<section class="card owner-contract-card office-section"><div class="row between gap-8 wrap"><div><div class="section-title">Traded Contract Extensions</div><div class="small muted">${deadline?`${esc(deadline.title)} • due ${fmtDate(deadline.due_at)}`:'Commissioner must open a Contract Extensions deadline before an extension can be exercised.'}</div></div></div>${rows.map(({e,c,r,bid})=>`<div class="contract-row"><div><div class="contract-player">${esc(c.player_name)}</div><div class="contract-sub">${esc(r?.position||'')} • ${esc(contractLabel(c))} → ${e.eligible_to_years}-year • ${e.eligible_to_years===3?25:45} pts</div><div class="contract-detail">Extension fee: <strong>${bid==null?'N/A':`${bid} bid dollars`}</strong></div></div>${deadline?`<button class="btn btn-sm btn-green" data-extend-contract="${e.id}" data-player-name="${esc(c.player_name)}" data-extension-cost="${bid??''}">Extend</button>`:'<span class="tag">WAITING</span>'}</div>`).join('')}</section>`;
}

function contractsView(){
 const cap=state.season?.salary_cap_points||100;
 const body=state.teams.map(t=>{
   const rows=contractsFor(t.id).sort((a,b)=>a.end_year-b.end_year||a.player_name.localeCompare(b.player_name));
   return `<section class="contract-team"><div class="contract-team-head"><div class="contract-team-name">${esc(t.name)}</div><strong>${capUsed(t.id)}/${cap} pts</strong></div><div class="contract-list">${rows.length?rows.map(c=>`<div class="contract-row"><div><div class="contract-player">${esc(c.player_name)}</div><div class="contract-sub">${esc(contractLabel(c))} • ${c.start_year}–${c.end_year}</div></div><div>${isCommish()?`<button class="btn btn-sm btn-reset" data-void-contract="${c.id}">Void</button>`:`<span class="cap-badge">${c.cap_cost}</span>`}</div></div>`).join(''):'<div class="empty-tight">No active contracts.</div>'}</div></section>`;
 }).join('');
 return `${pageHeading('Contracts & Salary Cap','Assign, track and extend contracts while staying under the 100-point cap.','Roster Management')}<div class="contract-cost-strip">${state.contractOptions.map(o=>`<div><strong>${o.years}-Year</strong><span>${o.cap_cost} pts</span></div>`).join('')}</div>${extensionCostReference()}${extensionPanel()}${ownerContractPanel()}${isCommish()?contractForm():''}${body}`;
}
function ownerContractPanel(){
 const t=myTeam();
 if(!t||state.session?.spectator)return '';
 const deadline=openContractDeadline();
 const cap=state.season?.salary_cap_points||100;
 if(!deadline){
   return `<section class="card owner-contract-card office-section"><div class="section-title">Your New Contracts</div><div class="small muted">Owner contract assignments are currently closed. The commissioner can open a Contracts deadline from the Deadlines tab.</div></section>`;
 }
 const expired=new Date()>new Date(deadline.due_at);
 const locked=expired&&deadline.auto_lock;
 const status=myDeadlineStatus(deadline.id);
 const eligible=rosterFor(t.id).filter(r=>{const c=contractForPlayer(t.id,r.player_key);return !c||(c.source==='owner_assignment'&&Number(c.start_year)===Number(state.season?.season_year||2026));});
 const pending=contractsFor(t.id).filter(c=>c.source==='owner_assignment'&&Number(c.start_year)===Number(state.season?.season_year||2026));
 return `<section class="card owner-contract-card office-section">
   <div class="row between gap-8 wrap"><div><div class="section-title">Assign New Contracts</div><div class="small muted">${esc(deadline.title)} • due ${fmtDate(deadline.due_at)}${deadline.auto_lock?' • auto-lock':''}</div></div><div class="cap-badge">${capUsed(t.id)}/${cap} pts used</div></div>
   ${locked?'<div class="error" style="margin-top:10px">This contract deadline is locked.</div>':`
   <div class="form-grid" style="margin-top:12px">
     <div class="field"><label>Player</label><select id="owner-contract-player" class="input"><option value="">Select player…</option>${eligible.map(r=>{const c=contractForPlayer(t.id,r.player_key);return `<option value="${esc(r.player_key)}">${esc(r.player_name)}${c?` • currently ${c.length_years}yr`:''}</option>`;}).join('')}</select></div>
     <div class="field"><label>Contract length</label><select id="owner-contract-years" class="input">${state.contractOptions.map(o=>`<option value="${o.years}">${o.years} years • ${o.cap_cost} pts</option>`).join('')}</select></div>
   </div>
   <div class="inline-actions"><button class="btn btn-primary" data-action="owner-save-contract">Assign / Update Contract</button><button class="btn btn-green" data-action="owner-submit-contracts" data-deadline-id="${deadline.id}">${status?.status==='submitted'?'Resubmit Contract Assignments':'Submit Contract Assignments'}</button></div>`}
   ${pending.length?`<div class="owner-pending"><div class="small muted" style="margin-bottom:6px">Your new ${state.season?.season_year||2026} assignments:</div>${pending.map(c=>`<div class="contract-row"><div><div class="contract-player">${esc(c.player_name)}</div><div class="contract-sub">${esc(contractLabel(c))}</div></div>${locked?'':`<button class="btn btn-sm btn-reset" data-owner-remove-contract="${c.id}" data-deadline-id="${deadline.id}">Remove</button>`}</div>`).join('')}</div>`:''}
   ${status?`<div class="small muted" style="margin-top:8px">Submission status: <strong>${esc(status.status)}</strong>${status.submitted_at?` • ${fmtDate(status.submitted_at)}`:''}</div>`:''}
 </section>`;
}
function contractForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner • Add / Update Contract</div><div class="form-grid"><div class="field"><label>Team</label><select id="contract-team" class="input">${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Player</label><input id="contract-player" class="input" list="roster-player-list" placeholder="Player name"><datalist id="roster-player-list">${state.roster.map(r=>`<option value="${esc(r.player_name)}"></option>`).join('')}</datalist></div><div class="field"><label>Length</label><select id="contract-years" class="input">${state.contractOptions.map(o=>`<option value="${o.years}">${o.years} years • ${o.cap_cost} pts</option>`).join('')}</select></div><div class="field"><label>Start year</label><input id="contract-start" type="number" class="input" value="${state.season?.season_year||2026}"></div></div><button class="btn btn-primary" data-action="save-contract">Save Contract</button></section>`;}

function tradeAssetLabel(a){
 if(a.asset_type==='bid_dollars')return `${a.bid_amount} bid dollars`;
 if(a.asset_type==='rookie_pick'||a.asset_type==='supplemental_pick'){const p=state.futurePicks.find(x=>x.id===a.pick_id);return p?pickLabel(p):'Future pick';}
 if(a.asset_type==='rookie_rights')return `Rookie rights: ${a.player_name||a.asset_key}`;
 return a.player_name||a.asset_key||a.asset_type;
}
function tradeSide(teamId,cls,sideLabel='Assets'){
 const team=teamById(teamId),roster=rosterFor(teamId).slice().sort((a,b)=>{
   const posOrder={QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
   return (posOrder[a.position]||9)-(posOrder[b.position]||9)||a.player_name.localeCompare(b.player_name);
 });
 const rights=rightsFor(teamId);
 const nextYear=Number(state.season?.season_year||2026)+1;
 const rookiePicks=picksFor(teamId)
   .filter(p=>p.draft_year===nextYear&&p.draft_type==='rookie')
   .sort((a,b)=>Number(a.round)-Number(b.round)||String(a.id).localeCompare(String(b.id)));
 const playerRows=roster.map(r=>{
   const c=contractForPlayer(teamId,r.player_key),hasRights=rights.some(x=>x.player_key===r.player_key);
   return `<label class="trade-player-row">
     <span class="trade-check-cell"><input type="checkbox" class="${cls}" data-type="player" data-key="${esc(r.player_key)}" data-name="${esc(r.player_name)}"></span>
     <span class="${rosterPositionClass(r.position)} trade-pos">${esc(r.position||'—')}</span>
     <span class="trade-player-info"><strong>${esc(r.player_name)}</strong><small>${esc(r.nfl_team||'')} ${c?`• ${esc(contractLabel(c))}`:'• No contract'}${hasRights?' • Rights follow player':''}</small>${playerStatLine(r,true)}</span>
     <span class="trade-cap-cell">${c?`${c.cap_cost} pts`:'—'}</span>
   </label>`;
 }).join('');
 const pickRow=(pk)=>`<label class="draft-pick-option">
   <input type="checkbox" class="${cls}" data-type="rookie_pick" data-pick-id="${pk.id}">
   <span class="draft-pick-round">Round ${Number(pk.round)}</span>
   ${pk.original_team_id&&pk.original_team_id!==teamId?`<span class="draft-pick-origin">from ${esc(teamById(pk.original_team_id)?.name||'another team')}</span>`:''}
 </label>`;
 return `<div class="trade-team-panel">
   <div class="trade-team-panel-head">
     <div><span>${esc(sideLabel)}</span><strong>${esc(team?.name||'Team')}</strong></div>
     <div class="trade-team-metrics"><span><b>${bidMoney(team?.remaining_budget||0)}</b> bids</span><span><b>${capUsed(teamId)}/100</b> cap</span></div>
   </div>
   <div class="trade-table-head"><span></span><span>Pos</span><span>Player</span><span>Cap</span></div>
   <div class="trade-player-list">${playerRows||'<div class="trade-empty">No rostered players.</div>'}</div>
   <div class="trade-picks-section">
     <div class="trade-picks-header"><div><strong>${nextYear} Rookie Draft Picks</strong><span>Only next year's Rookie Draft picks are tradable.</span></div></div>
     <div class="draft-pick-grid rookie-only-picks">${rookiePicks.length?rookiePicks.map(pickRow).join(''):'<div class="small muted trade-no-picks">No rookie picks owned.</div>'}</div>
   </div>
   <div class="trade-bid-row"><label>Bid dollars</label><input id="${cls==='trade-give'?'trade-give-bids':'trade-receive-bids'}" class="input" type="number" min="0" max="${team?.remaining_budget||0}" value="0"><span>max ${bidMoney(team?.remaining_budget||0)}</span></div>
 </div>`;
}
function tradeSummary(tr){
 const assets=state.tradeAssets.filter(a=>a.trade_id===tr.id),p=teamById(tr.proposer_team_id),q=teamById(tr.partner_team_id);
 const give=assets.filter(a=>a.direction==='proposer_to_partner'),recv=assets.filter(a=>a.direction==='partner_to_proposer');
 return `<div class="trade-columns"><div><div class="asset-title">${esc(p?.name||'Proposer')} sends</div>${give.map(a=>`<div class="trade-line">${esc(tradeAssetLabel(a))}</div>`).join('')||'<div class="small muted">Nothing</div>'}</div><div><div class="asset-title">${esc(q?.name||'Partner')} sends</div>${recv.map(a=>`<div class="trade-line">${esc(tradeAssetLabel(a))}</div>`).join('')||'<div class="small muted">Nothing</div>'}</div></div>`;
}
function tradesView(){
 const me=myTeam();
 const others=me?state.teams.filter(t=>t.id!==me.id):[];
 const partnerId=state.tradePartner&&others.some(t=>t.id===state.tradePartner)?state.tradePartner:others[0]?.id;
 const partner=teamById(partnerId);
 const visible=state.trades.filter(tr=>isCommish()||!me||tr.proposer_team_id===me.id||tr.partner_team_id===me.id);
 return `${pageHeading('Trades','Select a partner, choose assets from each roster, then submit the deal for owner and commissioner approval.','Transactions')}
 ${me&&!state.session?.spectator?`<section class="trade-workspace">
   <div class="trade-toolbar card">
     <div class="trade-toolbar-copy"><span class="trade-step">1</span><div><strong>Choose trade partner</strong><small>Only assets currently owned by each team are selectable.</small></div></div>
     <select id="trade-partner" class="input trade-partner-select">${others.map(t=>`<option value="${t.id}" ${t.id===partnerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
   </div>
   <div class="trade-builder-v2">
     ${tradeSide(me.id,'trade-give','You Send')}
     <div class="trade-swap-mark" aria-hidden="true">⇄</div>
     ${partner?tradeSide(partner.id,'trade-receive','You Receive'):''}
   </div>
   <div class="trade-submit-card card">
     <div class="trade-submit-summary"><span class="trade-step">2</span><div><strong>Review & submit</strong><small id="trade-selection-summary">Select players, rights, picks or bid dollars above.</small></div></div>
     <div class="trade-submit-actions"><input id="trade-note" class="input" placeholder="Optional trade note"><button class="btn btn-primary" data-action="propose-trade">Send Trade Proposal</button></div>
     <div class="trade-rule-note">Contracted players retain their current contract year and original point value. The platform blocks deals that would leave either team above the 100-point contract cap.</div>
   </div>
 </section>`:''}
 <section class="office-section trade-inbox"><div class="office-section-head"><div><h2>Trade Activity</h2><div class="section-caption">Proposed, pending commissioner review, completed and declined deals</div></div><span class="trade-count">${visible.length}</span></div>
 <div class="list-stack">${visible.length?visible.map(tr=>{const proposer=teamById(tr.proposer_team_id),partnerT=teamById(tr.partner_team_id);return `<div class="card trade-card trade-card-v2"><div class="trade-card-head"><div><div class="deadline-title">${esc(proposer?.name)} <span class="trade-arrow">⇄</span> ${esc(partnerT?.name)}</div><div class="deadline-meta">Proposed ${fmtDate(tr.proposed_at)}${tr.note?` • ${esc(tr.note)}`:''}</div></div><span class="trade-status ${tr.status}">${esc(tr.status.replaceAll('_',' '))}</span></div>${tradeSummary(tr)}<div class="inline-actions trade-card-actions">${me?.id===tr.partner_team_id&&tr.status==='proposed'?`<button class="btn btn-sm btn-green" data-trade-response="accept" data-trade-id="${tr.id}">Accept Trade</button><button class="btn btn-sm btn-reset" data-trade-response="reject" data-trade-id="${tr.id}">Reject</button>`:''}${me?.id===tr.proposer_team_id&&['proposed','pending_commish'].includes(tr.status)?`<button class="btn btn-sm btn-outline" data-cancel-trade="${tr.id}">Cancel Proposal</button>`:''}${isCommish()&&tr.status==='pending_commish'?`<button class="btn btn-sm btn-green" data-commish-trade="approve" data-trade-id="${tr.id}">Approve Trade</button><button class="btn btn-sm btn-reset" data-commish-trade="deny" data-trade-id="${tr.id}">Deny</button>`:''}</div></div>`;}).join(''):'<div class="card empty">No trade activity yet.</div>'}</div></section>`;
}
function transactionTypeLabel(t){return ({auction:'Auction',supplemental:'Supplemental',phase3:'Roster Fill',trade:'Trade',drop:'Drop',contract_assigned:'Contract Assigned',contract_removed:'Contract Removed',contract_extended:'Contract Extended',contract_voided:'Contract Voided',rookie_rights_transfer:'Rookie Rights',commissioner_correction:'Commissioner Correction',add:'Add'}[t]||t.replaceAll('_',' '));}
function transactionsView(){
 const f=state.txFilters||{team:'',type:'',search:''},types=[...new Set(state.transactions.map(t=>t.transaction_type))].sort();
 const rows=state.transactions.filter(tx=>(!f.team||tx.team_id===f.team||tx.other_team_id===f.team)&&(!f.type||tx.transaction_type===f.type)&&(!f.search||`${tx.player_name||''} ${tx.description||''}`.toLowerCase().includes(f.search.toLowerCase())));
 return `${pageHeading('Transactions','Permanent league ledger for trades, adds, drops, contracts, draft picks and commissioner corrections.','League Ledger')}<section class="card card-pad office-section tx-filter-card"><div class="tx-filters"><select id="tx-team" class="input"><option value="">All teams</option>${state.teams.map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select><select id="tx-type" class="input"><option value="">All transaction types</option>${types.map(t=>`<option value="${esc(t)}" ${f.type===t?'selected':''}>${esc(transactionTypeLabel(t))}</option>`).join('')}</select><input id="tx-search" class="input" value="${esc(f.search)}" placeholder="Search player / transaction"></div></section>${isCommish()?correctionForm():''}<div class="list-stack">${rows.length?rows.map(tx=>{const t=teamById(tx.team_id),o=teamById(tx.other_team_id);return `<details class="card tx-card"><summary><div><div class="row gap-8 wrap"><span class="tx-type">${esc(transactionTypeLabel(tx.transaction_type))}</span>${tx.status==='reversed'?'<span class="trade-status denied">REVERSED</span>':''}</div><div class="log-name">${esc(tx.description)}</div><div class="small muted">${fmtDate(tx.created_at)}${t?` • ${esc(t.name)}`:''}${o?` ↔ ${esc(o.name)}`:''}</div></div><div class="tx-deltas">${tx.bid_delta?`<span class="${tx.bid_delta<0?'neg':'pos'}">${tx.bid_delta>0?'+':''}${tx.bid_delta} bids</span>`:''}${tx.cap_delta?`<span>${tx.cap_delta>0?'+':''}${tx.cap_delta} cap</span>`:''}</div></summary><pre class="tx-json">${esc(JSON.stringify(tx.details||{},null,2))}</pre></details>`;}).join(''):'<div class="card empty">No transactions match these filters.</div>'}</div>`;
}
function correctionForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner Correction</div><div class="form-grid"><div class="field"><label>Team (optional)</label><select id="corr-team" class="input"><option value="">League / no team</option>${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Bid-dollar adjustment</label><input id="corr-bids" class="input" type="number" step="1" value="0"></div><div class="field"><label>Reverse transaction (optional)</label><select id="corr-reverse" class="input"><option value="">None</option>${state.transactions.filter(x=>x.status!=='reversed').slice(0,100).map(x=>`<option value="${x.id}">${esc(fmtDate(x.created_at))} • ${esc(transactionTypeLabel(x.transaction_type))} • ${esc(x.player_name||x.description)}</option>`).join('')}</select></div><div class="field"><label>Description</label><input id="corr-desc" class="input" placeholder="Reason for correction"></div></div><button class="btn btn-primary" data-action="save-correction">Record Correction</button></section>`;}

function weeklyHostRulesPanel(){
 const h=state.weeklyHostSettings;
 if(!h)return '';
 const groups=[...new Set(state.scoringRules.map(r=>r.category))];
 const ruleValue=r=>{
   if(r.rate_value!=null)return `${Number(r.rate_value).toFixed(Number(r.rate_value)%1?1:0)} ${esc(r.rate_unit||'')} / ${Number(r.points||0)} pt`;
   return `${Number(r.points||0)>0?'+':''}${Number(r.points||0)} pts`;
 };
 return `<section class="card card-pad office-section host-rules-panel">
   <div class="office-section-head"><div><h2>2026 Weekly Play</h2><div class="small muted">GLSK host configuration mirrored from the supplied Yahoo commissioner settings.</div></div></div>
   <div class="host-rule-kpis">
     <div><span>Format</span><strong>Head-to-Head</strong></div>
     <div><span>Regular Season</span><strong>Weeks 1–14</strong></div>
     <div><span>Playoffs</span><strong>6 Teams • Weeks 15–17</strong></div>
     <div><span>Reseeding</span><strong>No</strong></div>
   </div>
   <div class="host-lineup-strip"><span>Starting Lineup</span><strong>QB • RB • RB • WR • WR • WR • TE • W/R/T • K • D/ST</strong></div>
   <div class="scoring-rule-groups">${groups.map(g=>`<div class="scoring-rule-group"><div class="scoring-group-title">${esc(g)}</div>${state.scoringRules.filter(r=>r.category===g).map(r=>`<div class="scoring-rule-row"><span>${esc(r.label)}</span><strong>${ruleValue(r)}</strong>${r.notes?`<small>${esc(r.notes)}</small>`:''}</div>`).join('')}</div>`).join('')}</div>
 </section>`;
}

function rulesView(){const groups=[...new Set(state.rules.map(r=>r.category))];const total=state.distro.reduce((s,r)=>s+Number(r.percentage||0),0);return `${pageHeading('League Rules','Season-versioned settings can change going forward without rewriting prior years.','Commissioner Settings')}${weeklyHostRulesPanel()}<div class="office-grid two"><div><section class="card card-pad">${groups.map(g=>`<div class="rule-category"><h3>${esc(g)}</h3>${state.rules.filter(r=>r.category===g).map(r=>`<div class="rule-row"><div class="rule-label">${esc(r.label)}${r.unit?` <span class="small muted">(${esc(r.unit)})</span>`:''}</div><div>${r.numeric_value!=null?(isCommish()?`<input class="rule-input" data-rule-key="${esc(r.rule_key)}" type="number" step="1" value="${Number(r.numeric_value)}">`:`<div class="rule-value">${Number(r.numeric_value)} ${esc(r.unit||'')}</div>`):`<div class="rule-value">${r.boolean_value?'On':'Off'}</div>`}</div></div>`).join('')}</div>`).join('')}${isCommish()?'<button class="btn btn-primary" data-action="save-rules">Save Rule Defaults</button>':''}</section></div><div><section class="card card-pad"><div class="office-section-head"><h2>Bid Redistribution</h2><div id="distro-total" class="${Math.abs(total-100)>.001?'distro-total bad':'distro-total'}">${total.toFixed(2)}%</div></div><div class="redistribution-grid">${state.distro.map(r=>`<div class="distro-row"><div class="rule-label">${esc(r.label)}</div>${isCommish()?`<input class="rule-input distro-input" data-bracket="${r.bracket}" data-finish="${r.finish}" type="number" step="0.05" min="0" max="100" value="${Number(r.percentage).toFixed(2)}">`:`<div class="rule-value">${Number(r.percentage).toFixed(2)}%</div>`}</div>`).join('')}</div><div class="distro-total"><span>Total</span><strong id="distro-total-bottom">${total.toFixed(2)}%</strong></div>${isCommish()?'<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="save-distro">Save Redistribution</button>':''}<div class="small muted" style="margin-top:9px">The 2026 values were imported from the league workbook. Future seasons can use different versions without rewriting history.</div></section></div></div>`;}

function deadlinesView(){const mine=myTeam();return `${pageHeading('Deadlines','Create league deadlines, track submissions and automatically lock time-sensitive actions.','League Calendar')}${isCommish()?deadlineForm():''}<div class="list-stack">${state.deadlines.length?state.deadlines.map(d=>{const sts=state.deadlineStatus.filter(s=>s.deadline_id===d.id),done=sts.filter(s=>['submitted','late','waived'].includes(s.status)).length,my=mine?sts.find(s=>s.team_id===mine.id):null,pct=state.teams.length?done/state.teams.length*100:0;return `<div class="card deadline-card"><div class="row between gap-8"><div><div class="deadline-title">${esc(d.title)}</div><div class="deadline-meta">${esc(d.deadline_type)} • ${fmtDate(d.due_at)}${d.auto_lock?' • auto-lock':''}</div></div><span class="deadline-status ${d.status}">${esc(d.status)}</span></div>${d.notes?`<div class="small muted" style="margin-top:7px">${esc(d.notes)}</div>`:''}<div class="deadline-progress"><div style="width:${pct}%"></div></div><div class="row between gap-8 wrap" style="margin-top:8px"><div class="small muted">${done}/${state.teams.length} submitted${my?` • Your status: ${esc(my.status)}`:''}</div><div class="inline-actions">${mine&&d.status==='open'&&(!my||my.status==='pending')?`<button class="btn btn-sm btn-green" data-submit-deadline="${d.id}">Mark Submitted</button>`:''}${isCommish()&&d.status==='open'?`<button class="btn btn-sm btn-outline" data-deadline-status="closed" data-deadline-id="${d.id}">Close</button>`:''}${isCommish()&&d.status==='closed'?`<button class="btn btn-sm btn-outline" data-deadline-status="open" data-deadline-id="${d.id}">Reopen</button>`:''}${isCommish()&&d.status!=='completed'?`<button class="btn btn-sm btn-outline" data-deadline-status="completed" data-deadline-id="${d.id}">Complete</button>`:''}</div></div></div>`;}).join(''):'<div class="card empty">No league deadlines have been created yet.</div>'}</div>`;}
function deadlineForm(){return `<section class="card office-form office-section"><div class="section-title">Create Deadline</div><div class="form-grid"><div class="field"><label>Title</label><input id="deadline-title" class="input" placeholder="Contract assignments due"></div><div class="field"><label>Type</label><select id="deadline-type" class="input"><option value="contracts">Contracts</option><option value="contract_extensions">Contract Extensions</option><option value="rookie_rights">Rookie Rights</option><option value="dues">Dues</option><option value="trade">Trade / Transaction</option><option value="general">General</option></select></div><div class="field"><label>Due date & time</label><input id="deadline-due" type="datetime-local" class="input"></div><div class="field"><label>Automatic lock</label><select id="deadline-lock" class="input"><option value="true">Yes</option><option value="false">No</option></select></div></div><div class="field"><label>Notes</label><textarea id="deadline-notes" class="input" placeholder="Optional instructions"></textarea></div><button class="btn btn-primary" data-action="create-deadline">Create Deadline</button></section>`;}

function financesView(){const sumDue=state.finance.filter(x=>x.status==='due').reduce((s,x)=>s+Number(x.amount_cents||0),0),sumPaid=state.finance.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount_cents||0),0);return `${pageHeading('League Finances','Private ledger for dues, prizes, expenses and adjustments.','League Accounting')}<div class="kpi-grid"><div class="card kpi"><div class="kpi-label">Due</div><div class="kpi-value">${money(sumDue)}</div></div><div class="card kpi"><div class="kpi-label">Paid</div><div class="kpi-value">${money(sumPaid)}</div></div></div>${isCommish()?financeForm():''}<div class="list-stack">${state.finance.length?state.finance.map(f=>{const t=teamById(f.team_id);return `<div class="finance-row"><div><div class="log-name">${esc(f.description)}</div><div class="small muted">${esc(t?.name||'League')} • ${esc(f.category)}${f.due_at?` • due ${fmtDateOnly(f.due_at)}`:''}</div><div class="finance-status">${esc(f.status)}</div></div><div style="text-align:right"><div class="finance-amount ${Number(f.amount_cents)<0?'negative':''}">${money(f.amount_cents)}</div>${isCommish()?`<div class="inline-actions" style="justify-content:flex-end;margin-top:5px">${f.status!=='paid'?`<button class="btn btn-sm btn-green" data-finance-status="paid" data-finance-id="${f.id}">Paid</button>`:''}${f.status!=='waived'?`<button class="btn btn-sm btn-outline" data-finance-status="waived" data-finance-id="${f.id}">Waive</button>`:''}</div>`:''}</div></div>`;}).join(''):'<div class="card empty">No finance entries yet.</div>'}</div><div class="notice" style="margin-top:12px">Financial rows are not publicly readable from Supabase; owners can retrieve only their own items with their team PIN, while the commissioner can retrieve the full ledger.</div>`;}
function financeForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner • Add Finance Entry</div><div class="form-grid"><div class="field"><label>Team</label><select id="finance-team" class="input"><option value="">League-wide</option>${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Category</label><select id="finance-category" class="input"><option value="dues">Dues</option><option value="prize">Prize</option><option value="expense">Expense</option><option value="adjustment">Adjustment</option><option value="other">Other</option></select></div><div class="field"><label>Amount ($)</label><input id="finance-amount" type="number" step="0.01" class="input" placeholder="100.00"></div><div class="field"><label>Due date</label><input id="finance-due" type="date" class="input"></div></div><div class="field"><label>Description</label><input id="finance-desc" class="input" placeholder="2026 league dues"></div><button class="btn btn-primary" data-action="add-finance">Add Entry</button></section>`;}



function lineupSetupPanel(){
 if(!isCommish())return '';
 const counts=lineupSlotCounts();
 return `<section class="card card-pad office-section weekly-setup-card">
   <div class="office-section-head"><div><h2>Commissioner • Starting Lineup Setup</h2><div class="small muted">Enter the official GLSK starter counts. FLEX is RB/WR/TE in this first build.</div></div></div>
   <div class="lineup-count-grid">${['QB','RB','WR','TE','FLEX','K','DST'].map(p=>`<label><span>${p}</span><input id="slot-count-${p}" class="input" type="number" min="0" max="5" value="${counts[p]||0}"></label>`).join('')}</div>
   <button class="btn btn-primary" data-action="save-lineup-slots">Save Starting Lineup</button>
 </section>`;
}
function lineupView(){
 const t=myTeam(),week=browseWeek(),slots=state.lineupSlots,current=currentWeek();
 if(!t)return `${pageHeading('Set Lineup',`Week ${week} lineup and player data.`,`Weekly Play`)}<div class="card empty">Sign in as a team owner to manage a lineup.</div>`;

 const lineup=lineupFor(t.id,week);
 const starterKeys=new Set(lineup.map(l=>l.player_key));
 const bench=rosterFor(t.id).filter(r=>!starterKeys.has(r.player_key)).sort((a,b)=>{
   const p={QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
   return (p[String(a.position||'').toUpperCase()]||9)-(p[String(b.position||'').toUpperCase()]||9)||a.player_name.localeCompare(b.player_name);
 });
 const editable=week===current;
 const dataTab=state.lineupDataTab||'stats';
 const statRange=state.lineupStatsRange||'week';
 const projRange=state.lineupProjectionRange||'week';
 const range=dataTab==='stats'?statRange:projRange;
 const matchup=matchupForTeam(t.id,week);
 const oppId=matchup?(matchup.home_team_id===t.id?matchup.away_team_id:matchup.home_team_id):null;
 const opp=oppId?teamById(oppId):null;
 const posClass=p=>`yahoo-pos yahoo-pos-${String(p||'').toUpperCase().replace('/','')}`;
 const allRows=slots.map(slot=>{
   const cur=lineup.find(l=>l.slot_code===slot.slot_code);
   const rp=cur?rosterFor(t.id).find(r=>r.player_key===cur.player_key):null;
   return {slot,cur,rp,bench:false};
 }).concat(bench.map(r=>({slot:{label:'BN',allowed_positions:[r.position]},cur:{player_key:r.player_key,player_name:r.player_name},rp:r,bench:true})));

 const dataFor=row=>{
   if(!row.rp)return null;
   return dataTab==='stats'?actualBundle(row.rp.player_key,range,week):projectionBundle(row.rp.player_key,range,week);
 };
 const pointsLabel=dataTab==='stats'?'Fan Pts':'Proj Pts';
 const showProj=dataTab==='projected';
 const teamDisplayPoints=dataTab==='projected'?projectedTeamTotal(t.id,range,week):weeklyScore(t.id,week);

 const rowHtml=row=>{
   const {slot,cur,rp,bench:isBench}=row;
   const score=cur?scoreFor(cur.player_key,week):null;
   const locked=Boolean(score?.game_started);
   const d=dataFor(row);
   const game=rp?lineupGameLabel(rp.player_key,week):{main:'—',sub:'Open starter'};
   const options=!isBench?slotEligibleRoster(slot,t.id):[];
   const playerCell=isBench
     ?`<div class="lineup-player-static"><strong>${esc(rp.player_name)}</strong><span>${esc(rp.nfl_team||'')} • ${esc(rp.position||'')}</span></div>`
     :`<select class="lineup-player-select lineup-select" data-slot-code="${esc(slot.slot_code)}" ${(!editable||locked)?'disabled':''}><option value="">Select player</option>${options.map(r=>`<option value="${esc(r.player_key)}" ${cur?.player_key===r.player_key?'selected':''}>${esc(r.player_name)} • ${esc(r.nfl_team||'')} • ${esc(r.position||'')}</option>`).join('')}</select><div class="lineup-player-sub">${rp?`${esc(rp.nfl_team||'')} • ${esc(rp.position||'')}${locked?' • Locked':''}`:'Open starter'}</div>`;
   return `<div class="lineup-data-row ${isBench?'bench-row':'starter-row'} ${locked?'is-locked':''}">
     <div class="lineup-yahoo-pos"><span class="${isBench?'yahoo-pos yahoo-pos-BN':posClass(slot.label)}">${esc(isBench?'BN':slot.label)}</span></div>
     <div class="lineup-yahoo-player">${playerCell}</div>
     <div class="lineup-data-game"><strong>${esc(game.main)}</strong><small>${esc(game.sub)}</small></div>
     <div class="lineup-num main-points">${fmtStat(dataTab==='stats'?d?.fantasy_points:d?.projected_fantasy_points,2)}</div>
     ${showProj?`<div class="lineup-num">${fmtStat(d?.projected_max,2)}</div><div class="lineup-num">${fmtStat(d?.projected_min,2)}</div>`:''}
     <div class="lineup-num">${d?.position_rank!=null?`${d.position_rank} (${esc(rp?.position||'')})`:'—'}</div>
     <div class="lineup-num stat-divider">${fmtStat(d?.passing_yards,0)}</div>
     <div class="lineup-num">${fmtStat(d?.passing_td,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.interceptions,showProj?1:0)}</div>
     <div class="lineup-num stat-divider">${fmtStat(d?.rushing_attempts,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.rushing_yards,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.rushing_td,showProj?1:0)}</div>
     <div class="lineup-num stat-divider">${fmtStat(d?.targets,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.receptions,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.receiving_yards,showProj?1:0)}</div>
     <div class="lineup-num">${fmtStat(d?.receiving_td,showProj?1:0)}</div>
   </div>`;
 };

 const subTabs=dataTab==='stats'
   ?`<button class="${statRange==='week'?'active':''}" data-lineup-range="week">Current Week</button><button class="${statRange==='season'?'active':''}" data-lineup-range="season">This Season</button>`
   :`<button class="${projRange==='week'?'active':''}" data-lineup-range="week">Week ${week}</button><button class="${projRange==='weeks1_4'?'active':''}" data-lineup-range="weeks1_4">Weeks 1–4</button><button class="${projRange==='remaining'?'active':''}" data-lineup-range="remaining">Remaining Games</button><button class="${projRange==='season'?'active':''}" data-lineup-range="season">Season Total</button>`;

 return `${pageHeading('Lineup',`Week ${week}${week===current?' • current week':''} • players lock individually at NFL kickoff.`,`Weekly Play`)}
 <section class="lineup-data-toolbar">
   <div class="lineup-week-nav">
     <button class="week-arrow" data-lineup-week="${Math.max(1,week-1)}" ${week<=1?'disabled':''}>‹</button>
     <strong>Week ${week}</strong>
     <button class="week-arrow" data-lineup-week="${Math.min(18,week+1)}" ${week>=18?'disabled':''}>›</button>
   </div>
   <div class="lineup-main-tabs">
     <button class="${dataTab==='stats'?'active':''}" data-lineup-data-tab="stats">Stats</button>
     <button class="${dataTab==='projected'?'active':''}" data-lineup-data-tab="projected">Projected Stats</button>
   </div>
 </section>
 <div class="lineup-subtabs">${subTabs}</div>

 <section class="card lineup-card lineup-card-data">
   <div class="lineup-card-head lineup-yahoo-head">
     <div><strong>${esc(t.name)}</strong><span>${lineup.length}/${slots.length} starters filled${opp?` • vs ${esc(opp.name)}`:''}${!editable?' • read-only week':''}</span></div>
     <div class="lineup-score-duo">
       <div><span>${dataTab==='projected'?'PROJECTED':'WEEK SCORE'}</span><strong>${Number(teamDisplayPoints||0).toFixed(2)}</strong></div>
       ${dataTab==='stats'?`<div><span>PROJ WEEK ${week}</span><strong>${projectedTeamTotal(t.id,'week',week).toFixed(2)}</strong></div>`:''}
     </div>
   </div>

   <div class="lineup-data-scroller">
     <div class="lineup-data-head ${showProj?'with-proj':''}">
       <span>Pos</span><span>Offense</span><span>Opponent</span><span>${pointsLabel}</span>
       ${showProj?'<span>Proj Max</span><span>Proj Min</span>':''}
       <span>Pos Rank</span>
       <span class="group-head">Passing</span><span></span><span></span>
       <span class="group-head">Rushing</span><span></span><span></span>
       <span class="group-head">Receiving</span><span></span><span></span><span></span>
     </div>
     <div class="lineup-data-subhead ${showProj?'with-proj':''}">
       <span></span><span></span><span></span><span></span>${showProj?'<span></span><span></span>':''}<span></span>
       <span>Yds</span><span>TD</span><span>Int</span>
       <span>Att</span><span>Yds</span><span>TD</span>
       <span>Tgt</span><span>Rec</span><span>Yds</span><span>TD</span>
     </div>

     <div class="lineup-data-body">
       ${allRows.slice(0,slots.length).map(rowHtml).join('')}
       <div class="lineup-section-divider"><strong>BENCH</strong><span>${bench.length} players</span></div>
       ${allRows.slice(slots.length).map(rowHtml).join('')}
     </div>
   </div>

   <div class="lineup-save-row lineup-yahoo-save">
     <div>${editable?'<strong>Lineup locks at each player’s NFL kickoff.</strong><span>Projected and actual stat views do not change your saved starters until you click Save.</span>':`<strong>Week ${week} is view-only.</strong><span>Return to the current week to make lineup changes.</span>`}</div>
     ${editable?`<button class="btn btn-primary" data-action="save-lineup">Save Week ${week} Lineup</button>`:''}
   </div>
 </section>

 ${dataTab==='projected'&&!state.playerProjections.length?'<div class="notice lineup-feed-notice">Projection layout is ready. Values will populate when the projection feed is connected.</div>':''}
 ${isCommish()&&slots.length?lineupSetupPanel():''}`;
}

function matchupBrowseWeek(){return Math.max(1,Math.min(18,Number(state.matchupBrowseWeek||currentWeek())));}
function matchupRowsForWeek(week=matchupBrowseWeek()){
  return state.matchupScores.filter(m=>Number(m.week)===Number(week)).sort((a,b)=>Number(a.matchup_no)-Number(b.matchup_no));
}
function scheduleRowsForWeek(week){
  return state.schedule.filter(s=>Number(s.week)===Number(week)).sort((a,b)=>Number(a.matchup_no)-Number(b.matchup_no));
}
function teamRecord(teamId){
  const r=state.shadowStandings.find(x=>x.team_id===teamId);
  return r?`${r.wins}-${r.losses}${Number(r.ties)?`-${r.ties}`:''}`:'0-0';
}
function projectedStarterTotal(teamId,week){
  return lineupFor(teamId,week).reduce((sum,l)=>sum+Number(projectionBundle(l.player_key,'week',week)?.projected_fantasy_points||0),0);
}
function matchupStatusLabel(m){
  if(m?.week_status==='final')return 'Final';
  if(m?.week_status==='live')return 'Live';
  return 'Not started';
}
function matchupWinnerClass(m,teamId){
  if(m?.week_status!=='final')return '';
  const mine=Number(m.home_team_id===teamId?m.home_score:m.away_score);
  const opp=Number(m.home_team_id===teamId?m.away_score:m.home_score);
  return mine>opp?'winner':mine<opp?'loser':'tie';
}
function selectedMatchupForWeek(week=matchupBrowseWeek()){
  const rows=matchupRowsForWeek(week);
  let selected=rows.find(m=>String(m.schedule_id)===String(state.selectedMatchupId));
  const me=myTeam();
  if(!selected&&me)selected=rows.find(m=>m.home_team_id===me.id||m.away_team_id===me.id);
  return selected||rows[0]||null;
}
function matchupPlayerRows(teamId,week){
  const slots=state.lineupSlots;
  const rows=lineupFor(teamId,week);
  return slots.map(slot=>{
    const l=rows.find(x=>x.slot_code===slot.slot_code);
    const rp=l?rosterFor(teamId).find(r=>r.player_key===l.player_key):null;
    const actual=l?scoreFor(l.player_key,week):null;
    const proj=l?projectionBundle(l.player_key,'week',week):null;
    const game=l?lineupGameLabel(l.player_key,week):{main:'—',sub:''};
    return {slot,l,rp,actual,proj,game};
  });
}

function scheduleSetupPanel(){
 if(!isCommish())return '';
 const week=currentWeek(),existing=state.schedule.filter(s=>Number(s.week)===week).sort((a,b)=>a.matchup_no-b.matchup_no);
 return `<section class="card card-pad office-section weekly-setup-card"><div class="office-section-head"><div><h2>Commissioner • Week Setup</h2><div class="small muted">Use this while Yahoo import is unavailable. Each team may appear once.</div></div><div class="week-control"><label>Current Week</label><input id="current-week-input" class="input" type="number" min="1" max="25" value="${week}"><button class="btn btn-sm btn-outline" data-action="set-current-week">Set</button></div></div>
 <div class="schedule-editor">${Array.from({length:6},(_,i)=>{const row=existing[i];return `<div class="schedule-edit-row"><span>#${i+1}</span><select class="input schedule-home" data-matchup="${i+1}"><option value="">Home team</option>${state.teams.map(t=>`<option value="${t.id}" ${row?.home_team_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select><strong>vs</strong><select class="input schedule-away" data-matchup="${i+1}"><option value="">Away team</option>${state.teams.map(t=>`<option value="${t.id}" ${row?.away_team_id===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div>`}).join('')}</div>
 <div class="inline-actions"><select id="schedule-phase" class="input"><option value="regular">Regular season</option><option value="playoffs">Playoffs</option><option value="championship">Championship</option><option value="consolation">Consolation</option></select><button class="btn btn-primary" data-action="save-week-schedule">Save Week ${week} Matchups</button></div></section>`;
}
function matchupTeamLine(teamId,week,side='home'){
 const rows=matchupPlayerRows(teamId,week);
 return `<div class="matchup-detail-lineup">${rows.map(({slot,l,rp,actual,proj,game})=>`<div class="matchup-detail-player ${side}">
   <span class="matchup-detail-slot">${esc(slot.label)}</span>
   <div class="matchup-detail-player-info"><strong>${l?esc(l.player_name):'Open Starter'}</strong>${rp?`<small>${esc(rp.nfl_team||'')} • ${esc(rp.position||'')} • ${esc(game.main)}</small>`:'<small>—</small>'}</div>
   <span class="matchup-detail-proj">${proj?.projected_fantasy_points!=null?Number(proj.projected_fantasy_points).toFixed(2):'—'}</span>
   <span class="matchup-detail-actual">${actual?Number(actual.fantasy_points||0).toFixed(2):'—'}</span>
 </div>`).join('')}</div>`;
}

function matchupsView(){
 const week=matchupBrowseWeek(),matches=matchupRowsForWeek(week),selected=selectedMatchupForWeek(week),ws=weekState(week),me=myTeam();
 if(selected&&!state.selectedMatchupId)state.selectedMatchupId=selected.schedule_id;
 const home=selected?teamById(selected.home_team_id):null,away=selected?teamById(selected.away_team_id):null;
 const homeProj=selected?projectedStarterTotal(selected.home_team_id,week):0,awayProj=selected?projectedStarterTotal(selected.away_team_id,week):0;
 const status=selected?matchupStatusLabel(selected):(ws?.status||'scheduled');
 return `${pageHeading('Matchups',`Browse every GLSK matchup and open any head-to-head detail.`,`Weekly Play`)}
 <section class="matchup-topbar">
   <div class="lineup-week-nav matchup-week-nav">
     <button class="week-arrow" data-matchup-week="${Math.max(1,week-1)}" ${week<=1?'disabled':''}>‹</button>
     <strong>Week ${week}</strong>
     <button class="week-arrow" data-matchup-week="${Math.min(18,week+1)}" ${week>=18?'disabled':''}>›</button>
   </div>
   <div class="matchup-week-status ${status.toLowerCase().replaceAll(' ','-')}">${esc(status)}</div>
 </section>

 ${scheduleSetupPanel()}

 ${selected?`<section class="card matchup-feature-card">
   <div class="matchup-feature-head">
     <div class="matchup-feature-team ${matchupWinnerClass(selected,selected.home_team_id)}">
       <span class="matchup-side-label">${me?.id===selected.home_team_id?'YOUR TEAM':'HOME'}</span>
       <strong>${esc(home?.name||'Home')}</strong>
       <small>${teamRecord(selected.home_team_id)}</small>
     </div>
     <div class="matchup-feature-score">
       <div><strong>${Number(selected.home_score||0).toFixed(2)}</strong><span>${homeProj?homeProj.toFixed(2):'—'} proj</span></div>
       <b>VS</b>
       <div><strong>${Number(selected.away_score||0).toFixed(2)}</strong><span>${awayProj?awayProj.toFixed(2):'—'} proj</span></div>
     </div>
     <div class="matchup-feature-team away ${matchupWinnerClass(selected,selected.away_team_id)}">
       <span class="matchup-side-label">${me?.id===selected.away_team_id?'YOUR TEAM':'AWAY'}</span>
       <strong>${esc(away?.name||'Away')}</strong>
       <small>${teamRecord(selected.away_team_id)}</small>
     </div>
   </div>
   <div class="matchup-progress-row"><span>${Number(selected.home_players_remaining||0)} players remaining</span><strong>${esc(status)}</strong><span>${Number(selected.away_players_remaining||0)} players remaining</span></div>
   <div class="matchup-detail-head">
     <span>Player</span><span>Proj</span><span>Fan Pts</span><span class="matchup-detail-center">Pos</span><span>Fan Pts</span><span>Proj</span><span>Player</span>
   </div>
   <div class="matchup-detail-grid">
     <div>${matchupTeamLine(selected.home_team_id,week,'home')}</div>
     <div class="matchup-detail-position-column">${state.lineupSlots.map(s=>`<span>${esc(s.label)}</span>`).join('')}</div>
     <div>${matchupTeamLine(selected.away_team_id,week,'away')}</div>
   </div>
 </section>`:'<div class="card empty">No Week '+week+' matchup has been scheduled yet.</div>'}

 <section class="office-section all-matchups-section">
   <div class="office-section-head"><div><h2>Week ${week} • League Matchups</h2><div class="section-caption">Select any matchup to open the full head-to-head view</div></div><span class="trade-count">${matches.length}</span></div>
   <div class="league-matchup-list">${matches.length?matches.map(m=>{
     const h=teamById(m.home_team_id),a=teamById(m.away_team_id),active=String(selected?.schedule_id)===String(m.schedule_id);
     const hp=projectedStarterTotal(m.home_team_id,week),ap=projectedStarterTotal(m.away_team_id,week);
     return `<button class="league-matchup-row ${active?'active':''}" data-select-matchup="${m.schedule_id}">
       <div class="league-matchup-team home"><strong>${esc(h?.name||'Home')}</strong><small>${teamRecord(m.home_team_id)}</small></div>
       <div class="league-matchup-score"><strong>${Number(m.home_score||0).toFixed(2)}</strong><span>${hp?`${hp.toFixed(2)} proj`:'— proj'}</span></div>
       <div class="league-matchup-vs">vs</div>
       <div class="league-matchup-score"><strong>${Number(m.away_score||0).toFixed(2)}</strong><span>${ap?`${ap.toFixed(2)} proj`:'— proj'}</span></div>
       <div class="league-matchup-team away"><strong>${esc(a?.name||'Away')}</strong><small>${teamRecord(m.away_team_id)}</small></div>
     </button>`;
   }).join(''):'<div class="card empty">No Week '+week+' matchups have been entered yet.</div>'}</div>
 </section>

 ${isCommish()&&matches.length&&ws?.status!=='final'?`<div class="weekly-finalize"><button class="btn btn-reset" data-action="finalize-week">Finalize Week ${week}</button><span>Finalized weeks feed the GLSK standings.</span></div>`:''}`;
}

function scheduleView(){
 const me=myTeam();
 const selectedTeamId=state.scheduleTeamId&&state.teams.some(t=>t.id===state.scheduleTeamId)?state.scheduleTeamId:(me?.id||state.teams[0]?.id);
 const team=teamById(selectedTeamId);
 const weeks=Array.from({length:Number(state.gameSettings?.regular_season_weeks||14)},(_,i)=>i+1);
 const playoffWeeks=state.weeklyHostSettings?.playoff_weeks||[15,16,17];
 const allWeeks=[...weeks,...playoffWeeks.filter(w=>!weeks.includes(Number(w))).map(Number)].sort((a,b)=>a-b);
 const scheduleRows=allWeeks.map(week=>{
   const s=scheduleRowsForWeek(week).find(x=>x.home_team_id===selectedTeamId||x.away_team_id===selectedTeamId);
   const m=state.matchupScores.find(x=>x.schedule_id===s?.id);
   if(!s)return {week,s:null,m:null,opp:null};
   const oppId=s.home_team_id===selectedTeamId?s.away_team_id:s.home_team_id;
   return {week,s,m,opp:teamById(oppId)};
 });
 return `${pageHeading('Schedule','View a team’s complete regular-season and playoff schedule.','Weekly Play')}
 <section class="schedule-toolbar card">
   <div><span>Team Schedule</span><strong>${esc(team?.name||'Team')}</strong></div>
   <select id="schedule-team-select" class="input">${state.teams.map(t=>`<option value="${t.id}" ${t.id===selectedTeamId?'selected':''}>${esc(t.name)}</option>`).join('')}</select>
 </section>
 <section class="card schedule-card">
   <div class="schedule-table-head"><span>Week</span><span>Opponent</span><span>Result</span><span>Score</span><span>Proj</span></div>
   <div class="schedule-table-body">${scheduleRows.map(({week,s,m,opp})=>{
     const phase=s?.phase||((playoffWeeks||[]).map(Number).includes(week)?'playoffs':'regular');
     const isHome=s?.home_team_id===selectedTeamId;
     const myScore=m?Number(isHome?m.home_score:m.away_score):0,oppScore=m?Number(isHome?m.away_score:m.home_score):0;
     const final=m?.week_status==='final';
     const result=final?(myScore>oppScore?'W':myScore<oppScore?'L':'T'):'—';
     const proj=s?projectedStarterTotal(selectedTeamId,week):0;
     return `<div class="schedule-table-row ${week===currentWeek()?'current':''} ${phase!=='regular'?'playoff-week':''}">
       <div class="schedule-week-cell"><strong>${week}</strong>${phase!=='regular'?'<small>PLAYOFF</small>':''}</div>
       <div class="schedule-opponent">${s?`<span>${isHome?'vs':'@'}</span><strong>${esc(opp?.name||'Opponent')}</strong>`:'<span>—</span><strong>Not scheduled</strong>'}</div>
       <div class="schedule-result ${result==='W'?'win':result==='L'?'loss':''}">${result}</div>
       <div class="schedule-score">${m?`${myScore.toFixed(2)} – ${oppScore.toFixed(2)}`:'—'}</div>
       <div class="schedule-proj">${proj?proj.toFixed(2):'—'}</div>
     </div>`;
   }).join('')}</div>
 </section>
 <div class="schedule-note">Weeks without an opponent will populate as the GLSK schedule is entered or imported.</div>`;
}

function standingsView(){
 const playoffTeams=Number(state.weeklyHostSettings?.playoff_teams||6);
 const finalizedWeeks=state.weekStates.filter(w=>w.phase==='regular'&&w.status==='final').length;
 const me=myTeam();
 const rows=state.shadowStandings.map((r,i)=>({...r,rank:i+1,diff:Number(r.points_for||0)-Number(r.points_against||0)}));
 const leader=rows[0];
 return `${pageHeading('Standings','Standings update from finalized regular-season GLSK matchup results.','Weekly Play')}
 <section class="standings-overview">
   <div class="standings-overview-card"><span>Current Week</span><strong>${currentWeek()}</strong><small>${weekState()?.status||'scheduled'}</small></div>
   <div class="standings-overview-card"><span>Finalized Weeks</span><strong>${finalizedWeeks}</strong><small>of ${state.gameSettings?.regular_season_weeks||14}</small></div>
   <div class="standings-overview-card"><span>Playoff Field</span><strong>${playoffTeams}</strong><small>teams qualify</small></div>
   <div class="standings-overview-card"><span>Points Leader</span><strong class="standings-leader">${leader&&Number(leader.points_for||0)>0?esc(leader.team_name):'—'}</strong><small>${leader&&Number(leader.points_for||0)>0?`${Number(leader.points_for).toFixed(2)} PF`:'No finalized scoring yet'}</small></div>
 </section>
 <section class="card standings-card standings-card-v2">
   <div class="standings-card-head"><div><h2>League Standings</h2><span>Top ${playoffTeams} are in playoff position</span></div><div class="standings-legend"><span class="legend-playoff"></span> Playoff position</div></div>
   <div class="standings-desktop">
     <div class="standings-grid standings-grid-head"><span>RK</span><span>TEAM</span><span>RECORD</span><span>PCT</span><span>PF</span><span>PA</span><span>DIFF</span></div>
     ${rows.map((r,i)=>`${i===playoffTeams?'<div class="standings-cutline"><span>PLAYOFF CUT LINE</span></div>':''}<div class="standings-grid standings-grid-row ${i<playoffTeams?'is-playoff':''} ${me?.id===r.team_id?'is-me':''}">
       <div><span class="standings-rank">${r.rank}</span></div>
       <div class="standings-team-cell"><strong>${esc(r.team_name)}</strong>${me?.id===r.team_id?'<span class="standings-you">YOU</span>':''}</div>
       <div class="standings-record"><strong>${r.wins}-${r.losses}${Number(r.ties)?`-${r.ties}`:''}</strong></div>
       <div>${Number(r.win_pct||0).toFixed(3)}</div>
       <div>${Number(r.points_for||0).toFixed(2)}</div>
       <div>${Number(r.points_against||0).toFixed(2)}</div>
       <div class="${r.diff>0?'positive':r.diff<0?'negative':''}">${r.diff>0?'+':''}${r.diff.toFixed(2)}</div>
     </div>`).join('')}
   </div>
   <div class="standings-mobile">
     ${rows.map((r,i)=>`${i===playoffTeams?'<div class="standings-cutline mobile"><span>PLAYOFF CUT LINE</span></div>':''}<div class="standings-mobile-row ${i<playoffTeams?'is-playoff':''} ${me?.id===r.team_id?'is-me':''}">
       <div class="standings-mobile-top"><span class="standings-rank">${r.rank}</span><div><strong>${esc(r.team_name)}</strong>${me?.id===r.team_id?'<span class="standings-you">YOU</span>':''}</div><span class="standings-mobile-record">${r.wins}-${r.losses}${Number(r.ties)?`-${r.ties}`:''}</span></div>
       <div class="standings-mobile-stats"><span><small>PCT</small><b>${Number(r.win_pct||0).toFixed(3)}</b></span><span><small>PF</small><b>${Number(r.points_for||0).toFixed(2)}</b></span><span><small>PA</small><b>${Number(r.points_against||0).toFixed(2)}</b></span><span><small>DIFF</small><b class="${r.diff>0?'positive':r.diff<0?'negative':''}">${r.diff>0?'+':''}${r.diff.toFixed(2)}</b></span></div>
     </div>`).join('')}
   </div>
 </section>`;
}
function reconcileView(){
 if(!isCommish())return '<div class="card empty">Commissioner only.</div>';
 const week=currentWeek(),rows=state.reconciliation;
 return `${pageHeading('Reconciliation',`Week ${week} private commissioner comparison.`,`Commissioner Only`)}
 <div class="reconcile-kpis"><div class="card kpi"><div class="kpi-label">Matchups</div><div class="kpi-value">${rows.length}</div><div class="kpi-sub">GLSK vs Yahoo</div></div><div class="card kpi"><div class="kpi-label">Roster Audit</div><div class="kpi-value">—</div><div class="kpi-sub">Yahoo OAuth pending</div></div><div class="card kpi"><div class="kpi-label">Lineup Audit</div><div class="kpi-value">—</div><div class="kpi-sub">Yahoo OAuth pending</div></div><div class="card kpi"><div class="kpi-label">Standings Audit</div><div class="kpi-value">—</div><div class="kpi-sub">Yahoo OAuth pending</div></div></div>
 <section class="card card-pad office-section"><div class="office-section-head"><div><h2>Weekly Score Check</h2><div class="small muted">Until Yahoo OAuth is connected, you can manually enter Yahoo totals here after games.</div></div></div>
 <div class="reconcile-list">${rows.length?rows.map(r=>{const h=teamById(r.home_team_id),a=teamById(r.away_team_id),hm=r.yahoo_home_score!=null&&Math.abs(Number(r.yahoo_home_score)-Number(r.glsk_home_score))<.011,am=r.yahoo_away_score!=null&&Math.abs(Number(r.yahoo_away_score)-Number(r.glsk_away_score))<.011;return `<div class="reconcile-row" data-reconcile-row="${r.schedule_id}"><div class="reconcile-team"><strong>${esc(h?.name||'Home')}</strong><span>GLSK ${Number(r.glsk_home_score||0).toFixed(2)}</span></div><input class="input yahoo-home-score" type="number" step="0.01" placeholder="Yahoo score" value="${r.yahoo_home_score??''}"><span class="reconcile-status ${r.yahoo_home_score==null?'pending':hm?'match':'diff'}">${r.yahoo_home_score==null?'—':hm?'✓':'!'}</span><div class="reconcile-team"><strong>${esc(a?.name||'Away')}</strong><span>GLSK ${Number(r.glsk_away_score||0).toFixed(2)}</span></div><input class="input yahoo-away-score" type="number" step="0.01" placeholder="Yahoo score" value="${r.yahoo_away_score??''}"><span class="reconcile-status ${r.yahoo_away_score==null?'pending':am?'match':'diff'}">${r.yahoo_away_score==null?'—':am?'✓':'!'}</span></div>`}).join(''):'<div class="empty-tight">No current-week schedule to reconcile.</div>'}</div>
 ${rows.length?'<button class="btn btn-primary" data-action="save-reconciliation">Save Yahoo Comparison</button>':''}</section>`;
}


function pct(v){return v==null?'—':`${Number(v).toFixed(1)}%`;}
function historySeasonById(id){return state.historySeasons.find(s=>s.id===id);}
function historyRows(){
  if(state.historySeason==='all')return state.historyAllTime.map(r=>({...r,_kind:'all'}));
  const y=Number(state.historySeason),season=state.historySeasons.find(s=>Number(s.season_year)===y);
  if(!season)return [];
  return state.historyTeamSeasons.filter(r=>r.history_season_id===season.id).map(r=>({
    ...r,_kind:'season',
    display_name:state.historyFranchises.find(f=>f.id===r.franchise_id)?.display_name||r.team_name,
    seasons_played:1,
    regular_win_pct:(Number(r.regular_wins)+Number(r.regular_losses)+Number(r.regular_ties))?100*(Number(r.regular_wins)+.5*Number(r.regular_ties))/(Number(r.regular_wins)+Number(r.regular_losses)+Number(r.regular_ties)):null,
    playoff_win_pct:(Number(r.playoff_wins)+Number(r.playoff_losses)+Number(r.playoff_ties))?100*(Number(r.playoff_wins)+.5*Number(r.playoff_ties))/(Number(r.playoff_wins)+Number(r.playoff_losses)+Number(r.playoff_ties)):null,
    championships:r.is_champion?1:0,
    playoff_appearances:r.playoff_appearance?1:0,
    title_game_appearances:r.title_game_appearance?1:0
  }));
}
function historySortRows(rows){
  const {key,dir}=state.historySort,m=dir==='asc'?1:-1;
  return [...rows].sort((a,b)=>{
    const av=a[key],bv=b[key];
    if(typeof av==='string'||typeof bv==='string')return m*String(av??'').localeCompare(String(bv??''));
    return m*((Number(av)||0)-(Number(bv)||0));
  });
}
function historySortHead(key,label){
  const active=state.historySort.key===key;
  return `<button class="history-sort ${active?'active':''}" data-history-sort="${key}">${label}${active?(state.historySort.dir==='asc'?' ↑':' ↓'):''}</button>`;
}
function historyLeader(rows,key,pctMode=false){
  if(!rows.length)return {name:'—',value:'—'};
  const eligible=rows.filter(r=>Number(r.seasons_played||0)>0 && r[key]!=null);
  if(!eligible.length)return {name:'—',value:'—'};
  const max=Math.max(...eligible.map(r=>Number(r[key]||0)));
  const names=eligible.filter(r=>Number(r[key]||0)===max).map(r=>r.display_name).join(' / ');
  return {name:names,value:pctMode?pct(max):String(max)};
}
function historyView(){
  const imported=state.historySeasons.filter(s=>s.status==='imported').length;
  const pending=state.historySeasons.filter(s=>s.status!=='imported').length;
  const unmatched=state.historyTeamSeasons.filter(r=>!r.franchise_id);
  const rows=historySortRows(historyRows());
  const all=state.historyAllTime.filter(r=>Number(r.seasons_played||0)>0);
  const champs=historyLeader(all,'championships'),wins=historyLeader(all,'regular_wins'),regPct=historyLeader(all,'regular_win_pct',true),poWins=historyLeader(all,'playoff_wins');
  const lastRun=state.historyImportRuns[0];

  return `${pageHeading('League History & Records','All-time franchise performance across the completed GLSK seasons.','2011–2025 Archive')}
  <div class="kpi-grid history-kpis">
    <div class="card kpi"><div class="kpi-label">Completed seasons</div><div class="kpi-value">${imported}/15</div><div class="kpi-sub">${pending} awaiting import</div></div>
    <div class="card kpi"><div class="kpi-label">Most championships</div><div class="kpi-value">${esc(champs.value)}</div><div class="kpi-sub">${esc(champs.name)}</div></div>
    <div class="card kpi"><div class="kpi-label">Most reg. wins</div><div class="kpi-value">${esc(wins.value)}</div><div class="kpi-sub">${esc(wins.name)}</div></div>
    <div class="card kpi"><div class="kpi-label">Most playoff wins</div><div class="kpi-value">${esc(poWins.value)}</div><div class="kpi-sub">${esc(poWins.name)}</div></div>
  </div>

  <section class="card history-section">
    <div class="office-section-head history-table-head">
      <div><h2>Performance</h2><div class="small muted">Tap any column heading to sort.</div></div>
      <select id="history-season" class="input history-season-select">
        <option value="all" ${state.historySeason==='all'?'selected':''}>All time</option>
        ${state.historySeasons.slice().reverse().map(s=>`<option value="${s.season_year}" ${String(state.historySeason)===String(s.season_year)?'selected':''}>${s.season_year}${s.status==='imported'?'':' • pending'}</option>`).join('')}
      </select>
    </div>
    <div class="history-table-scroll"><table class="history-table"><thead><tr>
      <th>${historySortHead('display_name','Franchise')}</th>
      <th>${historySortHead('seasons_played','Seasons')}</th>
      <th>${historySortHead('regular_wins','Reg W')}</th>
      <th>${historySortHead('regular_losses','Reg L')}</th>
      <th>${historySortHead('regular_win_pct','Reg %')}</th>
      <th>${historySortHead('playoff_wins','PO W')}</th>
      <th>${historySortHead('playoff_losses','PO L')}</th>
      <th>${historySortHead('playoff_win_pct','PO %')}</th>
      <th>${historySortHead('championships','Titles')}</th>
      <th>${historySortHead('playoff_appearances','PO Apps')}</th>
      <th>${historySortHead('title_game_appearances','Finals')}</th>
      <th>${historySortHead('regular_points_for','Points')}</th>
    </tr></thead><tbody>
      ${rows.length?rows.map((r,i)=>`<tr><td><strong>${esc(r.display_name||r.team_name||'—')}</strong>${r._kind==='season'&&r.manager_name?`<div class="history-manager">${esc(r.manager_name)}</div>`:''}</td><td>${Number(r.seasons_played||1)}</td><td>${Number(r.regular_wins||0)}</td><td>${Number(r.regular_losses||0)}</td><td>${pct(r.regular_win_pct)}</td><td>${Number(r.playoff_wins||0)}</td><td>${Number(r.playoff_losses||0)}</td><td>${pct(r.playoff_win_pct)}</td><td class="history-title-cell">${Number(r.championships||0)}</td><td>${Number(r.playoff_appearances||0)}</td><td>${Number(r.title_game_appearances||0)}</td><td>${Number(r.regular_points_for||0).toFixed(2)}</td></tr>`).join(''):`<tr><td colspan="12"><div class="empty-tight">Historical results have not been imported yet.</div></td></tr>`}
    </tbody></table></div>
  </section>

  <div class="office-grid two history-grid">
    <section class="card history-section"><div class="office-section-head"><h2>All-Time Accomplishments</h2></div>
      <div class="achievement-list">
        <div class="achievement"><span>🏆</span><div><strong>Most Championships</strong><div>${esc(champs.name)} • ${esc(champs.value)}</div></div></div>
        <div class="achievement"><span>📈</span><div><strong>Most Regular-Season Wins</strong><div>${esc(wins.name)} • ${esc(wins.value)}</div></div></div>
        <div class="achievement"><span>🎯</span><div><strong>Best Regular-Season Win %</strong><div>${esc(regPct.name)} • ${esc(regPct.value)}</div></div></div>
        <div class="achievement"><span>🔥</span><div><strong>Most Playoff Wins</strong><div>${esc(poWins.name)} • ${esc(poWins.value)}</div></div></div>
      </div>
    </section>
    <section class="card history-section"><div class="office-section-head"><h2>Yahoo Archive Import</h2></div>
      <div class="history-import-status"><strong>${imported} of 15 seasons imported</strong><div class="small muted">2011 through 2025 are the completed historical archive. 2026 stays live until the season ends.</div></div>
      ${lastRun?`<div class="history-last-run">Last import: ${fmtDate(lastRun.started_at)} • ${esc(lastRun.status)}${lastRun.season_year?` • ${lastRun.season_year}`:''}</div>`:''}
      <div class="notice">The database and History page are ready. Automated Yahoo importing requires a Yahoo Fantasy API application and OAuth authorization; no Yahoo password is stored in GLSK.</div>
    </section>
  </div>

  ${isCommish()&&unmatched.length?`<section class="card history-section"><div class="office-section-head"><div><h2>Commissioner • Match Historical Franchises</h2><div class="small muted">${unmatched.length} imported team-season row${unmatched.length===1?'':'s'} need franchise mapping.</div></div></div><div class="history-unmatched">${unmatched.slice(0,40).map(r=>{const s=historySeasonById(r.history_season_id);return `<div class="history-map-row"><div><strong>${esc(r.team_name)}</strong><div class="small muted">${s?.season_year||'—'}${r.manager_name?` • ${esc(r.manager_name)}`:''}</div></div><select class="input" data-history-map-select="${r.id}"><option value="">Choose franchise…</option>${state.historyFranchises.map(f=>`<option value="${f.id}">${esc(f.display_name)}</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-history-map="${r.id}">Map</button></div>`}).join('')}</div><div class="history-new-franchise"><input id="history-new-franchise" class="input" placeholder="Former franchise name"><button class="btn btn-outline" data-action="history-create-franchise">Create Former Franchise</button></div></section>`:''}
  `;
}

function loginView(){const options=state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>${esc(LEAGUE_NAME)}</h1><p>League Office</p></div><div class="login-body"><div class="field"><label>Your team</label><select id="join-team" class="input"><option value="">Select your team…</option>${options}</select></div><div class="field"><label>Team PIN</label><input id="team-pin" class="input pin-input" inputmode="numeric" maxlength="6" placeholder="6-digit PIN"></div><div id="join-error"></div><button class="btn btn-primary btn-block" data-action="join">Enter League Office</button><button class="btn-link btn-block" data-action="spectate">View public league dashboard</button><a class="btn-link btn-block" href="/" style="display:block;text-align:center;text-decoration:none">← Auction Room</a></div></div></div>`;}
function setupError(){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>League Office Ready</h1><p>Database connection is missing.</p></div></div></div>`;}
function render(){if(!configured){app.innerHTML=setupError();return;}if(state.loading){app.innerHTML='<div class="login-wrap"><div style="color:white;font-weight:900">Loading League Office…</div></div>';return;}if(!state.session){app.innerHTML=loginView();bind();return;}let content=state.tab==='lineup'?lineupView():state.tab==='matchups'?matchupsView():state.tab==='schedule'?scheduleView():state.tab==='standings'?standingsView():state.tab==='board'?boardView():state.tab==='teams'?teamsView():state.tab==='contracts'?contractsView():state.tab==='trades'?tradesView():state.tab==='transactions'?transactionsView():state.tab==='history'?historyView():state.tab==='rules'?rulesView():state.tab==='deadlines'?deadlinesView():state.tab==='finances'?financesView():state.tab==='reconcile'?reconcileView():dashboard();app.innerHTML=`<div class="office-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;bind();}

async function join(){const teamId=document.querySelector('#join-team')?.value,pin=document.querySelector('#team-pin')?.value.trim(),err=document.querySelector('#join-error');if(!teamId||!pin){err.innerHTML='<div class="error">Select your team and enter its PIN.</div>';return;}try{await rpc('join_room',{p_room_code:ROOM_CODE,p_team_id:teamId,p_pin:pin});const t=state.teams.find(x=>x.id===teamId);let commishPin=null;if(t?.name===COMMISH_TEAM_NAME){const valid=await rpc('commish_login',{p_room_code:ROOM_CODE,p_pin:pin});if(!valid?.valid)throw new Error('Commissioner access is not configured.');commishPin=pin;}saveSession({teamId,pin,commishPin,spectator:false});await loadFinance();render();}catch(e){err.innerHTML=`<div class="error">${esc(e.message)}</div>`;}}
function logout(){saveSession(null);render();}
async function commish(name,args={},msg='Saved.'){try{await rpc(name,{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,...args});toast(msg);await loadData();render();}catch(e){toast(e.message,'error');}}

function bind(){
 app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render();}));
 app.querySelector('#history-season')?.addEventListener('change',e=>{state.historySeason=e.target.value;render();});
 app.querySelectorAll('[data-lineup-week]').forEach(b=>b.addEventListener('click',()=>{state.lineupBrowseWeek=Number(b.dataset.lineupWeek);render();}));
 app.querySelectorAll('[data-lineup-data-tab]').forEach(b=>b.addEventListener('click',()=>{state.lineupDataTab=b.dataset.lineupDataTab;render();}));
 app.querySelectorAll('[data-lineup-range]').forEach(b=>b.addEventListener('click',()=>{
   if(state.lineupDataTab==='projected')state.lineupProjectionRange=b.dataset.lineupRange;
   else state.lineupStatsRange=b.dataset.lineupRange;
   render();
 }));
 app.querySelectorAll('[data-matchup-week]').forEach(b=>b.addEventListener('click',()=>{state.matchupBrowseWeek=Number(b.dataset.matchupWeek);state.selectedMatchupId=null;render();}));
 app.querySelectorAll('[data-select-matchup]').forEach(b=>b.addEventListener('click',()=>{state.selectedMatchupId=b.dataset.selectMatchup;render();}));
 app.querySelector('#schedule-team-select')?.addEventListener('change',e=>{state.scheduleTeamId=e.target.value;render();});
 app.querySelectorAll('[data-board-thread]').forEach(b=>b.addEventListener('click',()=>{state.boardSelectedThread=b.dataset.boardThread;render();}));
 app.querySelector('[data-action="board-create-thread"]')?.addEventListener('click',async()=>{
   const t=myTeam(),title=document.getElementById('board-thread-title')?.value.trim(),body=document.getElementById('board-thread-body')?.value.trim();
   if(!t)return;
   if(!title||title.length<3)return toast('Enter a discussion title.','error');
   if(!body)return toast('Enter a message.','error');
   try{
     const d=await rpc('league_owner_create_message_thread',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_title:title,p_body:body});
     state.boardSelectedThread=d.thread_id;
     toast('Discussion posted.');
     await loadData();render();
   }catch(e){toast(e.message,'error');}
 });
 app.querySelector('[data-action="board-reply"]')?.addEventListener('click',async b=>{
   const t=myTeam(),body=document.getElementById('board-reply-body')?.value.trim();
   if(!t||!body)return toast('Enter a reply.','error');
   try{
     await rpc('league_owner_reply_message_thread',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_thread_id:Number(b.currentTarget.dataset.threadId),p_body:body});
     toast('Reply posted.');
     await loadData();render();
   }catch(e){toast(e.message,'error');}
 });
 app.querySelectorAll('[data-board-action]').forEach(b=>b.addEventListener('click',()=>{
   const action=b.dataset.boardAction,id=Number(b.dataset.threadId);
   if(action==='archive'&&!confirm('Archive this discussion? It will disappear from the active message board.'))return;
   commish('league_commish_message_thread_action',{p_thread_id:id,p_action:action},`Discussion ${action}d.`);
 }));
 app.querySelector('[data-action="save-lineup-slots"]')?.addEventListener('click',()=>{
   const counts={};['QB','RB','WR','TE','FLEX','K','DST'].forEach(p=>counts[p]=Number(document.getElementById(`slot-count-${p}`)?.value||0));
   const slots=[];let order=1;
   const add=(code,label,allowed,count)=>{for(let i=1;i<=count;i++)slots.push({slot_code:`${code}${i}`,label:count>1?`${label}${i}`:label,slot_order:order++,allowed_positions:allowed});};
   add('QB','QB',['QB'],counts.QB);add('RB','RB',['RB'],counts.RB);add('WR','WR',['WR'],counts.WR);add('TE','TE',['TE'],counts.TE);add('FLEX','FLEX',['RB','WR','TE'],counts.FLEX);add('K','K',['K'],counts.K);add('DST','D/ST',['DST'],counts.DST);
   if(!slots.length)return toast('Add at least one starting slot.','error');
   commish('league_commish_set_lineup_slots',{p_slots:slots},'Starting lineup configuration saved.');
 });
 app.querySelector('[data-action="save-lineup"]')?.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   const entries=[...document.querySelectorAll('.lineup-select')].map(s=>({slot_code:s.dataset.slotCode,player_key:s.value||null}));
   try{await rpc('league_owner_save_lineup',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_week:browseWeek(),p_entries:entries});toast(`Week ${browseWeek()} lineup saved.`);await loadData();render();}catch(e){toast(e.message,'error');}
 });
 app.querySelector('[data-action="set-current-week"]')?.addEventListener('click',()=>{const w=Number(document.getElementById('current-week-input')?.value);commish('league_commish_set_current_week',{p_week:w},`Current week set to ${w}.`);});
 app.querySelector('[data-action="save-week-schedule"]')?.addEventListener('click',()=>{
   const rows=[];for(let i=1;i<=6;i++){const h=document.querySelector(`.schedule-home[data-matchup="${i}"]`)?.value,a=document.querySelector(`.schedule-away[data-matchup="${i}"]`)?.value;if(h&&a)rows.push({matchup_no:i,home_team_id:h,away_team_id:a});}
   if(rows.length!==6)return toast('Enter all six weekly matchups.','error');
   commish('league_commish_set_week_schedule',{p_week:currentWeek(),p_phase:document.getElementById('schedule-phase')?.value||'regular',p_matchups:rows},`Week ${currentWeek()} schedule saved.`);
 });
 app.querySelector('[data-action="finalize-week"]')?.addEventListener('click',()=>{if(confirm(`Finalize Week ${matchupBrowseWeek()}? This will post the week to GLSK standings.`))commish('league_commish_finalize_week',{p_week:matchupBrowseWeek()},`Week ${matchupBrowseWeek()} finalized.`);});
 app.querySelector('[data-action="save-reconciliation"]')?.addEventListener('click',async()=>{
   const rows=[...document.querySelectorAll('[data-reconcile-row]')].map(el=>({schedule_id:Number(el.dataset.reconcileRow),yahoo_home_score:el.querySelector('.yahoo-home-score')?.value||null,yahoo_away_score:el.querySelector('.yahoo-away-score')?.value||null}));
   try{await rpc('league_commish_save_reconciliation_matchups',{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,p_week:currentWeek(),p_rows:rows});toast('Reconciliation saved.');await loadData();render();}catch(e){toast(e.message,'error');}
 });
 app.querySelectorAll('[data-history-sort]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.historySort;if(state.historySort.key===key)state.historySort.dir=state.historySort.dir==='asc'?'desc':'asc';else state.historySort={key,dir:key==='display_name'?'asc':'desc'};render();}));
 document.querySelectorAll('[data-history-map]').forEach(b=>b.addEventListener('click',()=>{const id=Number(b.dataset.historyMap),select=document.querySelector(`[data-history-map-select="${id}"]`),fid=select?.value;if(!fid)return toast('Choose a franchise.','error');commish('league_commish_map_history_team',{p_history_team_season_id:id,p_franchise_id:fid},'Historical franchise mapped.');}));
 app.querySelector('[data-action="history-create-franchise"]')?.addEventListener('click',()=>{const name=document.getElementById('history-new-franchise')?.value.trim();if(!name)return toast('Enter a franchise name.','error');commish('league_commish_create_history_franchise',{p_display_name:name},'Historical franchise created.');});
 app.querySelector('[data-action="join"]')?.addEventListener('click',join); app.querySelector('[data-action="spectate"]')?.addEventListener('click',()=>{saveSession({spectator:true,teamId:null,pin:null,commishPin:null});render();}); app.querySelector('[data-action="leave"]')?.addEventListener('click',logout);
 app.querySelector('[data-action="save-rules"]')?.addEventListener('click',()=>{const updates=[...document.querySelectorAll('[data-rule-key]')].map(i=>({key:i.dataset.ruleKey,value:Number(i.value)}));commish('league_commish_set_rules',{p_updates:updates},'League rule defaults updated.');});
 const updateTotal=()=>{const t=[...document.querySelectorAll('.distro-input')].reduce((s,i)=>s+Number(i.value||0),0);for(const id of ['distro-total','distro-total-bottom']){const el=document.getElementById(id);if(el){el.textContent=`${t.toFixed(2)}%`;el.classList.toggle('bad',Math.abs(t-100)>.001);}}}; document.querySelectorAll('.distro-input').forEach(i=>i.addEventListener('input',updateTotal));
 app.querySelector('[data-action="save-distro"]')?.addEventListener('click',()=>{const rows=[...document.querySelectorAll('.distro-input')].map(i=>({bracket:i.dataset.bracket,finish:Number(i.dataset.finish),percentage:Number(i.value)}));commish('league_commish_save_redistribution',{p_rows:rows},'Redistribution saved.');});
 app.querySelector('[data-action="commish-add-player"]')?.addEventListener('click',()=>{
   const p_team_id=document.getElementById('manual-add-team')?.value;
   const p_player_name=document.getElementById('manual-add-player')?.value.trim();
   const p_nfl_team=document.getElementById('manual-add-nfl')?.value.trim().toUpperCase();
   const p_position=document.getElementById('manual-add-position')?.value;
   if(!p_team_id||!p_player_name||!p_nfl_team||!p_position)return toast('Team, player, NFL team and position are required.','error');
   commish('league_commish_add_player',{p_team_id,p_player_name,p_nfl_team,p_position},`${p_player_name} added to roster.`);
 });
 app.querySelector('[data-action="save-contract"]')?.addEventListener('click',()=>{const p_team_id=document.getElementById('contract-team').value,p_player_name=document.getElementById('contract-player').value.trim(),p_length_years=Number(document.getElementById('contract-years').value),p_start_year=Number(document.getElementById('contract-start').value);if(!p_player_name)return toast('Enter a player name.','error');commish('league_commish_upsert_contract',{p_team_id,p_player_name,p_length_years,p_start_year},'Contract saved.');});
 app.querySelector('[data-action="owner-save-contract"]')?.addEventListener('click',async()=>{const deadline=openContractDeadline(),t=myTeam(),p_player_key=document.getElementById('owner-contract-player')?.value,p_length_years=Number(document.getElementById('owner-contract-years')?.value);if(!deadline||!t)return toast('Contract assignments are not open.','error');if(!p_player_key)return toast('Select a player.','error');try{await rpc('league_owner_upsert_contract',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_player_key,p_length_years,p_deadline_id:deadline.id});toast('Contract assignment saved.');await loadData();render();}catch(e){toast(e.message,'error');}});
 app.querySelector('[data-action="owner-submit-contracts"]')?.addEventListener('click',async()=>{const t=myTeam(),deadlineId=document.querySelector('[data-action="owner-submit-contracts"]')?.dataset.deadlineId;if(!t||!deadlineId)return;try{await rpc('league_mark_deadline_submitted',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_deadline_id:deadlineId});toast('Contract assignments submitted.');await loadData();render();}catch(e){toast(e.message,'error');}});
 document.querySelectorAll('[data-owner-remove-contract]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam();if(!t||!confirm('Remove this new contract assignment?'))return;try{await rpc('league_owner_remove_contract',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_contract_id:Number(b.dataset.ownerRemoveContract),p_deadline_id:b.dataset.deadlineId});toast('Contract assignment removed.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-void-contract]').forEach(b=>b.addEventListener('click',()=>{if(confirm('Void this contract?'))commish('league_commish_void_contract',{p_contract_id:Number(b.dataset.voidContract)},'Contract voided.');}));
 app.querySelector('[data-action="create-deadline"]')?.addEventListener('click',()=>{const title=document.getElementById('deadline-title').value.trim(),due=document.getElementById('deadline-due').value;if(!title||!due)return toast('Title and due date/time are required.','error');commish('league_commish_create_deadline',{p_title:title,p_deadline_type:document.getElementById('deadline-type').value,p_due_at:new Date(due).toISOString(),p_auto_lock:document.getElementById('deadline-lock').value==='true',p_notes:document.getElementById('deadline-notes').value},'Deadline created.');});
 document.querySelectorAll('[data-submit-deadline]').forEach(b=>b.addEventListener('click',async()=>{try{await rpc('league_mark_deadline_submitted',{p_room_code:ROOM_CODE,p_team_id:state.session.teamId,p_pin:state.session.pin,p_deadline_id:b.dataset.submitDeadline});toast('Submission recorded.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-deadline-status]').forEach(b=>b.addEventListener('click',()=>commish('league_commish_set_deadline_status',{p_deadline_id:b.dataset.deadlineId,p_status:b.dataset.deadlineStatus},'Deadline updated.')));
 app.querySelector('[data-action="add-finance"]')?.addEventListener('click',()=>{const amt=Math.round(Number(document.getElementById('finance-amount').value||0)*100),desc=document.getElementById('finance-desc').value.trim();if(!desc||!Number.isFinite(amt))return toast('Enter description and amount.','error');commish('league_commish_add_finance_item',{p_team_id:document.getElementById('finance-team').value||null,p_category:document.getElementById('finance-category').value,p_description:desc,p_amount_cents:amt,p_due_at:document.getElementById('finance-due').value||null,p_status:'due'},'Finance entry added.');});
 document.querySelectorAll('[data-finance-status]').forEach(b=>b.addEventListener('click',()=>commish('league_commish_set_finance_status',{p_finance_id:b.dataset.financeId,p_status:b.dataset.financeStatus},'Finance status updated.')));
 document.querySelectorAll('[data-drop-player]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam(),pen=Number(b.dataset.dropPenalty||0),name=b.dataset.dropName;if(!t)return;if(!confirm(`Drop ${name}?${pen?` This will cost ${pen} bid dollars.`:''}`))return;try{const d=await rpc('league_owner_drop_player',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_player_key:b.dataset.dropPlayer});toast(`${name} dropped${d.penalty?` • ${d.penalty} bid fine`:''}.`);await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-exception-drop]').forEach(b=>b.addEventListener('click',()=>{const reason=prompt(`No-penalty exception for ${b.dataset.dropName}. Type retirement or ban:`);if(!reason)return;commish('league_commish_exception_drop',{p_team_id:b.dataset.exceptionTeam,p_player_key:b.dataset.exceptionDrop,p_reason:reason},`${b.dataset.dropName} removed with no penalty.`);}));
 app.querySelector('[data-action="refresh-extension-costs"]')?.addEventListener('click',()=>commish('league_commish_refresh_extension_costs',{},'Extension costs refreshed from auction results.'));
 document.querySelectorAll('[data-extend-contract]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam(),cost=b.dataset.extensionCost,name=b.dataset.playerName;if(!t)return;if(!confirm(`Extend ${name}${cost?` for ${cost} bid dollars`:''}? The new contract length and cap value apply immediately.`))return;try{await rpc('league_owner_extend_contract',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_eligibility_id:b.dataset.extendContract});toast(`${name} extended.`);await loadData();render();}catch(e){toast(e.message,'error');}}));
 app.querySelector('#trade-partner')?.addEventListener('change',e=>{state.tradePartner=e.target.value;render();});
 const updateTradeSelectionSummary=()=>{
   const give=[...document.querySelectorAll('.trade-give:checked')].length;
   const receive=[...document.querySelectorAll('.trade-receive:checked')].length;
   const gb=Number(document.getElementById('trade-give-bids')?.value||0),rb=Number(document.getElementById('trade-receive-bids')?.value||0);
   const el=document.getElementById('trade-selection-summary');
   if(el)el.textContent=`You send ${give} asset${give===1?'':'s'}${gb?` + ${gb} bids`:''} • You receive ${receive} asset${receive===1?'':'s'}${rb?` + ${rb} bids`:''}`;
 };
 document.querySelectorAll('.trade-give,.trade-receive').forEach(i=>i.addEventListener('change',updateTradeSelectionSummary));
 app.querySelector('#trade-give-bids')?.addEventListener('input',updateTradeSelectionSummary);
 app.querySelector('#trade-receive-bids')?.addEventListener('input',updateTradeSelectionSummary);
 updateTradeSelectionSummary();
 app.querySelector('[data-action="propose-trade"]')?.addEventListener('click',async()=>{const me=myTeam(),partner=document.getElementById('trade-partner')?.value;if(!me||!partner)return;const collect=cls=>[...document.querySelectorAll(`.${cls}:checked`)].map(i=>({type:i.dataset.type,key:i.dataset.key||null,name:i.dataset.name||null,pick_id:i.dataset.pickId||null}));const give=collect('trade-give'),receive=collect('trade-receive');const gb=Number(document.getElementById('trade-give-bids')?.value||0),rb=Number(document.getElementById('trade-receive-bids')?.value||0);if(gb>0)give.push({type:'bid_dollars',amount:gb});if(rb>0)receive.push({type:'bid_dollars',amount:rb});try{await rpc('league_owner_propose_trade',{p_room_code:ROOM_CODE,p_team_id:me.id,p_pin:state.session.pin,p_partner_team_id:partner,p_give:give,p_receive:receive,p_note:document.getElementById('trade-note')?.value||null});toast('Trade proposal sent.');await loadData();render();}catch(e){toast(e.message,'error');}});
 document.querySelectorAll('[data-trade-response]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam();if(!t)return;try{await rpc('league_owner_trade_response',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_trade_id:b.dataset.tradeId,p_accept:b.dataset.tradeResponse==='accept'});toast(b.dataset.tradeResponse==='accept'?'Trade accepted — awaiting commissioner approval.':'Trade rejected.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-cancel-trade]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam();if(!t||!confirm('Cancel this trade proposal?'))return;try{await rpc('league_owner_cancel_trade',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_trade_id:b.dataset.cancelTrade});toast('Trade cancelled.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-commish-trade]').forEach(b=>b.addEventListener('click',()=>{if(!confirm(`${b.dataset.commishTrade==='approve'?'Approve':'Deny'} this trade?`))return;commish('league_commish_trade_decision',{p_trade_id:b.dataset.tradeId,p_approve:b.dataset.commishTrade==='approve'},b.dataset.commishTrade==='approve'?'Trade approved and processed.':'Trade denied.');}));
 const updateTx=()=>{state.txFilters={team:document.getElementById('tx-team')?.value||'',type:document.getElementById('tx-type')?.value||'',search:document.getElementById('tx-search')?.value||''};render();};
 app.querySelector('#tx-team')?.addEventListener('change',updateTx);app.querySelector('#tx-type')?.addEventListener('change',updateTx);app.querySelector('#tx-search')?.addEventListener('change',updateTx);
 app.querySelector('[data-action="save-correction"]')?.addEventListener('click',()=>{const desc=document.getElementById('corr-desc')?.value.trim();if(!desc)return toast('Enter a correction description.','error');commish('league_commish_correction',{p_team_id:document.getElementById('corr-team')?.value||null,p_bid_delta:Number(document.getElementById('corr-bids')?.value||0),p_description:desc,p_reverse_transaction_id:document.getElementById('corr-reverse')?.value||null},'Correction recorded.');});
}

async function subscribe(){if(state.realtime)await supabase.removeChannel(state.realtime);state.realtime=supabase.channel(`league-office-${ROOM_CODE}`).on('postgres_changes',{event:'*',schema:'public',table:'league_roster_entries'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'teams'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_contracts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_rule_settings'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'redistribution_rules'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadlines'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadline_team_status'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_seasons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_team_seasons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_stats'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_lineups'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_weekly_player_scores'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_schedule'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_week_states'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_scoring_rules'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_projections'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_message_threads'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_message_posts'},refresh).subscribe();}
let refreshTimer=null;function refresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{try{await loadData();render();}catch(e){console.warn(e);}},180);}

async function init(){if(!configured){state.loading=false;render();return;}try{await loadData();state.loading=false;render();await subscribe();}catch(e){state.loading=false;app.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>League Office</h1><p>Database migration required.</p></div><div class="login-body"><div class="error">${esc(e.message)}</div><p class="small muted">Run the League Office v1 Supabase migration, then refresh.</p></div></div></div>`;}}
init();
