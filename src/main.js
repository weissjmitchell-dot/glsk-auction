import './styles.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const SOUND_STORAGE_KEY = `glsk-auction-sound-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';

const state = {
  room: null,
  teams: [],
  players: [],
  bids: [],
  sales: [],
  rosterEntries: [],
  session: loadSession(),
  tab: 'action',
  loading: true,
  realtime: null,
  search: '',
  finalizing: false,
  refreshTimer: null,
};

const audioState = {
  enabled: loadSoundPreference(),
  ctx: null,
  lastCountdownKey: null,
};

function loadSoundPreference() {
  try {
    const saved = localStorage.getItem(SOUND_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch { return true; }
}

function saveSoundPreference() {
  try { localStorage.setItem(SOUND_STORAGE_KEY, String(audioState.enabled)); }
  catch { /* localStorage may be unavailable in private modes */ }
}

function unlockAudio() {
  if (!audioState.enabled) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioState.ctx) audioState.ctx = new AudioCtx();
    if (audioState.ctx.state === 'suspended') audioState.ctx.resume().catch(() => {});
  } catch { /* sound is optional */ }
}

function tone(freq, duration = 0.1, delay = 0, volume = 0.045, type = 'sine') {
  if (!audioState.enabled) return;
  unlockAudio();
  const ctx = audioState.ctx;
  if (!ctx || ctx.state === 'closed') return;
  try {
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.03);
  } catch { /* ignore audio hardware/browser errors */ }
}

function playSound(kind, detail = {}) {
  if (!audioState.enabled || !state.session) return;
  if (kind === 'player') {
    tone(392, .11, 0, .045, 'triangle');
    tone(523.25, .12, .105, .05, 'triangle');
    tone(659.25, .15, .215, .055, 'triangle');
  } else if (kind === 'bid') {
    tone(880, .075, 0, .04, 'sine');
    tone(1174.66, .085, .055, .038, 'sine');
  } else if (kind === 'sold') {
    tone(523.25, .12, 0, .05, 'triangle');
    tone(659.25, .12, .11, .05, 'triangle');
    tone(783.99, .18, .22, .055, 'triangle');
  } else if (kind === 'warning') {
    tone(587.33, .13, 0, .045, 'square');
  } else if (kind === 'countdown') {
    const sec = Number(detail.sec || 0);
    const freq = sec <= 2 ? 988 : sec <= 3 ? 880 : 740;
    tone(freq, sec <= 2 ? .12 : .075, 0, sec <= 2 ? .055 : .04, 'square');
  } else if (kind === 'pause') {
    tone(440, .12, 0, .035, 'triangle');
    tone(349.23, .16, .10, .035, 'triangle');
  } else if (kind === 'resume') {
    tone(349.23, .10, 0, .035, 'triangle');
    tone(523.25, .15, .09, .045, 'triangle');
  } else if (kind === 'reset') {
    tone(659.25, .09, 0, .035, 'sine');
    tone(523.25, .09, .08, .035, 'sine');
    tone(392, .14, .16, .04, 'sine');
  } else if (kind === 'enabled') {
    tone(660, .08, 0, .035, 'sine');
    tone(880, .11, .075, .04, 'sine');
  }
}

function soundSnapshot() {
  return {
    activePlayerId: state.room?.active_player_id || null,
    activeBid: Number(state.room?.active_bid || 0),
    activeBidderId: state.room?.active_bidder_team_id || null,
    soldCount: Number(state.room?.sold_count || 0),
    status: state.room?.status || null,
  };
}

