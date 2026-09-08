import './styles.css';
import './phase3.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const SOUND_STORAGE_KEY = `glsk-auction-sound-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';

const state = {
  room: null,
  teams: [],
  settings: null,
  order: [],
  rosterState: [],
  rosterEntries: [],
  leagueRosterEntries: [],
  players: [],
  picks: [],
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

const audioState = { enabled: loadSoundPreference(), ctx: null, lastCountdownKey: null };

function loadSession() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function saveSession(session) { state.session = session; if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session)); else localStorage.removeItem(STORAGE_KEY); }
function loadSoundPreference() { try { const x = localStorage.getItem(SOUND_STORAGE_KEY); return x === null ? true : x === 'true'; } catch { return true; } }
function saveSoundPreference() { try { localStorage.setItem(SOUND_STORAGE_KEY, String(audioState.enabled)); } catch {} }
function escapeHtml(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function teamById(id) { return state.teams.find(t => t.id === id); }
function playerById(id) { return state.players.find(p => p.id === id); }
function rosterByTeam(id) { return state.rosterState.find(r => r.team_id === id); }
function myTeam() { return state.session?.teamId ? teamById(state.session.teamId) : null; }
function isCommish() { return Boolean(state.session?.commishPin); }
function availablePlayers() { return state.players.filter(p => p.status === 'available').sort((a,b)=>(a.yahoo_rank-b.yahoo_rank)||a.name.localeCompare(b.name)); }
function roundForTurn(n) { return Math.floor((Number(n)-1)/12)+1; }
function slotForTurn(n) { const r=roundForTurn(n); const pos=((Number(n)-1)%12)+1; return r%2===1 ? pos : 13-pos; }
function pickerForTurn(n) { return teamById(state.order.find(o => o.slot === slotForTurn(n))?.team_id); }
function currentPicker() { return state.settings ? pickerForTurn(state.settings.current_turn_no) : null; }
function openSpots(teamId) { const r=rosterByTeam(teamId); return r ? Math.max(0,r.max_roster_size-r.roster_count) : 0; }
function rosterCount(teamId) { return rosterByTeam(teamId)?.roster_count ?? 0; }
function maxRoster(teamId) { return rosterByTeam(teamId)?.max_roster_size ?? 18; }
function isFull(teamId) { return openSpots(teamId) <= 0; }
function phase3PickByPlayer(id) { return state.picks.find(p=>p.player_id===id); }


function myLeagueRosterEntries() {
  const t = myTeam();
  return t ? state.leagueRosterEntries.filter(r => r.team_id === t.id && r.active !== false) : [];
}
function rosterSourceLabel(r) {
  return ({auction:'Auction',supplemental:'Supplemental',phase3:'Phase 3',rookie:'Rookie Draft',contract:'Contract',rights_claim:'Rookie Rights',current_roster:'Existing Roster'}[r.acquisition_type] || 'Roster');
}
function myTeamView() {
  const t=myTeam();
  if(!t)return `<div class="card empty"><strong>My Team</strong><br><span class="small muted">Sign in as a team owner to view a roster.</span></div>`;
  const order={QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
  const rows=myLeagueRosterEntries().slice().sort((a,b)=>(order[a.position]||99)-(order[b.position]||99)||a.player_name.localeCompare(b.player_name));
  const rosterLimit=maxRoster(t.id),open=Math.max(0,rosterLimit-rows.length);
  const groups=['QB','RB','WR','TE','K','DST'].map(pos=>{const ps=rows.filter(r=>r.position===pos);if(!ps.length)return '';return `<section class="myteam-group"><div class="myteam-group-head">${pos}<span>${ps.length}</span></div>${ps.map(r=>`<div class="myteam-player">${positionBadge(r.position)}<div class="myteam-player-main"><div class="myteam-player-name">${escapeHtml(r.player_name)}</div><div class="small muted">${escapeHtml(r.nfl_team||'')} • ${escapeHtml(rosterSourceLabel(r))}${r.acquisition_price!=null?` • $${Number(r.acquisition_price).toFixed(0)}`:''}</div></div></div>`).join('')}</section>`;}).join('');
  return `<div class="row between gap-12 wrap myteam-header"><div><h2 class="section-title">${escapeHtml(t.name)}</h2><div class="small muted">My Team • live roster</div></div><div class="myteam-summary"><strong>${rows.length}/${rosterLimit}</strong><span>${open} open</span></div></div><div class="myteam-budget card"><div><span class="small muted">Bid dollars remaining</span><strong>$${Number(t.remaining_budget||0).toFixed(0)}</strong></div><div><span class="small muted">Roster spots</span><strong>${open}</strong></div></div><div class="myteam-list">${groups||'<div class="card empty">No rostered players yet.</div>'}</div>`;
}

function toast(message,type='') {
  let wrap=document.querySelector('.toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap);}
  const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;wrap.appendChild(el);setTimeout(()=>el.remove(),3200);
}
async function rpc(name,args={}) {
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw new Error(error.message);
  if(data?.ok===false) throw new Error(data.error||'Request failed');
  return data;
}

function unlockAudio(){ if(!audioState.enabled)return; try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;if(!audioState.ctx)audioState.ctx=new A();if(audioState.ctx.state==='suspended')audioState.ctx.resume().catch(()=>{});}catch{}}
function tone(freq,duration=.1,delay=0,volume=.04,type='sine'){if(!audioState.enabled)return;unlockAudio();const c=audioState.ctx;if(!c)return;try{const st=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,st);g.gain.setValueAtTime(.0001,st);g.gain.exponentialRampToValueAtTime(Math.max(.001,volume),st+.012);g.gain.exponentialRampToValueAtTime(.0001,st+duration);o.connect(g);g.connect(c.destination);o.start(st);o.stop(st+duration+.03);}catch{}}
function playSound(kind,detail={}){
  if(!audioState.enabled||!state.session)return;
  if(kind==='pick'){tone(392,.10,0,.04,'triangle');tone(523,.11,.09,.045,'triangle');tone(659,.15,.19,.05,'triangle');}
  else if(kind==='drafted'){tone(523,.10,0,.05,'triangle');tone(659,.11,.09,.05,'triangle');tone(784,.17,.18,.055,'triangle');}
  else if(kind==='countdown'){const sec=Number(detail.sec||0);tone(sec<=2?988:sec<=3?880:740,sec<=2?.12:.075,0,sec<=2?.055:.04,'square');}
  else if(kind==='pause'){tone(440,.12,0,.035,'triangle');tone(349,.15,.1,.035,'triangle');}
  else if(kind==='resume'){tone(349,.1,0,.035,'triangle');tone(523,.15,.09,.045,'triangle');}
  else if(kind==='reset'){tone(659,.09,0,.035);tone(523,.09,.08,.035);tone(392,.14,.16,.04);}
  else if(kind==='enabled'){tone(660,.08,0,.035);tone(880,.11,.075,.04);}
}
function toggleSound(){audioState.enabled=!audioState.enabled;saveSoundPreference();if(audioState.enabled){unlockAudio();playSound('enabled');toast('Roster-fill sounds on.');}else toast('Roster-fill sounds muted.');render();}

function snapshot(){
  if(!state.settings)return null;
  return {status:state.settings.status,turn:state.settings.current_turn_no,picks:state.picks.length};
}
function handleTransitions(prev,curr){
  if(!prev||!curr||!state.session)return;
  if(curr.status==='setup'&&prev.status!=='setup'){playSound('reset');audioState.lastCountdownKey=null;return;}
  if(curr.picks>prev.picks)playSound('drafted');
  if(curr.turn!==prev.turn){setTimeout(()=>playSound('pick'),curr.picks>prev.picks?330:0);audioState.lastCountdownKey=null;}
  if(curr.status!==prev.status){if(curr.status==='paused')playSound('pause');if(prev.status==='paused'&&curr.status==='live')playSound('resume');}
}

async function loadData(){
  const prev=snapshot();
  const rr=await supabase.from('rooms').select('*').eq('code',ROOM_CODE).single();
  if(rr.error) throw rr.error; state.room=rr.data;

  const teamsRes=await supabase.from('teams').select('*').eq('room_id',state.room.id).order('sort_order');
  if(teamsRes.error) throw teamsRes.error; state.teams=teamsRes.data||[];

  const settingsRes=await supabase.from('phase3_settings').select('*').eq('room_id',state.room.id).maybeSingle();
  if(settingsRes.error && settingsRes.error.code!=='42P01') throw settingsRes.error;
  if(!settingsRes.data){state.migrationMissing=true;state.settings=null;state.loading=false;return;}

  state.migrationMissing=false;state.settings=settingsRes.data;
  const [o,rs,re,p,pk,lre]=await Promise.all([
    supabase.from('phase3_order').select('*').eq('room_id',state.room.id).order('slot'),
    supabase.from('phase3_roster_state').select('*').eq('room_id',state.room.id),
    supabase.from('phase3_roster_entries').select('*').eq('room_id',state.room.id).order('created_at'),
    supabase.from('phase3_players').select('*').eq('room_id',state.room.id).order('yahoo_rank'),
    supabase.from('phase3_picks').select('*').eq('room_id',state.room.id).order('pick_no'),
    supabase.from('league_roster_entries').select('*').eq('room_id',state.room.id).eq('active',true).order('player_name'),
  ]);
  for(const r of[o,rs,re,p,pk,lre]) if(r.error) throw r.error;
  state.order=o.data||[];state.rosterState=rs.data||[];state.rosterEntries=re.data||[];state.players=p.data||[];state.picks=pk.data||[];state.leagueRosterEntries=lre.data||[];state.loading=false;
  const curr=snapshot();if(prev)handleTransitions(prev,curr);
}
function scheduleRefresh(){clearTimeout(state.refreshTimer);state.refreshTimer=setTimeout(async()=>{try{await loadData();render();}catch(e){console.error(e);}},90);}
function subscribeRealtime(){
  state.realtime?.unsubscribe?.();
  if(!state.settings)return;
  state.realtime=supabase.channel(`phase3-${ROOM_CODE}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_settings',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_order',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_roster_state',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_players',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_picks',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'phase3_roster_entries',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .on('postgres_changes',{event:'*',schema:'public',table:'league_roster_entries',filter:`room_id=eq.${state.room.id}`},scheduleRefresh)
    .subscribe();
}

function positionBadge(pos){return `<span class="pos-badge pos-${escapeHtml(pos)}">${escapeHtml(pos)}</span>`;}
function projectionSummary(p){
  const x=p.projection_stats||{};const parts=[];
  if(p.position==='QB'){if(x.PassYds!=null)parts.push(`${x.PassYds} pass yd`);if(x.PassTD!=null)parts.push(`${x.PassTD} pass TD`);if(x.RunYds!=null)parts.push(`${x.RunYds} rush yd`);if(x.RunTD!=null)parts.push(`${x.RunTD} rush TD`);}
  else if(p.position==='RB'){if(x.ATT!=null)parts.push(`${x.ATT} att`);if(x.RunYds!=null)parts.push(`${x.RunYds} rush yd`);if(x.REC!=null)parts.push(`${x.REC} rec`);if(x.RecYds!=null)parts.push(`${x.RecYds} rec yd`);}
  else if(p.position==='WR'||p.position==='TE'){if(x.TGT!=null)parts.push(`${x.TGT} tgt`);if(x.REC!=null)parts.push(`${x.REC} rec`);if(x.RecYds!=null)parts.push(`${x.RecYds} yd`);if(x.RecTD!=null)parts.push(`${x.RecTD} TD`);}
  else if(p.position==='K'){if(x.FGM!=null)parts.push(`${x.FGM} FG`);if(x.XPM!=null)parts.push(`${x.XPM} XP`);}
  return parts.slice(0,4).join(' • ');
}
function playerRow(p,showButton=true){
  const cp=currentPicker(),mine=myTeam();
  const can=showButton&&state.settings?.status==='live'&&p.status==='available'&&((mine&&cp&&mine.id===cp.id&&!isFull(mine.id))||isCommish());
  return `<div class="supp-player-card"><div class="rank">#${p.yahoo_rank}</div>${positionBadge(p.position)}<div class="supp-player-info"><div class="supp-player-name">${escapeHtml(p.name)}</div><div class="supp-player-meta">${escapeHtml(p.nfl_team)} • ${escapeHtml(p.position)}${p.pos_rank?String(p.pos_rank):''} • Bye ${p.bye??'—'}</div>${projectionSummary(p)?`<div class="proj-line">${escapeHtml(projectionSummary(p))}</div>`:''}</div>${can?`<button class="btn btn-sm btn-primary" data-select-player="${p.id}">Draft</button>`:''}</div>`;
}

function topBar(){
  const t=myTeam(),rs=t?rosterByTeam(t.id):null;
  return `<header class="topbar"><div class="topbar-inner"><div class="brand"><div class="brand-kicker">Phase 3 • Roster Fill</div><div class="brand-title">${escapeHtml(LEAGUE_NAME)}</div></div><div class="user-chip"><div class="status-dot ${state.settings?.status==='live'?'live':''}"></div><div class="user-chip-text"><div class="user-team">${t?escapeHtml(t.name):state.session?.spectator?'Spectator':'Not joined'}${isCommish()?' • Czar':''}</div><div class="user-budget">${rs?`${rs.roster_count}/${rs.max_roster_size} rostered • ${openSpots(t.id)} open`:escapeHtml(state.settings?.status||'')}</div></div><a class="phase-link league-link" href="/league">League Office</a><a class="phase-link phase1-link" href="/">Auction</a><a class="phase-link phase2-link" href="/supplemental">Phase 2</a><button class="sound-toggle" data-action="toggle-sound">${audioState.enabled?'🔊':'🔇'}<span>${audioState.enabled?'Sound':'Muted'}</span></button><button class="btn-link" data-action="logout">Leave</button></div></div></header>`;
}

function predictedUpcoming(limit=24){
  if(!state.settings||state.order.length<12)return [];
  const counts=new Map(state.rosterState.map(r=>[r.team_id,r.roster_count]));
  const maxes=new Map(state.rosterState.map(r=>[r.team_id,r.max_roster_size]));
  let turn=Math.max(1,state.settings.current_turn_no),guard=0;const out=[];
  while(out.length<limit&&guard<5000){
    guard++;const t=pickerForTurn(turn);
    if(!t){turn++;continue;}
    const c=counts.get(t.id)??18,m=maxes.get(t.id)??18;
    if(c<m){out.push({turn,team:t,round:roundForTurn(turn)});counts.set(t.id,c+1);}
    if([...counts.entries()].every(([id,c])=>c>=(maxes.get(id)??18)))break;
    turn++;
  }
  return out;
}
function pickStrip(){
  const upcoming=predictedUpcoming(24);if(!upcoming.length)return '';
  return `<div class="pick-strip">${upcoming.map((x,i)=>`<div class="pick-chip ${i===0&&state.settings?.status!=='setup'?'current':''}"><div class="n">${i===0?'On Clock':'Upcoming'} • R${x.round}</div><div class="t">${escapeHtml(x.team.name)}</div></div>`).join('')}</div>`;
}

function stageView(){
  const s=state.settings,cp=currentPicker(),mine=myTeam(),rs=cp?rosterByTeam(cp.id):null;
  if(s.status==='complete')return `<section class="card hero-complete"><div class="trophy">🏁</div><h2>Rosters Complete</h2><p class="muted">All 12 teams have reached ${s.max_roster_size} players.</p><button class="btn btn-dark" data-tab="results">View Phase 3 Results</button></section>`;
  if(s.status==='setup')return `<section class="card supp-stage"><div class="supp-stage-head"><div><div class="supp-stage-title">Roster-Fill Snake Draft</div><div class="supp-stage-sub">30-second picks • teams auto-skip at 18 players</div></div><div class="timer">--</div></div><div class="supp-body"><div class="on-clock">Ready for Phase 3</div><p class="muted">The commissioner can verify current roster counts, order, and timer before starting.</p></div></section>`;

  const mineOn=mine&&cp&&mine.id===cp.id;
  return `<section class="card supp-stage"><div class="supp-stage-head"><div><div class="supp-stage-title">${s.status==='paused'?'Paused':'Roster-Fill Pick'}</div><div class="supp-stage-sub">Snake Round ${roundForTurn(s.current_turn_no)} • Turn ${s.current_turn_no}</div></div><div id="phase3-timer" class="timer">--</div></div><div class="supp-body"><div class="pick-label">On the clock</div><div class="on-clock">${escapeHtml(cp?.name||'—')}</div><div class="phase3-roster-line">${rs?`${rs.roster_count}/${rs.max_roster_size} rostered • ${Math.max(0,rs.max_roster_size-rs.roster_count)} spot${Math.max(0,rs.max_roster_size-rs.roster_count)===1?'':'s'} remaining`:''}</div>${mineOn?'<div class="notice" style="margin-top:12px">You are on the clock. Draft a player below or from the Players tab.</div>':''}<div class="supp-mini-list">${availablePlayers().slice(0,7).map(p=>playerRow(p,true)).join('')}</div></div></section>`;
}

function commishPanel(){
  if(!isCommish())return '';
  const s=state.settings;
  return `<section class="commish-panel"><div class="commish-head">Phase 3 Commissioner Controls</div><div class="commish-body"><div class="commish-actions">${s.status==='setup'?'<button class="btn btn-green" data-action="p3-start">▶ Start Phase 3</button>':''}${s.status==='live'?'<button class="btn btn-outline" data-action="p3-pause">⏸ Pause</button>':''}${s.status==='paused'?'<button class="btn btn-green" data-action="p3-resume">▶ Resume</button>':''}${['live','paused'].includes(s.status)?'<button class="btn btn-outline" data-action="add-time">+30 sec</button><button class="btn btn-outline" data-action="skip-turn">Skip Current Turn</button>':''}<button class="btn btn-outline" data-action="p3-undo">Undo Last Pick</button><button class="btn btn-reset" data-action="p3-reset">↺ Reset Phase 3</button></div><div class="small muted">Reset restores the pre-Phase-3 roster snapshot and clears only Phase 3 picks.</div></div></section>`;
}

function rosterMini(){
  const sorted=[...state.order].sort((a,b)=>a.slot-b.slot).map(o=>teamById(o.team_id)).filter(Boolean);
  return `<div class="card" style="overflow:hidden"><div class="queue-title">Roster Status</div><div class="phase3-roster-mini">${sorted.map(t=>{const r=rosterByTeam(t.id),pct=r?Math.min(100,r.roster_count/r.max_roster_size*100):0;return `<div class="phase3-team-mini ${r&&r.roster_count>=r.max_roster_size?'full':''}"><div><strong>${escapeHtml(t.name)}</strong><span>${r?`${r.roster_count}/${r.max_roster_size}`:'—'}</span></div><div class="phase3-progress"><i style="width:${pct}%"></i></div></div>`;}).join('')}</div></div>`;
}
function draftView(){return `${pickStrip()}<div class="desktop-grid"><div>${stageView()}${commishPanel()}</div><div>${rosterMini()}</div></div>`;}

function playersView(){
  const needle=state.search.toLowerCase();let rows=availablePlayers().filter(p=>(state.posFilter==='ALL'||p.position===state.posFilter)&&(!needle||`${p.name} ${p.nfl_team} ${p.position}`.toLowerCase().includes(needle)));
  return `<div class="row between gap-12 wrap" style="margin-bottom:10px"><h2 class="section-title">Phase 3 Player Pool</h2><div class="small muted">${rows.length} shown • ${availablePlayers().length} available</div></div><div class="filter-row"><input id="p3-search" class="input" placeholder="Search player or NFL team" value="${escapeHtml(state.search)}"><select id="p3-pos" class="input">${['ALL','QB','RB','WR','TE','K','DST'].map(x=>`<option value="${x}" ${state.posFilter===x?'selected':''}>${x==='ALL'?'All positions':x}</option>`).join('')}</select></div><div class="list-stack">${rows.map(p=>playerRow(p,true)).join('')||'<div class="card empty">No matching available players.</div>'}</div><div class="source-note">Player order and projected-stat fields carry forward from the Yahoo Half-PPR snapshot used for the Supplemental draft. Players already on the current roster snapshot are excluded.</div>`;
}

function moveOrder(slot,dir){
  if(!isCommish())return;
  const arr=[...state.order].sort((a,b)=>a.slot-b.slot),i=arr.findIndex(o=>o.slot===Number(slot)),j=dir==='up'?i-1:i+1;
  if(i<0||j<0||j>=arr.length)return;
  [arr[i],arr[j]]=[arr[j],arr[i]];
  return commishCall('phase3_commish_set_order',{p_team_ids:arr.map(x=>x.team_id)},'Phase 3 draft order updated.');
}

function orderView(){
  const ordered=[...state.order].sort((a,b)=>a.slot-b.slot),round2=[...ordered].reverse();
  const openTotal=state.rosterState.reduce((a,r)=>a+Math.max(0,r.max_roster_size-r.roster_count),0);
  return `<div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Phase 3 Order & Rosters</h2><div class="small muted">${openTotal} roster spots remaining</div></div><section class="card" style="padding:13px;margin-bottom:13px"><h3 style="margin:0 0 10px">Round 1 order</h3><div class="supp-order-grid">${ordered.map((o,i)=>{const t=teamById(o.team_id),r=rosterByTeam(o.team_id);return `<div class="order-row"><div class="order-slot">${o.slot}</div><div class="order-team">${escapeHtml(t?.name||'—')}<div class="small muted">${r?`${r.roster_count}/${r.max_roster_size} rostered • ${openSpots(t.id)} open`:''}</div></div>${isCommish()?`<div class="order-actions"><button class="btn btn-sm btn-outline" data-order-move="up" data-slot="${o.slot}" ${i===0?'disabled':''}>↑</button><button class="btn btn-sm btn-outline" data-order-move="down" data-slot="${o.slot}" ${i===ordered.length-1?'disabled':''}>↓</button></div>`:''}</div>`;}).join('')}</div><h3 style="margin:17px 0 10px">Round 2 reverses automatically</h3><div class="supp-order-grid">${round2.map((o,i)=>`<div class="order-row"><div class="order-slot">${13+i}</div><div class="order-team">${escapeHtml(teamById(o.team_id)?.name||'—')}</div><div class="small muted">R2</div></div>`).join('')}</div></section>${isCommish()?`<section class="commish-panel"><div class="commish-head">Pick Timer</div><div class="commish-body"><div class="timer-grid phase3-single-timer"><div class="timer-setting"><label>Pick clock</label><input id="p3-pick-seconds" type="number" min="5" max="600" value="${state.settings.pick_seconds}"></div></div><button class="btn btn-primary" data-action="save-timer">Save Timer</button><div class="small muted">Teams are skipped automatically once their roster reaches ${state.settings.max_roster_size} players.</div></div></section>`:''}`;
}


function boardView(){
  const ordered=[...state.order].sort((a,b)=>a.slot-b.slot);
  const initialOpen=state.rosterState.map(r=>{
    const teamPicks=state.picks.filter(pk=>pk.team_id===r.team_id).length;
    const starting=Number.isFinite(Number(r.initial_count))?Number(r.initial_count):Math.max(0,Number(r.roster_count||0)-teamPicks);
    return Math.max(0,Number(r.max_roster_size||18)-starting);
  });
  const rounds=Math.max(1,...initialOpen,roundForTurn(state.settings?.current_turn_no||1),...state.picks.map(pk=>Number(pk.round||1)));
  const currentRound=roundForTurn(state.settings?.current_turn_no||1);
  const currentSlot=slotForTurn(state.settings?.current_turn_no||1);
  const currentTurn=Number(state.settings?.current_turn_no||1);
  const turnFor=(round,slot)=>{
    const pos=round%2===1?slot:13-slot;
    return (round-1)*12+pos;
  };
  const cellFor=(round,o)=>{
    const t=teamById(o.team_id);
    const pk=state.picks.find(x=>Number(x.round)===round&&x.team_id===o.team_id);
    const turn=turnFor(round,o.slot);
    const current=state.settings?.status!=='setup'&&round===currentRound&&o.slot===currentSlot;
    if(pk){
      const p=playerById(pk.player_id);
      const pos=p?.position||'';
      return `<div class="draft-board-cell drafted ${pos?`board-${pos}`:''}"><div class="board-pick-no">#${pk.pick_no}</div><div class="board-player">${escapeHtml(p?.name||'—')}</div><div class="board-meta">${escapeHtml(pos)}${p?.nfl_team?` • ${escapeHtml(p.nfl_team)}`:''}</div></div>`;
    }
    if(current)return `<div class="draft-board-cell on-clock-cell"><div class="board-pick-no">ON CLOCK</div><div class="board-player">${escapeHtml(t?.name||'—')}</div><div class="board-meta">R${round} • turn ${turn}</div></div>`;
    if(turn<currentTurn)return `<div class="draft-board-cell skipped"><div class="board-pick-no">${isFull(o.team_id)?'FULL':'SKIP'}</div><div class="board-meta">No selection</div></div>`;
    if(isFull(o.team_id))return `<div class="draft-board-cell full-cell"><div class="board-pick-no">FULL</div><div class="board-meta">18/18</div></div>`;
    return `<div class="draft-board-cell empty-cell"><div class="board-pick-no">R${round}</div><div class="board-meta">Waiting</div></div>`;
  };
  return `<div class="row between gap-12 wrap board-title-row"><div><h2 class="section-title">Live Draft Board</h2><div class="small muted">Every Phase 3 pick appears here instantly for all owners.</div></div><div class="board-legend"><span><i class="legend-dot rb"></i>RB</span><span><i class="legend-dot wr"></i>WR</span><span><i class="legend-dot qb"></i>QB</span><span><i class="legend-dot te"></i>TE</span></div></div><div class="draft-board-scroll"><div class="draft-board" style="--board-cols:${ordered.length}"><div class="board-corner">ROUND</div>${ordered.map(o=>`<div class="board-team-head"><div>${escapeHtml(teamById(o.team_id)?.name||'—')}</div><span>Slot ${o.slot}</span></div>`).join('')}${Array.from({length:rounds},(_,i)=>i+1).map(round=>`<div class="board-round-head"><strong>R${round}</strong><span>${round%2===1?'→':'←'}</span></div>${ordered.map(o=>cellFor(round,o)).join('')}`).join('')}</div></div>`;
}

function resultsView(){
  const rows=[...state.picks].sort((a,b)=>a.pick_no-b.pick_no);
  return `<div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Phase 3 Results</h2><button class="btn btn-sm btn-outline" data-action="export-p3">Export CSV</button></div><div class="list-stack">${rows.map(pk=>{const p=playerById(pk.player_id),t=teamById(pk.team_id);return `<div class="log-row"><div><div class="log-name">#${pk.pick_no} ${escapeHtml(p?.name||'—')}</div><div class="small muted">${escapeHtml(p?.nfl_team||'')} • ${escapeHtml(p?.position||'')} • ${escapeHtml(t?.name||'—')} • Snake R${pk.round}</div></div><div class="tag tag-queued">PICK</div></div>`;}).join('')||'<div class="card empty">No Phase 3 picks yet.</div>'}</div>`;
}

function bottomNav(){return `<nav class="bottom-nav phase3-bottom-nav"><div class="bottom-nav-inner"><button class="nav-btn ${state.tab==='draft'?'active':''}" data-tab="draft"><span>⚡</span>Draft</button><button class="nav-btn ${state.tab==='players'?'active':''}" data-tab="players"><span>☰</span>Players</button><button class="nav-btn ${state.tab==='order'?'active':''}" data-tab="order"><span>↕</span>Order</button><button class="nav-btn ${state.tab==='board'?'active':''}" data-tab="board"><span>▦</span>Board</button><button class="nav-btn ${state.tab==='results'?'active':''}" data-tab="results"><span>▤</span>Results</button><button class="nav-btn ${state.tab==='myteam'?'active':''}" data-tab="myteam"><span>♜</span>My Team</button></div></nav>`;}
function loginView(){const opts=state.teams.map(t=>`<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>${escapeHtml(LEAGUE_NAME)}</h1><p>2026 Phase 3 • Roster-Fill Snake Draft</p></div><div class="login-body"><div class="field"><label>Your team</label><select id="join-team" class="input"><option value="">Select your team…</option>${opts}</select></div><div class="field"><label>Team PIN</label><input id="team-pin" class="input pin-input" inputmode="numeric" maxlength="6" placeholder="6-digit PIN"></div><div id="join-error"></div><button class="btn btn-primary btn-block" data-action="join">Enter Phase 3 Room</button><button class="btn-link btn-block" data-action="spectate">View as spectator</button><a class="btn-link btn-block" href="/supplemental" style="display:block;text-align:center;text-decoration:none">← Back to Supplemental</a></div></div></div>`;}
function migrationView(){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Phase 3 App Ready</h1><p>The Phase 3 database migration still needs to be installed.</p></div><div class="login-body"><div class="notice">Run <strong>supabase/phase3.sql</strong> in the GLSK Supabase SQL Editor, then refresh this page.</div><a class="btn-link btn-block" href="/supplemental" style="display:block;text-align:center;text-decoration:none">← Supplemental room</a></div></div></div>`;}
function connectionView(e){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Connection Error</h1><p>Phase 3 room could not load.</p></div><div class="login-body"><div class="error">${escapeHtml(e.message)}</div></div></div></div>`;}

function render(){
  if(!configured){app.innerHTML=migrationView();return;}
  if(state.loading){app.innerHTML='<div class="login-wrap"><div style="color:white;font-weight:900">Loading Phase 3…</div></div>';return;}
  if(state.migrationMissing){app.innerHTML=migrationView();return;}
  if(!state.session){app.innerHTML=loginView();bindEvents();return;}
  const content=state.tab==='players'?playersView():state.tab==='order'?orderView():state.tab==='board'?boardView():state.tab==='results'?resultsView():state.tab==='myteam'?myTeamView():draftView();
  app.innerHTML=`<div class="app-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;bindEvents();updateCountdown();
}

async function join(){
  unlockAudio();const teamId=document.querySelector('#join-team')?.value,pin=document.querySelector('#team-pin')?.value.trim(),err=document.querySelector('#join-error');
  if(!teamId||!pin){err.innerHTML='<div class="error">Select your team and enter its PIN.</div>';return;}
  try{
    await rpc('join_room',{p_room_code:ROOM_CODE,p_team_id:teamId,p_pin:pin});
    const t=teamById(teamId);let commishPin=null;
    if(t?.name===COMMISH_TEAM_NAME){const valid=await rpc('commish_login',{p_room_code:ROOM_CODE,p_pin:pin});if(!valid?.valid)throw new Error('Commissioner access is not configured for this PIN.');commishPin=pin;}
    saveSession({teamId,pin,commishPin,spectator:false});render();
  }catch(e){err.innerHTML=`<div class="error">${escapeHtml(e.message)}</div>`;}
}
function spectate(){unlockAudio();saveSession({spectator:true,teamId:null,pin:null,commishPin:null});render();}
function logout(){saveSession(null);render();}
async function teamCall(name,args={},success=''){const t=myTeam();if(!t)return;try{const out=await rpc(name,{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,...args});if(success)toast(typeof success==='function'?success(out):success);await loadData();render();}catch(e){toast(e.message,'error');}}
async function commishCall(name,args={},success=''){if(!isCommish())return;try{const out=await rpc(name,{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,...args});if(success)toast(typeof success==='function'?success(out):success);await loadData();render();}catch(e){toast(e.message,'error');}}
async function selectPlayer(id){
  try{
    if(isCommish())await rpc('phase3_commish_select_player',{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,p_player_id:id});
    else {const t=myTeam();if(!t)return;await rpc('phase3_select_player',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_player_id:id});}
    toast(`${playerById(id)?.name||'Player'} drafted.`);await loadData();render();
  }catch(e){toast(e.message,'error');}
}
async function saveTimer(){const p=Number(document.querySelector('#p3-pick-seconds')?.value);await commishCall('phase3_commish_update_settings',{p_pick_seconds:p},'Phase 3 pick timer saved.');}
async function skipTurn(){if(!isCommish())return;const cp=currentPicker();if(window.confirm(`Skip ${cp?.name||'the current team'} for this turn? They will remain eligible on a later snake turn until their roster is full.`))await commishCall('phase3_commish_skip_turn',{},'Current turn skipped.');}
async function resetPhase3(){if(!isCommish())return;if(window.confirm('Reset Phase 3?\n\nThis clears only Phase 3 picks and restores every team to the pre-Phase-3 roster counts. Auction and Supplemental results are untouched.'))await commishCall('phase3_commish_reset',{},'Phase 3 reset.');}
function exportPhase3(){const rows=[['Phase 3 Pick','Snake Turn','Round','Team','Player','NFL','Position','Yahoo Rank']];for(const pk of state.picks){const p=playerById(pk.player_id),t=teamById(pk.team_id);rows.push([pk.pick_no,pk.turn_no,pk.round,t?.name||'',p?.name||'',p?.nfl_team||'',p?.position||'',p?.yahoo_rank||'']);}const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='GLSK-2026-phase3-roster-fill-results.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);}

function bindEvents(){
  app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{state.tab=b.dataset.tab;render();}));
  app.querySelector('[data-action="join"]')?.addEventListener('click',join);
  app.querySelector('[data-action="spectate"]')?.addEventListener('click',spectate);
  app.querySelector('[data-action="logout"]')?.addEventListener('click',logout);
  app.querySelector('[data-action="toggle-sound"]')?.addEventListener('click',toggleSound);
  app.querySelectorAll('[data-select-player]').forEach(b=>b.addEventListener('click',()=>selectPlayer(b.dataset.selectPlayer)));
  app.querySelector('[data-action="p3-start"]')?.addEventListener('click',()=>commishCall('phase3_commish_start',{},'Phase 3 started.'));
  app.querySelector('[data-action="p3-pause"]')?.addEventListener('click',()=>commishCall('phase3_commish_pause',{},'Phase 3 paused.'));
  app.querySelector('[data-action="p3-resume"]')?.addEventListener('click',()=>commishCall('phase3_commish_resume',{},'Phase 3 resumed.'));
  app.querySelector('[data-action="add-time"]')?.addEventListener('click',()=>commishCall('phase3_commish_add_time',{p_seconds:30},'Added 30 seconds.'));
  app.querySelector('[data-action="p3-undo"]')?.addEventListener('click',()=>commishCall('phase3_commish_undo_last_pick',{},'Last Phase 3 pick undone.'));
  app.querySelector('[data-action="p3-reset"]')?.addEventListener('click',resetPhase3);
  app.querySelector('[data-action="skip-turn"]')?.addEventListener('click',skipTurn);
  app.querySelector('[data-action="save-timer"]')?.addEventListener('click',saveTimer);
  app.querySelector('[data-action="export-p3"]')?.addEventListener('click',exportPhase3);
  app.querySelectorAll('[data-order-move]').forEach(b=>b.addEventListener('click',()=>moveOrder(b.dataset.slot,b.dataset.orderMove)));
  const search=app.querySelector('#p3-search');search?.addEventListener('input',e=>{state.search=e.target.value;clearTimeout(search._t);search._t=setTimeout(render,120);});
  app.querySelector('#p3-pos')?.addEventListener('change',e=>{state.posFilter=e.target.value;render();});
}

function updateCountdown(){
  const el=document.querySelector('#phase3-timer');if(!el||!state.settings)return;
  const s=state.settings;
  if(s.status==='paused'){el.textContent='PAUSE';el.classList.add('danger');return;}
  if(s.status!=='live'||!s.pick_ends_at){el.textContent='--';return;}
  const ms=new Date(s.pick_ends_at).getTime()-Date.now(),sec=Math.max(0,Math.ceil(ms/1000));el.textContent=String(sec);el.classList.toggle('danger',sec<=5);
  if(sec>0){const key=`${s.current_turn_no}:${sec}`;if(key!==audioState.lastCountdownKey){audioState.lastCountdownKey=key;if(sec<=5)playSound('countdown',{sec});}}
  if(ms<=0&&!state.finalizing)finalizeExpired();
}
async function finalizeExpired(){
  if(state.finalizing||state.settings?.status!=='live')return;
  state.finalizing=true;
  try{await rpc('phase3_finalize_if_expired',{p_room_code:ROOM_CODE});await loadData();render();}catch(e){console.warn(e);}finally{state.finalizing=false;}
}

async function boot(){
  if(!configured){state.loading=false;render();return;}
  try{await loadData();subscribeRealtime();render();setInterval(updateCountdown,250);}catch(e){state.loading=false;app.innerHTML=connectionView(e);}
}
document.addEventListener('pointerdown',unlockAudio,{once:true,passive:true});
boot();
