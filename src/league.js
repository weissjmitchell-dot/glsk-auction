import './league.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';

const state = {
  room:null, teams:[], season:null, roster:[], contracts:[], rules:[], distro:[], deadlines:[], deadlineStatus:[], finance:[], contractOptions:[],
  transactions:[], trades:[], tradeAssets:[], futurePicks:[], rookieRights:[], extensionCosts:[], extensionEligibility:[],
  historySeasons:[], historyTeamSeasons:[], historyAllTime:[], historyFranchises:[], historyImportRuns:[],
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

async function loadData(){
  const {data:room,error:re}=await supabase.from('rooms').select('*').eq('code',ROOM_CODE).single(); if(re)throw re; state.room=room;
  const [teams,seasons,roster,contracts,rules,distro,deadlines,statuses,options,transactions,trades,tradeAssets,futurePicks,rookieRights,extensionCosts,extensionEligibility,historySeasons,historyTeamSeasons,historyAllTime,historyFranchises,historyImportRuns]=await Promise.all([
    q('teams','*',[['room_id',room.id]]),q('league_seasons','*',[['room_id',room.id]]),q('league_roster_entries','*',[['room_id',room.id]]),
    q('league_contracts','*'),q('league_rule_settings','*'),q('redistribution_rules','*'),q('league_deadlines','*'),q('league_deadline_team_status','*'),q('contract_options','*'),
    q('league_transactions','*'),q('league_trades','*'),q('league_trade_assets','*'),q('league_future_picks','*',[['room_id',room.id]]),q('league_rookie_rights','*',[['room_id',room.id]]),q('league_extension_costs','*'),q('league_contract_extension_eligibility','*'),
    q('league_history_seasons','*',[['room_id',room.id]]),q('league_history_team_seasons','*'),q('league_history_all_time','*',[['room_id',room.id]]),q('league_franchises','*',[['room_id',room.id]]),q('league_history_import_runs','*',[['room_id',room.id]])
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
  await loadFinance();
}

function topBar(){const t=myTeam();return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-kicker">League Office</div><div class="brand-title">${esc(LEAGUE_NAME)}</div></div><div class="user-chip"><span class="status-dot live"></span><div class="user-chip-text"><div class="user-team">${t?`${esc(t.name)}${isCommish()?' • Commish':''}`:state.session?.spectator?'Spectator':'League'}</div><div class="user-budget">${t?`${bidMoney(t.remaining_budget)} bids • ${rosterFor(t.id).length}/${state.season?.roster_limit||18} roster`:`${state.season?.season_year||2026} season`}</div></div><button class="btn-link" data-action="leave" style="color:#cbd4e3">Leave</button></div></div></header>`;}
function bottomNav(){const items=[['home','⌂','Home'],['teams','♟','Teams'],['contracts','▤','Contracts'],['trades','⇄','Trades'],['transactions','☷','Transactions'],['history','★','History'],['rules','⚙','Rules'],['deadlines','◷','Deadlines'],['finances','$','Finances']];return `<nav class="bottom-nav office-bottom-nav"><div class="bottom-nav-inner">${items.map(([t,i,l])=>`<button class="nav-btn ${state.tab===t?'active':''}" data-tab="${t}"><span>${i}</span>${l}</button>`).join('')}</div></nav>`;}

function dashboard(){
 const rosterLimit=state.season?.roster_limit||18,full=state.teams.filter(t=>rosterFor(t.id).length>=rosterLimit).length,totalBids=state.teams.reduce((s,t)=>s+Number(t.remaining_budget||0),0),open=state.deadlines.filter(d=>d.status==='open').length;
 const next=state.deadlines.find(d=>d.status==='open'&&new Date(d.due_at)>new Date());
 return `<section class="office-hero"><div class="office-kicker">${state.season?.season_year||2026} League Year</div><h1>Great Lake State Keepers</h1><p>Rosters, contracts, bid dollars, rules, deadlines and league operations in one place.</p></section>
 <div class="kpi-grid"><div class="card kpi"><div class="kpi-label">Teams Full</div><div class="kpi-value">${full}/12</div><div class="kpi-sub">${rosterLimit}-player limit</div></div><div class="card kpi"><div class="kpi-label">Bid Dollars</div><div class="kpi-value">${totalBids}</div><div class="kpi-sub">remaining league-wide</div></div><div class="card kpi"><div class="kpi-label">Contracts</div><div class="kpi-value">${state.contracts.filter(c=>c.status==='active').length}</div><div class="kpi-sub">active</div></div><div class="card kpi"><div class="kpi-label">Deadlines</div><div class="kpi-value">${open}</div><div class="kpi-sub">currently open</div></div></div>
 ${next?`<div class="owner-banner"><strong>Next deadline:</strong> ${esc(next.title)} • ${fmtDate(next.due_at)}</div>`:''}
 <div class="office-grid two"><div><div class="office-section"><div class="office-section-head"><h2>League Snapshot</h2><button class="btn btn-sm btn-outline" data-tab="teams">All Teams</button></div>${teamCards()}</div></div><div><div class="office-section"><div class="office-section-head"><h2>Draft Rooms</h2></div><div class="draft-links"><a class="draft-link" href="/"><strong>⚡</strong>Auction</a><a class="draft-link" href="/supplemental"><strong>↔</strong>Supplemental</a><a class="draft-link" href="/phase3"><strong>⇅</strong>Roster Fill</a></div></div><div class="office-section"><div class="office-section-head"><h2>Commissioner Tools</h2></div><div class="card card-pad"><div class="small muted">${isCommish()?'You have commissioner access. Rules, contracts, deadlines and finance controls are unlocked.':'Commissioner controls are only available to Weiss Tea & Lemonade.'}</div></div></div></div></div>`;
}
function teamCards(){const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;return `<div class="team-office-grid">${state.teams.map(t=>`<div class="card office-team-card"><div class="office-team-name">${esc(t.name)}</div><div class="cap-badge">${capUsed(t.id)}/${cap} pts</div><div class="office-team-metrics"><div class="office-mini"><span>Roster</span><strong>${rosterFor(t.id).length}/${lim}</strong></div><div class="office-mini"><span>Bids</span><strong>${bidMoney(t.remaining_budget)}</strong></div><div class="office-mini"><span>Contracts</span><strong>${contractsFor(t.id).length}</strong></div></div></div>`).join('')}</div>`;}

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

function teamsView(){
 const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;
 return `<div class="office-section-head"><h2>Teams & Rosters</h2><div class="small muted">Live from the shared league roster</div></div>${commissionerAddPlayerForm()}<div class="team-office-grid">${state.teams.map(t=>{
   const roster=rosterFor(t.id).slice().sort((a,b)=>(a.position||'').localeCompare(b.position||'')||a.player_name.localeCompare(b.player_name));
   return `<details class="card office-team-card"><summary style="cursor:pointer;list-style:none"><div class="row between gap-8"><div class="office-team-name">${esc(t.name)}</div><div><strong>${roster.length}/${lim}</strong> • ${bidMoney(t.remaining_budget)} • ${capUsed(t.id)}/${cap} pts</div></div></summary><div style="grid-column:1/-1;margin-top:8px">${roster.map(r=>{
     const c=contractForPlayer(t.id,r.player_key);
     const canDrop=myTeam()?.id===t.id&&!state.session?.spectator;
     const penalty=c?(contractYear(c)===1?Number(c.cap_cost||0)*2:({2:5,3:10,4:20}[Number(c.length_years)]||0)):0;
     return `<div class="contract-row"><div><div class="contract-player">${esc(r.player_name)}</div><div class="contract-sub">${esc(r.position||'')} • ${esc(r.nfl_team||'')} • ${esc(r.acquisition_type||'roster')}</div>${c?`<div class="contract-detail">${esc(contractLabel(c))}${penalty?` • Drop fine: ${penalty} bids`:''}</div>`:'<div class="contract-detail muted">No active contract</div>'}</div><div class="inline-actions">${c?'<span class="tag tag-next">CONTRACT</span>':''}${canDrop?`<button class="btn btn-sm btn-reset" data-drop-player="${esc(r.player_key)}" data-drop-name="${esc(r.player_name)}" data-drop-penalty="${penalty}">Drop</button>`:''}${isCommish()?`<button class="btn btn-sm btn-outline" data-exception-drop="${esc(r.player_key)}" data-exception-team="${t.id}" data-drop-name="${esc(r.player_name)}">Retire/Ban</button>`:''}</div></div>`;
   }).join('')||'<div class="empty-tight">No roster entries.</div>'}</div></details>`;
 }).join('')}</div>`;
}

function extensionCostReference(){
 const positions=['QB','RB','WR','TE'];
 return `<section class="card card-pad office-section"><div class="office-section-head"><div><h2>Extension Cost Reference</h2><div class="small muted">Actual top-3 Free Agent Auction bids • 2yr→3yr = 25% avg • 3yr→4yr = 40% avg</div></div>${isCommish()?'<button class="btn btn-sm btn-outline" data-action="refresh-extension-costs">Refresh</button>':''}</div><div class="table-scroll"><table class="office-table"><thead><tr><th>Pos</th><th>Top 3 bids</th><th>Avg</th><th>2→3</th><th>3→4</th></tr></thead><tbody>${positions.map(pos=>{const c=state.extensionCosts.find(x=>x.position===pos);return `<tr><td><strong>${pos}</strong></td><td>${c&&c.top_bid_3!=null?`${c.top_bid_1}, ${c.top_bid_2}, ${c.top_bid_3}`:'N/A'}</td><td>${c?.average_bid!=null?Number(c.average_bid).toFixed(1):'—'}</td><td><strong>${c?.cost_2_to_3!=null?`${c.cost_2_to_3} bids`:'—'}</strong></td><td><strong>${c?.cost_3_to_4!=null?`${c.cost_3_to_4} bids`:'—'}</strong></td></tr>`;}).join('')}</tbody></table></div></section>`;
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
 return `<div class="office-section-head"><h2>Contracts & Salary Cap</h2><div class="small muted">${state.contractOptions.map(o=>`${o.years}yr = ${o.cap_cost}pts`).join(' • ')}</div></div>${extensionCostReference()}${extensionPanel()}${ownerContractPanel()}${isCommish()?contractForm():''}${body}`;
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
function tradeSide(teamId,cls){
 const roster=rosterFor(teamId).slice().sort((a,b)=>a.player_name.localeCompare(b.player_name));
 const rights=rightsFor(teamId).slice().sort((a,b)=>a.player_name.localeCompare(b.player_name));
 const picks=picksFor(teamId).filter(p=>p.draft_year===Number(state.season?.season_year||2026)+1);
 return `<div class="trade-assets"><div class="asset-group"><div class="asset-title">Players</div>${roster.map(r=>`<label class="asset-check"><input type="checkbox" class="${cls}" data-type="player" data-key="${esc(r.player_key)}" data-name="${esc(r.player_name)}"><span>${esc(r.player_name)}${contractForPlayer(teamId,r.player_key)?' • CONTRACT':''}</span></label>`).join('')||'<div class="small muted">None</div>'}</div><div class="asset-group"><div class="asset-title">Rookie Rights</div>${rights.map(r=>`<label class="asset-check"><input type="checkbox" class="${cls}" data-type="rookie_rights" data-key="${esc(r.player_key)}" data-name="${esc(r.player_name)}"><span>${esc(r.player_name)}</span></label>`).join('')||'<div class="small muted">None</div>'}</div><div class="asset-group"><div class="asset-title">2027 Picks</div>${picks.map(pk=>`<label class="asset-check"><input type="checkbox" class="${cls}" data-type="${pk.draft_type==='rookie'?'rookie_pick':'supplemental_pick'}" data-pick-id="${pk.id}"><span>${esc(pickLabel(pk))}</span></label>`).join('')||'<div class="small muted">None</div>'}</div></div>`;
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
 return `<div class="office-section-head"><h2>Trades</h2><div class="small muted">Both owners agree • commissioner approves • contract cap validated before submission</div></div>
 ${me&&!state.session?.spectator?`<section class="card office-form office-section"><div class="section-title">Propose Trade</div><div class="field"><label>Trade partner</label><select id="trade-partner" class="input">${others.map(t=>`<option value="${t.id}" ${t.id===partnerId?'selected':''}>${esc(t.name)}</option>`).join('')}</select></div><div class="trade-builder"><div><h3>You Send</h3>${tradeSide(me.id,'trade-give')}<div class="field"><label>Bid dollars</label><input id="trade-give-bids" class="input" type="number" min="0" max="${me.remaining_budget}" value="0"></div></div><div><h3>You Request from ${esc(partner?.name||'')}</h3>${partner?tradeSide(partner.id,'trade-receive'):''}<div class="field"><label>Bid dollars</label><input id="trade-receive-bids" class="input" type="number" min="0" max="${partner?.remaining_budget||0}" value="0"></div></div></div><div class="field"><label>Note</label><input id="trade-note" class="input" placeholder="Optional trade note"></div><div class="notice">Only currently owned assets are selectable. In ${state.season?.season_year||2026}, only ${(state.season?.season_year||2026)+1} Rookie/Supplemental picks are tradable. Contracted players carry their current year and original point value.</div><button class="btn btn-primary" data-action="propose-trade">Send Trade Proposal</button></section>`:''}
 <div class="list-stack">${visible.length?visible.map(tr=>{const proposer=teamById(tr.proposer_team_id),partnerT=teamById(tr.partner_team_id);return `<div class="card trade-card"><div class="row between gap-8 wrap"><div><div class="deadline-title">${esc(proposer?.name)} ↔ ${esc(partnerT?.name)}</div><div class="deadline-meta">Proposed ${fmtDate(tr.proposed_at)}${tr.note?` • ${esc(tr.note)}`:''}</div></div><span class="trade-status ${tr.status}">${esc(tr.status.replace('_',' '))}</span></div>${tradeSummary(tr)}<div class="inline-actions" style="margin-top:10px">${me?.id===tr.partner_team_id&&tr.status==='proposed'?`<button class="btn btn-sm btn-green" data-trade-response="accept" data-trade-id="${tr.id}">Accept</button><button class="btn btn-sm btn-reset" data-trade-response="reject" data-trade-id="${tr.id}">Reject</button>`:''}${me?.id===tr.proposer_team_id&&['proposed','pending_commish'].includes(tr.status)?`<button class="btn btn-sm btn-outline" data-cancel-trade="${tr.id}">Cancel</button>`:''}${isCommish()&&tr.status==='pending_commish'?`<button class="btn btn-sm btn-green" data-commish-trade="approve" data-trade-id="${tr.id}">Approve</button><button class="btn btn-sm btn-reset" data-commish-trade="deny" data-trade-id="${tr.id}">Deny</button>`:''}</div></div>`;}).join(''):'<div class="card empty">No trades yet.</div>'}</div>`;
}
function transactionTypeLabel(t){return ({auction:'Auction',supplemental:'Supplemental',phase3:'Roster Fill',trade:'Trade',drop:'Drop',contract_assigned:'Contract Assigned',contract_removed:'Contract Removed',contract_extended:'Contract Extended',contract_voided:'Contract Voided',rookie_rights_transfer:'Rookie Rights',commissioner_correction:'Commissioner Correction',add:'Add'}[t]||t.replaceAll('_',' '));}
function transactionsView(){
 const f=state.txFilters||{team:'',type:'',search:''},types=[...new Set(state.transactions.map(t=>t.transaction_type))].sort();
 const rows=state.transactions.filter(tx=>(!f.team||tx.team_id===f.team||tx.other_team_id===f.team)&&(!f.type||tx.transaction_type===f.type)&&(!f.search||`${tx.player_name||''} ${tx.description||''}`.toLowerCase().includes(f.search.toLowerCase())));
 return `<div class="office-section-head"><h2>Transactions</h2><div class="small muted">Permanent league ledger • corrections preserve history</div></div><section class="card card-pad office-section"><div class="tx-filters"><select id="tx-team" class="input"><option value="">All teams</option>${state.teams.map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select><select id="tx-type" class="input"><option value="">All transaction types</option>${types.map(t=>`<option value="${esc(t)}" ${f.type===t?'selected':''}>${esc(transactionTypeLabel(t))}</option>`).join('')}</select><input id="tx-search" class="input" value="${esc(f.search)}" placeholder="Search player / transaction"></div></section>${isCommish()?correctionForm():''}<div class="list-stack">${rows.length?rows.map(tx=>{const t=teamById(tx.team_id),o=teamById(tx.other_team_id);return `<details class="card tx-card"><summary><div><div class="row gap-8 wrap"><span class="tx-type">${esc(transactionTypeLabel(tx.transaction_type))}</span>${tx.status==='reversed'?'<span class="trade-status denied">REVERSED</span>':''}</div><div class="log-name">${esc(tx.description)}</div><div class="small muted">${fmtDate(tx.created_at)}${t?` • ${esc(t.name)}`:''}${o?` ↔ ${esc(o.name)}`:''}</div></div><div class="tx-deltas">${tx.bid_delta?`<span class="${tx.bid_delta<0?'neg':'pos'}">${tx.bid_delta>0?'+':''}${tx.bid_delta} bids</span>`:''}${tx.cap_delta?`<span>${tx.cap_delta>0?'+':''}${tx.cap_delta} cap</span>`:''}</div></summary><pre class="tx-json">${esc(JSON.stringify(tx.details||{},null,2))}</pre></details>`;}).join(''):'<div class="card empty">No transactions match these filters.</div>'}</div>`;
}
function correctionForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner Correction</div><div class="form-grid"><div class="field"><label>Team (optional)</label><select id="corr-team" class="input"><option value="">League / no team</option>${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Bid-dollar adjustment</label><input id="corr-bids" class="input" type="number" step="1" value="0"></div><div class="field"><label>Reverse transaction (optional)</label><select id="corr-reverse" class="input"><option value="">None</option>${state.transactions.filter(x=>x.status!=='reversed').slice(0,100).map(x=>`<option value="${x.id}">${esc(fmtDate(x.created_at))} • ${esc(transactionTypeLabel(x.transaction_type))} • ${esc(x.player_name||x.description)}</option>`).join('')}</select></div><div class="field"><label>Description</label><input id="corr-desc" class="input" placeholder="Reason for correction"></div></div><button class="btn btn-primary" data-action="save-correction">Record Correction</button></section>`;}
function rulesView(){const groups=[...new Set(state.rules.map(r=>r.category))];const total=state.distro.reduce((s,r)=>s+Number(r.percentage||0),0);return `<div class="office-section-head"><h2>League Rules</h2><div class="small muted">Season-versioned settings</div></div><div class="office-grid two"><div><section class="card card-pad">${groups.map(g=>`<div class="rule-category"><h3>${esc(g)}</h3>${state.rules.filter(r=>r.category===g).map(r=>`<div class="rule-row"><div class="rule-label">${esc(r.label)}${r.unit?` <span class="small muted">(${esc(r.unit)})</span>`:''}</div><div>${r.numeric_value!=null?(isCommish()?`<input class="rule-input" data-rule-key="${esc(r.rule_key)}" type="number" step="1" value="${Number(r.numeric_value)}">`:`<div class="rule-value">${Number(r.numeric_value)} ${esc(r.unit||'')}</div>`):`<div class="rule-value">${r.boolean_value?'On':'Off'}</div>`}</div></div>`).join('')}</div>`).join('')}${isCommish()?'<button class="btn btn-primary" data-action="save-rules">Save Rule Defaults</button>':''}</section></div><div><section class="card card-pad"><div class="office-section-head"><h2>Bid Redistribution</h2><div id="distro-total" class="${Math.abs(total-100)>.001?'distro-total bad':'distro-total'}">${total.toFixed(2)}%</div></div><div class="redistribution-grid">${state.distro.map(r=>`<div class="distro-row"><div class="rule-label">${esc(r.label)}</div>${isCommish()?`<input class="rule-input distro-input" data-bracket="${r.bracket}" data-finish="${r.finish}" type="number" step="0.05" min="0" max="100" value="${Number(r.percentage).toFixed(2)}">`:`<div class="rule-value">${Number(r.percentage).toFixed(2)}%</div>`}</div>`).join('')}</div><div class="distro-total"><span>Total</span><strong id="distro-total-bottom">${total.toFixed(2)}%</strong></div>${isCommish()?'<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="save-distro">Save Redistribution</button>':''}<div class="small muted" style="margin-top:9px">The 2026 values were imported from the league workbook. Future seasons can use different versions without rewriting history.</div></section></div></div>`;}

function deadlinesView(){const mine=myTeam();return `<div class="office-section-head"><h2>Deadlines</h2><div class="small muted">Auto-lock + timestamped submissions</div></div>${isCommish()?deadlineForm():''}<div class="list-stack">${state.deadlines.length?state.deadlines.map(d=>{const sts=state.deadlineStatus.filter(s=>s.deadline_id===d.id),done=sts.filter(s=>['submitted','late','waived'].includes(s.status)).length,my=mine?sts.find(s=>s.team_id===mine.id):null,pct=state.teams.length?done/state.teams.length*100:0;return `<div class="card deadline-card"><div class="row between gap-8"><div><div class="deadline-title">${esc(d.title)}</div><div class="deadline-meta">${esc(d.deadline_type)} • ${fmtDate(d.due_at)}${d.auto_lock?' • auto-lock':''}</div></div><span class="deadline-status ${d.status}">${esc(d.status)}</span></div>${d.notes?`<div class="small muted" style="margin-top:7px">${esc(d.notes)}</div>`:''}<div class="deadline-progress"><div style="width:${pct}%"></div></div><div class="row between gap-8 wrap" style="margin-top:8px"><div class="small muted">${done}/${state.teams.length} submitted${my?` • Your status: ${esc(my.status)}`:''}</div><div class="inline-actions">${mine&&d.status==='open'&&(!my||my.status==='pending')?`<button class="btn btn-sm btn-green" data-submit-deadline="${d.id}">Mark Submitted</button>`:''}${isCommish()&&d.status==='open'?`<button class="btn btn-sm btn-outline" data-deadline-status="closed" data-deadline-id="${d.id}">Close</button>`:''}${isCommish()&&d.status==='closed'?`<button class="btn btn-sm btn-outline" data-deadline-status="open" data-deadline-id="${d.id}">Reopen</button>`:''}${isCommish()&&d.status!=='completed'?`<button class="btn btn-sm btn-outline" data-deadline-status="completed" data-deadline-id="${d.id}">Complete</button>`:''}</div></div></div>`;}).join(''):'<div class="card empty">No league deadlines have been created yet.</div>'}</div>`;}
function deadlineForm(){return `<section class="card office-form office-section"><div class="section-title">Create Deadline</div><div class="form-grid"><div class="field"><label>Title</label><input id="deadline-title" class="input" placeholder="Contract assignments due"></div><div class="field"><label>Type</label><select id="deadline-type" class="input"><option value="contracts">Contracts</option><option value="contract_extensions">Contract Extensions</option><option value="rookie_rights">Rookie Rights</option><option value="dues">Dues</option><option value="trade">Trade / Transaction</option><option value="general">General</option></select></div><div class="field"><label>Due date & time</label><input id="deadline-due" type="datetime-local" class="input"></div><div class="field"><label>Automatic lock</label><select id="deadline-lock" class="input"><option value="true">Yes</option><option value="false">No</option></select></div></div><div class="field"><label>Notes</label><textarea id="deadline-notes" class="input" placeholder="Optional instructions"></textarea></div><button class="btn btn-primary" data-action="create-deadline">Create Deadline</button></section>`;}

function financesView(){const sumDue=state.finance.filter(x=>x.status==='due').reduce((s,x)=>s+Number(x.amount_cents||0),0),sumPaid=state.finance.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount_cents||0),0);return `<div class="office-section-head"><h2>League Finances</h2><div class="small muted">PIN-validated private ledger</div></div><div class="kpi-grid"><div class="card kpi"><div class="kpi-label">Due</div><div class="kpi-value">${money(sumDue)}</div></div><div class="card kpi"><div class="kpi-label">Paid</div><div class="kpi-value">${money(sumPaid)}</div></div></div>${isCommish()?financeForm():''}<div class="list-stack">${state.finance.length?state.finance.map(f=>{const t=teamById(f.team_id);return `<div class="finance-row"><div><div class="log-name">${esc(f.description)}</div><div class="small muted">${esc(t?.name||'League')} • ${esc(f.category)}${f.due_at?` • due ${fmtDateOnly(f.due_at)}`:''}</div><div class="finance-status">${esc(f.status)}</div></div><div style="text-align:right"><div class="finance-amount ${Number(f.amount_cents)<0?'negative':''}">${money(f.amount_cents)}</div>${isCommish()?`<div class="inline-actions" style="justify-content:flex-end;margin-top:5px">${f.status!=='paid'?`<button class="btn btn-sm btn-green" data-finance-status="paid" data-finance-id="${f.id}">Paid</button>`:''}${f.status!=='waived'?`<button class="btn btn-sm btn-outline" data-finance-status="waived" data-finance-id="${f.id}">Waive</button>`:''}</div>`:''}</div></div>`;}).join(''):'<div class="card empty">No finance entries yet.</div>'}</div><div class="notice" style="margin-top:12px">Financial rows are not publicly readable from Supabase; owners can retrieve only their own items with their team PIN, while the commissioner can retrieve the full ledger.</div>`;}
function financeForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner • Add Finance Entry</div><div class="form-grid"><div class="field"><label>Team</label><select id="finance-team" class="input"><option value="">League-wide</option>${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Category</label><select id="finance-category" class="input"><option value="dues">Dues</option><option value="prize">Prize</option><option value="expense">Expense</option><option value="adjustment">Adjustment</option><option value="other">Other</option></select></div><div class="field"><label>Amount ($)</label><input id="finance-amount" type="number" step="0.01" class="input" placeholder="100.00"></div><div class="field"><label>Due date</label><input id="finance-due" type="date" class="input"></div></div><div class="field"><label>Description</label><input id="finance-desc" class="input" placeholder="2026 league dues"></div><button class="btn btn-primary" data-action="add-finance">Add Entry</button></section>`;}


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

  return `<section class="office-hero history-hero"><div class="office-kicker">2011–2025 Archive</div><h1>League History & Records</h1><p>All-time franchise performance across the completed GLSK seasons.</p></section>
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
function render(){if(!configured){app.innerHTML=setupError();return;}if(state.loading){app.innerHTML='<div class="login-wrap"><div style="color:white;font-weight:900">Loading League Office…</div></div>';return;}if(!state.session){app.innerHTML=loginView();bind();return;}let content=state.tab==='teams'?teamsView():state.tab==='contracts'?contractsView():state.tab==='trades'?tradesView():state.tab==='transactions'?transactionsView():state.tab==='history'?historyView():state.tab==='rules'?rulesView():state.tab==='deadlines'?deadlinesView():state.tab==='finances'?financesView():dashboard();app.innerHTML=`<div class="office-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;bind();}

async function join(){const teamId=document.querySelector('#join-team')?.value,pin=document.querySelector('#team-pin')?.value.trim(),err=document.querySelector('#join-error');if(!teamId||!pin){err.innerHTML='<div class="error">Select your team and enter its PIN.</div>';return;}try{await rpc('join_room',{p_room_code:ROOM_CODE,p_team_id:teamId,p_pin:pin});const t=state.teams.find(x=>x.id===teamId);let commishPin=null;if(t?.name===COMMISH_TEAM_NAME){const valid=await rpc('commish_login',{p_room_code:ROOM_CODE,p_pin:pin});if(!valid?.valid)throw new Error('Commissioner access is not configured.');commishPin=pin;}saveSession({teamId,pin,commishPin,spectator:false});await loadFinance();render();}catch(e){err.innerHTML=`<div class="error">${esc(e.message)}</div>`;}}
function logout(){saveSession(null);render();}
async function commish(name,args={},msg='Saved.'){try{await rpc(name,{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,...args});toast(msg);await loadData();render();}catch(e){toast(e.message,'error');}}

function bind(){
 app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render();}));
 app.querySelector('#history-season')?.addEventListener('change',e=>{state.historySeason=e.target.value;render();});
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
 app.querySelector('[data-action="propose-trade"]')?.addEventListener('click',async()=>{const me=myTeam(),partner=document.getElementById('trade-partner')?.value;if(!me||!partner)return;const collect=cls=>[...document.querySelectorAll(`.${cls}:checked`)].map(i=>({type:i.dataset.type,key:i.dataset.key||null,name:i.dataset.name||null,pick_id:i.dataset.pickId||null}));const give=collect('trade-give'),receive=collect('trade-receive');const gb=Number(document.getElementById('trade-give-bids')?.value||0),rb=Number(document.getElementById('trade-receive-bids')?.value||0);if(gb>0)give.push({type:'bid_dollars',amount:gb});if(rb>0)receive.push({type:'bid_dollars',amount:rb});try{await rpc('league_owner_propose_trade',{p_room_code:ROOM_CODE,p_team_id:me.id,p_pin:state.session.pin,p_partner_team_id:partner,p_give:give,p_receive:receive,p_note:document.getElementById('trade-note')?.value||null});toast('Trade proposal sent.');await loadData();render();}catch(e){toast(e.message,'error');}});
 document.querySelectorAll('[data-trade-response]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam();if(!t)return;try{await rpc('league_owner_trade_response',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_trade_id:b.dataset.tradeId,p_accept:b.dataset.tradeResponse==='accept'});toast(b.dataset.tradeResponse==='accept'?'Trade accepted — awaiting commissioner approval.':'Trade rejected.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-cancel-trade]').forEach(b=>b.addEventListener('click',async()=>{const t=myTeam();if(!t||!confirm('Cancel this trade proposal?'))return;try{await rpc('league_owner_cancel_trade',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_trade_id:b.dataset.cancelTrade});toast('Trade cancelled.');await loadData();render();}catch(e){toast(e.message,'error');}}));
 document.querySelectorAll('[data-commish-trade]').forEach(b=>b.addEventListener('click',()=>{if(!confirm(`${b.dataset.commishTrade==='approve'?'Approve':'Deny'} this trade?`))return;commish('league_commish_trade_decision',{p_trade_id:b.dataset.tradeId,p_approve:b.dataset.commishTrade==='approve'},b.dataset.commishTrade==='approve'?'Trade approved and processed.':'Trade denied.');}));
 const updateTx=()=>{state.txFilters={team:document.getElementById('tx-team')?.value||'',type:document.getElementById('tx-type')?.value||'',search:document.getElementById('tx-search')?.value||''};render();};
 app.querySelector('#tx-team')?.addEventListener('change',updateTx);app.querySelector('#tx-type')?.addEventListener('change',updateTx);app.querySelector('#tx-search')?.addEventListener('change',updateTx);
 app.querySelector('[data-action="save-correction"]')?.addEventListener('click',()=>{const desc=document.getElementById('corr-desc')?.value.trim();if(!desc)return toast('Enter a correction description.','error');commish('league_commish_correction',{p_team_id:document.getElementById('corr-team')?.value||null,p_bid_delta:Number(document.getElementById('corr-bids')?.value||0),p_description:desc,p_reverse_transaction_id:document.getElementById('corr-reverse')?.value||null},'Correction recorded.');});
}

async function subscribe(){if(state.realtime)await supabase.removeChannel(state.realtime);state.realtime=supabase.channel(`league-office-${ROOM_CODE}`).on('postgres_changes',{event:'*',schema:'public',table:'league_roster_entries'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'teams'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_contracts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_rule_settings'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'redistribution_rules'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadlines'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadline_team_status'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_seasons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_team_seasons'},refresh).subscribe();}
let refreshTimer=null;function refresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{try{await loadData();render();}catch(e){console.warn(e);}},180);}

async function init(){if(!configured){state.loading=false;render();return;}try{await loadData();state.loading=false;render();await subscribe();}catch(e){state.loading=false;app.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>League Office</h1><p>Database migration required.</p></div><div class="login-body"><div class="error">${esc(e.message)}</div><p class="small muted">Run the League Office v1 Supabase migration, then refresh.</p></div></div></div>`;}}
init();
