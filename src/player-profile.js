import {supabase} from './supabase.js';
import {ROOM_CODE} from './config.js';
import {normalizeName, profilePlayers, actionFor, dropFine, validateMove} from './player-profile-core.js';
import './player-profile.css';

let adapter, cached, dialog, trigger, current, busy = false, generation = 0;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString(undefined, {maximumFractionDigits:2});
const date = value => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString() : '—';
async function rpc(name, args) {
  const {data, error} = await supabase.rpc(name, args);
  if (error || data?.ok === false) throw new Error(error?.message || data?.error || 'Unable to complete this action.');
  return data;
}
async function rows(table, column, value) {
  const result = [];
  for (let start = 0;; start += 500) {
    const {data, error} = await supabase.from(table).select('*').eq(column, value).order('id').range(start, start + 499);
    if (error) throw error;
    result.push(...(data || []));
    if (!data || data.length < 500) return result;
  }
}
async function snapshot() {
  if (adapter) return adapter.read();
  const {data: room, error} = await supabase.from('rooms').select('id').eq('code', ROOM_CODE).single();
  if (error) throw error;
  let session = {};
  try { session = JSON.parse(localStorage.getItem(`glsk-auction-session-${ROOM_CODE}`)) || {}; } catch {}
  const seasons = await rows('league_seasons', 'room_id', room.id);
  const season = seasons.find(s => s.is_current) || seasons.sort((a,b) => b.season_year-a.season_year)[0];
  const [teams, roster, contracts] = await Promise.all([
    rows('teams', 'room_id', room.id), rows('league_roster_entries', 'room_id', room.id),
    season ? rows('league_contracts', 'season_id', season.id) : []
  ]);
  const optional = await Promise.allSettled([
    rows('players', 'room_id', room.id), rows('phase3_players', 'room_id', room.id),
    ...['league_player_stats','league_player_projections','league_weekly_player_scores'].map(t => season ? rows(t, 'season_id', season.id) : Promise.resolve([])),
    session.teamId && session.pin && !session.spectator ? rpc('league_owner_get_waiver_center', {p_room_code:ROOM_CODE,p_team_id:session.teamId,p_pin:session.pin}) : Promise.resolve(null)
  ]);
  const value = i => optional[i].status === 'fulfilled' ? optional[i].value : null;
  return {teams, roster, contracts, season, session, catalog:[...(value(0)||[]),...(value(1)||[])], playerStats:value(2)||[], playerProjections:value(3)||[], weeklyScores:value(4)||[], waiverCenter:value(5)};
}
window.GLSKPlayerProfiles = {
  register(value) { adapter = value; cached = value.read(); decorate(); },
  open(key) { openProfile(key); }
};
function allPlayers() { return cached ? profilePlayers(cached) : []; }
function resolve(identity, data) {
  const players = profilePlayers(data);
  const exact = players.find(p => p.player_key === identity);
  if (exact) return exact;
  const matches = players.filter(p => normalizeName(p.player_name) === normalizeName(identity));
  // A keyed roster/waiver record takes precedence over an unkeyed catalog duplicate.
  const keyed = matches.filter(p => p.player_key);
  return keyed.length === 1 ? keyed[0] : keyed.length === 0 && matches.length === 1 ? matches[0] : null;
}
function decorate() {
  if (!document.body || !cached) return;
  const names = new Set(allPlayers().map(p => normalizeName(p.player_name)));
  // Cover plain player names in tables, trades, history and dynamically rendered views.
  // Inputs, native options and existing action buttons keep their original behavior.
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const matches = [];
  while (walker.nextNode()) {
    const node = walker.currentNode, parent = node.parentElement;
    if (!parent || parent.closest('script,style,textarea,input,select,option,button,a,[contenteditable],.glsk-profile,[data-profile-key],[data-profile-name],.player-name,.player-row-name,.available-name,.supp-player-name,.contract-player,.log-name')) continue;
    const name = node.textContent.trim();
    if (name && names.has(normalizeName(name))) matches.push({node,name});
  }
  for (const {node,name} of matches) {
    const button = document.createElement('button');button.type='button';button.dataset.profileName=name;button.className='glsk-profile-inline glsk-profile-link';button.setAttribute('aria-haspopup','dialog');button.textContent=node.textContent;node.replaceWith(button);
  }
  const selectors = '.player-name,.player-row-name,.available-name,.supp-player-name,.contract-player,.log-name,[data-profile-key]';
  document.querySelectorAll(selectors).forEach(el => {
    if (el.closest('.glsk-profile')) return;
    const text = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim().replace(/^#\d+\s+/, '');
    if (!el.dataset.profileKey && !names.has(normalizeName(text))) return;
    if (!el.dataset.profileKey) el.dataset.profileName = text;
    if (el.dataset.profileReady) return;
    el.dataset.profileReady = 'true';
    if (el.tagName !== 'BUTTON' && el.tagName !== 'A') {el.setAttribute('role','button');el.tabIndex = 0;}
    el.classList.add('glsk-profile-link');
    el.setAttribute('aria-haspopup','dialog');
  });
}
function getDialog() {
  if (dialog) return dialog;
  dialog = document.createElement('dialog');dialog.className = 'glsk-profile';dialog.setAttribute('aria-labelledby','glsk-profile-title');
  document.body.appendChild(dialog);
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  dialog.addEventListener('close', () => {generation++;current = null;trigger?.isConnected && trigger.focus();});
  dialog.addEventListener('click', e => { if (e.target === dialog && !busy) dialog.close(); });
  return dialog;
}
async function openProfile(identity, source) {
  if (busy) return;
  trigger = source || document.activeElement;
  const box = getDialog(), ticket = ++generation;
  box.innerHTML = '<div class="gp-loading"><button type="button" class="gp-close" aria-label="Close profile">×</button><h2 id="glsk-profile-title">Player profile</h2><p role="status">Loading player details…</p></div>';
  box.querySelector('.gp-close').onclick = () => box.close();
  if (!box.open) box.showModal();
  try {
    cached = await snapshot();
    if (ticket !== generation || !box.open) return;
    const player = resolve(identity, cached);
    if (!player) throw new Error('A unique player record could not be found. Please open the player from the roster or free-agent list.');
    current = player;draw(player,cached);decorate();
  } catch (e) { if (ticket === generation) box.querySelector('[role="status"]').textContent = e.message; }
}
const statColumns = [['fantasy_points','Fan Pts'],['passing_yards','Pass Yds'],['passing_td','Pass TD'],['interceptions','INT'],['rushing_yards','Rush Yds'],['rushing_td','Rush TD'],['receptions','Rec'],['receiving_yards','Rec Yds'],['receiving_td','Rec TD']];
function statsTable(records, projected = false) {
  if (!records.length) return '<p class="gp-empty">No stats have been supplied for this view yet.</p>';
  return `<div class="gp-table-wrap"><table><thead><tr><th scope="col">Period</th>${statColumns.map(([,label])=>`<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${records.map(r=>`<tr><th scope="row">${esc(r.label || `Week ${r.week}`)}</th>${statColumns.map(([key])=>`<td>${fmt(r[projected && key === 'fantasy_points' ? 'projected_fantasy_points' : key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function draw(player, data) {
  const key = player.player_key, {owner,type} = actionFor(data,player);
  const team = data.teams?.find(t=>String(t.id)===String(owner?.team_id));
  const stats = data.playerStats?.find(p=>p.player_key===key) || {};
  const projections = (data.playerProjections || []).filter(p=>key && p.player_key===key).sort((a,b)=>a.week-b.week);
  const own = (data.roster || []).filter(r=>r.active!==false && String(r.team_id)===String(data.session?.teamId));
  const fine = dropFine(data,key);
  const image = player.headshot_url || player.photo_url;
  const safeImage = typeof image==='string' && /^https:\/\//.test(image);
  const initials = player.player_name.split(/\s+/).map(x=>x[0]).slice(0,2).join('');
  const availability = owner ? `Rostered by ${team?.name || 'another team'}` : player.availability==='waivers' ? 'On waivers' : player.availability==='free_agent' ? 'Free agent' : 'Availability not confirmed';
  dialog.innerHTML = `<div class="gp-shell"><header class="gp-hero"><button type="button" class="gp-close" aria-label="Close player profile">×</button><div class="gp-avatar">${safeImage?`<img src="${esc(image)}" alt="${esc(player.player_name)}">`:`<span>${esc(initials)}</span>`}</div><div class="gp-identity">${player.injury_status?`<span class="gp-injury">${esc(player.injury_status)}</span>`:''}<h2 id="glsk-profile-title">${esc(player.player_name)}</h2><p>${esc(player.position || '—')} <span>•</span> ${esc(player.nfl_team || 'NFL team unavailable')} ${player.jersey_number?`#${esc(player.jersey_number)}`:''} <span>•</span> Bye ${esc(player.bye_week ?? projections.find(p=>p.bye_week!=null)?.bye_week ?? '—')}</p><div class="gp-summary">${[['position_rank','Rank'],...statColumns.slice(0,4)].map(([k,l])=>`<div><strong>${fmt(stats[k])}</strong><span>${l}</span></div>`).join('')}</div></div><aside class="gp-action-card"><span class="gp-kicker">League availability</span><h3>${esc(availability)}</h3>${type?`<form id="gp-action-form">${type!=='drop'?`<label>Player to drop <select name="drop"><option value="">No drop</option>${own.map(r=>`<option value="${esc(r.player_key)}">${esc(r.player_name)}${dropFine(data,r.player_key)?` — $${dropFine(data,r.player_key)} fine`:''}</option>`).join('')}</select></label>${type==='claim'?'<label>FAAB bid <input name="bid" type="number" min="0" step="1" value="0" required></label>':''}`:`<p>Drop fine: $${fine} bid dollars</p>`}<button class="gp-primary ${type==='drop'?'gp-danger':''}" type="submit">${{drop:'− Drop player',add:'+ Add player',claim:'Submit waiver claim'}[type]}</button></form>`:`<p>${owner?'Only the owning team can drop this player.':data.waiverCenter?.settings?.enabled===false?'Adds and claims are currently paused.':'No roster action is currently available for this player.'}</p>`}<p class="gp-feedback" role="status" aria-live="polite"></p></aside></header><div class="gp-content"><div class="gp-tabs" role="tablist" aria-label="Player details">${['Game Log','Season Stats','Forecast'].map((label,i)=>`<button type="button" role="tab" id="gp-tab-${i}" aria-controls="gp-panel-${i}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-tab="${i}">${label}</button>`).join('')}</div>${[
    statsTable((data.weeklyScores||[]).filter(r=>key && r.player_key===key).sort((a,b)=>a.week-b.week).map(r=>({...r.raw_stats,...r}))),
    statsTable(Object.keys(stats).length?[{...stats,label:`${data.season?.season_year || ''} Season`}]:[]),
    statsTable(projections.map(p=>({...p,label:`Week ${p.week}${p.projection_source || p.source ? ` · ${p.projection_source || p.source}`:''}`})),true)
  ].map((html,i)=>`<section role="tabpanel" id="gp-panel-${i}" aria-labelledby="gp-tab-${i}" tabindex="0" ${i?'hidden':''}>${html}</section>`).join('')}</div></div>`;
  dialog.querySelector('.gp-close').onclick = () => {if(!busy)dialog.close();};
  dialog.querySelector('img')?.addEventListener('error',e=>{e.target.parentElement.textContent=initials;});
  const tabs = [...dialog.querySelectorAll('[role="tab"]')];
  function selectTab(index) {tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;dialog.querySelector(`#gp-panel-${i}`).hidden=i!==index;});tabs[index].focus();}
  tabs.forEach((tab,i)=>{tab.onclick=()=>selectTab(i);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!=null){e.preventDefault();selectTab(next);}};});
  dialog.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();perform(type,player,e.currentTarget);});
}
async function perform(type, player, form) {
  if (busy) return;
  const feedback = dialog.querySelector('.gp-feedback');
  busy = true;
  const controls = [...dialog.querySelectorAll('button,input,select')];
  const drop = form.elements.drop?.value || null, bid = Number(form.elements.bid?.value || 0);
  controls.forEach(el=>el.disabled=true);
  try {
    // Refresh ownership and availability before committing; the RPC also validates rules.
    if (adapter) await adapter.refresh();
    const fresh = await snapshot();
    validateMove(fresh,player,type,drop,bid);
    const dropped = fresh.roster.find(r=>r.player_key===drop);
    const message = type==='drop' ? `Drop ${player.player_name}? Contract fine: $${dropFine(fresh,player.player_key)} bid dollars.` : `${type==='claim'?`Submit a $${bid} waiver bid for`:'Add for $0:'} ${player.player_name}${dropped?` and drop ${dropped.player_name} (fine: $${dropFine(fresh,drop)} bid dollars)`:''}?`;
    if (!window.confirm(message)) return;
    const args = {p_room_code:ROOM_CODE,p_team_id:fresh.session.teamId,p_pin:fresh.session.pin,p_player_key:player.player_key};
    if(type!=='drop')args.p_drop_player_key=drop;
    if(type==='claim')args.p_bid_amount=bid;
    await rpc({drop:'league_owner_drop_player',add:'league_owner_add_free_agent',claim:'league_owner_submit_waiver_claim'}[type],args);
    feedback.textContent = type==='claim'?'Waiver claim saved.':'Roster updated.';
    // Never repeat a successful mutation if refreshing the page fails.
    try { if(adapter)await adapter.refresh(); cached=await snapshot();draw(resolve(player.player_key,cached)||player,cached);dialog.querySelector('.gp-feedback').textContent=type==='claim'?'Waiver claim saved.':'Roster updated.'; }
    catch { form.remove();feedback.textContent='Saved successfully. Reload the page to see updated roster data.'; }
    document.dispatchEvent(new CustomEvent('glsk:roster-updated'));
  } catch(e) {feedback.textContent=e.message;}
  finally {busy=false;controls.filter(el=>el.isConnected).forEach(el=>el.disabled=false);}
}
function handle(event) {
  const target = event.target.closest?.('[data-profile-key],[data-profile-name]');
  if(!target || target.closest('.glsk-profile'))return;
  if(event.type==='keydown' && !['Enter',' '].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();
  openProfile(target.dataset.profileKey || target.dataset.profileName,target);
}
document.addEventListener('click',handle,true);
document.addEventListener('keydown',handle,true);
function start() {
  let scheduled = false;
  new MutationObserver(records=>{if(records.every(r=>r.target.closest?.('.glsk-profile'))||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;decorate();});}).observe(document.body,{childList:true,subtree:true});
  // Deferred until shared Supabase has finished initializing (including circular imports).
  setTimeout(async()=>{try{cached=await snapshot();decorate();}catch{/* Existing pages remain usable if the profile catalog cannot load. */}},0);
}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
