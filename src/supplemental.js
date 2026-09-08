import './styles.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const SOUND_STORAGE_KEY = `glsk-auction-sound-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';
const RANKING_URL = 'https://sports.yahoo.com/articles/fantasy-football-cheat-sheet-2026-163605532.html';

const state = {
  room: null,
  teams: [],
  settings: null,
  order: [],
  players: [],
  picks: [],
  bids: [],
  rosterEntries: [],
  session: loadSession(),
  tab: 'draft',
  loading: true,
  migrationMissing: false,
  realtime: null,
  refreshTimer: null,
  finalizing: false,
  search: '',
  posFilter: 'ALL',
};

const audioState = { enabled: loadSoundPreference(), ctx: null, lastCountdownKey: null, snapshot: null };

function loadSession() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { state.session = session; if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); else localStorage.removeItem(STORAGE_KEY); }
function loadSoundPreference() { try { const x = localStorage.getItem(SOUND_STORAGE_KEY); return x === null ? true : x === 'true'; } catch { return true; } }
function saveSoundPreference() { try { localStorage.setItem(SOUND_STORAGE_KEY, String(audioState.enabled)); } catch {} }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(n) { return `$${Number(n || 0).toFixed(0)}`; }
function teamById(id) { return state.teams.find(t => t.id === id); }
function playerById(id) { return state.players.find(p => p.id === id); }
function myTeam() { return state.session?.teamId ? teamById(state.session.teamId) : null; }
function isCommish() { return Boolean(state.session?.commishPin); }
function availablePlayers() { return state.players.filter(p => p.status === 'available').sort((a,b)=>(a.yahoo_rank-b.yahoo_rank)||a.name.localeCompare(b.name)); }
function draftedPlayers() { return state.players.filter(p => p.status === 'drafted'); }
function roundForPick(n) { return Math.floor((Number(n)-1)/12)+1; }
function slotForPick(n) { const r=roundForPick(n); const pos=((Number(n)-1)%12)+1; return r%2===1 ? pos : 13-pos; }
function pickerForPick(n) { return teamById(state.order.find(o => o.slot === slotForPick(n))?.team_id); }
function currentPicker() { return state.settings ? pickerForPick(state.settings.current_pick_no) : null; }
function selectedPlayer() { return state.settings?.selected_player_id ? playerById(state.settings.selected_player_id) : null; }
function highBidder() { return state.settings?.active_bidder_team_id ? teamById(state.settings.active_bidder_team_id) : null; }
function rightsHolder(p=selectedPlayer()) { return p?.rights_team_id ? teamById(p.rights_team_id) : null; }