function handleSoundTransitions(previous, current) {
  if (!previous || !state.session) return;

  const resetHappened = current.status === 'setup' && previous.status !== 'setup' && !current.activePlayerId;
  if (resetHappened) {
    audioState.lastCountdownKey = null;
    playSound('reset');
    return;
  }

  const soldHappened = current.soldCount > previous.soldCount;
  const newPlayer = current.activePlayerId && current.activePlayerId !== previous.activePlayerId;
  const newBid = current.activePlayerId === previous.activePlayerId && current.activeBid > previous.activeBid;

  if (soldHappened) playSound('sold');
  if (newPlayer) {
    audioState.lastCountdownKey = null;
    if (soldHappened) setTimeout(() => playSound('player'), 430);
    else playSound('player');
  } else if (newBid) {
    playSound('bid');
  }

  if (current.status !== previous.status) {
    if (current.status === 'paused') playSound('pause');
    if (previous.status === 'paused' && current.status === 'live') playSound('resume');
  }
}

function toggleSound() {
  audioState.enabled = !audioState.enabled;
  saveSoundPreference();
  if (audioState.enabled) {
    unlockAudio();
    playSound('enabled');
    toast('Auction sounds on.');
  } else {
    toast('Auction sounds muted.');
  }
  render();
}

function loadSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
  catch { return null; }
}

function saveSession(session) {
  state.session = session;
  if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else localStorage.removeItem(STORAGE_KEY);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function money(n) { return `$${Number(n || 0).toFixed(0)}`; }
function teamById(id) { return state.teams.find(t => t.id === id); }
function playerById(id) { return state.players.find(p => p.id === id); }
function myTeam() { return state.session?.teamId ? teamById(state.session.teamId) : null; }
function isCommish() { return Boolean(state.session?.commishPin); }
function nextBid() {
  if (!state.room) return 1;
  return state.room.active_bid > 0
    ? state.room.active_bid + state.room.bid_increment
    : state.room.min_bid;
}
function activePlayer() { return state.room?.active_player_id ? playerById(state.room.active_player_id) : null; }
function queuedPlayers() { return state.players.filter(p => p.status === 'queued').sort((a,b) => (a.queue_order ?? 999) - (b.queue_order ?? 999)); }
function availablePlayers() { return state.players.filter(p => p.status === 'available').sort((a,b) => a.rank - b.rank); }
function soldPlayers() { return state.players.filter(p => p.status === 'sold'); }
function wonCount(teamId) { return soldPlayers().filter(p => p.sold_team_id === teamId).length; }


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
  const order = {QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
  const rows = myRosterEntries().slice().sort((a,b)=>(order[a.position]||99)-(order[b.position]||99)||a.player_name.localeCompare(b.player_name));
  const maxRoster = 18, open = Math.max(0,maxRoster-rows.length);
  const groups = ['QB','RB','WR','TE','K','DST'].map(pos => {
    const ps = rows.filter(r => r.position === pos);
    if (!ps.length) return '';
    return `<section class="myteam-group"><div class="myteam-group-head">${pos}<span>${ps.length}</span></div>${ps.map(r => `<div class="myteam-player">${positionBadge(r.position)}<div class="myteam-player-main"><div class="myteam-player-name">${escapeHtml(r.player_name)}</div><div class="small muted">${escapeHtml(r.nfl_team||'')} • ${escapeHtml(rosterSourceLabel(r))}${r.acquisition_price!=null ? ` • ${money(r.acquisition_price)}` : ''}</div></div></div>`).join('')}</section>`;
  }).join('');
  return `<div class="row between gap-12 wrap myteam-header"><div><h2 class="section-title">${escapeHtml(t.name)}</h2><div class="small muted">My Team • live roster</div></div><div class="myteam-summary"><strong>${rows.length}/${maxRoster}</strong><span>${open} open</span></div></div><div class="myteam-budget card"><div><span class="small muted">Bid dollars remaining</span><strong>${money(t.remaining_budget)}</strong></div><div><span class="small muted">Roster spots</span><strong>${open}</strong></div></div><div class="myteam-list">${groups || '<div class="card empty">No rostered players yet.</div>'}</div>`;
}

function toast(message, type = '') {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3100);
}

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(error.message);
  if (data && data.ok === false) throw new Error(data.error || 'Request failed');
  return data;
}

