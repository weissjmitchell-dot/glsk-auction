const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>v==null||v===''||!Number.isFinite(Number(v))?'—':Number(v).toLocaleString('en-US',{maximumFractionDigits:1});
const position=v=>v==='DST'?'DEF':v||'—';
const drafted=p=>['sold','drafted'].includes(p.status);
const initials=name=>String(name||'?').split(/\s+/).slice(0,2).map(x=>x[0]).join('');
export function createDraftRoom(phase,roomCode){
 let config,storageKey='',ui={queue:[],selected:null,search:'',position:'ALL',showDrafted:false};
 const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify({queue:ui.queue}));}catch{}};
 const pick=id=>config.players.find(p=>String(p.id)===String(id));
 const availableQueue=()=>ui.queue.map(pick).filter(p=>p&&!drafted(p));
 const selectButton=p=>`<button type="button" class="desk-player-name" data-desk-select="${esc(p.id)}">${esc(p.name)}</button>`;
 const star=p=>`<button type="button" class="desk-star ${ui.queue.includes(String(p.id))?'is-queued':''}" data-desk-star="${esc(p.id)}" aria-label="${ui.queue.includes(String(p.id))?'Remove from':'Add to'} queue: ${esc(p.name)}" aria-pressed="${ui.queue.includes(String(p.id))}" ${drafted(p)?'disabled':''}>${ui.queue.includes(String(p.id))?'★':'☆'}</button>`;
 const stat=(p,key)=>number(p.projection_stats?.[key]);
 function playerTable(){
  const rows=config.players.filter(p=>(ui.showDrafted||!drafted(p))&&(ui.position==='ALL'||position(p.position)===ui.position)&&(!ui.search||`${p.name} ${p.nfl_team} ${p.position}`.toLowerCase().includes(ui.search.toLowerCase()))).sort((a,b)=>(Number(a.yahoo_rank??a.rank??9999)-Number(b.yahoo_rank??b.rank??9999))||a.name.localeCompare(b.name));
  return `<div class="desk-filters"><label><span class="desk-sr">Position</span><select data-desk-position>${['ALL','QB','RB','WR','TE','K','DEF'].map(v=>`<option value="${v}" ${ui.position===v?'selected':''}>${v==='ALL'?'All positions':v}</option>`).join('')}</select></label><label class="desk-search"><span aria-hidden="true">⌕</span><input data-desk-search placeholder="Search for a player" aria-label="Search for a player" value="${esc(ui.search)}"></label><label class="desk-checkbox"><input type="checkbox" data-desk-drafted ${ui.showDrafted?'checked':''}>Show drafted</label><span class="desk-count">${rows.length} players</span></div>
  <div class="desk-table-scroll" data-desk-scroll="players"><table class="desk-player-table"><thead><tr><th scope="col">Queue</th><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Bye</th><th scope="col">Pass Yds</th><th scope="col">Rush Yds</th><th scope="col">Rec</th><th scope="col">Rec Yds</th><th scope="col">Status / Action</th></tr></thead><tbody>${rows.map(p=>`<tr class="${String(p.id)===String(ui.selected||config.activePlayer?.id)?'is-selected':''} ${drafted(p)?'is-drafted':''}"><td>${star(p)}</td><td>${number(p.yahoo_rank??p.rank)}</td><td>${selectButton(p)}<div class="desk-player-meta">${esc(p.nfl_team||'—')} · ${esc(position(p.position))}${p.rights_team_id?` · Rights: ${esc(config.teams.find(t=>t.id===p.rights_team_id)?.name||'Assigned')}`:''}</div></td><td>${number(p.bye)}</td><td>${stat(p,'PassYds')}</td><td>${stat(p,'RunYds')}</td><td>${stat(p,'REC')}</td><td>${stat(p,'RecYds')}</td><td>${drafted(p)?'Drafted':config.playerAction(p)||esc(p.status==='queued'?'Nominated':p.id===config.activePlayer?.id?'On the block':'Available')}</td></tr>`).join('')||'<tr><td colspan="9" class="desk-empty">No matching players.</td></tr>'}</tbody></table></div><div class="desk-data-note">${esc(config.sourceNote)}</div>`;
 }
 function preview(){
  const p=pick(ui.selected)||config.activePlayer||config.players.find(p=>!drafted(p));
  if(!p)return '<div class="desk-preview"><div><span class="desk-eyebrow">Player details</span><h2>No players available</h2></div></div>';
  return `<section class="desk-preview" aria-label="Player details"><div class="desk-avatar" aria-hidden="true">${esc(initials(p.name))}</div><div class="desk-preview-copy"><span class="desk-eyebrow">Player details</span><h2>${esc(p.name)}</h2><div>${esc(position(p.position))} · ${esc(p.nfl_team||'—')} · ${drafted(p)?'Drafted':p.id===config.activePlayer?.id?'On the block':'Available'}</div></div><dl><div><dt>Rank</dt><dd>${number(p.yahoo_rank??p.rank)}</dd></div><div><dt>Bye</dt><dd>${number(p.bye)}</dd></div></dl>${star(p)}</section>`;
 }
 function queueView(){
  const rows=availableQueue();
  return `<section class="desk-side-section"><h2>☆ My Queue <span>${rows.length}</span></h2><p class="desk-hint">Your shortlist on this device. Use the arrows to prioritize players.</p><div class="desk-queue" data-desk-scroll="queue">${rows.map((p,i)=>`<div class="desk-queue-row"><div>${selectButton(p)}<div class="desk-player-meta">${esc(position(p.position))} · ${esc(p.nfl_team||'—')}</div></div><div class="desk-queue-controls"><button data-desk-move="${esc(p.id)}" data-direction="-1" aria-label="Move ${esc(p.name)} up" ${i===0?'disabled':''}>↑</button><button data-desk-move="${esc(p.id)}" data-direction="1" aria-label="Move ${esc(p.name)} down" ${i===rows.length-1?'disabled':''}>↓</button><button data-desk-star="${esc(p.id)}" aria-label="Remove ${esc(p.name)} from queue">×</button></div></div>`).join('')||'<p class="desk-empty">Star a player in the table to add them here.</p>'}</div></section>`;
 }
 function rosterView(){
  const rank={QB:1,RB:2,WR:3,TE:4,K:5,DST:6,DEF:6};
  const rows=config.roster.filter(r=>r.active!==false).slice().sort((a,b)=>(rank[a.position]||9)-(rank[b.position]||9)||String(a.player_name).localeCompare(String(b.player_name)));
  return `<section class="desk-side-section"><h2>My Team <span>${rows.length}${config.rosterLimit?' / '+config.rosterLimit:''}</span></h2><p class="desk-team-title">${esc(config.myTeam?.name||'Sign in as an owner')}</p><div class="desk-roster" data-desk-scroll="roster">${rows.map(r=>`<div class="desk-roster-row"><span>${esc(position(r.position))}</span><div><strong>${esc(r.player_name)}</strong><small>${esc(r.nfl_team||'')}</small></div></div>`).join('')||'<p class="desk-empty">No players rostered yet.</p>'}</div><a class="desk-side-link" href="/league?tab=chat">Open League Chat ↗</a></section>`;
 }
 function view(c){
  config=c;
  const key=`glsk-draft-shortlist-${roomCode}-${phase}-${c.myTeam?.id||'guest'}`;
  if(key!==storageKey){storageKey=key;ui={queue:[],selected:null,search:'',position:'ALL',showDrafted:false};try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(Array.isArray(saved.queue))ui.queue=[...new Set(saved.queue.filter(x=>typeof x==='string'))];}catch{}}
  const activeTab=c.tabs.find(x=>x.active)?.key;
  const live=c.stageHtml.replace(/ id="(?:timer|supp-timer|phase3-timer)"/g,'');
  return `<div class="draft-desk"><aside class="desk-left"><section class="desk-clock"><div id="${esc(c.timerId)}" class="timer" role="timer" aria-label="Draft countdown">--</div><span class="desk-eyebrow">${esc(c.clockLabel)}</span><strong>${esc(c.clockDetail)}</strong><div class="desk-turn-note">${esc(c.turnNote)}</div></section><details class="desk-order" open><summary>${esc(c.orderTitle)}</summary><div class="desk-order-scroll" data-desk-scroll="order">${c.orderHtml||'<p class="desk-empty">Waiting for the draft order.</p>'}</div></details></aside>
  <main class="desk-center">${preview()}<div class="desk-live">${live}</div>${c.commissionerHtml?`<details class="desk-commissioner"><summary>Commissioner controls</summary>${c.commissionerHtml}</details>`:''}<section class="desk-workspace"><nav class="desk-tabs" aria-label="Draft views">${c.tabs.map(t=>`<button data-tab="${esc(t.key)}" class="${activeTab===t.key?'active':''}" aria-current="${t.active?'page':'false'}">${esc(t.label)}</button>`).join('')}</nav>${c.contentHtml==null?playerTable():`<div class="desk-other-panel" data-desk-scroll="panel">${c.contentHtml}</div>`}</section></main><aside class="desk-right">${queueView()}${rosterView()}</aside></div>`;
 }
 function bind(root,rerender){
  root.querySelectorAll('[data-desk-select]').forEach(b=>b.addEventListener('click',()=>{ui.selected=b.dataset.deskSelect;rerender();}));
  root.querySelectorAll('[data-desk-star]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.deskStar,p=pick(id);if(!p||drafted(p))return;ui.queue=ui.queue.includes(id)?ui.queue.filter(x=>x!==id):[...ui.queue,id];persist();rerender();}));
  root.querySelectorAll('[data-desk-move]').forEach(b=>b.addEventListener('click',()=>{const rows=availableQueue().map(p=>String(p.id)),i=rows.indexOf(b.dataset.deskMove),j=i+Number(b.dataset.direction);if(i<0||j<0||j>=rows.length)return;[rows[i],rows[j]]=[rows[j],rows[i]];ui.queue=rows;persist();rerender();}));
  root.querySelector('[data-desk-search]')?.addEventListener('input',e=>{ui.search=e.target.value;rerender();});
  root.querySelector('[data-desk-position]')?.addEventListener('change',e=>{ui.position=e.target.value;rerender();});
  root.querySelector('[data-desk-drafted]')?.addEventListener('change',e=>{ui.showDrafted=e.target.checked;rerender();});
 }
 function capture(root){
  const focused=root.querySelector('[data-desk-search]'),hasFocus=focused&&document.activeElement===focused,start=focused?.selectionStart,end=focused?.selectionEnd;
  const scrolls=[...root.querySelectorAll('[data-desk-scroll]')].map(e=>[e.dataset.deskScroll,e.scrollTop,e.scrollLeft]);
  const details=[...root.querySelectorAll('.desk-order,.desk-commissioner')].map(e=>[e.className,e.open]);
  return ()=>{if(hasFocus){const e=root.querySelector('[data-desk-search]');e?.focus({preventScroll:true});e?.setSelectionRange(start,end);}for(const [key,top,left] of scrolls){const e=root.querySelector(`[data-desk-scroll="${key}"]`);if(e){e.scrollTop=top;e.scrollLeft=left;}}for(const [cls,open]of details){const e=root.querySelector('.'+cls);if(e)e.open=open;}};
 }
 return {view,bind,capture};
}