function myRosterEntries() {
  const t = myTeam();
  return t ? state.rosterEntries.filter(r => r.team_id === t.id && r.active !== false) : [];
}
function rosterSourceLabel(r) {
  return ({auction:'Auction',supplemental:'Supplemental',phase3:'Phase 3',rookie:'Rookie Draft',contract:'Contract',rights_claim:'Rookie Rights',current_roster:'Existing Roster'}[r.acquisition_type] || 'Roster');
}
function myTeamView() {
  const t = myTeam();
  if (!t) return `<div class="card empty"><strong>My Team</strong><br><span class="small muted">Sign in as a team owner to view a roster.</span></div>`;
  const order={QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
  const rows=myRosterEntries().slice().sort((a,b)=>(order[a.position]||99)-(order[b.position]||99)||a.player_name.localeCompare(b.player_name));
  const maxRoster=18,open=Math.max(0,maxRoster-rows.length);
  const groups=['QB','RB','WR','TE','K','DST'].map(pos=>{const ps=rows.filter(r=>r.position===pos);if(!ps.length)return '';return `<section class="myteam-group"><div class="myteam-group-head">${pos}<span>${ps.length}</span></div>${ps.map(r=>`<div class="myteam-player">${positionBadge(r.position)}<div class="myteam-player-main"><div class="myteam-player-name">${escapeHtml(r.player_name)}</div><div class="small muted">${escapeHtml(r.nfl_team||'')} • ${escapeHtml(rosterSourceLabel(r))}${r.acquisition_price!=null?` • ${money(r.acquisition_price)}`:''}</div></div></div>`).join('')}</section>`;}).join('');
  return `<div class="row between gap-12 wrap myteam-header"><div><h2 class="section-title">${escapeHtml(t.name)}</h2><div class="small muted">My Team • live roster</div></div><div class="myteam-summary"><strong>${rows.length}/${maxRoster}</strong><span>${open} open</span></div></div><div class="myteam-budget card"><div><span class="small muted">Bid dollars remaining</span><strong>${money(t.remaining_budget)}</strong></div><div><span class="small muted">Roster spots</span><strong>${open}</strong></div></div><div class="myteam-list">${groups||'<div class="card empty">No rostered players yet.</div>'}</div>`;
}

function toast(message,type='') {
  let wrap=document.querySelector('.toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap);}
  const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;wrap.appendChild(el);setTimeout(()=>el.remove(),3200);
}
async function rpc(name,args={}) { const {data,error}=await supabase.rpc(name,args); if(error) throw new Error(error.message); if(data?.ok===false) throw new Error(data.error||'Request failed'); return data; }

function unlockAudio(){ if(!audioState.enabled)return; try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioState.ctx)audioState.ctx=new A();if(audioState.ctx.state==='suspended')audioState.ctx.resume().catch(()=>{});}catch{}}
function tone(freq,duration=.1,delay=0,volume=.04,type='sine'){if(!audioState.enabled)return;unlockAudio();const c=audioState.ctx;if(!c)return;try{const st=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,st);g.gain.setValueAtTime(.0001,st);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),st+.012);g.gain.exponentialRampToValueAtTime(.0001,st+duration);o.connect(g);g.connect(c.destination);o.start(st);o.stop(st+duration+.03);}catch{}}
function playSound(kind,detail={}){
  if(!audioState.enabled||!state.session)return;
  if(kind==='pick'){tone(392,.10,0,.04,'triangle');tone(523,.11,.09,.045,'triangle');tone(659,.15,.19,.05,'triangle');}
  else if(kind==='challenge'){tone(587,.11,0,.045,'square');tone(784,.11,.13,.045,'square');}
  else if(kind==='bid'){tone(880,.075,0,.04);tone(1175,.085,.055,.038);}
  else if(kind==='award'){tone(523,.11,0,.05,'triangle');tone(659,.11,.1,.05,'triangle');tone(784,.18,.2,.055,'triangle');}
  else if(kind==='countdown'){const sec=Number(detail.sec||0);tone(sec<=2?988:sec<=3?880:740,sec<=2?.12:.075,0,sec<=2?.055:.04,'square');}
  else if(kind==='pause'){tone(440,.12,0,.035,'triangle');tone(349,.15,.1,.035,'triangle');}
  else if(kind==='resume'){tone(349,.1,0,.035,'triangle');tone(523,.15,.09,.045,'triangle');}
  else if(kind==='reset'){tone(659,.09,0,.035);tone(523,.09,.08,.035);tone(392,.14,.16,.04);}
  else if(kind==='enabled'){tone(660,.08,0,.035);tone(880,.11,.075,.04);}
}
function snapshot(){return state.settings?{status:state.settings.status,stage:state.settings.stage,pick:state.settings.current_pick_no,selected:state.settings.selected_player_id,bid:Number(state.settings.active_bid||0),bidder:state.settings.active_bidder_team_id,picks:state.picks.length}:null;}
function handleTransitions(prev,curr){
  if(!prev||!curr||!state.session)return;
  if(curr.status==='setup'&&prev.status!=='setup'){playSound('reset');audioState.lastCountdownKey=null;return;}
  if(curr.picks>prev.picks)playSound('award');
  if(curr.pick!==prev.pick){setTimeout(()=>playSound('pick'),curr.picks>prev.picks?380:0);audioState.lastCountdownKey=null;}
  if(curr.stage==='challenge'&&prev.stage!=='challenge')playSound('challenge');
  if(curr.selected===prev.selected&&curr.bid>prev.bid)playSound('bid');
  if(curr.status!==prev.status){if(curr.status==='paused')playSound('pause');if(prev.status==='paused'&&curr.status==='live')playSound('resume');}
}
function toggleSound(){audioState.enabled=!audioState.enabled;saveSoundPreference();if(audioState.enabled){unlockAudio();playSound('enabled');toast('Supplemental sounds on.');}else toast('Supplemental sounds muted.');render();}