async function loadData() {
  const previousSoundState = state.room ? soundSnapshot() : null;
  const roomRes = await supabase.from('rooms').select('*').eq('code', ROOM_CODE).single();
  if (roomRes.error) throw roomRes.error;
  state.room = roomRes.data;

  const [teamsRes, playersRes, bidsRes, salesRes, rosterRes] = await Promise.all([
    supabase.from('teams').select('*').eq('room_id', state.room.id).order('sort_order'),
    supabase.from('players').select('*').eq('room_id', state.room.id).order('rank'),
    supabase.from('bids').select('*').eq('room_id', state.room.id).order('created_at', { ascending: false }).limit(100),
    supabase.from('sales').select('*').eq('room_id', state.room.id).eq('undone', false).order('sold_at', { ascending: false }),
    supabase.from('league_roster_entries').select('*').eq('room_id', state.room.id).eq('active', true).order('player_name'),
  ]);
  for (const r of [teamsRes, playersRes, bidsRes, salesRes, rosterRes]) if (r.error) throw r.error;
  state.teams = teamsRes.data || [];
  state.players = playersRes.data || [];
  state.bids = bidsRes.data || [];
  state.sales = salesRes.data || [];
  state.rosterEntries = rosterRes.data || [];
  state.loading = false;
  if (previousSoundState) handleSoundTransitions(previousSoundState, soundSnapshot());
}

function scheduleRefresh() {
  clearTimeout(state.refreshTimer);
  state.refreshTimer = setTimeout(async () => {
    try { await loadData(); render(); }
    catch (e) { console.error(e); }
  }, 90);
}

function subscribeRealtime() {
  state.realtime?.unsubscribe?.();
  state.realtime = supabase.channel(`auction-${ROOM_CODE}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${state.room.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'teams', filter: `room_id=eq.${state.room.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${state.room.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bids', filter: `room_id=eq.${state.room.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales', filter: `room_id=eq.${state.room.id}` }, scheduleRefresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'league_roster_entries', filter: `room_id=eq.${state.room.id}` }, scheduleRefresh)
    .subscribe();
}

function positionBadge(pos) {
  return `<span class="pos-badge pos-${escapeHtml(pos)}">${escapeHtml(pos)}</span>`;
}

function rightsHolder(player) {
  return player?.rights_team_id ? teamById(player.rights_team_id) : null;
}

function rightsBadge(player, prefix = 'Rookie rights') {
  const rights = rightsHolder(player);
  return rights ? `<span class="rights-badge">${escapeHtml(prefix)}: ${escapeHtml(rights.name)}</span>` : '';
}

function topBar() {
  const t = myTeam();
  return `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="brand">
          <div class="brand-kicker">Live Auction</div>
          <div class="brand-title">${escapeHtml(LEAGUE_NAME)}</div>
        </div>
        <div class="user-chip">
          <div class="status-dot ${state.room?.status === 'live' ? 'live' : ''}" aria-label="Connection status"></div>
          <div class="user-chip-text">
            <div class="user-team">${t ? escapeHtml(t.name) : state.session?.spectator ? 'Spectator' : 'Not joined'}${isCommish() ? ' • Czar' : ''}</div>
            <div class="user-budget">${t ? `${money(t.remaining_budget)} remaining` : escapeHtml(state.room?.status || '')}</div>
          </div>
          <a class="phase-link phase2-link" href="/supplemental" title="Open Supplemental Draft">Phase 2</a><a class="phase-link phase3-link" href="/phase3" title="Open Phase 3 Roster-Fill Draft">Phase 3</a>
          <button class="sound-toggle" data-action="toggle-sound" aria-pressed="${audioState.enabled}" title="Toggle auction sound effects">${audioState.enabled ? '🔊' : '🔇'}<span>${audioState.enabled ? 'Sound' : 'Muted'}</span></button>
          <button class="btn-link" data-action="logout" aria-label="Leave room">Leave</button>
        </div>
      </div>
    </header>`;
}