async function loadData(){
  const prev=snapshot();
  const rr=await supabase.from('rooms').select('*').eq('code',ROOM_CODE).single();
  if(rr.error) throw rr.error; state.room=rr.data;
  const teamsRes=await supabase.from('teams').select('*').eq('room_id',state.room.id).order('sort_order');
  if(teamsRes.error) throw teamsRes.error; state.teams=teamsRes.data||[];
  const settingsRes=await supabase.from('supplemental_settings').select('*').eq('room_id',state.room.id).maybeSingle();
  if(settingsRes.error && settingsRes.error.code!=='42P01') throw settingsRes.error;
  if(!settingsRes.data){state.migrationMissing=true;state.settings=null;state.loading=false;return;}
  state.migrationMissing=false;state.settings=settingsRes.data;
  const [o,p,pk,b,re]=await Promise.all([
    supabase.from('supplemental_order').select('*').eq('room_id',state.room.id).order('slot'),
    supabase.from('supplemental_players').select('*').eq('room_id',state.room.id).order('yahoo_rank'),
    supabase.from('supplemental_picks').select('*').eq('room_id',state.room.id).order('pick_no'),
    supabase.from('supplemental_bids').select('*').eq('room_id',state.room.id).order('created_at',{ascending:false}).limit(100),
    supabase.from('league_roster_entries').select('*').eq('room_id',state.room.id).eq('active',true).order('player_name'),
  ]);
  for(const r of[o,p,pk,b,re]) if(r.error) throw r.error;
  state.order=o.data||[];state.players=p.data||[];state.picks=pk.data||[];state.bids=b.data||[];state.rosterEntries=re.data||[];state.loading=false;
  const curr=snapshot();if(prev)handleTransitions(prev,curr);audioState.snapshot=curr;
}
function scheduleRefresh(){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(async()=>{try{await loadData();render();}catch(e){console.error(e);}},90);}
function subscribeRealtime(){
  state.realtime?.unsubscribe?.();
  if(!state.settings)return;
  state.realtime=supabase.channel(`supp-${ROOM_CODE}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'teams',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'supplemental_settings',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'supplemental_order',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'supplemental_players',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'supplemental_picks',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'supplemental_bids',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'league_roster_entries',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .subscribe();
}

function positionBadge(pos){return `<span class="pos-badge pos-${escapeHtml(pos)}">${escapeHtml(pos)}</span>`;}
function projectionSummary(p){
  const x=p.projection_stats||{};const parts=[];
  if(p.position==='QB'){if(x.PassYds!=null)parts.push(`${x.PassYds} pass yd`);if(x.PassTD!=null)parts.push(`${x.PassTD} pass TD`);if(x.RunYds!=null)parts.push(`${x.RunYds} rush yd`);if(x.RunTD!=null)parts.push(`${x.RunTD} rush TD`);}
  else if(p.position==='RB'){if(x.ATT!=null)parts.push(`${x.ATT} att`);if(x.RunYds!=null)parts.push(`${x.RunYds} rush yd`);if(x.REC!=null)parts.push(`${x.REC} rec`);if(x.RecYds!=null)parts.push(`${x.RecYds} rec yd`);}
  else if(p.position==='WR'||p.position==='TE'){if(x.TGT!=null)parts.push(`${x.TGT} tgt`);if(x.REC!=null)parts.push(`${x.REC} rec`);if(x.RecYds!=null)parts.push(`${x.RecYds} yd`);if(x.RecTD!=null)parts.push(`${x.RecTD} TD`);}
  else if(p.position==='K'){if(x.FGM!=null)parts.push(`${x.FGM}/${x.FGA} FG`);if(x.FGpct!=null)parts.push(`${x.FGpct}%`);if(x.FG50plus!=null)parts.push(`${x.FG50plus} 50+`);}
  return parts.slice(0,4).join(' • ');
}
function canCurrentUserSelect(){const t=myTeam(),cp=currentPicker();return Boolean(state.settings?.status==='live'&&state.settings?.stage==='pick'&&cp&&(isCommish()||t?.id===cp.id));}
function playerRow(p,showButton=true){
  const rights=rightsHolder(p); const can=showButton&&canCurrentUserSelect();
  return `<div class="supp-player-card"><div class="rank">#${p.yahoo_rank}</div>${positionBadge(p.position)}<div class="supp-player-info"><div class="supp-player-name">${escapeHtml(p.name)}</div><div class="supp-player-meta">${escapeHtml(p.nfl_team)} • ${escapeHtml(p.position)}${p.pos_rank?String(p.pos_rank).padStart(2,'0'):''} • Bye ${p.bye??'—'}</div>${projectionSummary(p)?`<div class="proj-line">${escapeHtml(projectionSummary(p))}</div>`:''}${rights?`<span class="rights-badge">Rookie rights: ${escapeHtml(rights.name)}</span>`:''}</div>${can?`<button class="btn btn-sm btn-primary" data-select-player="${p.id}">Select</button>`:''}</div>`;
}

function topBar(){const t=myTeam();return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-kicker">Phase 2 • Supplemental</div><div class="brand-title">${escapeHtml(LEAGUE_NAME)}</div></div><div class="user-chip"><div class="status-dot ${state.settings?.status==='live'?'live':''}"></div><div class="user-chip-text"><div class="user-team">${t?escapeHtml(t.name):state.session?.spectator?'Spectator':'Not joined'}${isCommish()?' • Czar':''}</div><div class="user-budget">${t?`${money(t.remaining_budget)} remaining`:escapeHtml(state.settings?.status||'')}</div></div><a class="phase-link phase1-link" href="/">Auction</a><a class="phase-link phase3-link" href="/phase3">Phase 3</a><button class="sound-toggle" data-action="toggle-sound">${audioState.enabled?'🔊':'🔇'}<span>${audioState.enabled?'Sound':'Muted'}</span></button><button class="btn-link" data-action="logout">Leave</button></div></div></header>`;}

function pickStrip(){
  if(!state.settings||state.order.length<12)return '';
  return `<div class="pick-strip">${Array.from({length:24},(_,i)=>i+1).map(n=>{const t=pickerForPick(n),done=state.picks.some(p=>p.pick_no===n),cur=state.settings.current_pick_no===n;return `<div class="pick-chip ${done?'done':''} ${cur?'current':''}"><div class="n">Pick ${n} • R${roundForPick(n)}</div><div class="t">${escapeHtml(t?.name||'—')}</div></div>`;}).join('')}</div>`;
}

function stageView(){
  const s=state.settings, cp=currentPicker(), sp=selectedPlayer(), hb=highBidder(), mine=myTeam(), rights=rightsHolder(sp);
  if(s.status==='complete')return `<section class="card hero-complete"><div class="trophy">🏁</div><h2>Supplemental Draft Complete</h2><p class="muted">All 24 snake-draft picks are complete.</p><div class="row gap-8 wrap" style="justify-content:center;margin-top:12px"><button class="btn btn-dark" data-tab="results">View Results</button><a class="btn btn-primary phase-button" href="/phase3">Open Phase 3 →</a></div></section>`;
  if(s.status==='setup')return `<section class="card supp-stage"><div class="supp-stage-head"><div><div class="supp-stage-title">Supplemental Draft</div><div class="supp-stage-sub">2-round snake • 45s pick • 10s challenge • 30s auction</div></div><div class="timer">--</div></div><div class="supp-body"><div class="on-clock">Ready for Phase 2</div><p class="muted">The commissioner can review the order and timers, then start the draft.</p></div></section>`;

  let body='';
  if(s.stage==='pick'){
    const mineOn=mine&&cp&&mine.id===cp.id;
    body=`<div class="pick-label">Pick ${s.current_pick_no} • Round ${roundForPick(s.current_pick_no)}</div><div class="on-clock">${escapeHtml(cp?.name||'—')} is on the clock</div><p class="muted small" style="margin-top:7px">Select any available player. After the selection, the league gets a 10-second challenge window.</p>${mineOn?'<div class="notice" style="margin-top:12px">You are on the clock. Choose a player below or from the Players tab.</div>':''}<div class="supp-mini-list">${availablePlayers().slice(0,7).map(p=>playerRow(p,true)).join('')}</div>`;
  } else if(s.stage==='challenge'){
    const isSelector=mine?.id===s.selected_by_team_id, isRights=mine&&rights&&mine.id===rights.id;
    body=`<div class="pick-label">Pick ${s.current_pick_no} • Challenge Window</div>${sp?`<div class="player-line" style="margin-top:7px">${positionBadge(sp.position)}<div class="player-main"><div class="player-name">${escapeHtml(sp.name)}</div><div class="player-meta">${escapeHtml(sp.nfl_team)} • Yahoo #${sp.yahoo_rank}</div></div></div>`:''}<div class="challenge-banner"><strong>${escapeHtml(teamById(s.selected_by_team_id)?.name||'Picker')}</strong> selected this player. If nobody challenges, the player is awarded for <strong>$0</strong>.</div>${rights?`<div class="rights-banner">Restricted rights: <strong>${escapeHtml(rights.name)}</strong> can start a head-to-head auction at <strong>2 bids</strong>. Any third team can instead open normal league bidding at 6.</div>`:''}<div class="supp-actions">${mine&&!isSelector?`<button class="btn btn-challenge" data-action="challenge-open" ${mine.remaining_budget<6?'disabled':''}>Challenge at $6</button>`:''}${isRights&&!isSelector?`<button class="btn btn-rights-live" data-action="challenge-rights" ${mine.remaining_budget<2?'disabled':''}>Use Rookie Rights • $2 H2H</button>`:''}${isSelector?'<span class="notice">Your selection is being challenged for 10 seconds.</span>':''}</div>`;
  } else if(s.stage==='auction'){
    const next=Number(s.active_bid||0)+1,isHigh=mine&&hb&&mine.id===hb.id,canBid=mine&&!isHigh&&mine.remaining_budget>=next;
    body=`<div class="pick-label">Pick ${s.current_pick_no} • Open Challenge Auction</div>${sp?`<div class="player-name" style="margin-top:6px">${escapeHtml(sp.name)}</div>`:''}<div class="auction-banner">Open to all teams. The original selector's Supplemental pick is used regardless of who wins.</div><div style="margin-top:16px"><div class="current-bid-label">Current bid</div><div class="bid-big">${money(s.active_bid)}</div><div class="high-line">${hb?`High bidder: ${escapeHtml(hb.name)}`:'Waiting for bid'}</div></div><div class="supp-actions">${mine?`<button class="btn btn-auction" data-action="supp-bid" ${canBid?'':'disabled'}>${isHigh?'YOU ARE HIGH BID':`BID ${money(next)}`}</button>`:'<span class="notice">Spectator mode</span>'}</div>`;
  } else if(s.stage==='rights_auction'){
    const next=Number(s.active_bid||0)+1,isHigh=mine&&hb&&mine.id===hb.id,inH2H=mine&&(mine.id===s.selected_by_team_id||mine.id===sp?.rights_team_id),canH2H=inH2H&&!isHigh&&mine.remaining_budget>=next,openAt=Math.max(6,next),canOpen=mine&&!inH2H&&mine.remaining_budget>=openAt;
    body=`<div class="pick-label">Pick ${s.current_pick_no} • Rookie Rights H2H</div>${sp?`<div class="player-name" style="margin-top:6px">${escapeHtml(sp.name)}</div>`:''}<div class="rights-banner"><strong>${escapeHtml(teamById(s.selected_by_team_id)?.name||'Selector')}</strong> vs <strong>${escapeHtml(rights?.name||'Rights holder')}</strong>. A third team can convert this to open bidding.</div><div style="margin-top:16px"><div class="current-bid-label">Current bid</div><div class="bid-big">${money(s.active_bid)}</div><div class="high-line">${hb?`High bidder: ${escapeHtml(hb.name)}`:'—'}</div></div><div class="supp-actions">${inH2H?`<button class="btn btn-auction" data-action="supp-bid" ${canH2H?'':'disabled'}>${isHigh?'YOU ARE HIGH BID':`H2H BID ${money(next)}`}</button>`:''}${mine&&!inH2H?`<button class="btn btn-challenge" data-action="challenge-open" ${canOpen?'':'disabled'}>Open to All at ${money(openAt)}</button>`:''}</div>`;
  }
  return `<section class="card supp-stage"><div class="supp-stage-head"><div><div class="supp-stage-title">${s.status==='paused'?'Paused':s.stage.replace('_',' ')}</div><div class="supp-stage-sub">${cp?`Original picker: ${escapeHtml(cp.name)}`:''}</div></div><div id="supp-timer" class="timer">--</div></div><div class="supp-body">${body}</div></section>`;
}

function commishPanel(){if(!isCommish())return '';const s=state.settings;return `<section class="commish-panel"><div class="commish-head">Supplemental Commissioner Controls</div><div class="commish-body"><div class="commish-actions">${s.status==='setup'?'<button class="btn btn-green" data-action="supp-start">▶ Start Supplemental</button>':''}${s.status==='live'?'<button class="btn btn-outline" data-action="supp-pause">⏸ Pause</button>':''}${s.status==='paused'?'<button class="btn btn-green" data-action="supp-resume">▶ Resume</button>':''}${['live','paused'].includes(s.status)?'<button class="btn btn-outline" data-action="add-time">+30 sec</button>':''}<button class="btn btn-outline" data-action="supp-undo">Undo Last Pick</button><button class="btn btn-reset" data-action="supp-reset">↺ Reset Supplemental</button></div><div class="small muted">Reset refunds only bids spent in Supplemental and restores the Phase 1 carry-over balances.</div></div></section>`;}

function draftView(){return `${pickStrip()}<div class="desktop-grid"><div>${stageView()}${commishPanel()}</div><div><div class="card" style="overflow:hidden"><div class="queue-title">Remaining Bid Dollars</div><div class="supp-budget-mini">${state.teams.map(t=>`<div><span>${escapeHtml(t.name)}</span><strong>${money(t.remaining_budget)}</strong></div>`).join('')}</div></div></div></div>`;}

function playersView(){
  const needle=state.search.toLowerCase();let rows=availablePlayers().filter(p=>(state.posFilter==='ALL'||p.position===state.posFilter)&&(!needle||`${p.name} ${p.nfl_team} ${p.position}`.toLowerCase().includes(needle)));
  return `<div class="row between gap-12 wrap" style="margin-bottom:10px"><h2 class="section-title">Supplemental Player Pool</h2><div class="small muted">${rows.length} shown • ${availablePlayers().length} available</div></div><div class="filter-row"><input id="supp-search" class="input" placeholder="Search player or team" value="${escapeHtml(state.search)}"><select id="supp-pos" class="input">${['ALL','QB','RB','WR','TE','K','DST'].map(x=>`<option value="${x}" ${state.posFilter===x?'selected':''}>${x==='ALL'?'All positions':x}</option>`).join('')}</select></div><div class="list-stack">${rows.map(p=>playerRow(p,true)).join('')||'<div class="card empty">No matching available players.</div>'}</div>${sourceNote()}`;
}

function orderView(){
  const ordered=[...state.order].sort((a,b)=>a.slot-b.slot);const round2=[...ordered].reverse();
  return `<div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Supplemental Draft Order</h2><div class="small muted">2-round snake</div></div><section class="card" style="padding:13px;margin-bottom:13px"><h3 style="margin:0 0 10px">Round 1</h3><div class="supp-order-grid">${ordered.map((o,i)=>{const t=teamById(o.team_id);return `<div class="order-row"><div class="order-slot">${o.slot}</div><div class="order-team">${escapeHtml(t?.name||'—')}</div>${isCommish()?`<div class="order-actions"><button class="btn btn-sm btn-outline" data-order-move="up" data-slot="${o.slot}" ${i===0?'disabled':''}>↑</button><button class="btn btn-sm btn-outline" data-order-move="down" data-slot="${o.slot}" ${i===ordered.length-1?'disabled':''}>↓</button></div>`:''}</div>`;}).join('')}</div><h3 style="margin:17px 0 10px">Round 2 (automatic reverse)</h3><div class="supp-order-grid">${round2.map((o,i)=>`<div class="order-row"><div class="order-slot">${13+i}</div><div class="order-team">${escapeHtml(teamById(o.team_id)?.name||'—')}</div><div class="small muted">R2</div></div>`).join('')}</div></section>${isCommish()?`<section class="commish-panel"><div class="commish-head">Timer Settings</div><div class="commish-body"><div class="timer-grid"><div class="timer-setting"><label>Pick clock</label><input id="pick-seconds" type="number" min="5" max="600" value="${state.settings.pick_seconds}"></div><div class="timer-setting"><label>Challenge</label><input id="challenge-seconds" type="number" min="3" max="120" value="${state.settings.challenge_seconds}"></div><div class="timer-setting"><label>Auction</label><input id="auction-seconds" type="number" min="5" max="300" value="${state.settings.auction_seconds}"></div></div><button class="btn btn-primary" data-action="save-timers">Save Timers</button></div></section>`:''}`;
}

function resultsView(){
  return `<div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Supplemental Results</h2><button class="btn btn-sm btn-outline" data-action="export-supp">Export CSV</button></div><div class="list-stack">${state.picks.length?state.picks.map(pk=>{const p=playerById(pk.player_id),sel=teamById(pk.selecting_team_id),win=teamById(pk.winner_team_id);return `<div class="log-row"><div><div class="log-name">${pk.pick_no}. ${escapeHtml(p?.name||'Player')}</div><div class="small muted">${escapeHtml(p?.position||'')} ${escapeHtml(p?.nfl_team||'')} • ${pk.outcome==='free'?'Unchallenged':pk.outcome==='rights_auction'?'Rookie Rights H2H':'Challenge Auction'}</div><div class="result-arrow">Selected by ${escapeHtml(sel?.name||'—')}${win?.id!==sel?.id?` → won by ${escapeHtml(win?.name||'—')}`:''}</div></div><div class="log-price">${money(pk.price)}</div></div>`;}).join(''):'<div class="card empty">No Supplemental picks yet.</div>'}</div><div style="margin-top:14px"><h2 class="section-title">Current Budgets</h2><div class="team-grid" style="margin-top:10px">${state.teams.map(t=>`<div class="team-row"><div class="team-name">${escapeHtml(t.name)}</div><div class="team-budget">${money(t.remaining_budget)}</div></div>`).join('')}</div></div>${sourceNote()}`;
}
function sourceNote(){return `<div class="source-note">Player order: <a href="${RANKING_URL}" target="_blank" rel="noreferrer">Yahoo Sports Half-PPR Top 300</a>, updated Sept. 5, 2026. Raw projection stats are a June 9 Yahoo Sports-hosted projection snapshot where available. Players already contracted, selected in the 2026 rookie draft, or included in the 40-player auction are excluded.</div>`;}

function bottomNav(){const items=[['draft','⚡','Draft'],['players','☷','Players'],['order','⇅','Order'],['results','≡','Results'],['myteam','♜','My Team']];return `<nav class="bottom-nav"><div class="bottom-nav-inner">${items.map(([tab,icon,label])=>`<button class="nav-btn ${state.tab===tab?'active':''}" data-tab="${tab}"><span>${icon}</span>${label}</button>`).join('')}</div></nav>`;}

function loginView(){const opts=state.teams.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>${escapeHtml(LEAGUE_NAME)}</h1><p>2026 Supplemental Draft</p></div><div class="login-body"><div class="field"><label>Your team</label><select id="join-team" class="input"><option value="">Select your team…</option>${opts}</select></div><div class="field"><label>Team PIN</label><input id="team-pin" class="input pin-input" inputmode="numeric" maxlength="6" placeholder="6-digit PIN"></div><div id="join-error"></div><button class="btn btn-primary btn-block" data-action="join">Enter Supplemental Room</button><button class="btn-link btn-block" data-action="spectate">View as spectator</button><a class="btn-link btn-block" href="/" style="display:block;text-align:center;text-decoration:none">← Back to Auction</a></div></div></div>`;}
function migrationView(){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Phase 2 App Ready</h1><p>The Supplemental database migration still needs to be installed.</p></div><div class="login-body"><div class="notice">Run <strong>supabase/phase2.sql</strong> in the GLSK Supabase SQL Editor, then refresh this page.</div><a class="btn-link btn-block" href="/" style="display:block;text-align:center;text-decoration:none">← Auction room</a></div></div></div>`;}
function connectionView(e){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Connection Error</h1><p>Supplemental room could not load.</p></div><div class="login-body"><div class="error">${escapeHtml(e.message)}</div></div></div></div>`;}

function render(){
  if(!configured){app.innerHTML=migrationView();return;}
  if(state.loading){app.innerHTML='<div class="login-wrap"><div style="color:white;font-weight:900">Loading Supplemental Draft…</div></div>';return;}
  if(state.migrationMissing){app.innerHTML=migrationView();return;}
  if(!state.session){app.innerHTML=loginView();bindEvents();return;}
  let content=state.tab==='players'?playersView():state.tab==='order'?orderView():state.tab==='results'?resultsView():state.tab==='myteam'?myTeamView():draftView();
  app.innerHTML=`<div class="app-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;bindEvents();updateCountdown();
}

async function join(){unlockAudio();const teamId=document.querySelector('#join-team')?.value,pin=document.querySelector('#team-pin')?.value.trim(),err=document.querySelector('#join-error');if(!teamId||!pin){err.innerHTML='<div class="error">Select your team and enter its PIN.</div>';return;}try{await rpc('join_room',{p_room_code:ROOM_CODE,p_team_id:teamId,p_pin:pin});const t=teamById(teamId);let commishPin=null;if(t?.name===COMMISH_TEAM_NAME){const valid=await rpc('commish_login',{p_room_code:ROOM_CODE,p_pin:pin});if(!valid?.valid)throw new Error('Commissioner access is not configured for this PIN.');commishPin=pin;}saveSession({teamId,pin,commishPin,spectator:false});render();}catch(e){err.innerHTML=`<div class="error">${escapeHtml(e.message)}</div>`;}}
function spectate(){unlockAudio();saveSession({spectator:true,teamId:null,pin:null,commishPin:null});render();}
function logout(){saveSession(null);render();}
async function teamCall(name,args={},success=''){const t=myTeam();if(!t)return;try{const out=await rpc(name,{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,...args});if(success)toast(typeof success==='function'?success(out):success);await loadData();render();}catch(e){toast(e.message,'error');}}
async function commishCall(name,args={},success=''){if(!isCommish())return;try{const out=await rpc(name,{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,...args});if(success)toast(typeof success==='function'?success(out):success);await loadData();render();}catch(e){toast(e.message,'error');}}
async function selectPlayer(id){try{if(isCommish()){await rpc('supp_commish_select_player',{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,p_player_id:id});}else{const t=myTeam();if(!t)return;await rpc('supp_select_player',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_player_id:id});}toast(`${playerById(id)?.name||'Player'} selected. Challenge window open.`);await loadData();render();}catch(e){toast(e.message,'error');}}
async function moveOrder(slot,dir){if(!isCommish())return;const arr=[...state.order].sort((a,b)=>a.slot-b.slot);const i=arr.findIndex(o=>o.slot===Number(slot)),j=dir==='up'?i-1:i+1;if(i<0||j<0||j>=arr.length)return;[arr[i],arr[j]]=[arr[j],arr[i]];try{await rpc('supp_commish_set_order',{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,p_team_ids:arr.map(x=>x.team_id)});toast('Draft order updated.');await loadData();render();}catch(e){toast(e.message,'error');}}
async function saveTimers(){const p=Number(document.querySelector('#pick-seconds')?.value),c=Number(document.querySelector('#challenge-seconds')?.value),a=Number(document.querySelector('#auction-seconds')?.value);await commishCall('supp_commish_update_settings',{p_pick_seconds:p,p_challenge_seconds:c,p_auction_seconds:a},'Timer settings saved.');}
async function resetSupplemental(){if(!isCommish())return;const ok=window.confirm('Reset the Supplemental Draft?\n\nAll Supplemental picks/bids will be cleared and any Supplemental bid dollars spent will be refunded. Phase 1 auction results and carry-over balances will remain intact.');if(ok)await commishCall('supp_commish_reset',{},'Supplemental draft reset.');}
function exportSupplemental(){const rows=[['Pick','Round','Player','NFL','Position','Original Picker','Winner','Price','Outcome']];for(const pk of state.picks){const p=playerById(pk.player_id),sel=teamById(pk.selecting_team_id),win=teamById(pk.winner_team_id);rows.push([pk.pick_no,pk.round,p?.name||'',p?.nfl_team||'',p?.position||'',sel?.name||'',win?.name||'',pk.price,pk.outcome]);}const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='GLSK-2026-supplemental-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}

function bindEvents(){
  app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render();}));
  app.querySelector('[data-action="join"]')?.addEventListener('click',join);app.querySelector('[data-action="spectate"]')?.addEventListener('click',spectate);app.querySelector('[data-action="logout"]')?.addEventListener('click',logout);app.querySelector('[data-action="toggle-sound"]')?.addEventListener('click',toggleSound);
  app.querySelectorAll('[data-select-player]').forEach(b=>b.addEventListener('click',()=>selectPlayer(b.dataset.selectPlayer)));
  app.querySelector('[data-action="challenge-open"]')?.addEventListener('click',()=>teamCall('supp_challenge',{p_mode:'open'},o=>`Challenge opened at ${money(o.bid)}.`));
  app.querySelector('[data-action="challenge-rights"]')?.addEventListener('click',()=>teamCall('supp_challenge',{p_mode:'rights'},'Rookie-rights head-to-head auction opened at $2.'));
  app.querySelector('[data-action="supp-bid"]')?.addEventListener('click',()=>teamCall('supp_bid',{},o=>`Bid accepted at ${money(o.bid)}.`));
  app.querySelector('[data-action="supp-start"]')?.addEventListener('click',()=>commishCall('supp_commish_start',{},'Supplemental Draft started.'));
  app.querySelector('[data-action="supp-pause"]')?.addEventListener('click',()=>commishCall('supp_commish_pause',{},'Supplemental Draft paused.'));
  app.querySelector('[data-action="supp-resume"]')?.addEventListener('click',()=>commishCall('supp_commish_resume',{},'Supplemental Draft resumed.'));
  app.querySelector('[data-action="add-time"]')?.addEventListener('click',()=>commishCall('supp_commish_add_time',{p_seconds:30},'Added 30 seconds.'));
  app.querySelector('[data-action="supp-undo"]')?.addEventListener('click',()=>commishCall('supp_commish_undo_last_pick',{},'Last Supplemental pick undone.'));
  app.querySelector('[data-action="supp-reset"]')?.addEventListener('click',resetSupplemental);
  app.querySelector('[data-action="save-timers"]')?.addEventListener('click',saveTimers);
  app.querySelector('[data-action="export-supp"]')?.addEventListener('click',exportSupplemental);
  app.querySelectorAll('[data-order-move]').forEach(b=>b.addEventListener('click',()=>moveOrder(b.dataset.slot,b.dataset.orderMove)));
  const search=app.querySelector('#supp-search');search?.addEventListener('input',e=>{state.search=e.target.value;clearTimeout(search._t);search._t=setTimeout(render,120);});
  app.querySelector('#supp-pos')?.addEventListener('change',e=>{state.posFilter=e.target.value;render();});
}

function updateCountdown(){
  const el=document.querySelector('#supp-timer');if(!el||!state.settings)return;
  const s=state.settings;if(s.status==='paused'){el.textContent='PAUSE';el.classList.add('danger');return;}if(s.status!=='live'||!s.stage_ends_at){el.textContent='--';return;}
  const ms=new Date(s.stage_ends_at).getTime()-Date.now(),sec=Math.max(0,Math.ceil(ms/1000));el.textContent=String(sec);el.classList.toggle('danger',sec<=5);
  if(sec>0){const key=`${s.current_pick_no}:${s.stage}:${sec}`;if(key!==audioState.lastCountdownKey){audioState.lastCountdownKey=key;if(sec<=5)playSound('countdown',{sec});}}
  if(ms<=0&&!state.finalizing)finalizeExpired();
}
async function finalizeExpired(){if(state.finalizing||state.settings?.status!=='live')return;state.finalizing=true;try{await rpc('supp_finalize_if_expired',{p_room_code:ROOM_CODE});await loadData();render();}catch(e){console.warn(e);}finally{state.finalizing=false;}}

async function boot(){if(!configured){state.loading=false;render();return;}try{await loadData();subscribeRealtime();render();setInterval(updateCountdown,250);}catch(e){state.loading=false;app.innerHTML=connectionView(e);}}
document.addEventListener('pointerdown',unlockAudio,{once:true,passive:true});
boot();