function actionView() {
  if (state.room.status === 'complete') {
    return `<div class="card hero-complete"><div class="trophy">🏆</div><h2>Auction Complete</h2><p class="muted">All 40 auction players have been sold.</p><div class="row gap-8 wrap" style="justify-content:center;margin-top:12px"><button class="btn btn-dark" data-tab="log">View Results</button><a class="btn btn-primary phase-button" href="/supplemental">Open Phase 2 →</a><a class="btn btn-outline phase-button" href="/phase3">Phase 3 →</a></div></div>`;
  }

  const p = activePlayer();
  const high = teamById(state.room.active_bidder_team_id);
  const mine = myTeam();
  const bid = nextBid();
  const isHigh = mine && high && mine.id === high.id;
  const canBid = Boolean(mine && p && state.room.status === 'live' && !isHigh && mine.remaining_budget >= bid);

  const stage = p ? `
    <div class="card auction-stage">
      <div class="stage-head"><div class="stage-label">On the block</div><div id="timer" class="timer">--</div></div>
      <div class="nominee">
        <div class="player-line">
          ${positionBadge(p.position)}
          <div class="player-main">
            <div class="player-name">${escapeHtml(p.name)}</div>
            <div class="player-meta">${escapeHtml(p.nfl_team)}${p.note ? ` • ${escapeHtml(p.note)}` : ''}</div>
            ${rightsBadge(p)}
          </div>
        </div>
        <div class="bid-area">
          <div>
            <div class="current-bid-label">Current bid</div>
            <div class="current-bid">${state.room.active_bid ? money(state.room.active_bid) : '—'}</div>
            <div class="high-bidder">${high ? `High bidder: ${escapeHtml(high.name)}` : 'Waiting for the first bid'}</div>
          </div>
          <button class="bid-button ${isHigh ? 'high' : ''}" data-action="bid" ${canBid ? '' : 'disabled'}>
            ${isHigh ? '<small>You are</small>HIGH BID' : mine ? `<small>One tap</small>BID ${money(bid)}` : '<small>Join a team</small>VIEW ONLY'}
          </button>
        </div>
      </div>
    </div>` : `
    <div class="card empty">
      <div style="font-size:42px">⚡</div>
      <h2 style="margin:8px 0 5px">No player on the block</h2>
      <div>${state.room.status === 'setup' ? 'The commissioner will start the draft shortly.' : state.room.status === 'paused' ? 'The auction is paused.' : 'Waiting for the commissioner to nominate a player.'}</div>
    </div>`;

  const q = queuedPlayers();
  const queue = `
    <div class="card queue-card">
      <div class="queue-title">Nomination Queue</div>
      ${q.length ? q.slice(0, 8).map((x,i) => `
        <div class="player-row">
          <div class="rank">#${x.rank}</div>
          ${positionBadge(x.position)}
          <div class="player-row-name">${escapeHtml(x.name)}<div class="player-row-sub">${escapeHtml(x.nfl_team)}</div>${rightsBadge(x)}</div>
          <span class="tag ${i === 0 ? 'tag-next' : 'tag-queued'}">${i === 0 ? 'Up next' : 'Queued'}</span>
        </div>`).join('') : `<div class="empty">No players are queued.</div>`}
    </div>`;

  return `<div class="desktop-grid"><div>${stage}${commishPanel()}</div>${queue}</div>`;
}

function commishPanel() {
  if (!isCommish()) return '';
  const p = activePlayer();
  const status = state.room.status;
  const teams = state.teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)} — ${money(t.remaining_budget)}</option>`).join('');
  return `
    <section class="commish-panel">
      <div class="commish-head">Commissioner / Czar Controls</div>
      <div class="commish-body">
        <div class="commish-actions">
          ${status === 'setup' ? '<button class="btn btn-green" data-action="start-draft">▶ Start Draft</button>' : ''}
          ${status === 'live' ? '<button class="btn btn-outline" data-action="pause">⏸ Pause</button>' : ''}
          ${status === 'paused' ? '<button class="btn btn-green" data-action="resume">▶ Resume</button>' : ''}
          ${p ? '<button class="btn btn-outline" data-action="skip">Skip Player</button>' : ''}
          <button class="btn btn-outline" data-action="undo">Undo Last Sale</button>
          <button class="btn btn-reset" data-action="reset-draft">↺ Reset Draft</button>
        </div>
        ${p ? `
        <div>
          <div class="small muted" style="font-weight:850;margin-bottom:5px">Emergency manual sale</div>
          <div class="force-grid">
            <select id="force-team" class="input">${teams}</select>
            <input id="force-price" class="input" type="number" min="1" step="1" value="${Math.max(1, state.room.active_bid || 1)}" />
            <button class="btn btn-red" data-action="force-sale">Force Sold</button>
          </div>
        </div>` : ''}
      </div>
    </section>`;
}

function playersView() {
  const p = activePlayer();
  const q = queuedPlayers();
  const avail = availablePlayers().filter(x => !state.search || `${x.name} ${x.nfl_team} ${x.position}`.toLowerCase().includes(state.search.toLowerCase()));

  const queueHtml = `
    <section class="card" style="margin-bottom:14px;overflow:hidden">
      <div class="queue-title">Nomination Queue</div>
      ${p ? `<div class="player-row"><div class="rank">#${p.rank}</div>${positionBadge(p.position)}<div class="player-row-name">${escapeHtml(p.name)}<div class="player-row-sub">${escapeHtml(p.nfl_team)}</div>${rightsBadge(p)}</div><span class="tag tag-block">On block</span></div>` : ''}
      ${q.map((x,i) => `<div class="player-row"><div class="rank">#${x.rank}</div>${positionBadge(x.position)}<div class="player-row-name">${escapeHtml(x.name)}<div class="player-row-sub">${escapeHtml(x.nfl_team)}</div>${rightsBadge(x)}</div>${isCommish() ? `<button class="btn btn-sm btn-outline" data-unqueue="${x.id}">Remove</button>` : `<span class="tag ${i===0?'tag-next':'tag-queued'}">${i===0?'Up next':'Queued'}</span>`}</div>`).join('') || (!p ? '<div class="empty">Queue is empty.</div>' : '')}
    </section>`;

  const availableHtml = `
    <section>
      <div class="row between gap-12 wrap" style="margin-bottom:10px"><h2 class="section-title">Undrafted</h2><div class="small muted">${avail.length} available • ${soldPlayers().length} sold</div></div>
      <div class="searchbar"><input id="player-search" class="input" placeholder="Search players" value="${escapeHtml(state.search)}" /></div>
      <div class="list-stack">
        ${avail.map(x => `<div class="available-row"><div class="rank">#${x.rank}</div>${positionBadge(x.position)}<div class="available-row-main"><div class="available-name">${escapeHtml(x.name)}</div><div class="player-row-sub">${escapeHtml(x.nfl_team)}${x.note ? ` • ${escapeHtml(x.note)}` : ''}</div>${rightsBadge(x)}</div>${isCommish() ? `<button class="btn btn-sm btn-primary" data-queue="${x.id}">Queue</button>` : ''}</div>`).join('') || '<div class="card empty">No matching undrafted players.</div>'}
      </div>
    </section>`;

  return queueHtml + availableHtml;
}

function teamsView() {
  const max = Math.max(...state.teams.map(t => t.starting_budget), 1);
  return `
    <div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Team Budgets</h2><div class="small muted">${money(state.teams.reduce((s,t)=>s+t.remaining_budget,0))} remaining league-wide</div></div>
    <div class="team-grid">
      ${state.teams.map(t => {
        const spent = t.starting_budget - t.remaining_budget;
        const pct = Math.max(0, Math.min(100, (t.remaining_budget / max) * 100));
        return `<div class="team-row"><div><div class="team-name">${escapeHtml(t.name)}</div><div class="small muted">${wonCount(t.id)} won • ${money(spent)} spent • started ${money(t.starting_budget)}</div></div><div class="team-stats"><div class="team-budget">${money(t.remaining_budget)}</div></div><div class="budget-bar"><div class="budget-fill" style="width:${pct}%"></div></div></div>`;
      }).join('')}
    </div>`;
}

function logView() {
  return `
    <div class="row between gap-12 wrap" style="margin-bottom:12px"><h2 class="section-title">Auction Results</h2><div class="row gap-8 wrap"><a class="btn btn-sm btn-primary phase-button" href="/supplemental">Open Supplemental Draft →</a><a class="btn btn-sm btn-outline phase-button" href="/phase3">Phase 3 →</a><button class="btn btn-sm btn-outline" data-action="export">Export CSV</button></div></div>
    <div class="list-stack">
      ${state.sales.length ? state.sales.map(s => {
        const p = playerById(s.player_id); const t = teamById(s.team_id); const rights = p?.rights_team_id ? teamById(p.rights_team_id) : null;
        const canClaim = Boolean(isCommish() && rights && t && rights.id !== t.id);
        return `<div class="log-row rights-log-row"><div><div class="log-name">${escapeHtml(p?.name || 'Player')}</div><div class="small muted">${escapeHtml(p?.position || '')} ${escapeHtml(p?.nfl_team || '')} → ${escapeHtml(t?.name || 'Team')}</div>${rights ? `<div class="rights-note">Rookie rights: ${escapeHtml(rights.name)}${rights.id===t?.id ? ' • claimed' : ''}</div>` : ''}${canClaim ? `<button class="btn btn-sm btn-rights" data-rights-transfer="${p.id}" data-player-name="${escapeHtml(p.name)}" data-rights-name="${escapeHtml(rights.name)}" data-price="${s.price}">Transfer to rights holder for ${money(s.price)}</button>` : ''}</div><div class="log-price">${money(s.price)}</div></div>`;
      }).join('') : '<div class="card empty">No completed sales yet.</div>'}
    </div>`;
}

function bottomNav() {
  const items = [
    ['players','☷','Players'],
    ['action','⚡','Action'],
    ['teams','♟','Teams'],
    ['log','≡','Results'],
    ['myteam','♜','My Team'],
  ];
  return `<nav class="bottom-nav"><div class="bottom-nav-inner">${items.map(([tab,icon,label]) => `<button class="nav-btn ${state.tab===tab?'active':''}" data-tab="${tab}"><span>${icon}</span>${label}</button>`).join('')}</div></nav>`;
}

function loginView() {
  const options = state.teams.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  return `
    <div class="login-wrap">
      <div class="login-card">
        <div class="login-head"><h1>${escapeHtml(LEAGUE_NAME)}</h1><p>2026 Live Auction Room</p></div>
        <div class="login-body">
          <div class="field"><label for="join-team">Your team</label><select id="join-team" class="input"><option value="">Select your team…</option>${options}</select></div>
          <div class="field"><label for="team-pin">Team PIN</label><input id="team-pin" class="input pin-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit PIN" /></div>
          <div class="small muted" style="margin:-4px 0 15px">Commissioner controls are enabled automatically when Weiss Tea & Lemonade joins with its team PIN.</div>
          <div id="join-error"></div>
          <button class="btn btn-primary btn-block" data-action="join" style="margin-top:8px">Enter Auction Room</button>
          <button class="btn-link btn-block" data-action="spectate" style="margin-top:8px">View as spectator</button>
        </div>
      </div>
    </div>`;
}

function setupErrorView() {
  return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Auction App Ready</h1><p>Database connection still needs to be added.</p></div><div class="login-body"><div class="notice">Create a <code>.env</code> file from <code>.env.example</code>, add the Supabase project URL and anon key, then restart the app.</div></div></div></div>`;
}

function render() {
  if (!configured) { app.innerHTML = setupErrorView(); return; }
  if (state.loading) { app.innerHTML = `<div class="login-wrap"><div style="color:white;font-weight:900">Loading auction room…</div></div>`; return; }
  if (!state.session) { app.innerHTML = loginView(); bindEvents(); return; }
  let content = state.tab === 'players' ? playersView() : state.tab === 'teams' ? teamsView() : state.tab === 'log' ? logView() : state.tab === 'myteam' ? myTeamView() : actionView();
  app.innerHTML = `<div class="app-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;
  bindEvents();
  updateCountdown();
}

async function join() {
  unlockAudio();
  const teamId = document.querySelector('#join-team')?.value;
  const pin = document.querySelector('#team-pin')?.value.trim();
  const err = document.querySelector('#join-error');
  if (!teamId || !pin) { err.innerHTML = '<div class="error">Select your team and enter its PIN.</div>'; return; }
  try {
    await rpc('join_room', { p_room_code: ROOM_CODE, p_team_id: teamId, p_pin: pin });
    const selectedTeam = state.teams.find(t => t.id === teamId);
    let commishPin = null;
    if (selectedTeam?.name === COMMISH_TEAM_NAME) {
      const valid = await rpc('commish_login', { p_room_code: ROOM_CODE, p_pin: pin });
      if (!valid?.valid) throw new Error('Commissioner access is not configured for this team PIN.');
      commishPin = pin;
    }
    saveSession({ teamId, pin, commishPin, spectator: false });
    render();
  } catch (e) { err.innerHTML = `<div class="error">${escapeHtml(e.message)}</div>`; }
}

function spectate() { unlockAudio(); saveSession({ spectator: true, teamId: null, pin: null, commishPin: null }); render(); }
function logout() { saveSession(null); render(); }

async function submitBid() {
  const t = myTeam();
  if (!t) return;
  try {
    const result = await rpc('submit_bid', { p_room_code: ROOM_CODE, p_team_id: t.id, p_pin: state.session.pin });
    toast(`Bid accepted at ${money(result.bid)}.`);
    await loadData(); render();
  } catch (e) { toast(e.message, 'error'); scheduleRefresh(); }
}

async function commishCall(name, args = {}, success = '') {
  try {
    await rpc(name, { p_room_code: ROOM_CODE, p_commish_pin: state.session.commishPin, ...args });
    if (success) toast(success);
    await loadData(); render();
  } catch (e) { toast(e.message, 'error'); }
}

async function resetDraft() {
  if (!isCommish()) return;
  const confirmed = window.confirm(
    'RESET THE ENTIRE DRAFT?\n\nThis will restore every team to its starting budget, clear all bids and auction results, requeue all 40 players in rank order, and return the room to pre-draft setup.\n\nThis cannot be undone.'
  );
  if (!confirmed) return;
  await commishCall('commish_reset_draft', {}, 'Draft reset. All budgets and 40 players restored.');
}

async function transferRookieRights(button) {
  if (!isCommish()) return;
  const playerName = button.dataset.playerName || 'this player';
  const rightsName = button.dataset.rightsName || 'the rights holder';
  const price = Number(button.dataset.price || 0);
  const confirmed = window.confirm(`Transfer ${playerName} to ${rightsName} for the same ${price} bid dollars?\n\nThe original auction winner will be refunded ${price}; ${rightsName} will be charged ${price}.`);
  if (!confirmed) return;
  await commishCall('commish_transfer_rookie_rights', { p_player_id: button.dataset.rightsTransfer }, `${playerName} transferred to ${rightsName} for ${price} bids.`);
}

async function exportCsv() {
  const rows = [['Rank','Player','NFL Team','Position','Fantasy Team','Price']];
  for (const s of [...state.sales].reverse()) {
    const p = playerById(s.player_id); const t = teamById(s.team_id);
    rows.push([p?.rank ?? '', p?.name ?? '', p?.nfl_team ?? '', p?.position ?? '', t?.name ?? '', s.price]);
  }
  const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = 'GLSK-2026-auction-results.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function bindEvents() {
  app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
  app.querySelector('[data-action="join"]')?.addEventListener('click', join);
  app.querySelector('[data-action="spectate"]')?.addEventListener('click', spectate);
  app.querySelector('[data-action="logout"]')?.addEventListener('click', logout);
  app.querySelector('[data-action="toggle-sound"]')?.addEventListener('click', toggleSound);
  app.querySelector('[data-action="bid"]')?.addEventListener('click', submitBid);
  app.querySelector('[data-action="start-draft"]')?.addEventListener('click', () => commishCall('commish_start_draft', {}, 'Draft started.'));
  app.querySelector('[data-action="pause"]')?.addEventListener('click', () => commishCall('commish_pause_draft', {}, 'Auction paused.'));
  app.querySelector('[data-action="resume"]')?.addEventListener('click', () => commishCall('commish_resume_draft', {}, 'Auction resumed.'));
  app.querySelector('[data-action="skip"]')?.addEventListener('click', () => commishCall('commish_skip_active', {}, 'Player returned to undrafted.'));
  app.querySelector('[data-action="undo"]')?.addEventListener('click', () => commishCall('commish_undo_last_sale', {}, 'Last sale undone.'));
  app.querySelector('[data-action="reset-draft"]')?.addEventListener('click', resetDraft);
  app.querySelector('[data-action="force-sale"]')?.addEventListener('click', () => {
    const teamId = document.querySelector('#force-team')?.value;
    const price = Number(document.querySelector('#force-price')?.value || 0);
    commishCall('commish_force_sale', { p_team_id: teamId, p_price: price }, 'Manual sale completed.');
  });
  app.querySelector('[data-action="export"]')?.addEventListener('click', exportCsv);
  app.querySelectorAll('[data-rights-transfer]').forEach(b => b.addEventListener('click', () => transferRookieRights(b)));

  app.querySelectorAll('[data-queue]').forEach(b => b.addEventListener('click', () => commishCall('commish_queue_player', { p_player_id: b.dataset.queue }, 'Player queued.')));
  app.querySelectorAll('[data-unqueue]').forEach(b => b.addEventListener('click', () => commishCall('commish_unqueue_player', { p_player_id: b.dataset.unqueue }, 'Player removed from queue.')));

  const search = app.querySelector('#player-search');
  search?.addEventListener('input', e => { state.search = e.target.value; clearTimeout(search._t); search._t = setTimeout(render, 120); });
}

function updateCountdown() {
  const el = document.querySelector('#timer');
  if (!el || !state.room) return;
  if (state.room.status === 'paused') { el.textContent = 'PAUSE'; el.classList.add('danger'); return; }
  if (!state.room.auction_ends_at) { el.textContent = '--'; return; }
  const ms = new Date(state.room.auction_ends_at).getTime() - Date.now();
  const sec = Math.max(0, Math.ceil(ms / 1000));
  el.textContent = String(sec);
  el.classList.toggle('danger', sec <= 7);

  if (state.room.status === 'live' && state.room.active_player_id && sec > 0) {
    const countdownKey = `${state.room.active_player_id}:${sec}`;
    if (countdownKey !== audioState.lastCountdownKey) {
      audioState.lastCountdownKey = countdownKey;
      if (sec === 10) playSound('warning');
      else if (sec <= 5) playSound('countdown', { sec });
    }
  }

  if (ms <= 0 && !state.finalizing) finalizeExpired();
}

async function finalizeExpired() {
  if (state.finalizing || !state.room?.active_player_id) return;
  state.finalizing = true;
  try {
    await rpc('finalize_if_expired', { p_room_code: ROOM_CODE });
    await loadData(); render();
  } catch (e) { console.warn(e); }
  finally { state.finalizing = false; }
}

async function boot() {
  if (!configured) { state.loading = false; render(); return; }
  try {
    await loadData();
    subscribeRealtime();
    render();
    setInterval(updateCountdown, 250);
  } catch (e) {
    state.loading = false;
    app.innerHTML = `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>Connection Error</h1><p>The app could not load the auction room.</p></div><div class="login-body"><div class="error">${escapeHtml(e.message)}</div><p class="muted small">Make sure the Supabase SQL setup was run and the environment variables are correct.</p></div></div></div>`;
  }
}

document.addEventListener('pointerdown', unlockAudio, { once: true, passive: true });

boot();
