import {bidBankView,historicalBidView} from './bid-bank.js';
import './autocomplete.js';
import {rolloverView,bindRollover} from './season-rollover.js';
import './player-profile.js';
import './league.css';
import './auth.css';
import { supabase, configured } from './supabase.js';
import { ROOM_CODE, LEAGUE_NAME } from './config.js';
import { requireOwnerAccount, legacySessionFromAccount, signOutOwner, sendPasswordResetEmail, promptOwnerPush } from './auth.js';

// Keep the interaction styles with the controls so a stale stylesheet cannot
// expose the transparent native selectors as duplicate dropdowns.
const lineupInteractionStyle = document.createElement('style');
lineupInteractionStyle.id = 'glsk-lineup-interactions-v724';
lineupInteractionStyle.textContent = `
.roster-group-heading{padding:10px 14px;background:#edf1f6;color:#52647c;font-size:12px;font-weight:800;border-bottom:1px solid #dbe2ed}

.home-team-link{color:inherit;text-decoration:none;cursor:pointer}
.home-team-link:hover{text-decoration:underline}
.home-team-link:focus-visible{outline:3px solid #2276e8;outline-offset:4px;border-radius:3px}

.fa-player-browser{background:white;padding:22px 18px;border-radius:8px;color:#263443;margin-bottom:20px}
.fa-big-search{max-width:350px!important;border-radius:28px!important;border:2px solid #b9d2ff!important;height:52px;font-size:16px!important;margin-bottom:24px}
.fa-position-label{font-size:14px;color:#606c7a;margin-bottom:8px}
.fa-position-pills{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:24px}
.fa-position-pills button{border:1px solid #d9e0e9;border-radius:24px;background:white;padding:9px 18px;font-size:15px;color:#22354b;cursor:pointer}
.fa-position-pills button.active{background:#0765ed;color:white;border-color:#0765ed}
.fa-position-pills label{display:flex;gap:10px;align-items:center;margin-left:14px;font-size:15px}
.fa-position-pills input{width:22px;height:22px}
.fa-browser-filters{display:grid;grid-template-columns:repeat(6,minmax(130px,1fr));gap:18px}
.fa-browser-filters label{font-size:14px;color:#606c7a;display:grid;gap:8px}
.fa-browser-filters .input{font-size:14px;min-height:46px;width:100%}
.fa-table-caption{font-size:13px;color:#68778b;margin:22px 0 12px}
.fa-table-scroll{overflow:auto;max-height:75vh;border:1px solid #dce3eb}
.fa-stats-table{border-collapse:separate;border-spacing:0;min-width:1800px;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
.fa-stats-table th{background:#eff2f4;padding:12px 7px;white-space:nowrap;color:#263443;text-align:center;border-bottom:1px solid #dce3eb}
.fa-stats-table thead{position:sticky;top:0;z-index:2}
.fa-stats-table th button{font:inherit;font-weight:700;border:0;background:none;color:inherit;cursor:pointer;padding:0}
.fa-stats-table .fa-group-head th{font-weight:400;color:#62707d;padding:12px}
.fa-stats-table td{padding:16px 8px;border-bottom:1px solid #dce3eb;text-align:center;white-space:nowrap;background:white}
.fa-stats-table td:nth-child(2),.fa-stats-table td:nth-child(3){text-align:left}
.fa-stats-table tr.selected td{background:#f0f6ff}
.fa-stats-table td small{font-size:12px}
.fa-stats-table .fa-points{font-weight:800}
.fa-row-actions{display:flex;gap:10px;align-items:center}
.fa-row-actions button{background:none;border:0;font-size:27px;cursor:pointer;padding:4px}
.fa-add-icon{color:#008846}.fa-watch-icon{color:#0665ed}.fa-add-icon:disabled{opacity:.22;cursor:default}
.fa-player-identity{display:flex;align-items:center;gap:12px;min-width:280px}
.fa-player-identity img,.fa-player-initials{width:48px;height:48px;border-radius:50%;object-fit:cover;flex:none}
.fa-player-initials{display:grid;place-items:center;background:#edf3fb;color:#40618d;font-weight:700}
.fa-player-identity span:not(.fa-player-initials),.fa-player-identity small{display:block;margin-top:4px}
.fa-player-link{font:inherit;color:#0665ed;background:none;border:0;padding:0;text-align:left;cursor:pointer;font-size:16px}
.fa-player-link:disabled{cursor:default}
.fa-browser-management{display:block!important}.fa-browser-management .fa-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
@media(max-width:1000px){.fa-browser-filters{grid-template-columns:repeat(3,minmax(120px,1fr))}}
@media(max-width:600px){.fa-player-browser{padding:16px 10px}.fa-browser-filters{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.fa-position-pills{gap:6px}.fa-position-pills button{padding:8px 12px}.fa-browser-management .fa-side{grid-template-columns:1fr}}

.lineup-card-data .lineup-action-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 12px;background:white;border-bottom:1px solid #dbe1e8}
.lineup-card-data .lineup-optimize-button{border:1px solid #ccd5e9;border-radius:20px;background:white;color:#7f35bc;padding:8px 17px;font-size:14px;font-weight:700;cursor:pointer}
.lineup-card-data .lineup-optimize-button:disabled{color:#8892a1;cursor:default}
.lineup-selection-help{font-size:13px;color:#51647a}
.lineup-cancel-button{border:0;background:none;color:#1266c2;font-size:14px;text-decoration:underline;cursor:pointer}
.lineup-card-data .lineup-data-row{min-height:78px;font-size:13px;border-bottom:1px solid #dbe1e8;transition:background-color .12s}
.lineup-card-data .lineup-data-row.bench-row{background:#eee}
.lineup-card-data .lineup-data-row.lineup-selected{background:#ebebff}
.lineup-card-data .lineup-data-row.lineup-eligible{background:#bfe3bc;cursor:pointer}
.lineup-card-data .lineup-data-row.lineup-faded>div{opacity:.25}
.lineup-card-data .lineup-position-button{border:0;display:block;min-width:64px;padding:7px 10px;background:#0765ed;color:white;border-radius:22px;font-size:14px;font-weight:700;cursor:pointer}
.lineup-card-data .lineup-position-button:disabled{cursor:default}
.lineup-card-data .lineup-name-button{font:inherit;font-size:14px;color:#0665d9;background:transparent;border:0;padding:0;text-align:left;cursor:pointer;line-height:1.4}
.lineup-card-data .lineup-name-button:disabled{cursor:default}
.lineup-card-data .lineup-player-static span{font-size:12px;line-height:1.5;color:#233850;font-weight:400}
.lineup-card-data .lineup-inline-game{display:block;font-size:12px;color:#233850;line-height:1.4}
.lineup-card-data .lineup-yahoo-pos{padding-right:8px}
.lineup-card-data .lineup-data-head,.lineup-card-data .lineup-data-subhead{font-size:12px;background:#eff2f4}
.lineup-card-data button:focus-visible{outline:2px solid #1266c2;outline-offset:3px}
.lineup-card-data .lineup-data-scroller{overflow-x:auto}
.lineup-card-data .lineup-data-head,.lineup-card-data .lineup-data-subhead,.lineup-card-data .lineup-data-row{grid-template-columns:82px 280px 140px repeat(15,72px)!important;min-width:1582px}

.lineup-team-heading { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.lineup-team-heading .btn { flex:none; min-height:36px; font-size:13px; }
.lineup-optimize-note { display:block; margin:5px 0; color:#68758a; font-size:12px; font-weight:500; }

.lineup-card-data .lineup-position-target,
.lineup-card-data .lineup-bench-target { position: relative; }
.lineup-card-data .lineup-hit-select {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
  margin: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  cursor: pointer;
  z-index: 1;
  font-size: 16px;
}
.lineup-card-data .lineup-hit-select:disabled { cursor: default; }
.lineup-card-data .lineup-position-target:focus-within,
.lineup-card-data .lineup-bench-target:focus-within {
  outline: 2px solid #1266c2;
  outline-offset: 2px;
  border-radius: 5px;
}
.lineup-card-data .lineup-bench-target:has(select:not(:disabled)):hover strong {
  text-decoration: underline;
}
`;
document.getElementById(lineupInteractionStyle.id)?.remove();
document.head.appendChild(lineupInteractionStyle);
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&state.lineupSelection){state.lineupSelection=null;render();}});

const app = document.querySelector('#app');
const STORAGE_KEY = `glsk-auction-session-${ROOM_CODE}`;
const COMMISH_TEAM_NAME = 'Weiss Tea & Lemonade';

const state = {
  room:null, teams:[], season:null, roster:[], contracts:[], rules:[], distro:[], deadlines:[], deadlineStatus:[], finance:[], contractOptions:[],
  transactions:[], trades:[], tradeAssets:[], futurePicks:[], rookieRights:[], extensionCosts:[], extensionEligibility:[],
  historySeasons:[], historyTeamSeasons:[], historyAllTime:[], historyFranchises:[], historyImportRuns:[], playerStats:[],
  gameSettings:null, lineupSlots:[], weekStates:[], schedule:[], lineups:[], weeklyScores:[], matchupScores:[], shadowStandings:[], reconciliation:[], scoringRules:[], weeklyHostSettings:null, playerProjections:[],
  lineupDrafts:{}, lineupSaving:false, lineupSelection:null,
  lineupDataTab:'stats', lineupStatsRange:'week', lineupProjectionRange:'week', lineupBrowseWeek:null,
  matchupBrowseWeek:null, selectedMatchupId:null, scheduleTeamId:null,
  boardThreads:[], boardPosts:[], boardSelectedThread:null, boardMode:'current', boardSearch:'',
  chatMessages:[], chatYears:[], chatYear:null, chatUnread:0, chatHasMore:false, chatOldestAt:null,
  chatDisplayName:'', chatDraft:'', chatReplyTo:null, chatEditingId:null, chatReactionTarget:null, chatAutoScroll:true, chatError:null,
  notifications:[], notificationPrefs:[], notificationUnread:0, playerWatches:[], notificationPlayers:[], playerStatusUpdates:[],
  faNfl:'', faFantasy:'', faShowMine:false, faStats:'projected', faWeek:null, faSource:'', faSort:'points', faSortDesc:true,
  waiverCenter:null, waiverSearch:'', waiverPosition:'ALL', waiverStatus:'ALL', waiverSelectedPlayer:null,
  pushSupported:false, pushSubscribed:false, pushPermission:'default', pushStandalone:false, pushBusy:false,
  authUser:null, authAccount:null,
  session:loadSession(), tab:(new URLSearchParams(location.search).get('tab')||'home'), selectedTeamId:new URLSearchParams(location.search).get('team'), loading:true, realtime:null, txFilters:{team:'',type:'',search:''},
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
function commissionerToolsActive(){return isCommish()&&state.tab==='commissioner';}
function rosterFor(id){return state.roster.filter(r=>r.team_id===id&&r.active!==false);}
function activeRosterFor(id){return rosterFor(id).filter(r=>String(r.roster_slot||'ACTIVE').toUpperCase()!=='IR');}
function irRosterFor(id){return rosterFor(id).filter(r=>String(r.roster_slot||'ACTIVE').toUpperCase()==='IR');}
function irLimit(){return Number(state.weeklyHostSettings?.ir_slots??2);}
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

// Walk stable IDs until an empty page: even a server cap below 500 cannot
// silently truncate the imported board. Scope every page to this league.
async function qBoardAll(table,roomId){
 const rows=[];let after=null;
 for(;;){
   let query=supabase.from(table).select('*').eq('room_id',roomId).is('deleted_at',null).order('id',{ascending:true}).limit(500);
   if(after!==null)query=query.gt('id',after);
   const {data,error}=await query;
   if(error)throw error;
   if(!data?.length)return rows;
   const next=data[data.length-1].id;
   if(String(next)===String(after))throw new Error('Unable to load the complete message board. Please refresh.');
   rows.push(...data);after=next;
 }
}



function ensurePwaMetadata(){
  if(!document.querySelector('link[rel="manifest"]')){
    const l=document.createElement('link');l.rel='manifest';l.href='/manifest.webmanifest';document.head.appendChild(l);
  }
  if(!document.querySelector('meta[name="theme-color"]')){
    const m=document.createElement('meta');m.name='theme-color';m.content='#17263f';document.head.appendChild(m);
  }
  if(!document.querySelector('link[rel="apple-touch-icon"]')){
    const a=document.createElement('link');a.rel='apple-touch-icon';a.href='/glsk-icon-192.png';document.head.appendChild(a);
  }
  if(!document.querySelector('meta[name="apple-mobile-web-app-capable"]')){
    const m=document.createElement('meta');m.name='apple-mobile-web-app-capable';m.content='yes';document.head.appendChild(m);
  }
}
function isStandaloneApp(){
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);
}
function isIOSDevice(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
function base64UrlToUint8Array(value){
  const pad='='.repeat((4-value.length%4)%4),base64=(value+pad).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64),out=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);
  return out;
}
async function getPushRegistration(){
  if(!('serviceWorker' in navigator))return null;
  try{
    await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    return await navigator.serviceWorker.ready;
  }catch(e){console.warn('service worker',e.message);return null;}
}
async function refreshPushState(){
  state.pushSupported=Boolean('serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window);
  state.pushPermission=('Notification' in window)?Notification.permission:'denied';
  state.pushStandalone=isStandaloneApp();
  if(!state.pushSupported){state.pushSubscribed=false;return;}
  const reg=await getPushRegistration();
  const sub=reg?await reg.pushManager.getSubscription():null;
  state.pushSubscribed=Boolean(sub);
}
async function enablePushNotifications(){
  const t=myTeam();if(!t)return;
  if(!state.pushSupported)return toast('Push notifications are not supported in this browser.','error');
  if(isIOSDevice()&&!isStandaloneApp())return toast('On iPhone/iPad, add GLSK to your Home Screen first, then enable notifications from the Home Screen app.','error');
  if(state.pushBusy)return;
  state.pushBusy=true;render();
  try{
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Notification permission was not granted.');
    const reg=await getPushRegistration();
    if(!reg)throw new Error('GLSK could not start its notification service worker.');

    const cfgRes=await fetch('/api/push-config',{cache:'no-store'});
    if(!cfgRes.ok)throw new Error('Push configuration is not available yet.');
    const cfg=await cfgRes.json();
    if(!cfg.publicKey)throw new Error('VAPID public key is not configured.');

    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      sub=await reg.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:base64UrlToUint8Array(cfg.publicKey)
      });
    }

    const j=sub.toJSON(),keys=j.keys||{};
    const platform=navigator.userAgentData?.platform||navigator.platform||'Device';
    await rpc('league_owner_save_push_subscription',{
      p_room_code:ROOM_CODE,
      p_team_id:t.id,
      p_pin:state.session.pin,
      p_endpoint:j.endpoint,
      p_p256dh:keys.p256dh,
      p_auth:keys.auth,
      p_expiration_time:j.expirationTime||null,
      p_user_agent:navigator.userAgent,
      p_device_label:platform
    });

    await refreshPushState();
    toast('Phone/browser push notifications enabled.');
  }catch(e){toast(e.message,'error');}
  finally{state.pushBusy=false;render();}
}
async function disablePushNotifications(){
  const t=myTeam();if(!t||state.pushBusy)return;
  state.pushBusy=true;render();
  try{
    const reg=await getPushRegistration();
    const sub=reg?await reg.pushManager.getSubscription():null;
    if(sub){
      await rpc('league_owner_remove_push_subscription',{
        p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_endpoint:sub.endpoint
      });
      await sub.unsubscribe();
    }
    await refreshPushState();
    toast('Push notifications disabled on this device.');
  }catch(e){toast(e.message,'error');}
  finally{state.pushBusy=false;render();}
}
function renderPreservingInputFocus(id,start=null,end=null){
  render();
  requestAnimationFrame(()=>{
    const el=document.getElementById(id);
    if(!el)return;
    el.focus({preventScroll:true});
    if(typeof el.setSelectionRange==='function'&&start!=null){
      const len=String(el.value||'').length;
      const s=Math.min(Number(start),len);
      const e=Math.min(Number(end==null?start:end),len);
      try{el.setSelectionRange(s,e);}catch{}
    }
  });
}

function setTab(tab){
  if(tab==='reconcile'){state.commissionerSection='reconcile';tab='commissioner';}
  state.tab=tab==='commissioner'&&!isCommish()?'home':tab||'home';
  const u=new URL(location.href);
  if(state.tab==='team'&&state.selectedTeamId)u.searchParams.set('team',state.selectedTeamId);else u.searchParams.delete('team');
  if(state.tab==='home')u.searchParams.delete('tab');else u.searchParams.set('tab',state.tab);
  history.replaceState(null,'',u.pathname+(u.search?u.search:'')+u.hash);
  render();
  if(state.tab==='chat')setTimeout(()=>markChatRead(),60);
}

async function loadBidBank(){
 state.bidBank=null;
 try{const {data,error}=await supabase.rpc('league_get_bid_bank',{p_room_code:ROOM_CODE});if(error)throw error;state.bidBank=data;}catch(e){console.warn('Bid bank load',e.message);}
}
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


async function loadNotifications(){
  state.notifications=[];
  state.notificationPrefs=[];
  state.notificationUnread=0;
  state.playerWatches=[];
  const t=myTeam();
  if(!t||state.session?.spectator)return;
  try{
    const {data,error}=await supabase.rpc('league_get_notifications',{
      p_room_code:ROOM_CODE,
      p_team_id:t.id,
      p_pin:state.session.pin,
      p_limit:150
    });
    if(error)throw error;
    if(data?.ok===false)throw new Error(data.error||'Unable to load notifications.');
    state.notifications=data?.events||[];
    state.notificationPrefs=data?.preferences||[];
    state.notificationUnread=Number(data?.unread_count||0);
    state.playerWatches=data?.watches||[];
  }catch(e){console.warn('notification load',e.message);}
}



async function loadChat(older=false){
  const t=myTeam();
  if(!t||state.session?.spectator)return;
  if(state.chatYear==null)state.chatYear=Number(state.season?.season_year||2026);
  try{
    const {data,error}=await supabase.rpc('league_owner_get_chat',{
      p_room_code:ROOM_CODE,
      p_team_id:t.id,
      p_pin:state.session.pin,
      p_year:Number(state.chatYear),
      p_before:older?state.chatOldestAt:null,
      p_limit:120
    });
    if(error)throw error;
    if(data?.ok===false)throw new Error(data.error||'Unable to load League Chat.');
    const incoming=data?.messages||[];
    if(older){
      const ids=new Set(state.chatMessages.map(m=>String(m.id)));
      state.chatMessages=[...incoming.filter(m=>!ids.has(String(m.id))),...state.chatMessages];
    }else{
      state.chatMessages=incoming;
    }
    state.chatYears=(data?.years||[]).map(Number).filter(Boolean);
    if(!state.chatYears.includes(Number(data?.current_year||state.season?.season_year||2026))){
      state.chatYears.unshift(Number(data?.current_year||state.season?.season_year||2026));
    }
    state.chatYear=Number(data?.selected_year||state.chatYear);
    state.chatUnread=Number(data?.unread_count||0);
    state.chatDisplayName=data?.my_display_name||myTeam()?.name||'League Manager';
    state.chatHasMore=Boolean(data?.has_more);
    state.chatOldestAt=state.chatMessages[0]?.sent_at||data?.oldest_at||null;
    state.chatError=null;
  }catch(e){
    console.warn('chat load',e.message);
    state.chatError=e.message;
    if(!older){
      state.chatMessages=[];
      state.chatYears=[Number(state.season?.season_year||2026)];
      state.chatUnread=0;
    }
  }
}
async function markChatRead(){
  const t=myTeam();
  if(!t||state.chatError)return;
  try{
    await rpc('league_owner_mark_chat_read',{
      p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin
    });
    state.chatUnread=0;
    const badge=document.querySelector('.chat-nav-badge');
    if(badge)badge.remove();
  }catch(e){console.warn('mark chat read',e.message);}
}

async function loadWaiverCenter(){
  state.waiverCenter=null;
  const t=myTeam();
  if(!t||state.session?.spectator)return;
  try{
    const {data,error}=await supabase.rpc('league_owner_get_waiver_center',{
      p_room_code:ROOM_CODE,
      p_team_id:t.id,
      p_pin:state.session.pin
    });
    if(error)throw error;
    if(data?.ok===false)throw new Error(data.error||'Unable to load Free Agency.');
    state.waiverCenter=data||null;
    const players=data?.players||[];
    if(state.waiverSelectedPlayer&&!players.some(p=>p.player_key===state.waiverSelectedPlayer)){
      state.waiverSelectedPlayer=null;
    }
  }catch(e){
    console.warn('waiver center load',e.message);
    state.waiverCenter={ok:false,error:e.message,players:[],claims:[],priority:[],runs:[],settings:{}};
  }
}

async function loadData(){
  const {data:room,error:re}=await supabase.from('rooms').select('*').eq('code',ROOM_CODE).single(); if(re)throw re; state.room=room;
  const [teams,seasons,roster,contracts,rules,distro,deadlines,statuses,options,transactions,trades,tradeAssets,futurePicks,rookieRights,extensionCosts,extensionEligibility,historySeasons,historyTeamSeasons,historyAllTime,historyFranchises,historyImportRuns,playerStats,gameSettings,lineupSlots,weekStates,schedule,lineups,weeklyScores,matchupScores,shadowStandings,scoringRules,weeklyHostSettings,playerProjections,boardThreads,boardPosts,notificationPlayers,playerStatusUpdates]=await Promise.all([
    q('teams','*',[['room_id',room.id]]),q('league_seasons','*',[['room_id',room.id]]),q('league_roster_entries','*',[['room_id',room.id]]),
    q('league_contracts','*'),q('league_rule_settings','*'),q('redistribution_rules','*'),q('league_deadlines','*'),q('league_deadline_team_status','*'),q('contract_options','*'),
    q('league_transactions','*'),q('league_trades','*'),q('league_trade_assets','*'),q('league_future_picks','*',[['room_id',room.id]]),q('league_rookie_rights','*',[['room_id',room.id]]),q('league_extension_costs','*'),q('league_contract_extension_eligibility','*'),
    q('league_history_seasons','*',[['room_id',room.id]]),q('league_history_team_seasons','*'),q('league_history_all_time','*',[['room_id',room.id]]),q('league_franchises','*',[['room_id',room.id]]),q('league_history_import_runs','*',[['room_id',room.id]]),q('league_player_stats','*',[['room_id',room.id]]),
    q('league_game_settings','*'),q('league_lineup_slots','*'),q('league_week_states','*'),q('league_schedule','*'),q('league_lineups','*'),q('league_weekly_player_scores','*'),q('league_matchup_live_scores','*'),q('league_shadow_standings','*'),q('league_scoring_rules','*'),q('league_weekly_host_settings','*'),q('league_player_projections','*',[['room_id',room.id]]),
    qBoardAll('league_message_threads',room.id),qBoardAll('league_message_posts',room.id),
    q('phase3_players','id,name,nfl_team,position,status',[['room_id',room.id]]),q('league_player_status_updates','*',[['room_id',room.id]])
  ]);
  state.teams=teams.sort((a,b)=>a.sort_order-b.sort_order); state.season=seasons.find(s=>s.is_current)||seasons.sort((a,b)=>b.season_year-a.season_year)[0]||null;
  const {data:draftPlan}=await supabase.from('league_season_draft_plans').select('season_id,status').eq('season_id',state.season?.id||'00000000-0000-0000-0000-000000000000').maybeSingle();
  state.draftPreparation=draftPlan?.status==='preparation';
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
  state.boardThreads=boardThreads.filter(x=>x.status!=='archived').sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(new Date(b.last_activity_at)-new Date(a.last_activity_at)));
  state.boardPosts=boardPosts.filter(x=>x.status==='active').sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(state.boardSelectedThread&&!state.boardThreads.some(t=>String(t.id)===String(state.boardSelectedThread)))state.boardSelectedThread=null;
  state.notificationPlayers=notificationPlayers.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name)));
  state.playerStatusUpdates=playerStatusUpdates.filter(x=>x.season_id===sid);
  await Promise.all([loadFinance(),loadBidBank()]);
  await loadReconciliation();
  await loadNotifications();
  await loadWaiverCenter();
  await loadChat(false);
  await refreshPushState();
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
  return activeRosterFor(teamId).filter(r=>(slot.allowed_positions||[]).includes(String(r.position||'').toUpperCase())).sort((a,b)=>a.player_name.localeCompare(b.player_name));
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
 const t=myTeam();
 return `<header class="topbar office-topbar"><div class="topbar-inner office-topbar-inner">
   <button class="office-brand-button" data-tab="home" aria-label="League Office home">
     <div class="office-mark">GL</div>
     <div class="brand"><div class="brand-kicker">${state.season?.season_year||2026} • League Office</div><div class="brand-title">${esc(LEAGUE_NAME)}</div></div>
   </button>
   <div class="office-user-area">
     ${t?`<button class="notification-bell ${state.notificationUnread?'has-unread':''}" data-tab="notifications" aria-label="Notifications"><span class="notification-bell-icon">♢</span>${state.notificationUnread?`<b>${state.notificationUnread>99?'99+':state.notificationUnread}</b>`:''}</button>`:''}
     <div class="user-chip"><span class="status-dot live"></span><div class="user-chip-text"><div class="user-team">${t?`${esc(t.name)}${isCommish()?' • Commissioner':''}`:'Account Required'}</div><div class="user-budget">${t?'Connected':'League view'}</div></div><button class="btn-link office-account-link" data-tab="account">Account</button><button class="btn-link office-leave" data-action="leave">Sign Out</button></div>
   </div>
 </div></header>`;
}
function navGroupForTab(tab){
  if(['teamhub','lineup','contracts','trades'].includes(tab))return 'teamhub';
  if(['freeagents'].includes(tab))return 'freeagents';
  if(['communications','chat','board','notifications'].includes(tab))return 'communications';
  if(['leaguehub','teams','team','matchups','schedule','standings','transactions','history'].includes(tab))return 'leaguehub';
  if(['settingshub','commissioner','reconcile','rules','deadlines','finances'].includes(tab))return 'settingshub';
  if(['draft','biddollars','bidbank','bidhistory'].includes(tab))return 'draft';
  if(tab==='home')return 'home';
  return '';
}
function bottomNav(){
 const active=navGroupForTab(state.tab);
 const items=[
   ['home','⌂','Home'],
   ['leaguehub','☷','League'],
   ['teamhub','♟','Team'],
   ['freeagents','+','Free Agents'],
   ['communications','💬','Communication'],
   ['draft','⇅','Draft'],
   ['settingshub','⚙','Settings']
 ];
 return `<nav class="bottom-nav office-bottom-nav consolidated-nav"><div class="bottom-nav-inner" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items.map(([t,i,l])=>`<button class="nav-btn ${active===t?'active':''}" data-tab="${t}"><span class="nav-icon-wrap">${i}${t==='communications'&&state.chatUnread?`<b class="chat-nav-badge">${state.chatUnread>99?'99+':state.chatUnread}</b>`:''}</span>${l}</button>`).join('')}</div></nav>`;
}

function hubCard(tab,icon,title,body,badge=''){
  return `<button class="nav-hub-card" data-tab="${tab}">
    <div class="nav-hub-icon">${icon}</div>
    <div class="nav-hub-copy"><strong>${esc(title)}</strong><span>${esc(body)}</span></div>
    ${badge?`<b class="nav-hub-badge">${esc(badge)}</b>`:''}
    <div class="nav-hub-arrow">›</div>
  </button>`;
}
function teamHubView(){
  const me=myTeam();
  return `${pageHeading('My Team','Everything directly related to managing your franchise.','Team Management')}
    ${me?`<section class="card nav-hub-summary">
      <div><span>${esc(me.name)}</span><strong>${activeRosterFor(me.id).length}/${state.season?.roster_limit||18} active${irRosterFor(me.id).length?` + ${irRosterFor(me.id).length} IR`:''}</strong></div>
      <div><span>Bid Dollars</span><strong>${bidMoney(me.remaining_budget)}</strong></div>
      <div><span>Contract Cap</span><strong>${capUsed(me.id)}/100</strong></div>
    </section>`:''}
    <section class="nav-hub-grid nav-hub-grid-three">
      ${hubCard('lineup','☑','Lineup','Set starters, bench and weekly lineup decisions.')}
      ${hubCard('contracts','▤','Contracts','Contract years, salary-cap usage and contract actions.')}
      ${hubCard('trades','⇄','Trades','Build, send and review player, pick and bid-dollar trades.')}
    </section>`;
}
function communicationsHubView(){
  const boardCurrent=state.boardThreads.filter(t=>Number(t.season_year||state.season?.season_year||2026)===Number(state.season?.season_year||2026)).length;
  const unread=Number(state.notificationUnread||0);
  return `${pageHeading('Communication','League Chat, Message Board and alerts in one place.','League Community')}
    <section class="nav-hub-grid nav-hub-grid-three">
      ${hubCard('chat','💬','League Chat','Fast, realtime group conversation.',state.chatUnread?`${state.chatUnread} unread`:'')}
      ${hubCard('board','✎','Message Board','Longer-form discussions plus the Google Groups archive.',boardCurrent?`${boardCurrent} current`:'')}
      ${hubCard('notifications','♢','Notifications','League alerts, player watches and push preferences.',unread?`${unread} unread`:'')}
    </section>`;
}
function leagueHubView(){
  const week=Number(state.gameSettings?.current_week||1);
  return `${pageHeading('League','League-wide competition, rosters, activity and history.','League Information')}
    <section class="nav-hub-grid">
      ${hubCard('teams','♟','Teams & Rosters','View every franchise roster, IR, bids and ownership.')}
      ${hubCard('matchups','VS','Matchups',`Week ${week} scores, projections and starting lineups.`)}
      ${hubCard('schedule','◫','Schedule','Full regular-season schedule and team-by-team results.')}
      ${hubCard('standings','≡','Standings','League records, rankings and playoff positioning.')}
      ${hubCard('transactions','☷','Transactions','Adds, drops, trades, contracts, corrections and draft activity.')}
      ${hubCard('history','★','History','Champions, season records and franchise accomplishments.')}
    </section>`;
}
function settingsHubView(){
  const open=state.deadlines.filter(d=>d.status==='open').length;
  return `${pageHeading('Settings','League rules, deadlines and financial administration.','League Administration')}
    <section class="nav-hub-grid nav-hub-grid-three">
      ${hubCard('rules','⚙','Rules','Constitution, league settings and season configuration.')}
      ${hubCard('deadlines','◷','Deadlines','Contract, extension and commissioner deadlines.',open?`${open} open`:'')}
      ${hubCard('finances','$','Finances','League financial ledger and bid-dollar accounting.')}
      ${isCommish()?hubCard('commissioner','⚙','Commissioner','Roster corrections, waivers, approvals and all commissioner-adjustable tools.'):''}
    </section>`;
}

const commissionerSections=[
 ['rollover','Season Rollover','Preview the next season, confirm changes and undo an untouched rollover.'],
 ['teams','Rosters','Manual player additions and retirement or ban corrections.'],
 ['contracts','Contracts','Assign, update and void contracts; refresh extension costs.'],
 ['freeagents','Free Agency & Waivers','Manage the player pool, waiver timing, priority and processing.'],
 ['trades','Trade Approvals','Review pending trades and approve or deny them.'],
 ['lineup','Starting Positions','Configure the starting lineup slots.'],
 ['matchups','Schedule & Weekly Results','Edit weekly matchups and finalize results.'],
 ['reconcile','Reconciliation','Compare and save weekly Yahoo scores.'],
 ['rules','Rules & Redistribution','Edit league defaults and bid-dollar distribution.'],
 ['deadlines','Deadlines','Create, close, reopen and complete deadlines.'],
 ['finances','Finances','Record dues, prizes, adjustments and payment status.'],
 ['transactions','Transaction Corrections','Record a correction in the league ledger.'],
 ['history','Historical Franchises','Match imported teams to franchises.'],
 ['board','Message Board Moderation','Pin, lock or delete threads and remove messages.'],
 ['chat','Chat Moderation','Review and remove chat messages.']
];
function commissionerHubView(){
 if(!isCommish())return '<div class="card empty">Commissioner access is required.</div>';
 const section=commissionerSections.find(([key])=>key===state.commissionerSection);
 const heading=`<button class="btn btn-outline" data-tab="settingshub" style="margin-bottom:16px">‹ Settings</button>${pageHeading('Commissioner','All League Office administration tools in one place.','League Administration')}`;
 if(!section)return `${heading}<section class="nav-hub-grid">${commissionerSections.map(([key,title,description])=>`<button class="nav-hub-card" data-commissioner-section="${key}"><div class="nav-hub-copy"><strong>${esc(title)}</strong><span>${esc(description)}</span></div><div class="nav-hub-arrow">›</div></button>`).join('')}</section>`;
 const views={rollover:rolloverView,teams:teamsView,contracts:contractsView,freeagents:freeAgencyView,trades:tradesView,lineup:lineupSetupPanel,matchups:matchupsView,reconcile:reconcileView,rules:rulesView,deadlines:deadlinesView,finances:financesView,transactions:transactionsView,history:historyView,board:boardView,chat:chatView};
 return `${heading}<div class="row gap-8 wrap" style="margin-bottom:20px"><button class="btn btn-outline" data-commissioner-section="">‹ All Commissioner Tools</button><label>Section <select class="input" id="commissioner-section">${commissionerSections.map(([key,title])=>`<option value="${key}" ${key===section[0]?'selected':''}>${esc(title)}</option>`).join('')}</select></label></div>${views[section[0]]()}`;
}

function draftRoomsView(){
 if(state.draftPreparation)return `${pageHeading('Draft','Next-season draft preparation.','League Drafts')}<section class="card card-pad"><h2>Previous draft rooms archived</h2><p>The new season is in setup. Its player pools and draft rooms must be prepared before drafting resumes. The previous draft records have been preserved.</p></section>`;
 return `${pageHeading('Draft','Auction, supplemental and roster-fill draft rooms.','League Drafts')}<section class="office-section"><div class="office-section-head"><div><h2>Draft Rooms</h2><div class="section-caption">Choose a draft phase to open its room.</div></div></div><div class="draft-links"><a class="draft-link" href="/"><strong>⚡</strong><span>Auction</span><small>Top 40</small></a><a class="draft-link" href="/supplemental"><strong>↔</strong><span>Supplemental</span><small>2-round snake</small></a><a class="draft-link" href="/phase3"><strong>⇅</strong><span>Snake</span><small>Roster fill to 18</small></a></div></section>`;
}

function draftHubView(){return draftRoomsView()+`<div class="hub-grid" style="margin-top:20px">${hubCard('biddollars','$','Bid Dollars','Bid bank total and historical data.')}</div>`;}
function bidDollarsView(){return `${pageHeading('Bid Dollars','League bid bank and historical accounting.','Draft')}<div class="hub-grid">${hubCard('bidbank','$','Bid Bank total','Bid dollars collected for next season’s redistribution.')}${hubCard('bidhistory','↗','Historical Data','Auction stats, bid pool size by year and beginning bid trend.')}</div>`;}
function bidBankPage(){return `${pageHeading('Bid Bank total','Bid dollars collected for next season’s redistribution.','Draft → Bid Dollars')}<button class="btn btn-outline" data-tab="biddollars" style="margin-bottom:16px">‹ Bid Dollars</button>${bidBankView(state.bidBank)}`;}
function bidHistoryPage(){return `${pageHeading('Historical Data','Pre-auction workbook history.','Draft → Bid Dollars')}<button class="btn btn-outline" data-tab="biddollars" style="margin-bottom:16px">‹ Bid Dollars</button>${historicalBidView(state.bidHistoryTab||'auction')}`;}

function dashboard(){
 const rosterLimit=state.season?.roster_limit||18,full=state.teams.filter(t=>activeRosterFor(t.id).length>=rosterLimit).length,totalBids=state.teams.reduce((s,t)=>s+Number(t.remaining_budget||0),0),open=state.deadlines.filter(d=>d.status==='open').length;
 const next=state.deadlines.find(d=>d.status==='open'&&new Date(d.due_at)>new Date());
 const me=myTeam();
 return `<section class="office-hero office-home-hero"><div><div class="office-kicker">${state.season?.season_year||2026} League Year</div><h1>League Office</h1><p>Your GLSK home base. Manage your team, browse the league and stay connected from the tabs below.</p></div>${me?`<div class="home-team-summary"><span>Your Team</span><strong>${homeTeamLink(me)}</strong><div>${activeRosterFor(me.id).length}/${rosterLimit} roster${irRosterFor(me.id).length?` + ${irRosterFor(me.id).length} IR`:''} • ${bidMoney(me.remaining_budget)} bids • ${capUsed(me.id)}/100 cap</div></div>`:''}</section>
 <div class="kpi-grid office-kpi-grid"><div class="card kpi"><div class="kpi-label">Full Rosters</div><div class="kpi-value">${full}<span class="kpi-denom">/12</span></div><div class="kpi-sub">${rosterLimit}-player limit</div></div><div class="card kpi"><div class="kpi-label">Bid Dollars</div><div class="kpi-value">${totalBids}</div><div class="kpi-sub">remaining league-wide</div></div><div class="card kpi"><div class="kpi-label">Contracts</div><div class="kpi-value">${state.contracts.filter(c=>c.status==='active').length}</div><div class="kpi-sub">active contracts</div></div><div class="card kpi"><div class="kpi-label">Open Deadlines</div><div class="kpi-value">${open}</div><div class="kpi-sub">need attention</div></div></div>
 ${next?`<div class="owner-banner office-deadline-banner"><div><span class="banner-label">NEXT DEADLINE</span><strong>${esc(next.title)}</strong></div><div>${fmtDate(next.due_at)}</div></div>`:''}
 <div class="office-home-grid"><section class="office-section"><div class="office-section-head"><div><h2>League Snapshot</h2><div class="section-caption">Roster, bid and cap status at a glance</div></div><button class="btn btn-sm btn-outline" data-tab="teams">View Rosters</button></div>${teamCards()}</section></div>`;
}
function homeTeamLink(team){
 return `<a class="home-team-link" href="?tab=team&team=${encodeURIComponent(team.id)}" data-open-team="${esc(team.id)}">${esc(team.name)}</a>`;
}
function teamPageView(){
 const team=state.teams.find(t=>String(t.id)===String(state.selectedTeamId));
 if(!team)return `<section class="card card-pad"><h1>Team not found</h1><button class="btn btn-outline" data-tab="teams">View All Teams</button></section>`;
 return `<button class="btn btn-outline" data-tab="teams" style="margin-bottom:16px">‹ All Teams</button>${teamsView(team.id)}`;
}
function teamCards(){
 const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;
 return `<div class="team-office-grid compact-team-grid">${state.teams.map(t=>{
   const rc=activeRosterFor(t.id).length,irc=irRosterFor(t.id).length,cu=capUsed(t.id);
   return `<div class="card office-team-card compact-team-card"><div class="team-card-top"><div class="office-team-name">${homeTeamLink(t)}</div><span class="team-roster-pill">${rc}/${lim}${irc?` +${irc} IR`:''}</span></div><div class="team-card-bars"><div class="mini-progress"><span style="width:${Math.min(100,rc/lim*100)}%"></span></div><div class="team-card-meta"><span><b>${bidMoney(t.remaining_budget)}</b> bids</span><span><b>${cu}/${cap}</b> cap</span><span><b>${contractsFor(t.id).length}</b> contracts</span></div></div></div>`;
 }).join('')}</div>`;
}
function commissionerAddPlayerForm(){
 if(!commissionerToolsActive())return '';
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



function chatMessageById(id){return state.chatMessages.find(m=>String(m.id)===String(id))||null;}
function chatInitials(name='GL'){return String(name||'GL').split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase();}
function chatTime(v){
  if(!v)return '';
  return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(new Date(v));
}
function chatDayKey(v){
  const d=new Date(v);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function chatDayLabel(v){
  const d=new Date(v),today=new Date(),yesterday=new Date(Date.now()-86400000);
  if(chatDayKey(d)===chatDayKey(today))return 'Today';
  if(chatDayKey(d)===chatDayKey(yesterday))return 'Yesterday';
  return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:d.getFullYear()===today.getFullYear()?undefined:'numeric'}).format(d);
}
function chatView(){
  const me=myTeam();
  if(!me)return `${pageHeading('League Chat','Realtime GLSK group chat.','League Community')}<div class="card empty">Sign in to use League Chat.</div>`;

  if(state.chatError){
    return `${pageHeading('League Chat','Realtime GLSK group chat.','League Community')}
      <section class="card card-pad office-section">
        <div class="office-section-head"><div><h2>Setup Required</h2><div class="section-caption">Run the GLSK v7.1.1 League Chat migration, then refresh.</div></div></div>
        <div class="error">${esc(state.chatError)}</div>
      </section>`;
  }

  const currentYear=Number(state.season?.season_year||2026);
  const editing=state.chatEditingId?chatMessageById(state.chatEditingId):null;
  const reply=state.chatReplyTo?chatMessageById(state.chatReplyTo):null;
  let lastDay=null;

  return `${pageHeading('League Chat','Fast, realtime league conversation. Message Board remains available for longer-form discussions.','League Community')}
    <section class="card chat-card">
      <div class="chat-toolbar">
        <div class="chat-room-title">
          <div class="chat-live-dot"></div>
          <div><strong>GLSK League Chat</strong><span>${state.chatYear===currentYear?'Live conversation':`${state.chatYear} archive`}</span></div>
        </div>
        <div class="chat-toolbar-actions">
          <label class="chat-year-control"><span>Year</span><select id="chat-year" class="input">
            ${state.chatYears.map(y=>`<option value="${y}" ${Number(state.chatYear)===Number(y)?'selected':''}>${y}${Number(y)===currentYear?' • Current':''}</option>`).join('')}
          </select></label>
          <button class="btn btn-sm btn-outline" data-action="chat-change-name">Posting as ${esc(state.chatDisplayName)}</button>
        </div>
      </div>

      <div id="chat-message-list" class="chat-message-list">
        ${state.chatHasMore?'<div class="chat-load-older"><button class="btn btn-sm btn-outline" data-action="chat-load-older">Load Older Messages</button></div>':''}
        ${state.chatMessages.length?state.chatMessages.map(m=>{
          const day=chatDayKey(m.sent_at),dateSep=day!==lastDay?`<div class="chat-date-separator"><span>${esc(chatDayLabel(m.sent_at))}</span></div>`:'';
          lastDay=day;
          const removed=m.status==='removed';
          const imported=m.source==='google_groups';
          const replyText=m.reply_body?String(m.reply_body).replace(/\s+/g,' ').slice(0,125):'';
          const reactionPicker=state.chatReactionTarget===String(m.id);
          return `${dateSep}<article class="chat-row ${m.is_mine?'mine':''} ${imported?'imported':''}" data-chat-message="${m.id}">
            ${m.is_mine?'':`<div class="chat-avatar">${esc(chatInitials(m.author_display_name||m.team_name))}</div>`}
            <div class="chat-message-wrap">
              <div class="chat-author-line">
                ${m.is_mine?'':`<strong>${esc(m.author_display_name||m.team_name||'GLSK Member')}</strong><span>${m.team_name&&m.author_display_name!==m.team_name?esc(m.team_name):''}</span>`}
                ${imported?'<em>Imported from Google Groups</em>':''}
              </div>
              <div class="chat-bubble ${removed?'removed':''}">
                ${m.source_subject?`<div class="chat-source-subject">${esc(m.source_subject)}</div>`:''}
                ${m.reply_to_message_id?`<button class="chat-reply-quote" data-chat-jump="${m.reply_to_message_id}">
                  <strong>${esc(m.reply_author_display_name||m.reply_team_name||'Message')}</strong>
                  <span>${esc(replyText||'[Message unavailable]')}</span>
                </button>`:''}
                <div class="chat-body">${removed?'<em>Message removed</em>':esc(m.body).replaceAll('\n','<br>')}</div>
              </div>
              <div class="chat-meta">
                <span>${chatTime(m.sent_at)}${m.edited_at?' • edited':''}</span>
                ${!removed?`<button data-chat-reply="${m.id}">Reply</button><button data-chat-react="${m.id}">React</button>${m.can_edit&&(m.is_mine||commissionerToolsActive())?`<button data-chat-edit="${m.id}">Edit</button>`:''}${m.can_delete&&(m.is_mine||commissionerToolsActive())?`<button class="danger" data-chat-delete="${m.id}">Remove</button>`:''}`:''}
              </div>
              ${(m.reactions||[]).length?`<div class="chat-reactions">${m.reactions.map(r=>`<button class="${r.mine?'mine':''}" data-chat-reaction-message="${m.id}" data-chat-reaction-emoji="${esc(r.emoji)}">${esc(r.emoji)} <b>${r.count}</b></button>`).join('')}</div>`:''}
              ${reactionPicker&&!removed?`<div class="chat-reaction-picker">${['👍','😂','❤️','🔥','👀'].map(e=>`<button data-chat-reaction-message="${m.id}" data-chat-reaction-emoji="${e}">${e}</button>`).join('')}</div>`:''}
            </div>
          </article>`;
        }).join(''):`<div class="chat-empty"><div>💬</div><strong>${state.chatYear===currentYear?'Start the GLSK League Chat':'No imported messages in this year yet.'}</strong><span>${state.chatYear===currentYear?'Send the first live message below.':'Google Groups history will appear here after the archive is imported.'}</span></div>`}
      </div>

      ${state.chatYear===currentYear?`<div class="chat-composer">
        ${editing?`<div class="chat-compose-context"><div><strong>Editing message</strong><span>${esc(editing.body.slice(0,120))}</span></div><button data-action="chat-cancel-context">×</button></div>`:
          reply?`<div class="chat-compose-context"><div><strong>Replying to ${esc(reply.author_display_name||reply.team_name||'message')}</strong><span>${esc(String(reply.body||'').replace(/\s+/g,' ').slice(0,120))}</span></div><button data-action="chat-cancel-context">×</button></div>`:''}
        <div class="chat-compose-row">
          <textarea id="chat-compose" class="input chat-compose-input" maxlength="3000" rows="1" placeholder="${editing?'Edit your message…':`Message GLSK as ${esc(state.chatDisplayName)}…`}">${esc(state.chatDraft)}</textarea>
          <button class="btn btn-primary chat-send" data-action="chat-send">${editing?'Save':'Send'}</button>
        </div>
        <div class="chat-compose-help">Enter to send • Shift+Enter for a new line</div>
      </div>`:`<div class="chat-archive-note">Viewing the ${state.chatYear} archive. Switch to ${currentYear} to send live messages.</div>`}
    </section>`;
}

function boardThreadById(id){return state.boardThreads.find(t=>String(t.id)===String(id))||null;}
function boardPostsFor(threadId){return state.boardPosts.filter(p=>String(p.thread_id)===String(threadId));}
function boardAuthorName(item){
 const team=item?.author_team_id?teamById(item.author_team_id):null;
 return item?.author_display_name||team?.name||'GLSK Member';
}
function boardInitials(item){
 return boardAuthorName(item).split(/\s+/).filter(Boolean).map(x=>x[0]).join('').slice(0,2).toUpperCase()||'GL';
}
function boardArchiveAttachments(item){
 const raw=item?.source_metadata;
 const meta=raw&&typeof raw==='object'?raw:{};
 const attachments=Array.isArray(meta.attachments)?meta.attachments.filter(Boolean):[];
 if(!attachments.length)return '';
 return `<div class="board-archive-attachments"><strong>📎 Attachment${attachments.length===1?'':'s'} from Google Groups</strong>${attachments.map(a=>`<span>${esc(a)}</span>`).join('')}</div>`;
}
function boardView(){
 const me=myTeam();
 const currentYear=Number(state.season?.season_year||2026);
 const archiveYears=[...new Set(
   state.boardThreads
     .filter(t=>t.source==='google_groups' && Number(t.season_year||currentYear)!==currentYear)
     .map(t=>Number(t.season_year||currentYear))
 )].sort((a,b)=>b-a);

 if(!state.boardMode)state.boardMode='current';

 const archiveMatch=String(state.boardMode).match(/^archive:(\d{4})$/);
 let archiveYear=archiveMatch?Number(archiveMatch[1]):null;
 if(archiveYear===currentYear){
   state.boardMode='current';
   archiveYear=null;
 }
 const isArchive=Boolean(archiveYear);

 const search=String(state.boardSearch||'').trim().toLowerCase();

 let threads=state.boardThreads.filter(t=>{
   if(isArchive){
     return t.source==='google_groups' && Number(t.season_year||currentYear)===archiveYear;
   }
   return Number(t.season_year||currentYear)===currentYear;
 });

 if(search){
   threads=threads.filter(t=>`${t.title||''} ${t.body||''} ${boardAuthorName(t)} ${t.source_subject||''}`.toLowerCase().includes(search));
 }

 threads=threads.sort((a,b)=>(Number(b.pinned)-Number(a.pinned))||(new Date(b.last_activity_at)-new Date(a.last_activity_at)));

 let selected=threads.find(t=>String(t.id)===String(state.boardSelectedThread))||threads[0]||null;
 if(selected&&String(state.boardSelectedThread)!==String(selected.id))state.boardSelectedThread=selected.id;
 if(!selected)state.boardSelectedThread=null;

 const posts=selected?boardPostsFor(selected.id):[];
 const authorName=selected?boardAuthorName(selected):'';
 const googleImported=selected?.source==='google_groups';
 const imported=googleImported&&isArchive;
 const currentGoogle=googleImported&&!isArchive;
 const synced=selected?.source==='google_groups_sync';

 const boardTitle=isArchive?`${archiveYear} Google Groups Archive`:'Current Message Board';
 const boardSub=isArchive
   ?`${threads.length} historical discussion${threads.length===1?'':'s'} • read-only`
   :`${threads.length} current discussion${threads.length===1?'':'s'}`;

 return `${pageHeading('Message Board','Structured league discussions plus the complete Google Groups discussion archive. League Chat remains separate for realtime conversation.','League Community')}

 <section class="card board-archive-toolbar">
   <div class="board-archive-summary">
     <strong>${boardTitle}</strong>
     <span>${boardSub}</span>
   </div>
   <div class="board-archive-controls">
     <input id="board-search" class="input" placeholder="Search discussions" value="${esc(state.boardSearch)}">
     <select id="board-mode" class="input">
       <option value="current" ${!isArchive?'selected':''}>Current Board</option>
       ${archiveYears.map(y=>`<option value="archive:${y}" ${archiveYear===y?'selected':''}>${y} Archive</option>`).join('')}
     </select>
   </div>
 </section>

 ${me&&!state.session?.spectator&&!isArchive?`<section class="card card-pad office-section board-compose-card">
   <div class="office-section-head"><div><h2>Start a Discussion</h2><div class="section-caption">Posting as ${esc(state.chatDisplayName||me.name)} • ${esc(me.name)}</div></div></div>
   <div class="board-compose-grid">
     <input id="board-thread-title" class="input" maxlength="120" placeholder="Discussion title">
     <textarea id="board-thread-body" class="input board-textarea" maxlength="5000" placeholder="What do you want to talk about?"></textarea>
     <div class="board-compose-actions"><span>Use League Chat for quick conversation; use the Board for longer topics and announcements.</span><button class="btn btn-primary" data-action="board-create-thread">Post Discussion</button></div>
   </div>
 </section>`:''}

 <div class="board-layout">
   <section class="card board-thread-list">
     <div class="board-list-head">
       <div><strong>Discussions</strong><span>${threads.length} shown</span></div>
       ${isArchive?'<span class="board-google-archive-chip">Google Groups Archive</span>':''}
     </div>
     <div class="board-thread-items">${threads.length?threads.map(t=>{
       const active=selected&&String(selected.id)===String(t.id);
       const isImport=t.source==='google_groups'&&isArchive,isCurrentGoogle=t.source==='google_groups'&&!isArchive,isSync=t.source==='google_groups_sync';
       return `<button class="board-thread-item ${active?'active':''}" data-board-thread="${t.id}">
         <div class="board-thread-title-row"><strong>${t.pinned?'📌 ':''}${esc(t.title)}</strong>${isImport?'<span class="board-import-chip">ARCHIVE</span>':isCurrentGoogle?'<span class="board-sync-chip">GOOGLE GROUP</span>':isSync?'<span class="board-sync-chip">GROUP SYNC</span>':t.status==='locked'?'<span class="board-status-chip">LOCKED</span>':''}</div>
         <div class="board-thread-preview">${esc((t.body||'').length>115?t.body.slice(0,115)+'…':t.body||'')}</div>
         <div class="board-thread-meta"><span>${esc(boardAuthorName(t))}</span><span>${Number(t.reply_count||0)} repl${Number(t.reply_count||0)===1?'y':'ies'}</span><span>${fmtDate(t.last_activity_at)}</span></div>
       </button>`;
     }).join(''):`<div class="board-empty"><strong>${isArchive?'No archived discussions found.':'No current discussions yet.'}</strong><span>${search?'Try a different search.':isArchive?'No Google Groups topics were found for this year.':'Start the first current GLSK message-board thread.'}</span></div>`}</div>
   </section>

   <section class="card board-discussion">
     ${selected?`<div class="board-discussion-head">
       <div>
         <div class="board-thread-flags">${selected.pinned?'<span>PINNED</span>':''}${imported?'<span class="google">GOOGLE GROUPS ARCHIVE</span>':currentGoogle?'<span class="sync">GOOGLE GROUP • CURRENT SEASON</span>':synced?'<span class="sync">GOOGLE GROUP SYNC</span>':selected.status==='locked'?'<span>LOCKED</span>':''}</div>
         <h2>${esc(selected.title)}</h2>
         <div class="board-discussion-meta">Started by <strong>${esc(authorName)}</strong> • ${fmtDate(selected.created_at)}${imported?' • Original Google Groups timestamp':currentGoogle?' • Imported from the 2026 Google Group • GLSK replies stay here':synced?' • Synced from Google Groups • GLSK replies stay here':''}</div>
       </div>
       ${commissionerToolsActive()?`<div class="board-mod-actions">
         ${!imported?`
         <button class="btn btn-sm btn-outline" data-board-action="${selected.pinned?'unpin':'pin'}" data-thread-id="${selected.id}">${selected.pinned?'Unpin':'Pin'}</button>
         <button class="btn btn-sm btn-outline" data-board-action="${selected.status==='locked'?'unlock':'lock'}" data-thread-id="${selected.id}">${selected.status==='locked'?'Unlock':'Lock'}</button>
         <button class="btn btn-sm btn-reset" data-board-action="archive" data-thread-id="${selected.id}">Archive</button>`:''}
         <button class="btn btn-sm btn-reset" data-board-delete-thread="${selected.id}">Delete Thread</button>
       </div>`:''}
     </div>

     <article class="board-root-post ${imported?'board-imported-post':(currentGoogle||synced)?'board-synced-post':''}">
       <div class="board-avatar">${esc(boardInitials(selected))}</div>
       <div>
         <div class="board-post-author"><strong>${esc(authorName)}</strong><span>${fmtDate(selected.created_at)}</span>${imported?'<em>Imported</em>':currentGoogle?'<em class="sync">Google Group</em>':synced?'<em class="sync">Synced</em>':''}</div>
         <div class="board-post-body">${esc(selected.body||'').replaceAll('\n','<br>')}</div>
         ${boardArchiveAttachments(selected)}
       </div>
     </article>

     <div class="board-replies-head"><strong>${posts.length} ${posts.length===1?'Reply':'Replies'}</strong></div>
     <div class="board-replies">${posts.map(p=>{
       const pImported=p.source==='google_groups'&&isArchive,pCurrentGoogle=p.source==='google_groups'&&!isArchive,pSynced=p.source==='google_groups_sync';
       return `<article class="board-reply ${pImported?'board-imported-post':(pCurrentGoogle||pSynced)?'board-synced-post':''}">
         <div class="board-avatar">${esc(boardInitials(p))}</div>
         <div>
           <div class="board-post-author"><strong>${esc(boardAuthorName(p))}</strong><span>${fmtDate(p.created_at)}</span>${pImported?'<em>Imported</em>':pCurrentGoogle?'<em class="sync">Google Group</em>':pSynced?'<em class="sync">Synced</em>':''}</div>
           <div class="board-post-body">${esc(p.body||'').replaceAll('\n','<br>')}</div>
           ${commissionerToolsActive()?`<button class="btn btn-sm btn-reset board-delete-message" data-board-delete-post="${p.id}" data-thread-id="${selected.id}">Delete Message</button>`:''}
           ${boardArchiveAttachments(p)}
         </div>
       </article>`;
     }).join('')||'<div class="board-no-replies">No replies.</div>'}</div>

     ${me&&!state.session?.spectator&&!isArchive&&['live','google_groups','google_groups_sync'].includes(selected.source)&&selected.status!=='locked'?`<div class="board-reply-compose"><textarea id="board-reply-body" class="input board-textarea" maxlength="5000" placeholder="Reply as ${esc(state.chatDisplayName||me.name)}"></textarea><div><span>${['google_groups','google_groups_sync'].includes(selected.source)?'This reply stays in GLSK and will not post back to Google Groups.':'Keep the discussion going.'}</span><button class="btn btn-primary" data-action="board-reply" data-thread-id="${selected.id}">Post Reply</button></div></div>`:
       imported?'<div class="board-locked-notice">Historical Google Groups discussion • preserved as read-only.</div>':
       selected.status==='locked'?'<div class="board-locked-notice">This discussion has been locked by the commissioner.</div>':''}
     `:'<div class="board-empty discussion-empty"><strong>Select a discussion</strong><span>Choose a thread from the left to read it.</span></div>'}
   </section>
 </div>`;
}

function notificationCategoryMeta(category){
 const map={
  roster_moves:['Roster Moves','↕'],
  trades:['Trades','⇄'],
  drafts:['Drafts','D'],
  contracts:['Contracts','C'],
  rookie_rights:['Rookie Rights','R'],
  league_chat:['League Chat','💬'],
  message_board:['Message Board','✎'],
  matchups:['Matchups','VS'],
  deadlines:['Deadlines','◷'],
  injuries:['Injury Updates','+'],
  player_availability:['Player Availability','A'],
  other_activity:['Other League Activity','•']
 };
 return map[category]||[String(category||'Activity').replaceAll('_',' '),'•'];
}
function notificationPrefEnabled(category){
 const p=state.notificationPrefs.find(x=>x.category===category);
 return p?p.enabled!==false:true;
}
function notificationRelatedTab(e){
 if(e.category==='league_chat')return 'chat';
 if(e.category==='message_board')return 'board';
 if(e.category==='trades')return 'trades';
 if(e.category==='drafts'||e.category==='roster_moves'||e.category==='contracts'||e.category==='rookie_rights')return 'transactions';
 if(e.category==='matchups')return 'matchups';
 if(e.category==='deadlines')return 'deadlines';
 return null;
}
function notificationView(){
 const t=myTeam();
 if(!t)return `${pageHeading('Notifications','Owner-specific GLSK alerts.','League Activity')}<div class="card empty">Sign in as a team owner to use notifications.</div>`;
 const categories=['roster_moves','trades','drafts','contracts','rookie_rights','league_chat','message_board','matchups','deadlines','injuries','player_availability','other_activity'];
 const rosterKeys=new Set(rosterFor(t.id).map(r=>r.player_key));
 return `${pageHeading('Notifications','Choose what you want to hear about and follow league activity in realtime.','League Activity')}
 <div class="notifications-layout">
   <section class="card notification-feed-card">
     <div class="notification-feed-head"><div><h2>Activity Feed</h2><span>${state.notificationUnread} unread</span></div>${state.notificationUnread?'<button class="btn btn-sm notification-mark-read" data-action="notifications-mark-read">Mark All Read</button>':''}</div>
     <div class="notification-feed">${state.notifications.length?state.notifications.map(e=>{
       const [label,icon]=notificationCategoryMeta(e.category),tab=notificationRelatedTab(e);
       return `<button class="notification-row ${e.unread?'unread':''}" ${tab?`data-notification-tab="${tab}"`:''}>
         <span class="notification-icon notification-${esc(e.category)}">${esc(icon)}</span>
         <div class="notification-copy"><div class="notification-title-row"><strong>${esc(e.title)}</strong>${e.unread?'<span class="notification-unread-dot"></span>':''}</div>${e.body?`<p>${esc(e.body)}</p>`:''}<div class="notification-meta"><span>${esc(label)}</span><span>${fmtDate(e.created_at)}</span></div></div>
       </button>`;
     }).join(''):'<div class="board-empty"><strong>No notifications yet.</strong><span>New league activity will appear here automatically.</span></div>'}</div>
   </section>

   <div class="notification-settings-column">
     <section class="card card-pad office-section push-device-card">
       <div class="office-section-head"><div><h2>Phone & Browser Push</h2><div class="section-caption">Receive selected GLSK alerts even when the site is closed.</div></div></div>
       <div class="push-device-status ${state.pushPermission==='denied'?'permission-blocked':''}">
         <div class="push-status-copy">
           <span class="push-status-dot ${state.pushSubscribed?'on':state.pushPermission==='denied'?'blocked':'off'}"></span>
           <div>
             <strong>${state.pushSubscribed?'Push enabled on this device':state.pushPermission==='denied'?'Push blocked in browser settings':state.pushSupported?'Push not enabled':'Push unsupported'}</strong>
             <span>${state.pushSubscribed?'This device is registered for background notifications.':state.pushPermission==='denied'?'Chrome, Safari, or a browser extension is currently blocking GLSK notifications.':isIOSDevice()&&!state.pushStandalone?'On iPhone/iPad: add GLSK to the Home Screen, open it there, then enable push.':'Enable this device to receive Lock Screen / system notifications.'}</span>
           </div>
         </div>
         ${state.pushSupported
           ? state.pushPermission==='denied'
             ? `<div class="push-device-actions"><button class="btn btn-outline push-refresh-permission" data-action="push-refresh-permission" ${state.pushBusy?'disabled':''}>${state.pushBusy?'Checking…':'Refresh Status'}</button></div>`
             : `<div class="push-device-actions">${state.pushSubscribed?'<button class="btn btn-outline" data-action="push-test">Send Test Push</button>':''}<button class="btn ${state.pushSubscribed?'btn-reset':'btn-primary'}" data-action="${state.pushSubscribed?'push-disable':'push-enable'}" ${state.pushBusy?'disabled':''}>${state.pushBusy?'Working…':state.pushSubscribed?'Disable on This Device':'Enable Push Notifications'}</button></div>`
           : ''}
       </div>
       ${state.pushPermission==='denied'?'<div class="push-denied-note"><strong>Browser permission blocked.</strong><span>Allow notifications for <b>glsk-auction.vercel.app</b> in browser/site settings—or disable the extension blocking them—then tap <b>Refresh Status</b>.</span></div>':''}
       <div class="notification-delivery-note"><strong>How settings work</strong><span>The category switches below control both the in-app feed and phone push. Each owner can enable GLSK on multiple phones/computers independently.</span></div>
     </section>

     <section class="card card-pad office-section notification-settings-card">
       <div class="office-section-head"><div><h2>Notification Settings</h2><div class="section-caption">Each owner controls their own feed and push alerts.</div></div></div>
       <div class="notification-toggle-list">${categories.map(c=>{const [label]=notificationCategoryMeta(c);return `<label class="notification-toggle-row"><div><strong>${esc(label)}</strong><span>${c==='injuries'?'My roster + watched players':c==='player_availability'?'Watched players only':'League activity'}</span></div><input type="checkbox" class="notification-pref-toggle" data-notification-category="${c}" ${notificationPrefEnabled(c)?'checked':''}></label>`}).join('')}</div>
       <div class="notification-delivery-note"><strong>Delivery</strong><span>These settings control both the realtime GLSK activity feed and background phone/browser push alerts on subscribed devices.</span></div>
     </section>

     <section class="card card-pad office-section player-alerts-card">
       <div class="office-section-head"><div><h2>Player Alerts</h2><div class="section-caption">Follow specific players for injury and availability changes.</div></div></div>
       <div class="player-watch-form">
         <input id="notification-watch-player" class="input" list="notification-player-list" placeholder="Search player name">
         <datalist id="notification-player-list">${state.notificationPlayers.map(p=>`<option value="${esc(p.name)}">${esc(p.nfl_team||'')} • ${esc(p.position||'')}</option>`).join('')}</datalist>
         <label class="watch-check"><input id="watch-injury" type="checkbox" checked> Injury</label>
         <label class="watch-check"><input id="watch-availability" type="checkbox" checked> Availability</label>
         <button class="btn btn-primary" data-action="notification-add-watch">Watch Player</button>
       </div>
       <div class="watch-list">${state.playerWatches.length?state.playerWatches.map(w=>`<div class="watch-row"><div><strong>${esc(w.player_name)}</strong><span>${esc(w.nfl_team||'')} • ${esc(w.position||'')} • ${w.injury_alerts?'Injury':''}${w.injury_alerts&&w.availability_alerts?' + ':''}${w.availability_alerts?'Availability':''}</span></div><button class="btn btn-sm btn-reset" data-remove-watch="${w.id}">Remove</button></div>`).join(''):'<div class="empty-tight">No watched players yet.</div>'}</div>
       <div class="watch-scope-note">Players already on <strong>${esc(t.name)}</strong> automatically qualify for injury alerts when Injury Updates are enabled. You only need to watch them if you also want availability alerts after they leave your roster.</div>
     </section>
   </div>
 </div>`;
}


function waiverDate(v){
  if(!v)return '—';
  const d=new Date(v);
  return new Intl.DateTimeFormat('en-US',{
    weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'
  }).format(d);
}
function waiverDropPenalty(r){
  const t=myTeam();
  if(!t||!r)return 0;
  const c=contractForPlayer(t.id,r.player_key);
  if(!c)return 0;
  return contractYear(c)===1
    ? Number(c.cap_cost||0)*2
    : ({2:5,3:10,4:20}[Number(c.length_years)]||0);
}
function waiverPriorityRank(){
  const t=myTeam();
  if(!t)return null;
  return (state.waiverCenter?.priority||[]).find(x=>x.team_id===t.id)?.priority_rank??null;
}
function waiverClaimFor(playerKey){
  return (state.waiverCenter?.claims||[]).find(c=>c.player_key===playerKey&&c.status==='pending')||null;
}
function waiverDropOptions(selectedKey=''){
  const t=myTeam();
  if(!t)return '';
  const rows=rosterFor(t.id).slice().sort((a,b)=>(a.position||'').localeCompare(b.position||'')||a.player_name.localeCompare(b.player_name));
  return rows.map(r=>{
    const p=waiverDropPenalty(r);
    return `<option value="${esc(r.player_key)}" ${selectedKey===r.player_key?'selected':''}>${esc(r.position||'')} • ${esc(r.player_name)}${p?` — ${p} bid fine`:''}</option>`;
  }).join('');
}
function faPlayerPool(){
 const available=state.waiverCenter?.players||[];
 const map=new Map(available.map(p=>[p.player_key,{...p}]));
 for(const r of state.roster.filter(r=>r.active!==false))map.set(r.player_key,{...map.get(r.player_key),...r,availability:'rostered',owner_team_id:r.team_id});
 return [...map.values()];
}
function faData(p){
 const week=Number(state.faWeek||currentWeek());
 if(state.faStats==='season')return statForPlayer(p.player_key)||{};
 if(state.faStats==='actual')return actualBundle(p.player_key,'week',week)||{};
 const rows=projectionsFor(p.player_key).filter(r=>Number(r.week)===week&&(!state.faSource||String(r.projection_source||r.source||'')===state.faSource));
 return rows[0]||{};
}
function faWatchFor(p){return state.playerWatches.find(w=>w.player_key===p.player_key||(w.player_name===p.player_name&&w.nfl_team===p.nfl_team));}
function faFilteredPlayers(all,me){
 const search=String(state.waiverSearch||'').trim().toLowerCase();
 const list=all.filter(p=>{
   const pos=String(p.position||'').toUpperCase();
   if(state.waiverPosition==='OFFENSE'&&!['QB','RB','WR','TE'].includes(pos))return false;
   if(state.waiverPosition==='FLEX'&&!['RB','WR','TE'].includes(pos))return false;
   if(!['ALL','OFFENSE','FLEX'].includes(state.waiverPosition)&&pos!==state.waiverPosition)return false;
   if(state.faShowMine&&p.owner_team_id!==me.id&&p.availability==='rostered')return false;
   if(state.faFantasy&&p.owner_team_id!==state.faFantasy)return false;
   if(!state.faFantasy&&!(state.faShowMine&&p.owner_team_id===me.id)){
     if(state.waiverStatus==='ALL'&&p.availability==='rostered')return false;
     if(!['ALL','EVERYONE'].includes(state.waiverStatus)&&p.availability!==state.waiverStatus)return false;
   }
   if(state.faNfl&&p.nfl_team!==state.faNfl)return false;
   return !search||`${p.player_name} ${p.nfl_team||''} ${pos}`.toLowerCase().includes(search);
 });
 const value=p=>{const d=faData(p);return state.faSort==='name'?String(p.player_name):state.faSort==='rank'?p.yahoo_rank:state.faSort==='position_rank'?(d.projected_position_rank??d.position_rank):state.faSort==='points'?(state.faStats==='projected'?d.projected_fantasy_points:d.fantasy_points):d[state.faSort];};
 return list.sort((a,b)=>{const av=value(a),bv=value(b);const missing=v=>v==null||v===''||(typeof v!=='string'&&!Number.isFinite(Number(v)));
   if(missing(av)||missing(bv))return Number(missing(av))-Number(missing(bv));
   const cmp=state.faSort==='name'?av.localeCompare(bv):Number(av)-Number(bv);
   return (state.faSortDesc?-cmp:cmp)||String(a.player_name).localeCompare(String(b.player_name));
 });
}
function faMarketTable(players,all,me,settings){
 const week=Number(state.faWeek||currentWeek());
 const teams=[...new Set(all.map(p=>p.nfl_team).filter(Boolean))].sort();
 const sources=[...new Set(state.playerProjections.map(r=>r.projection_source||r.source).filter(Boolean))].sort();
 const cols=[['points','Fan Pts'],['position_rank','Pos Rank'],['rank','Pre-Season'],['overall_rank','Actual'],['passing_yards','Yds'],['passing_td','TD'],['interceptions','Int'],['rushing_attempts','Att'],['rushing_yards','Yds'],['rushing_td','TD'],['targets','Tgt'],['receptions','Rec'],['receiving_yards','Yds'],['receiving_td','TD'],['return_td','TD'],['two_point_conversions','2PT'],['fumbles_lost','Lost']];
 return `<section class="fa-player-browser">
 <input id="fa-search" class="input fa-big-search" aria-label="Search player by name" placeholder="Search player by name" value="${esc(state.waiverSearch)}">
 <div class="fa-position-label">Position</div><div class="fa-position-pills">${[['ALL','All Players'],['OFFENSE','All Offense'],['QB','QB'],['RB','RB'],['WR','WR'],['TE','TE'],['FLEX','W/R/T'],['K','K'],['DST','D/ST']].map(([v,label])=>`<button type="button" data-fa-position="${v}" aria-pressed="${state.waiverPosition===v}" class="${state.waiverPosition===v?'active':''}">${label}</button>`).join('')}<label><input id="fa-show-mine" type="checkbox" ${state.faShowMine?'checked':''}> Show my team</label></div>
 <div class="fa-browser-filters">
 <label>Status<select id="fa-status" class="input">${[['ALL','All Available Players'],['free_agent','Free Agents'],['waivers','Waivers'],['EVERYONE','All Players'],['rostered','Rostered Players']].map(([v,label])=>`<option value="${v}" ${state.waiverStatus===v?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>NFL Teams<select id="fa-nfl" class="input"><option value="">All Teams</option>${teams.map(v=>`<option ${v===state.faNfl?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
 <label>Fantasy Teams<select id="fa-fantasy" class="input"><option value="">No Team Selected</option>${state.teams.map(t=>`<option value="${esc(t.id)}" ${t.id===state.faFantasy?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label>
 <label>Stats<select id="fa-stats" class="input">${[['projected','Weekly Projections'],['actual','Weekly Stats'],['season','Season Stats']].map(([v,label])=>`<option value="${v}" ${v===state.faStats?'selected':''}>${label}</option>`).join('')}</select></label>
 <label>Week<select id="fa-week" class="input" ${state.faStats==='season'?'disabled':''}>${Array.from({length:18},(_,i)=>`<option value="${i+1}" ${week===i+1?'selected':''}>Week ${i+1}</option>`).join('')}</select></label>
 <label>Projection Sources<select id="fa-source" class="input" ${state.faStats!=='projected'||!sources.length?'disabled':''}><option value="">Current feed</option>${sources.map(v=>`<option value="${esc(v)}" ${v===state.faSource?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
 </div><div class="fa-table-caption">${players.length} players • ${state.faStats==='projected'?'Projected stats':state.faStats==='season'?'Season stats':'Actual stats'}${state.faStats==='season'?'':` • Week ${week}`} • Unavailable data shown as —</div>
 <div class="fa-table-scroll"><table class="fa-stats-table"><thead><tr class="fa-group-head"><th colspan="5"></th><th colspan="2">Fantasy</th><th colspan="2">Rankings</th><th colspan="3">Passing</th><th colspan="3">Rushing</th><th colspan="4">Receiving</th><th>Ret</th><th>Misc</th><th>Fum</th></tr>
 <tr><th aria-label="Player actions"></th><th><button data-fa-sort="name">Offense</button></th><th>Roster Status</th><th>GP</th><th>Bye</th>${cols.map(([key,label])=>`<th aria-sort="${state.faSort===key?(state.faSortDesc?'descending':'ascending'):'none'}"><button data-fa-sort="${key}">${label}${state.faSort===key?(state.faSortDesc?' ↓':' ↑'):''}</button></th>`).join('')}</tr></thead><tbody>
 ${players.map(p=>{const d=faData(p),proj=projectionFor(p.player_key,week)||{},actual=statForPlayer(p.player_key)||{},watched=faWatchFor(p);const available=['free_agent','waivers'].includes(p.availability);const game=lineupGameLabel(p.player_key,week);const image=p.headshot_url||p.photo_url;const safeImage=typeof image==='string'&&/^https:\/\//.test(image)?image:null;const name=esc(p.player_name);const vals=cols.map(([key])=>key==='points'?(state.faStats==='projected'?d.projected_fantasy_points:d.fantasy_points):key==='position_rank'?(d.projected_position_rank??d.position_rank):key==='rank'?p.yahoo_rank:key==='overall_rank'?actual.overall_rank:d[key]);
 return `<tr class="${state.waiverSelectedPlayer===p.player_key?'selected':''}"><td><div class="fa-row-actions"><button class="fa-add-icon" data-fa-select="${esc(p.player_key)}" aria-label="${p.availability==='waivers'?'Claim':'Add'} ${name}" ${!available||settings.enabled===false?'disabled':''}>+</button><button class="fa-watch-icon" data-fa-watch="${esc(p.player_key)}" aria-label="${watched?'Unwatch':'Watch'} ${name}" aria-pressed="${Boolean(watched)}">${watched?'★':'☆'}</button></div></td>
 <td><div class="fa-player-identity">${safeImage?`<img src="${esc(safeImage)}" alt="" loading="lazy">`:`<span class="fa-player-initials" aria-hidden="true">${esc(p.player_name.split(/\s+/).map(n=>n[0]).slice(0,2).join(''))}</span>`}<div><button class="fa-player-link" data-profile-key="${esc(p.player_key)}">${name}</button><span>${esc(p.nfl_team||'FA')} - ${esc(p.position)}</span><small>${esc(game.main)}${game.sub&&game.sub!=='Open starter'?' • '+esc(game.sub):''}</small></div></div></td>
 <td>${p.availability==='rostered'?esc(teamById(p.owner_team_id)?.name||'Rostered'):p.availability==='waivers'?`Waivers<br><small>${waiverDate(p.waiver_ends_at)}</small>`:'FA'}</td><td>${fmtStat(d.games_played??d.gp,0)}</td><td>${fmtStat(d.bye_week??proj.bye_week??actual.bye_week,0)}</td>${vals.map((v,i)=>`<td class="${i===0?'fa-points':''}">${fmtStat(v,i===0?2:state.faStats==='projected'&&i>=4?1:0)}</td>`).join('')}</tr>`;}).join('')||'<tr><td colspan="22">No players match these filters.</td></tr>'}
 </tbody></table></div></section>`;
}
function freeAgencyView(){
  const wc=state.waiverCenter;
  const me=myTeam();
  if(!me)return `${pageHeading('Free Agency & Waivers','Sign in as a franchise manager to use player acquisitions.','Player Market')}`;

  if(!wc||wc.ok===false){
    return `${pageHeading('Free Agency & Waivers','Immediate free-agent adds and blind FAAB waiver claims.','Player Market')}
      <section class="card card-pad office-section">
        <div class="office-section-head"><div><h2>Setup Required</h2><div class="section-caption">Run the GLSK v7.0.9 Free Agency + Waivers migration, then refresh.</div></div></div>
        <div class="error">${esc(wc?.error||'Free Agency database is not installed yet.')}</div>
      </section>`;
  }

  const settings=wc.settings||{};
  const all=faPlayerPool();
  const claims=wc.claims||[];
  const priority=wc.priority||[];
  const rank=waiverPriorityRank();
  const rosterCount=activeRosterFor(me.id).length;
  const limit=Number(state.season?.roster_limit||18);
  const pending=claims.filter(c=>c.status==='pending');
  const players=faFilteredPlayers(all,me);
  const selected=all.find(p=>p.player_key===state.waiverSelectedPlayer&&p.availability!=='rostered')||null;
  const selectedClaim=selected?waiverClaimFor(selected.player_key):null;
  const defaultDrop=selectedClaim?.drop_player_key||'';
  const full=rosterCount>=limit;
  const lastRun=(wc.runs||[])[0];

  const actionPanel=selected?`
    <section class="card card-pad fa-action-card">
      <div class="fa-action-head">
        <div>
          <span class="${rosterPositionClass(selected.position)}">${esc(selected.position)}</span>
          <div>
            <h2>${esc(selected.player_name)}</h2>
            <div class="section-caption">${esc(selected.nfl_team||'FA')}${selected.yahoo_rank?` • Yahoo rank ${selected.yahoo_rank}`:''}</div>
          </div>
        </div>
        <span class="fa-status-chip ${selected.availability==='waivers'?'waiver':'free'}">${selected.availability==='waivers'?(selected.awaiting_processing?'Processing':'Waivers'):'Free Agent'}</span>
      </div>
      ${selected.availability==='waivers'?`
        <div class="fa-deadline-box">
          <span>${selected.claim_open?'Claim deadline':'Claim window closed'}</span>
          <strong>${waiverDate(selected.waiver_ends_at)}</strong>
        </div>
      `:'<div class="fa-deadline-box free"><span>Acquisition</span><strong>Immediate • $0</strong></div>'}
      <div class="field">
        <label>${full?'Player to drop if acquired':'Optional player to drop'}</label>
        <select id="fa-drop-player" class="input">
          <option value="">${full?'Select a player':'Use open roster spot'}</option>
          ${waiverDropOptions(defaultDrop)}
        </select>
        <div class="field-help">Contract drop fines are charged in addition to a winning waiver bid.</div>
      </div>
      ${selected.availability==='waivers'?`
        <div class="field">
          <label>FAAB bid</label>
          <div class="fa-bid-line"><span>$</span><input id="fa-waiver-bid" class="input" type="number" min="${settings.allow_zero_bid?0:1}" max="${Number(me.remaining_budget||0)}" value="${selectedClaim?Number(selectedClaim.bid_amount||0):0}"></div>
          <div class="field-help">Your bid stays private until waivers process. Ties use the current rolling priority.</div>
        </div>
        <button class="btn btn-primary fa-primary-action" data-action="fa-submit-claim" ${selected.claim_open?'':'disabled'}>${selectedClaim?'Update Claim':'Submit Claim'}</button>
        ${selectedClaim?`<button class="btn btn-outline fa-secondary-action" data-cancel-waiver="${selectedClaim.id}">Cancel Claim</button>`:''}
      `:`
        <button class="btn btn-primary fa-primary-action" data-action="fa-add-now">Add Free Agent</button>
      `}
      ${commissionerToolsActive()?`<div class="fa-commish-inline">
        ${selected.availability==='free_agent'
          ?'<button class="btn btn-sm btn-outline" data-action="fa-commish-waive-selected">Commissioner • Put on Waivers</button>'
          :'<button class="btn btn-sm btn-outline" data-action="fa-commish-clear-selected">Commissioner • Clear to FA</button>'}
      </div>`:''}
    </section>`:`
    <section class="card card-pad fa-action-card fa-action-empty">
      <div class="fa-empty-icon">+</div>
      <h2>Select a Player</h2>
      <p>Choose an available player to add immediately or submit a blind waiver claim.</p>
    </section>`;

  return `${pageHeading('Player List','','Free Agents')}
    <div class="fa-summary-grid">
      <div class="card fa-summary"><span>Bid Dollars</span><strong>${bidMoney(me.remaining_budget)}</strong><small>available</small></div>
      <div class="card fa-summary"><span>Roster</span><strong>${rosterCount}/${limit}</strong><small>${full?'full active roster':`${limit-rosterCount} open`}${irRosterFor(me.id).length?` • ${irRosterFor(me.id).length}/${irLimit()} IR`:''}</small></div>
      <div class="card fa-summary"><span>Waiver Priority</span><strong>${rank?`#${rank}`:'—'}</strong><small>rolling tiebreak</small></div>
      <div class="card fa-summary"><span>Pending Claims</span><strong>${pending.length}</strong><small>private to ${esc(me.name)}</small></div>
    </div>

    ${settings.enabled===false?'<div class="owner-banner office-deadline-banner"><div><span class="banner-label">FREE AGENCY PAUSED</span><strong>Commissioner has disabled adds and claims.</strong></div></div>':''}

    ${faMarketTable(players,all,me,settings)}
    <div class="fa-layout fa-browser-management">
      <aside class="fa-side">
        ${actionPanel}

        <section class="card card-pad fa-claims-card">
          <div class="office-section-head"><div><h2>My Pending Claims</h2><div class="section-caption">Shared by your franchise co-managers; hidden from other teams.</div></div><span class="status-chip">${pending.length}</span></div>
          <div class="fa-claim-list">
            ${pending.length?pending.map(c=>`<div class="fa-claim-row">
              <div><strong>${esc(c.player_name||c.player_key)}</strong><span>${esc(c.position||'')} ${esc(c.nfl_team||'')} • Bid ${bidMoney(c.bid_amount)}</span>${c.drop_player_name?`<small>Drop if won: ${esc(c.drop_player_name)}</small>`:''}</div>
              <div><small>${waiverDate(c.waiver_ends_at)}</small><button class="btn btn-sm btn-reset" data-cancel-waiver="${c.id}">Cancel</button></div>
            </div>`).join(''):'<div class="empty-tight">No pending waiver claims.</div>'}
          </div>
        </section>

        <section class="card card-pad fa-priority-card">
          <div class="office-section-head"><div><h2>Waiver Priority</h2><div class="section-caption">Used only as the tiebreak when FAAB bids are equal.</div></div></div>
          <div class="fa-priority-list">
            ${priority.map((p,i)=>`<div class="fa-priority-row ${p.team_id===me.id?'mine':''}">
              <b>${p.priority_rank}</b><span>${esc(p.team_name)}</span>
              ${commissionerToolsActive()?`<div><button class="btn btn-xs btn-outline" data-waiver-priority-team="${p.team_id}" data-waiver-priority-dir="up" ${i===0?'disabled':''}>↑</button><button class="btn btn-xs btn-outline" data-waiver-priority-team="${p.team_id}" data-waiver-priority-dir="down" ${i===priority.length-1?'disabled':''}>↓</button></div>`:''}
            </div>`).join('')}
          </div>
        </section>

        ${commissionerToolsActive()?`<section class="card card-pad fa-commish-card">
          <div class="office-section-head"><div><h2>Commissioner • Waivers</h2><div class="section-caption">Pending bids remain blind; processing resolves only players whose claim window has ended.</div></div></div>
          <div class="form-grid">
            <div class="field"><label>Dropped-player waiver days</label><input id="fa-waiver-days" class="input" type="number" min="0" max="14" value="${Number(settings.waiver_days??1)}"></div>
            <div class="field"><label>$0 waiver bids</label><select id="fa-zero-bids" class="input"><option value="true" ${settings.allow_zero_bid!==false?'selected':''}>Allowed</option><option value="false" ${settings.allow_zero_bid===false?'selected':''}>Not allowed</option></select></div>
            <div class="field"><label>Rolling tiebreak priority</label><select id="fa-rolling-priority" class="input"><option value="true" ${settings.rolling_priority!==false?'selected':''}>On</option><option value="false" ${settings.rolling_priority===false?'selected':''}>Off</option></select></div>
            <div class="field"><label>Free Agency</label><select id="fa-enabled" class="input"><option value="true" ${settings.enabled!==false?'selected':''}>Enabled</option><option value="false" ${settings.enabled===false?'selected':''}>Paused</option></select></div>
          </div>
          <div class="row gap-8 wrap"><button class="btn btn-outline" data-action="fa-save-settings">Save Settings</button><button class="btn btn-primary" data-action="fa-process-waivers">Process Eligible Waivers</button></div>
          <div class="fa-last-run">${lastRun?`Last run ${waiverDate(lastRun.processed_at)} • ${lastRun.award_count}/${lastRun.player_count} awarded`:'No waiver processing runs yet.'}</div>
          <div class="fa-provider-note"><strong>2026 game-time locks:</strong> The policy is stored as Game Time → Tuesday. Individual NFL kickoff locking will plug into the same waiver holds when Yahoo game data is connected; dropped-player waivers work now.</div>
          <hr class="fa-divider">
          <h3>Add / Correct Player Pool</h3>
          <div class="form-grid">
            <div class="field"><label>Player</label><input id="fa-pool-player" class="input" placeholder="Player name"></div>
            <div class="field"><label>NFL Team</label><input id="fa-pool-team" class="input" maxlength="4" placeholder="DET"></div>
            <div class="field"><label>Position</label><select id="fa-pool-position" class="input"><option>QB</option><option>RB</option><option>WR</option><option>TE</option><option>K</option><option>DST</option></select></div>
            <div class="field"><label>Yahoo Rank (optional)</label><input id="fa-pool-rank" class="input" type="number" min="1" placeholder="—"></div>
          </div>
          <button class="btn btn-outline" data-action="fa-add-pool-player">Save Player to Pool</button>
        </section>`:''}
      </aside>
    </div>`;
}

function orderedTeamRoster(teamId){
 const positionOrder={QB:0,RB:1,WR:2,TE:3,K:4,DEF:5};
 const position=r=>{const p=String(r.position||'').toUpperCase();return ['DST','D/ST','DEF','DEFENSE'].includes(p)?'DEF':p;};
 const compare=(a,b)=>(positionOrder[position(a)]??6)-(positionOrder[position(b)]??6)||String(a.player_name||'').localeCompare(String(b.player_name||''));
 const slots=state.lineupSlots.slice().sort((a,b)=>Number(a.slot_order||0)-Number(b.slot_order||0));
 const slotIndex=new Map(slots.map((s,i)=>[s.slot_code,{...s,index:i}]));
 const saved=lineupFor(teamId,currentWeek()).filter(l=>l.player_key&&(!slots.length||slotIndex.has(l.slot_code))).slice().sort((a,b)=>(slotIndex.get(a.slot_code)?.index??99)-(slotIndex.get(b.slot_code)?.index??99)||String(a.slot_code).localeCompare(String(b.slot_code),undefined,{numeric:true}));
 const starting=new Map();
 saved.forEach((l,i)=>{if(!starting.has(l.player_key))starting.set(l.player_key,{order:i,label:slotIndex.get(l.slot_code)?.label||l.slot_code});});
 return rosterFor(teamId).map(r=>{
   const ir=String(r.roster_slot||'ACTIVE').toUpperCase()==='IR';
   const starter=ir?null:starting.get(r.player_key);
   return {...r,displayGroup:ir?'IR':starter?'Starting Lineup':'Bench',displayPosition:ir?'IR':starter?.label||position(r),starterOrder:starter?.order??99};
 }).sort((a,b)=>({ 'Starting Lineup':0,Bench:1,IR:2 }[a.displayGroup]-{ 'Starting Lineup':0,Bench:1,IR:2 }[b.displayGroup])||(a.displayGroup==='Starting Lineup'?a.starterOrder-b.starterOrder:compare(a,b)));
}

function teamsView(teamId=null){
 const selected=teamId==null?null:state.teams.find(t=>String(t.id)===String(teamId));
 const visibleTeams=selected?[selected]:state.teams;
 const lim=state.season?.roster_limit||18,cap=state.season?.salary_cap_points||100;
 return `${pageHeading(selected?selected.name:'Teams & Rosters',selected?'Roster, bid dollars and contract status.':'Live roster, bid-dollar and contract status for every franchise.','League Management')}${commissionerAddPlayerForm()}<div class="team-office-grid roster-team-grid">${visibleTeams.map(t=>{
   const roster=orderedTeamRoster(t.id);
   const activeCount=activeRosterFor(t.id).length,irCount=irRosterFor(t.id).length;
   const cu=capUsed(t.id);
   return `<details class="card office-team-card roster-team-card" ${selected?'open':''}><summary class="team-summary"><div class="team-summary-main"><div class="office-team-name">${esc(t.name)}</div><div class="team-summary-sub">${activeCount===lim?'Active roster full':`${lim-activeCount} active roster spot${lim-activeCount===1?'':'s'} open`}${irCount?` • ${irCount}/${irLimit()} IR`:''}</div></div><div class="team-summary-metrics"><span><b>${activeCount}/${lim}</b><small>Roster</small></span><span><b>${irCount}/${irLimit()}</b><small>IR</small></span><span><b>${bidMoney(t.remaining_budget)}</b><small>Bids</small></span><span><b>${cu}/${cap}</b><small>Cap</small></span></div><span class="details-chevron">⌄</span></summary><div class="team-roster-body">${roster.map((r,index)=>{
     const c=contractForPlayer(t.id,r.player_key);
     const canDrop=myTeam()?.id===t.id&&!state.session?.spectator;
     const penalty=c?(contractYear(c)===1?Number(c.cap_cost||0)*2:({2:5,3:10,4:20}[Number(c.length_years)]||0)):0;
     return `${index===0||roster[index-1].displayGroup!==r.displayGroup?`<div class="roster-group-heading">${esc(r.displayGroup)}${r.displayGroup==='Starting Lineup'?` • Week ${currentWeek()}`:''}</div>`:''}<div class="roster-player-row"><span class="${rosterPositionClass(r.position)}">${esc(r.displayPosition||'—')}</span><div class="roster-player-main"><div class="contract-player">${esc(r.player_name)}</div><div class="roster-player-meta">${esc(r.nfl_team||'')} <span>•</span> ${esc(acquisitionLabel(r.acquisition_type))}</div>${playerStatLine(r)}${c?`<div class="contract-detail contract-active">${esc(contractLabel(c))}${penalty?` <span>• Drop fine ${penalty}</span>`:''}</div>`:'<div class="contract-detail contract-none">No active contract</div>'}</div><div class="roster-player-actions">${String(r.roster_slot||'ACTIVE')==='IR'?'<span class="status-chip roster-ir-chip">IR</span>':''}${c?'<span class="status-chip contract-chip">Contract</span>':''}${canDrop?`<button class="btn btn-sm btn-reset" data-drop-player="${esc(r.player_key)}" data-drop-name="${esc(r.player_name)}" data-drop-penalty="${penalty}">Drop</button>`:''}${commissionerToolsActive()?`<button class="btn btn-sm btn-outline" data-exception-drop="${esc(r.player_key)}" data-exception-team="${t.id}" data-drop-name="${esc(r.player_name)}">Retire/Ban</button>`:''}</div></div>`;
   }).join('')||'<div class="empty-tight">No roster entries.</div>'}</div></details>`;
 }).join('')}</div>`;
}

function extensionCostReference(){
 const positions=['QB','RB','WR','TE'];
 return `<section class="card card-pad office-section extension-reference-card">
   <div class="office-section-head"><div><h2>Contract Extension Cost Reference</h2><div class="small muted">Based on the actual top 3 Free Agent Auction bids at each position. Costs are rounded to the nearest whole bid dollar.</div></div>${commissionerToolsActive()?'<button class="btn btn-sm btn-outline" data-action="refresh-extension-costs">Refresh</button>':''}</div>
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
   return `<section class="contract-team"><div class="contract-team-head"><div class="contract-team-name">${esc(t.name)}</div><strong>${capUsed(t.id)}/${cap} pts</strong></div><div class="contract-list">${rows.length?rows.map(c=>`<div class="contract-row"><div><div class="contract-player">${esc(c.player_name)}</div><div class="contract-sub">${esc(contractLabel(c))} • ${c.start_year}–${c.end_year}</div></div><div>${commissionerToolsActive()?`<button class="btn btn-sm btn-reset" data-void-contract="${c.id}">Void</button>`:`<span class="cap-badge">${c.cap_cost}</span>`}</div></div>`).join(''):'<div class="empty-tight">No active contracts.</div>'}</div></section>`;
 }).join('');
 return `${pageHeading('Contracts & Salary Cap','Assign, track and extend contracts while staying under the 100-point cap.','Roster Management')}<div class="contract-cost-strip">${state.contractOptions.map(o=>`<div><strong>${o.years}-Year</strong><span>${o.cap_cost} pts</span></div>`).join('')}</div>${extensionCostReference()}${extensionPanel()}${ownerContractPanel()}${commissionerToolsActive()?contractForm():''}${body}`;
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
 <div class="list-stack">${visible.length?visible.map(tr=>{const proposer=teamById(tr.proposer_team_id),partnerT=teamById(tr.partner_team_id);return `<div class="card trade-card trade-card-v2"><div class="trade-card-head"><div><div class="deadline-title">${esc(proposer?.name)} <span class="trade-arrow">⇄</span> ${esc(partnerT?.name)}</div><div class="deadline-meta">Proposed ${fmtDate(tr.proposed_at)}${tr.note?` • ${esc(tr.note)}`:''}</div></div><span class="trade-status ${tr.status}">${esc(tr.status.replaceAll('_',' '))}</span></div>${tradeSummary(tr)}<div class="inline-actions trade-card-actions">${me?.id===tr.partner_team_id&&tr.status==='proposed'?`<button class="btn btn-sm btn-green" data-trade-response="accept" data-trade-id="${tr.id}">Accept Trade</button><button class="btn btn-sm btn-reset" data-trade-response="reject" data-trade-id="${tr.id}">Reject</button>`:''}${me?.id===tr.proposer_team_id&&['proposed','pending_commish'].includes(tr.status)?`<button class="btn btn-sm btn-outline" data-cancel-trade="${tr.id}">Cancel Proposal</button>`:''}${commissionerToolsActive()&&tr.status==='pending_commish'?`<button class="btn btn-sm btn-green" data-commish-trade="approve" data-trade-id="${tr.id}">Approve Trade</button><button class="btn btn-sm btn-reset" data-commish-trade="deny" data-trade-id="${tr.id}">Deny</button>`:''}</div></div>`;}).join(''):'<div class="card empty">No trade activity yet.</div>'}</div></section>`;
}
function transactionTypeLabel(t){return ({auction:'Auction',supplemental:'Supplemental',phase3:'Roster Fill',trade:'Trade',drop:'Drop',contract_assigned:'Contract Assigned',contract_removed:'Contract Removed',contract_extended:'Contract Extended',contract_voided:'Contract Voided',rookie_rights_transfer:'Rookie Rights',commissioner_correction:'Commissioner Correction',add:'Add'}[t]||t.replaceAll('_',' '));}
function transactionsView(){
 const f=state.txFilters||{team:'',type:'',search:''},types=[...new Set(state.transactions.map(t=>t.transaction_type))].sort();
 const rows=state.transactions.filter(tx=>(!f.team||tx.team_id===f.team||tx.other_team_id===f.team)&&(!f.type||tx.transaction_type===f.type)&&(!f.search||`${tx.player_name||''} ${tx.description||''}`.toLowerCase().includes(f.search.toLowerCase())));
 return `${pageHeading('Transactions','Permanent league ledger for trades, adds, drops, contracts, draft picks and commissioner corrections.','League Ledger')}<section class="card card-pad office-section tx-filter-card"><div class="tx-filters"><select id="tx-team" class="input"><option value="">All teams</option>${state.teams.map(t=>`<option value="${t.id}" ${f.team===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select><select id="tx-type" class="input"><option value="">All transaction types</option>${types.map(t=>`<option value="${esc(t)}" ${f.type===t?'selected':''}>${esc(transactionTypeLabel(t))}</option>`).join('')}</select><input id="tx-search" class="input" value="${esc(f.search)}" placeholder="Search player / transaction"></div></section>${commissionerToolsActive()?correctionForm():''}<div class="list-stack">${rows.length?rows.map(tx=>{const t=teamById(tx.team_id),o=teamById(tx.other_team_id);return `<details class="card tx-card"><summary><div><div class="row gap-8 wrap"><span class="tx-type">${esc(transactionTypeLabel(tx.transaction_type))}</span>${tx.status==='reversed'?'<span class="trade-status denied">REVERSED</span>':''}</div><div class="log-name">${esc(tx.description)}</div><div class="small muted">${fmtDate(tx.created_at)}${t?` • ${esc(t.name)}`:''}${o?` ↔ ${esc(o.name)}`:''}</div></div><div class="tx-deltas">${tx.bid_delta?`<span class="${tx.bid_delta<0?'neg':'pos'}">${tx.bid_delta>0?'+':''}${tx.bid_delta} bids</span>`:''}${tx.cap_delta?`<span>${tx.cap_delta>0?'+':''}${tx.cap_delta} cap</span>`:''}</div></summary><pre class="tx-json">${esc(JSON.stringify(tx.details||{},null,2))}</pre></details>`;}).join(''):'<div class="card empty">No transactions match these filters.</div>'}</div>`;
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

function rulesView(){const groups=[...new Set(state.rules.map(r=>r.category))];const total=state.distro.reduce((s,r)=>s+Number(r.percentage||0),0);return `${pageHeading('League Rules','Season-versioned settings can change going forward without rewriting prior years.','Commissioner Settings')}${weeklyHostRulesPanel()}<div class="office-grid two"><div><section class="card card-pad">${groups.map(g=>`<div class="rule-category"><h3>${esc(g)}</h3>${state.rules.filter(r=>r.category===g).map(r=>`<div class="rule-row"><div class="rule-label">${esc(r.label)}${r.unit?` <span class="small muted">(${esc(r.unit)})</span>`:''}</div><div>${r.numeric_value!=null?(commissionerToolsActive()?`<input class="rule-input" data-rule-key="${esc(r.rule_key)}" type="number" step="1" value="${Number(r.numeric_value)}">`:`<div class="rule-value">${Number(r.numeric_value)} ${esc(r.unit||'')}</div>`):`<div class="rule-value">${r.boolean_value?'On':'Off'}</div>`}</div></div>`).join('')}</div>`).join('')}${commissionerToolsActive()?'<button class="btn btn-primary" data-action="save-rules">Save Rule Defaults</button>':''}</section></div><div><section class="card card-pad"><div class="office-section-head"><h2>Bid Redistribution</h2><div id="distro-total" class="${Math.abs(total-100)>.001?'distro-total bad':'distro-total'}">${total.toFixed(2)}%</div></div><div class="redistribution-grid">${state.distro.map(r=>`<div class="distro-row"><div class="rule-label">${esc(r.label)}</div>${commissionerToolsActive()?`<input class="rule-input distro-input" data-bracket="${r.bracket}" data-finish="${r.finish}" type="number" step="0.05" min="0" max="100" value="${Number(r.percentage).toFixed(2)}">`:`<div class="rule-value">${Number(r.percentage).toFixed(2)}%</div>`}</div>`).join('')}</div><div class="distro-total"><span>Total</span><strong id="distro-total-bottom">${total.toFixed(2)}%</strong></div>${commissionerToolsActive()?'<button class="btn btn-primary btn-block" style="margin-top:10px" data-action="save-distro">Save Redistribution</button>':''}<div class="small muted" style="margin-top:9px">The 2026 values were imported from the league workbook. Future seasons can use different versions without rewriting history.</div></section></div></div>`;}

function deadlinesView(){const mine=myTeam();return `${pageHeading('Deadlines','Create league deadlines, track submissions and automatically lock time-sensitive actions.','League Calendar')}${commissionerToolsActive()?deadlineForm():''}<div class="list-stack">${state.deadlines.length?state.deadlines.map(d=>{const sts=state.deadlineStatus.filter(s=>s.deadline_id===d.id),done=sts.filter(s=>['submitted','late','waived'].includes(s.status)).length,my=mine?sts.find(s=>s.team_id===mine.id):null,pct=state.teams.length?done/state.teams.length*100:0;return `<div class="card deadline-card"><div class="row between gap-8"><div><div class="deadline-title">${esc(d.title)}</div><div class="deadline-meta">${esc(d.deadline_type)} • ${fmtDate(d.due_at)}${d.auto_lock?' • auto-lock':''}</div></div><span class="deadline-status ${d.status}">${esc(d.status)}</span></div>${d.notes?`<div class="small muted" style="margin-top:7px">${esc(d.notes)}</div>`:''}<div class="deadline-progress"><div style="width:${pct}%"></div></div><div class="row between gap-8 wrap" style="margin-top:8px"><div class="small muted">${done}/${state.teams.length} submitted${my?` • Your status: ${esc(my.status)}`:''}</div><div class="inline-actions">${mine&&d.status==='open'&&(!my||my.status==='pending')?`<button class="btn btn-sm btn-green" data-submit-deadline="${d.id}">Mark Submitted</button>`:''}${commissionerToolsActive()&&d.status==='open'?`<button class="btn btn-sm btn-outline" data-deadline-status="closed" data-deadline-id="${d.id}">Close</button>`:''}${commissionerToolsActive()&&d.status==='closed'?`<button class="btn btn-sm btn-outline" data-deadline-status="open" data-deadline-id="${d.id}">Reopen</button>`:''}${commissionerToolsActive()&&d.status!=='completed'?`<button class="btn btn-sm btn-outline" data-deadline-status="completed" data-deadline-id="${d.id}">Complete</button>`:''}</div></div></div>`;}).join(''):'<div class="card empty">No league deadlines have been created yet.</div>'}</div>`;}
function deadlineForm(){return `<section class="card office-form office-section"><div class="section-title">Create Deadline</div><div class="form-grid"><div class="field"><label>Title</label><input id="deadline-title" class="input" placeholder="Contract assignments due"></div><div class="field"><label>Type</label><select id="deadline-type" class="input"><option value="contracts">Contracts</option><option value="contract_extensions">Contract Extensions</option><option value="rookie_rights">Rookie Rights</option><option value="dues">Dues</option><option value="trade">Trade / Transaction</option><option value="general">General</option></select></div><div class="field"><label>Due date & time</label><input id="deadline-due" type="datetime-local" class="input"></div><div class="field"><label>Automatic lock</label><select id="deadline-lock" class="input"><option value="true">Yes</option><option value="false">No</option></select></div></div><div class="field"><label>Notes</label><textarea id="deadline-notes" class="input" placeholder="Optional instructions"></textarea></div><button class="btn btn-primary" data-action="create-deadline">Create Deadline</button></section>`;}

function financesView(){const sumDue=state.finance.filter(x=>x.status==='due').reduce((s,x)=>s+Number(x.amount_cents||0),0),sumPaid=state.finance.filter(x=>x.status==='paid').reduce((s,x)=>s+Number(x.amount_cents||0),0);return `${pageHeading('League Finances','Private ledger for dues, prizes, expenses and adjustments.','League Accounting')}<div class="kpi-grid"><div class="card kpi"><div class="kpi-label">Due</div><div class="kpi-value">${money(sumDue)}</div></div><div class="card kpi"><div class="kpi-label">Paid</div><div class="kpi-value">${money(sumPaid)}</div></div></div>${commissionerToolsActive()?financeForm():''}<div class="list-stack">${state.finance.length?state.finance.map(f=>{const t=teamById(f.team_id);return `<div class="finance-row"><div><div class="log-name">${esc(f.description)}</div><div class="small muted">${esc(t?.name||'League')} • ${esc(f.category)}${f.due_at?` • due ${fmtDateOnly(f.due_at)}`:''}</div><div class="finance-status">${esc(f.status)}</div></div><div style="text-align:right"><div class="finance-amount ${Number(f.amount_cents)<0?'negative':''}">${money(f.amount_cents)}</div>${commissionerToolsActive()?`<div class="inline-actions" style="justify-content:flex-end;margin-top:5px">${f.status!=='paid'?`<button class="btn btn-sm btn-green" data-finance-status="paid" data-finance-id="${f.id}">Paid</button>`:''}${f.status!=='waived'?`<button class="btn btn-sm btn-outline" data-finance-status="waived" data-finance-id="${f.id}">Waive</button>`:''}</div>`:''}</div></div>`;}).join(''):'<div class="card empty">No finance entries yet.</div>'}</div><div class="notice" style="margin-top:12px">Financial rows are not publicly readable from Supabase; owners can retrieve only their own items with their team PIN, while the commissioner can retrieve the full ledger.</div>`;}
function financeForm(){return `<section class="card office-form office-section"><div class="section-title">Commissioner • Add Finance Entry</div><div class="form-grid"><div class="field"><label>Team</label><select id="finance-team" class="input"><option value="">League-wide</option>${state.teams.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></div><div class="field"><label>Category</label><select id="finance-category" class="input"><option value="dues">Dues</option><option value="prize">Prize</option><option value="expense">Expense</option><option value="adjustment">Adjustment</option><option value="other">Other</option></select></div><div class="field"><label>Amount ($)</label><input id="finance-amount" type="number" step="0.01" class="input" placeholder="100.00"></div><div class="field"><label>Due date</label><input id="finance-due" type="date" class="input"></div></div><div class="field"><label>Description</label><input id="finance-desc" class="input" placeholder="2026 league dues"></div><button class="btn btn-primary" data-action="add-finance">Add Entry</button></section>`;}



function lineupSetupPanel(){
 if(!commissionerToolsActive())return '';
 const counts=lineupSlotCounts();
 return `<section class="card card-pad office-section weekly-setup-card">
   <div class="office-section-head"><div><h2>Commissioner • Starting Lineup Setup</h2><div class="small muted">Enter the official GLSK starter counts. FLEX is RB/WR/TE in this first build.</div></div></div>
   <div class="lineup-count-grid">${['QB','RB','WR','TE','FLEX','K','DST'].map(p=>`<label><span>${p}</span><input id="slot-count-${p}" class="input" type="number" min="0" max="5" value="${counts[p]||0}"></label>`).join('')}</div>
   <button class="btn btn-primary" data-action="save-lineup-slots">Save Starting Lineup</button>
 </section>`;
}
function lineupDraftKey(teamId,week){return `${teamId}:${week}`;}
function editableLineupFor(teamId,week){
 return state.lineupDrafts[lineupDraftKey(teamId,week)]||lineupFor(teamId,week);
}
function lineupSlotLocked(slotCode,teamId,week){
 const saved=lineupFor(teamId,week).find(l=>l.slot_code===slotCode);
 const draft=editableLineupFor(teamId,week).find(l=>l.slot_code===slotCode);
 return [saved,draft].some(l=>l?.player_key&&scoreFor(l.player_key,week)?.game_started);
}
function benchStartingSlots(playerKey,teamId,week){
 if(week!==currentWeek()||state.session?.spectator||state.lineupSaving||scoreFor(playerKey,week)?.game_started)return [];
 return state.lineupSlots.filter(slot=>!lineupSlotLocked(slot.slot_code,teamId,week)&&slotEligibleRoster(slot,teamId).some(r=>r.player_key===playerKey));
}
function changeLineupPlayer(slotCode,playerKey){
 const t=myTeam(),week=browseWeek();
 if(!t||state.session?.spectator||week!==currentWeek()||state.lineupSaving)throw new Error('This lineup is read-only.');
 const slot=state.lineupSlots.find(s=>s.slot_code===slotCode);
 if(!slot)throw new Error('Starting slot not found.');
 const rows=editableLineupFor(t.id,week).map(l=>({...l}));
 const target=rows.find(l=>l.slot_code===slotCode);
 if((target?.player_key||null)===(playerKey||null))return;
 if(lineupSlotLocked(slotCode,t.id,week))throw new Error('This starting position is locked.');
 if(playerKey&&!slotEligibleRoster(slot,t.id).some(r=>r.player_key===playerKey))throw new Error('This player is not eligible for that position.');
 if(playerKey&&scoreFor(playerKey,week)?.game_started)throw new Error('This player has already locked.');
 const source=playerKey?rows.find(l=>l.player_key===playerKey&&l.slot_code!==slotCode):null;
 if(source&&lineupSlotLocked(source.slot_code,t.id,week))throw new Error('This player’s starting position is locked.');
 const oldKey=target?.player_key||null;
 // A player already starting moves once. Swap back only when position-eligible.
 if(source){
   const sourceSlot=state.lineupSlots.find(s=>s.slot_code===source.slot_code);
   source.player_key=oldKey&&sourceSlot&&slotEligibleRoster(sourceSlot,t.id).some(r=>r.player_key===oldKey)?oldKey:null;
 }
 if(target)target.player_key=playerKey||null;
 else rows.push({slot_code:slotCode,player_key:playerKey||null,team_id:t.id,week});
 state.lineupDrafts[lineupDraftKey(t.id,week)]=rows.filter(l=>l.player_key);
}
// Maximum-weight assignment across ALL starter slots, including FLEX.
// Dummy columns permit empty slots when the roster cannot fill every position.
function bestLineupAssignment(slots,players){
 const n=slots.length,m=players.length+n;
 if(!n)return [];
 const bonus=players.reduce((total,p)=>total+Math.abs(p.points),0)*2+1;
 const costs=slots.map(slot=>Array.from({length:m},(_,j)=>j>=players.length?0:
   (slot.allowed_positions||[]).includes(String(players[j].position||'').toUpperCase())?-(bonus+players[j].points):bonus*(n+1)));
 const u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
 for(let i=1;i<=n;i++){
   p[0]=i;let j0=0;
   const minv=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
   do{
     used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;
     for(let j=1;j<=m;j++)if(!used[j]){
       const cur=costs[i0-1][j-1]-u[i0]-v[j];
       if(cur<minv[j]){minv[j]=cur;way[j]=j0;}
       if(minv[j]<delta){delta=minv[j];j1=j;}
     }
     for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta;}else minv[j]-=delta;
     j0=j1;
   }while(p[j0]!==0);
   do{const j1=way[j0];p[j0]=p[j1];j0=j1;}while(j0!==0);
 }
 const result=[];
 for(let j=1;j<=players.length;j++)if(p[j]&&costs[p[j]-1][j-1]<0)
   result.push({slot_code:slots[p[j]-1].slot_code,player_key:players[j-1].player_key});
 return result;
}
function lineupOptimizationInput(teamId,week){
 const started=key=>{
   const date=projectionFor(key,week)?.game_start_at;
   return Boolean(scoreFor(key,week)?.game_started||(date&&Number.isFinite(Date.parse(date))&&Date.parse(date)<=Date.now()));
 };
 const fixed=lineupFor(teamId,week).filter(l=>started(l.player_key)).map(l=>({...l}));
 const fixedSlots=new Set(fixed.map(l=>l.slot_code)),fixedPlayers=new Set(fixed.map(l=>l.player_key));
 const slots=state.lineupSlots.filter(s=>!fixedSlots.has(s.slot_code));
 const players=[],missing=[];
 for(const r of activeRosterFor(teamId)){
   const projection=projectionFor(r.player_key,week);
   if(fixedPlayers.has(r.player_key)||started(r.player_key)||Number(projection?.bye_week)===week)continue;
   if(!slots.some(slot=>(slot.allowed_positions||[]).includes(String(r.position||'').toUpperCase())))continue;
   const value=projection?.projected_fantasy_points;
   if(value==null||value===''||!Number.isFinite(Number(value))){missing.push(r.player_name);continue;}
   players.push({...r,points:Number(value)});
 }
 return {fixed,slots,players,missing};
}
function optimizeCurrentLineup(){
 const t=myTeam(),week=browseWeek();
 if(!t||state.session?.spectator||week!==currentWeek()||state.lineupSaving)throw new Error('This lineup is read-only.');
 const input=lineupOptimizationInput(t.id,week);
 if(!input.slots.length)throw new Error('All starting positions are locked.');
 if(input.missing.length)throw new Error(`Weekly projections are missing for ${input.missing.length} eligible player${input.missing.length===1?'':'s'}. Your lineup has not changed.`);
 if(!input.players.length)throw new Error('No eligible unlocked players with weekly projections.');
 const picks=bestLineupAssignment(input.slots,input.players);
 state.lineupDrafts[lineupDraftKey(t.id,week)]=input.fixed.concat(picks.map(p=>({...p,team_id:t.id,week})));
 return picks.length<input.slots.length?'Lineup optimized. Some slots could not be filled. Review and Save Lineup.':'Lineup optimized. Review your starters and Save Lineup.';
}
function lineupRowCanSwap(from,to,teamId,week){
 if(!from||!to||week!==currentWeek()||state.session?.spectator||state.lineupSaving)return false;
 if(from.slotCode===to.slotCode&&from.playerKey===to.playerKey)return false;
 const locked=row=>row.slotCode?lineupSlotLocked(row.slotCode,teamId,week):Boolean(row.playerKey&&scoreFor(row.playerKey,week)?.game_started);
 if(locked(from)||locked(to)||(!from.slotCode&&!to.slotCode))return false;
 const fits=(slotCode,key)=>!slotCode||!key||slotEligibleRoster(state.lineupSlots.find(s=>s.slot_code===slotCode)||{},teamId).some(r=>r.player_key===key);
 return fits(from.slotCode,to.playerKey)&&fits(to.slotCode,from.playerKey);
}
function chooseLineupRow(row){
 const t=myTeam(),week=browseWeek();
 if(!t||state.session?.spectator||week!==currentWeek()||state.lineupSaving)return;
 const from=state.lineupSelection;
 if(from&&from.teamId===t.id&&from.week===week){
   if(from.slotCode===row.slotCode&&from.playerKey===row.playerKey){state.lineupSelection=null;render();return;}
   if(!lineupRowCanSwap(from,row,t.id,week))return;
   try{
     if(row.slotCode)changeLineupPlayer(row.slotCode,from.playerKey);
     else changeLineupPlayer(from.slotCode,row.playerKey);
     state.lineupSelection=null;render();toast('Lineup changed. Review and Save Lineup.');
   }catch(e){state.lineupSelection=null;render();toast(e.message,'error');}
   return;
 }
 if(row.slotCode?lineupSlotLocked(row.slotCode,t.id,week):scoreFor(row.playerKey,week)?.game_started)return;
 state.lineupSelection={...row,teamId:t.id,week};render();
}
function lineupView(){
 const t=myTeam(),week=browseWeek(),slots=state.lineupSlots,current=currentWeek();
 if(!t)return `${pageHeading('Set Lineup',`Week ${week} lineup and player data.`,`Weekly Play`)}<div class="card empty">Sign in as a team owner to manage a lineup.</div>`;

 if(state.lineupSelection&&(state.lineupSelection.teamId!==t.id||state.lineupSelection.week!==week))state.lineupSelection=null;
 const lineup=editableLineupFor(t.id,week);
 const selection=state.lineupSelection;
 const starterKeys=new Set(lineup.map(l=>l.player_key));
 const bench=activeRosterFor(t.id).filter(r=>!starterKeys.has(r.player_key)).sort((a,b)=>{
   const p={QB:1,RB:2,WR:3,TE:4,K:5,DST:6};
   return (p[String(a.position||'').toUpperCase()]||9)-(p[String(b.position||'').toUpperCase()]||9)||a.player_name.localeCompare(b.player_name);
 });
 const editable=week===current&&!state.session?.spectator&&!state.lineupSaving;
 const optimizer=editable?lineupOptimizationInput(t.id,week):null;
 const optimizeReason=!optimizer?'':!optimizer.slots.length?'All starters locked':optimizer.missing.length?'Weekly projections needed':!optimizer.players.length?'No eligible players':'';
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
 const pointsLabel='Fan Pts';
 const showProj=true;
 const teamDisplayPoints=dataTab==='projected'?projectedTeamTotal(t.id,range,week):weeklyScore(t.id,week);

 const rowHtml=row=>{
   const {slot,cur,rp,bench:isBench}=row;
   const score=cur?scoreFor(cur.player_key,week):null;
   const locked=isBench?Boolean(score?.game_started):lineupSlotLocked(slot.slot_code,t.id,week);
   const d=dataFor(row);
   const proj=rp?projectionBundle(rp.player_key,dataTab==='projected'?range:'week',week):null;
   const actual=rp?actualBundle(rp.player_key,dataTab==='stats'?range:'week',week):null;
   const game=rp?lineupGameLabel(rp.player_key,week):{main:'—',sub:'Open starter'};
   const descriptor={slotCode:isBench?null:slot.slot_code,playerKey:cur?.player_key||null};
   const selected=selection&&selection.slotCode===descriptor.slotCode&&selection.playerKey===descriptor.playerKey;
   const eligible=selection&&lineupRowCanSwap(selection,descriptor,t.id,week);
   const faded=selection&&!selected&&!eligible;
   const label=isBench?'BN':String(slot.label).replace(/[0-9]+$/,'');
   const disabled=!editable||locked||Boolean(faded);
   const playerCell=`<div class="lineup-player-static"><button type="button" class="lineup-name-button" ${rp?`data-profile-key="${esc(rp.player_key)}"`:`data-lineup-pick ${disabled?'disabled':''}`}>${esc(rp?.player_name||'Empty position')}</button><span>${rp?`${esc(rp.nfl_team||'')} • ${esc(rp.position||'')}`:'Select an eligible player'}${locked?' • Locked':''}</span><small class="lineup-inline-game">${esc(game.main)}${game.sub&&game.sub!=='Open starter'?' • '+esc(game.sub):''}</small></div>`;
   return `<div class="lineup-data-row ${isBench?'bench-row':'starter-row'} ${locked?'is-locked':''} ${selected?'lineup-selected':eligible?'lineup-eligible':faded?'lineup-faded':''}" data-lineup-row data-row-slot="${esc(descriptor.slotCode||'')}" data-row-player="${esc(descriptor.playerKey||'')}">
     <div class="lineup-yahoo-pos"><button type="button" class="yahoo-pos lineup-position-button" data-lineup-pick aria-label="${selected?'Cancel selection':eligible?'Swap with':'Select'} ${esc(rp?.player_name||slot.label)}" aria-pressed="${Boolean(selected)}" ${disabled?'disabled':''}>${esc(label)}</button></div>
     <div class="lineup-yahoo-player">${playerCell}</div>
     <div class="lineup-data-game"><strong>${esc(game.main)}</strong><small>${esc(game.sub)}</small></div>
     <div class="lineup-num main-points">${fmtStat(actual?.fantasy_points,2)}</div>
     ${showProj?`<div class="lineup-num">${fmtStat(proj?.projected_fantasy_points,2)}</div><div class="lineup-num">${fmtStat(proj?.projected_max,2)}</div><div class="lineup-num">${fmtStat(proj?.projected_min,2)}</div>`:''}
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

   <div class="lineup-action-bar">
     ${editable?`<button type="button" class="lineup-optimize-button" data-action="optimize-lineup" ${optimizeReason?'disabled':''}>Optimize Lineup</button>`:''}
     <span class="lineup-selection-help" role="status">${selection?'Choose a green-highlighted player or position to swap.':editable?(optimizeReason||'Click a position to change your lineup.'):'This week is read-only.'}</span>
     ${selection?'<button type="button" class="lineup-cancel-button" data-action="cancel-lineup-selection">Cancel</button>':''}
   </div>
   <div class="lineup-data-scroller">
     <div class="lineup-data-head ${showProj?'with-proj':''}">
       <span>Pos</span><span>Offense</span><span>Opponent</span><span>${pointsLabel}</span>
       ${showProj?'<span>Proj Pts</span><span>Proj Max</span><span>Proj Min</span>':''}
       <span>Pos Rank</span>
       <span class="group-head">Passing</span><span></span><span></span>
       <span class="group-head">Rushing</span><span></span><span></span>
       <span class="group-head">Receiving</span><span></span><span></span><span></span>
     </div>
     <div class="lineup-data-subhead ${showProj?'with-proj':''}">
       <span></span><span></span><span></span><span></span>${showProj?'<span></span><span></span><span></span>':''}<span></span>
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
     <div>${editable?'<strong>Lineup locks at each player’s NFL kickoff.</strong><span>Click a position or bench player to make changes, then click Save Lineup.</span>':`<strong>Week ${week} is view-only.</strong><span>Return to the current week to make lineup changes.</span>`}</div>
     ${editable?`<button class="btn btn-primary" data-action="save-lineup">Save Week ${week} Lineup</button>`:''}
   </div>
 </section>

 ${dataTab==='projected'&&!state.playerProjections.length?'<div class="notice lineup-feed-notice">Projection layout is ready. Values will populate when the projection feed is connected.</div>':''}
 ${commissionerToolsActive()&&slots.length?lineupSetupPanel():''}`;
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
 if(!commissionerToolsActive())return '';
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

 ${commissionerToolsActive()&&matches.length&&ws?.status!=='final'?`<div class="weekly-finalize"><button class="btn btn-reset" data-action="finalize-week">Finalize Week ${week}</button><span>Finalized weeks feed the GLSK standings.</span></div>`:''}`;
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
 if(!commissionerToolsActive())return '<div class="card empty">Commissioner only.</div>';
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

  ${commissionerToolsActive()&&unmatched.length?`<section class="card history-section"><div class="office-section-head"><div><h2>Commissioner • Match Historical Franchises</h2><div class="small muted">${unmatched.length} imported team-season row${unmatched.length===1?'':'s'} need franchise mapping.</div></div></div><div class="history-unmatched">${unmatched.slice(0,40).map(r=>{const s=historySeasonById(r.history_season_id);return `<div class="history-map-row"><div><strong>${esc(r.team_name)}</strong><div class="small muted">${s?.season_year||'—'}${r.manager_name?` • ${esc(r.manager_name)}`:''}</div></div><select class="input" data-history-map-select="${r.id}"><option value="">Choose franchise…</option>${state.historyFranchises.map(f=>`<option value="${f.id}">${esc(f.display_name)}</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-history-map="${r.id}">Map</button></div>`}).join('')}</div><div class="history-new-franchise"><input id="history-new-franchise" class="input" placeholder="Former franchise name"><button class="btn btn-outline" data-action="history-create-franchise">Create Former Franchise</button></div></section>`:''}
  `;
}

function loginView(){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>${esc(LEAGUE_NAME)}</h1><p>Private League Access</p></div><div class="login-body"><div class="notice">A signed-in GLSK owner account is required. Public and spectator views are disabled.</div></div></div></div>`;}

function accountView(){
 const t=myTeam(),email=state.authUser?.email||state.session?.email||'—';
 return `${pageHeading('Account','Your private GLSK owner login and device access.','Owner Settings')}
 <div class="account-layout">
   <section class="card card-pad office-section account-card">
     <div class="office-section-head"><div><h2>Owner Account</h2><div class="section-caption">This login is linked to your GLSK franchise. A team may have multiple manager accounts.</div></div></div>
     <div class="account-detail-list">
       <div><span>Email</span><strong>${esc(email)}</strong></div>
       <div><span>Franchise</span><strong>${esc(t?.name||state.authAccount?.team_name||'—')}</strong></div>
       <div><span>Role</span><strong>${isCommish()?'Commissioner / Team Manager':'Team Manager'}</strong></div>
       <div><span>Session</span><strong>Stay signed in enabled</strong></div>
     </div>
     <div class="account-actions">
       <button class="btn btn-outline" data-action="account-reset-password">Send Password Reset Email</button>
       <button class="btn btn-reset" data-action="leave">Sign Out</button>
     </div>
   </section>
   <section class="card card-pad office-section account-card">
     <div class="office-section-head"><div><h2>Notifications</h2><div class="section-caption">Push subscriptions are tied to this owner account and this device.</div></div></div>
     <div class="account-notification-status">
       <span class="push-status-dot ${state.pushSubscribed?'on':'off'}"></span>
       <div><strong>${state.pushSubscribed?'Push enabled on this device':'Push not enabled on this device'}</strong><span>${state.pushSubscribed?'GLSK can alert this device while the app is closed.':'Open Notifications to enable background alerts.'}</span></div>
     </div>
     <button class="btn btn-primary" data-tab="notifications">Open Notification Settings</button>
   </section>
 </div>`;
}

function setupError(){return `<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>League Office Ready</h1><p>Database connection is missing.</p></div></div></div>`;}
function render(){if(!configured){app.innerHTML=setupError();return;}if(state.loading){app.innerHTML='<div class="login-wrap"><div style="color:white;font-weight:900">Loading League Office…</div></div>';return;}if(!state.session){app.innerHTML=loginView();bind();return;}if(state.tab==='reconcile'){state.commissionerSection='reconcile';state.tab='commissioner';}let content=state.tab==='team'?teamPageView():state.tab==='biddollars'?bidDollarsView():state.tab==='bidbank'?bidBankPage():state.tab==='bidhistory'?bidHistoryPage():state.tab==='draft'?draftHubView():state.tab==='teamhub'?teamHubView():state.tab==='communications'?communicationsHubView():state.tab==='leaguehub'?leagueHubView():state.tab==='settingshub'?settingsHubView():state.tab==='commissioner'?commissionerHubView():state.tab==='lineup'?lineupView():state.tab==='freeagents'?freeAgencyView():state.tab==='chat'?chatView():state.tab==='matchups'?matchupsView():state.tab==='schedule'?scheduleView():state.tab==='standings'?standingsView():state.tab==='board'?boardView():state.tab==='notifications'?notificationView():state.tab==='teams'?teamsView():state.tab==='contracts'?contractsView():state.tab==='trades'?tradesView():state.tab==='transactions'?transactionsView():state.tab==='history'?historyView():state.tab==='rules'?rulesView():state.tab==='deadlines'?deadlinesView():state.tab==='finances'?financesView():state.tab==='account'?accountView():state.tab==='reconcile'?reconcileView():dashboard();app.innerHTML=`<div class="office-shell">${topBar()}<main class="main">${content}</main>${bottomNav()}</div>`;bind();}

async function logout(){const t=myTeam();await signOutOwner({roomCode:ROOM_CODE,teamId:t?.id||null,legacyStorageKey:STORAGE_KEY});location.reload();}
async function commish(name,args={},msg='Saved.'){try{await rpc(name,{p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,...args});toast(msg);await loadData();render();}catch(e){toast(e.message,'error');}}

function bind(){
 app.querySelectorAll("[data-bid-history]").forEach(b=>b.addEventListener("click",()=>{state.bidHistoryTab=b.dataset.bidHistory;render();}));
 bindRollover({state,rpc,refresh:async()=>{await loadData();render();}});
 app.querySelectorAll('[data-open-team]').forEach(link=>link.addEventListener('click',event=>{
   if(event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();
   state.selectedTeamId=link.dataset.openTeam;
   setTab('team');
   window.scrollTo({top:0,behavior:'auto'});
 }));
 const openCommissionerSection=key=>{
   if(!isCommish())return;
   state.commissionerSection=commissionerSections.some(([id])=>id===key)?key:null;
   setTab('commissioner');
 };
 app.querySelectorAll('[data-commissioner-section]').forEach(b=>b.addEventListener('click',()=>openCommissionerSection(b.dataset.commissionerSection)));
 app.querySelector('#commissioner-section')?.addEventListener('change',e=>openCommissionerSection(e.target.value));
 window.GLSKPlayerProfiles?.register({
   read:()=>({...state,catalog:state.notificationPlayers}),
   refresh:async()=>{await loadData();render();}
 });
 window.GLSKAutocomplete?.addNames([...state.roster.map(p=>p.player_name),...(state.waiverCenter?.players||[]).map(p=>p.player_name),...state.notificationPlayers.map(p=>p.name),...state.teams.map(t=>t.name)]);
 app.querySelector('[data-action="optimize-lineup"]')?.addEventListener('click',()=>{
   try{const message=optimizeCurrentLineup();state.lineupSelection=null;render();toast(message);}
   catch(e){toast(e.message,'error');}
 });
 app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
 app.querySelector('#chat-year')?.addEventListener('change',async e=>{
   state.chatYear=Number(e.target.value);
   state.chatMessages=[];
   state.chatOldestAt=null;
   state.chatHasMore=false;
   state.chatReplyTo=null;
   state.chatEditingId=null;
   state.chatDraft='';
   state.chatAutoScroll=true;
   await loadChat(false);
   render();
   if(state.chatYear===Number(state.season?.season_year||2026))setTimeout(()=>markChatRead(),40);
 });
 app.querySelector('[data-action="chat-load-older"]')?.addEventListener('click',async()=>{
   state.chatAutoScroll=false;
   const list=document.getElementById('chat-message-list'),oldHeight=list?.scrollHeight||0;
   await loadChat(true);
   render();
   requestAnimationFrame(()=>{
     const next=document.getElementById('chat-message-list');
     if(next)next.scrollTop=Math.max(0,next.scrollHeight-oldHeight);
   });
 });
 app.querySelector('[data-action="chat-change-name"]')?.addEventListener('click',async()=>{
   const name=prompt('Chat display name (your franchise will still be shown):',state.chatDisplayName||'');
   if(name==null)return;
   const trimmed=name.trim();
   if(!trimmed)return toast('Chat name cannot be blank.','error');
   try{
     await rpc('league_owner_set_chat_display_name',{p_room_code:ROOM_CODE,p_display_name:trimmed});
     state.chatDisplayName=trimmed;
     toast('Chat name updated.');
     render();
   }catch(e){toast(e.message,'error');}
 });
 const chatInput=app.querySelector('#chat-compose');
 chatInput?.addEventListener('input',e=>{
   state.chatDraft=e.target.value;
   e.target.style.height='auto';
   e.target.style.height=Math.min(160,e.target.scrollHeight)+'px';
 });
 chatInput?.addEventListener('keydown',e=>{
   if(e.key==='Enter'&&!e.shiftKey){
     e.preventDefault();
     app.querySelector('[data-action="chat-send"]')?.click();
   }
 });
 app.querySelector('[data-action="chat-send"]')?.addEventListener('click',async()=>{
   const t=myTeam(),body=(document.getElementById('chat-compose')?.value||state.chatDraft||'').trim();
   if(!t||!body)return;
   try{
     if(state.chatEditingId){
       await rpc('league_owner_edit_chat_message',{
         p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
         p_message_id:Number(state.chatEditingId),p_body:body
       });
       toast('Message updated.');
     }else{
       await rpc('league_owner_send_chat_message',{
         p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
         p_body:body,p_reply_to_message_id:state.chatReplyTo?Number(state.chatReplyTo):null
       });
     }
     state.chatDraft='';
     state.chatReplyTo=null;
     state.chatEditingId=null;
     state.chatReactionTarget=null;
     state.chatAutoScroll=true;
     await loadChat(false);
     await markChatRead();
     render();
   }catch(e){toast(e.message,'error');}
 });
 app.querySelector('[data-action="chat-cancel-context"]')?.addEventListener('click',()=>{
   state.chatReplyTo=null;
   state.chatEditingId=null;
   state.chatDraft='';
   render();
 });
 app.querySelectorAll('[data-chat-reply]').forEach(b=>b.addEventListener('click',()=>{
   state.chatReplyTo=b.dataset.chatReply;
   state.chatEditingId=null;
   state.chatDraft='';
   state.chatAutoScroll=true;
   render();
   requestAnimationFrame(()=>document.getElementById('chat-compose')?.focus());
 }));
 app.querySelectorAll('[data-chat-edit]').forEach(b=>b.addEventListener('click',()=>{
   const m=chatMessageById(b.dataset.chatEdit);if(!m)return;
   state.chatEditingId=String(m.id);
   state.chatReplyTo=null;
   state.chatDraft=m.body||'';
   state.chatAutoScroll=true;
   render();
   requestAnimationFrame(()=>{const el=document.getElementById('chat-compose');el?.focus();el?.setSelectionRange(el.value.length,el.value.length);});
 }));
 app.querySelectorAll('[data-chat-delete]').forEach(b=>b.addEventListener('click',async()=>{
   const t=myTeam(),m=chatMessageById(b.dataset.chatDelete);if(!t||!m)return;
   if(!confirm(`Remove this message from ${m.author_display_name||m.team_name||'League Chat'}?`))return;
   try{
     await rpc('league_owner_remove_chat_message',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_message_id:Number(m.id)
     });
     if(String(state.chatEditingId)===String(m.id)){state.chatEditingId=null;state.chatDraft='';}
     if(String(state.chatReplyTo)===String(m.id))state.chatReplyTo=null;
     await loadChat(false);render();
   }catch(e){toast(e.message,'error');}
 }));
 app.querySelectorAll('[data-chat-react]').forEach(b=>b.addEventListener('click',()=>{
   state.chatReactionTarget=state.chatReactionTarget===String(b.dataset.chatReact)?null:String(b.dataset.chatReact);
   render();
 }));
 app.querySelectorAll('[data-chat-reaction-message]').forEach(b=>b.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   try{
     await rpc('league_owner_toggle_chat_reaction',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_message_id:Number(b.dataset.chatReactionMessage),
       p_emoji:b.dataset.chatReactionEmoji
     });
     state.chatReactionTarget=null;
     await loadChat(false);render();
   }catch(e){toast(e.message,'error');}
 }));
 app.querySelectorAll('[data-chat-jump]').forEach(b=>b.addEventListener('click',()=>{
   const target=document.querySelector(`[data-chat-message="${b.dataset.chatJump}"]`);
   if(target){
     state.chatAutoScroll=false;
     target.scrollIntoView({behavior:'smooth',block:'center'});
     target.classList.add('chat-highlight');
     setTimeout(()=>target.classList.remove('chat-highlight'),1400);
   }
 }));
 const chatList=app.querySelector('#chat-message-list');
 if(chatList){
   chatList.addEventListener('scroll',()=>{
     state.chatAutoScroll=(chatList.scrollHeight-chatList.scrollTop-chatList.clientHeight)<140;
   },{passive:true});
   requestAnimationFrame(()=>{
     if(state.chatAutoScroll)chatList.scrollTop=chatList.scrollHeight;
     if(state.tab==='chat')markChatRead();
     const ta=document.getElementById('chat-compose');
     if(ta){ta.style.height='auto';ta.style.height=Math.min(160,ta.scrollHeight)+'px';}
   });
 }

 app.querySelectorAll('[data-fa-select]').forEach(b=>b.addEventListener('click',()=>{
   state.waiverSelectedPlayer=b.dataset.faSelect;
   render();document.querySelector('.fa-action-card')?.scrollIntoView({behavior:'smooth',block:'center'});
 }));
 app.querySelectorAll('[data-fa-position]').forEach(b=>b.addEventListener('click',()=>{state.waiverPosition=b.dataset.faPosition;render();}));
 for(const [id,key] of [['fa-nfl','faNfl'],['fa-fantasy','faFantasy'],['fa-stats','faStats'],['fa-week','faWeek'],['fa-source','faSource']])app.querySelector('#'+id)?.addEventListener('change',e=>{state[key]=e.target.value;if(key==='faFantasy'&&e.target.value)state.faShowMine=false;render();});
 app.querySelector('#fa-show-mine')?.addEventListener('change',e=>{state.faShowMine=e.target.checked;state.faFantasy='';render();});
 app.querySelectorAll('[data-fa-sort]').forEach(b=>b.addEventListener('click',()=>{const key=b.dataset.faSort;state.faSortDesc=state.faSort===key?!state.faSortDesc:key==='points';state.faSort=key;render();}));
 app.querySelectorAll('[data-fa-watch]').forEach(b=>b.addEventListener('click',async()=>{
   const p=faPlayerPool().find(p=>p.player_key===b.dataset.faWatch),t=myTeam();if(!p||!t)return;b.disabled=true;
   try{const watch=faWatchFor(p);
     if(watch)await rpc('league_owner_remove_player_watch',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_watch_id:Number(watch.id)});
     else await rpc('league_owner_set_player_watch',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_player_name:p.player_name,p_nfl_team:p.nfl_team||'',p_position:p.position||'',p_injury_alerts:true,p_availability_alerts:true});
     await loadNotifications();render();toast(watch?'Player removed from watchlist.':'Player watched. Injury and availability alerts enabled.');
   }catch(e){toast(e.message,'error');b.disabled=false;}
 }));
 app.querySelector('#fa-search')?.addEventListener('input',e=>{
   state.waiverSearch=e.target.value;
   const start=e.target.selectionStart,end=e.target.selectionEnd;
   clearTimeout(e.target._faTimer);
   e.target._faTimer=setTimeout(()=>renderPreservingInputFocus('fa-search',start,end),120);
 });
 app.querySelector('#fa-position')?.addEventListener('change',e=>{state.waiverPosition=e.target.value;render();});
 app.querySelector('#fa-status')?.addEventListener('change',e=>{state.waiverStatus=e.target.value;render();});

 app.querySelector('[data-action="fa-add-now"]')?.addEventListener('click',async()=>{
   const t=myTeam(),p=(state.waiverCenter?.players||[]).find(x=>x.player_key===state.waiverSelectedPlayer);
   if(!t||!p)return;
   const drop=document.getElementById('fa-drop-player')?.value||null;
   if(activeRosterFor(t.id).length>=Number(state.season?.roster_limit||18)&&!drop)return toast('Roster is full. Select a player to drop.','error');
   if(!confirm(`Add ${p.player_name} as a free agent for $0${drop?' and complete the selected drop':''}?`))return;
   try{
     await rpc('league_owner_add_free_agent',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_player_key:p.player_key,p_drop_player_key:drop
     });
     toast(`${p.player_name} added.`);
     state.waiverSelectedPlayer=null;
     await loadData();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelector('[data-action="fa-submit-claim"]')?.addEventListener('click',async()=>{
   const t=myTeam(),p=(state.waiverCenter?.players||[]).find(x=>x.player_key===state.waiverSelectedPlayer);
   if(!t||!p)return;
   const bid=Number(document.getElementById('fa-waiver-bid')?.value);
   const drop=document.getElementById('fa-drop-player')?.value||null;
   if(!Number.isInteger(bid)||bid<0)return toast('Enter a whole-number FAAB bid.','error');
   if(activeRosterFor(t.id).length>=Number(state.season?.roster_limit||18)&&!drop)return toast('Roster is full. Select a player to drop if the claim wins.','error');
   try{
     await rpc('league_owner_submit_waiver_claim',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_player_key:p.player_key,p_bid_amount:bid,p_drop_player_key:drop
     });
     toast(`Waiver claim saved for ${p.player_name}.`);
     await loadWaiverCenter();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelectorAll('[data-cancel-waiver]').forEach(b=>b.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   if(!confirm('Cancel this waiver claim?'))return;
   try{
     await rpc('league_owner_cancel_waiver_claim',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_claim_id:b.dataset.cancelWaiver
     });
     toast('Waiver claim cancelled.');
     await loadWaiverCenter();render();
   }catch(e){toast(e.message,'error');}
 }));

 app.querySelector('[data-action="fa-save-settings"]')?.addEventListener('click',()=>{
   commish('league_commish_set_free_agent_settings',{
     p_enabled:document.getElementById('fa-enabled')?.value==='true',
     p_waiver_days:Number(document.getElementById('fa-waiver-days')?.value||1),
     p_allow_zero_bid:document.getElementById('fa-zero-bids')?.value==='true',
     p_rolling_priority:document.getElementById('fa-rolling-priority')?.value==='true'
   },'Free Agency settings saved.');
 });

 app.querySelector('[data-action="fa-process-waivers"]')?.addEventListener('click',async()=>{
   if(!confirm('Process every waiver player whose claim deadline has ended? Pending bids will be resolved now.'))return;
   try{
     const d=await rpc('league_commish_process_waivers',{
       p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,p_force:false
     });
     toast(`Waivers processed • ${d.players_awarded||0} awarded • ${d.players_cleared_to_free_agency||0} cleared to FA.`);
     state.waiverSelectedPlayer=null;
     await loadData();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelectorAll('[data-waiver-priority-team]').forEach(b=>b.addEventListener('click',()=>{
   commish('league_commish_move_waiver_priority',{
     p_team_id:b.dataset.waiverPriorityTeam,
     p_direction:b.dataset.waiverPriorityDir
   },'Waiver priority updated.');
 }));

 app.querySelector('[data-action="fa-add-pool-player"]')?.addEventListener('click',async()=>{
   const name=document.getElementById('fa-pool-player')?.value.trim();
   if(!name)return toast('Enter a player name.','error');
   const rawRank=document.getElementById('fa-pool-rank')?.value;
   try{
     await rpc('league_commish_upsert_free_agent_player',{
       p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,
       p_player_name:name,
       p_nfl_team:document.getElementById('fa-pool-team')?.value.trim()||'',
       p_position:document.getElementById('fa-pool-position')?.value,
       p_yahoo_rank:rawRank?Number(rawRank):null
     });
     toast(`${name} saved to the player pool.`);
     await loadData();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelector('[data-action="fa-commish-waive-selected"]')?.addEventListener('click',async()=>{
   const p=(state.waiverCenter?.players||[]).find(x=>x.player_key===state.waiverSelectedPlayer);
   if(!p)return;
   if(!confirm(`Put ${p.player_name} on waivers using the current waiver-duration setting?`))return;
   try{
     await rpc('league_commish_place_player_on_waivers',{
       p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,
       p_player_key:p.player_key,p_ends_at:null
     });
     toast(`${p.player_name} placed on waivers.`);
     await loadWaiverCenter();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelector('[data-action="fa-commish-clear-selected"]')?.addEventListener('click',async()=>{
   const p=(state.waiverCenter?.players||[]).find(x=>x.player_key===state.waiverSelectedPlayer);
   if(!p)return;
   if(!confirm(`Clear ${p.player_name} to immediate free agency? Any pending claims on him will be cancelled.`))return;
   try{
     await rpc('league_commish_clear_player_waiver',{
       p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,
       p_player_key:p.player_key
     });
     toast(`${p.player_name} cleared to free agency.`);
     await loadWaiverCenter();render();
   }catch(e){toast(e.message,'error');}
 });

 app.querySelector('#history-season')?.addEventListener('change',e=>{state.historySeason=e.target.value;render();});
 app.querySelectorAll('[data-lineup-row]').forEach(el=>{
   const choose=()=>chooseLineupRow({slotCode:el.dataset.rowSlot||null,playerKey:el.dataset.rowPlayer||null});
   el.querySelectorAll('[data-lineup-pick]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();choose();}));
   el.addEventListener('click',()=>{if(el.classList.contains('lineup-eligible'))choose();});
 });
 app.querySelector('[data-action="cancel-lineup-selection"]')?.addEventListener('click',()=>{state.lineupSelection=null;render();});
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
 app.querySelector('#board-mode')?.addEventListener('change',e=>{state.boardMode=e.target.value;state.boardSelectedThread=null;state.boardSearch='';render();});
 app.querySelector('#board-search')?.addEventListener('input',e=>{state.boardSearch=e.target.value;state.boardSelectedThread=null;const start=e.target.selectionStart,end=e.target.selectionEnd;clearTimeout(e.target._boardTimer);e.target._boardTimer=setTimeout(()=>renderPreservingInputFocus('board-search',start,end),120);});
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
 app.querySelectorAll('[data-board-delete-thread],[data-board-delete-post]').forEach(b=>b.addEventListener('click',async()=>{
   if(!isCommish()||b.disabled)return;
   const isThread=Boolean(b.dataset.boardDeleteThread);
   const question=isThread?'Delete this entire thread and all its replies from the GLSK message board? This does not delete the original Google Groups emails.':'Delete this message from the GLSK message board? Other replies will remain. This does not delete the original Google Groups email.';
   if(!confirm(question))return;
   b.disabled=true;
   try{
     await rpc('league_commish_delete_board_item',{
       p_room_code:ROOM_CODE,p_commish_pin:state.session.commishPin,
       p_thread_id:b.dataset.boardDeleteThread||b.dataset.threadId,
       p_post_id:isThread?null:b.dataset.boardDeletePost
     });
     if(isThread)state.boardSelectedThread=null;
     await loadData();render();toast(isThread?'Thread deleted.':'Message deleted.');
   }catch(e){toast(e.message,'error');b.disabled=false;}
 }));
 app.querySelectorAll('[data-board-action]').forEach(b=>b.addEventListener('click',()=>{
   const action=b.dataset.boardAction,id=Number(b.dataset.threadId);
   if(action==='archive'&&!confirm('Archive this discussion? It will disappear from the active message board.'))return;
   commish('league_commish_message_thread_action',{p_thread_id:id,p_action:action},`Discussion ${action}d.`);
 }));
 app.querySelectorAll('[data-notification-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.notificationTab)));
 app.querySelector('[data-action="push-enable"]')?.addEventListener('click',enablePushNotifications);
 app.querySelector('[data-action="push-disable"]')?.addEventListener('click',disablePushNotifications);
 app.querySelector('[data-action="push-refresh-permission"]')?.addEventListener('click',async()=>{
   if(state.pushBusy)return;
   state.pushBusy=true;render();
   await refreshPushState();
   state.pushBusy=false;render();
   if(state.pushPermission==='granted'&&!state.pushSubscribed)toast('Browser permission is allowed. You can now enable GLSK push notifications.');
   else if(state.pushPermission==='denied')toast('Notifications are still blocked in browser or extension settings.','error');
 });
 app.querySelector('[data-action="push-test"]')?.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   try{await rpc('league_owner_test_push',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin});toast('Test push queued. Lock the phone or close GLSK and watch for the alert.');}
   catch(e){toast(e.message,'error');}
 });
 app.querySelector('[data-action="notifications-mark-read"]')?.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   try{
     await rpc('league_owner_mark_notifications_read',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin});
     await loadNotifications();render();
   }catch(e){toast(e.message,'error');}
 });
 app.querySelectorAll('.notification-pref-toggle').forEach(el=>el.addEventListener('change',async()=>{
   const t=myTeam();if(!t)return;
   try{
     await rpc('league_owner_set_notification_preference',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_category:el.dataset.notificationCategory,p_enabled:el.checked
     });
     await loadNotifications();render();
   }catch(e){toast(e.message,'error');}
 }));
 app.querySelector('[data-action="notification-add-watch"]')?.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   const name=document.getElementById('notification-watch-player')?.value.trim();
   const p=state.notificationPlayers.find(x=>String(x.name).toLowerCase()===String(name||'').toLowerCase());
   if(!p)return toast('Choose a player from the player list.','error');
   try{
     await rpc('league_owner_set_player_watch',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_player_name:p.name,p_nfl_team:p.nfl_team||'',p_position:p.position||'',
       p_injury_alerts:Boolean(document.getElementById('watch-injury')?.checked),
       p_availability_alerts:Boolean(document.getElementById('watch-availability')?.checked)
     });
     toast(`${p.name} added to Player Alerts.`);
     await loadNotifications();render();
   }catch(e){toast(e.message,'error');}
 });
 app.querySelectorAll('[data-remove-watch]').forEach(b=>b.addEventListener('click',async()=>{
   const t=myTeam();if(!t)return;
   try{
     await rpc('league_owner_remove_player_watch',{
       p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,
       p_watch_id:Number(b.dataset.removeWatch)
     });
     await loadNotifications();render();
   }catch(e){toast(e.message,'error');}
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
   const t=myTeam(),week=browseWeek();if(!t||state.lineupSaving||state.session?.spectator||week!==currentWeek())return;
   const draft=editableLineupFor(t.id,week);
   const entries=state.lineupSlots.map(slot=>({slot_code:slot.slot_code,player_key:draft.find(l=>l.slot_code===slot.slot_code)?.player_key||null}));
   state.lineupSaving=true;render();
   try{
     await rpc('league_owner_save_lineup',{p_room_code:ROOM_CODE,p_team_id:t.id,p_pin:state.session.pin,p_week:week,p_entries:entries});
     await loadData();delete state.lineupDrafts[lineupDraftKey(t.id,week)];toast(`Week ${week} lineup saved.`);
   }catch(e){toast(e.message,'error');}
   finally{state.lineupSaving=false;render();}
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
 app.querySelector('[data-action="history-create-franchise"]')?.addEventListener('click',()=>{const name=document.getElementById('history-new-franchise')?.value.trim();if(!name)return toast('Enter a franchise name.','error');commish('league_commish_create_history_franchise',{p_display_name:name},'Historical franchise created.');}); app.querySelector('[data-action="account-reset-password"]')?.addEventListener('click',async()=>{
   try{await sendPasswordResetEmail(state.authUser?.email);toast('Password reset email sent.');}
   catch(e){toast(e.message,'error');}
 });
 app.querySelector('[data-action="leave"]')?.addEventListener('click',logout);
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
 app.querySelector('#tx-team')?.addEventListener('change',updateTx);app.querySelector('#tx-type')?.addEventListener('change',updateTx);
 app.querySelector('#tx-search')?.addEventListener('input',e=>{
   state.txFilters={team:document.getElementById('tx-team')?.value||'',type:document.getElementById('tx-type')?.value||'',search:e.target.value||''};
   const start=e.target.selectionStart,end=e.target.selectionEnd;
   clearTimeout(e.target._txTimer);
   e.target._txTimer=setTimeout(()=>renderPreservingInputFocus('tx-search',start,end),120);
 });
 app.querySelector('[data-action="save-correction"]')?.addEventListener('click',()=>{const desc=document.getElementById('corr-desc')?.value.trim();if(!desc)return toast('Enter a correction description.','error');commish('league_commish_correction',{p_team_id:document.getElementById('corr-team')?.value||null,p_bid_delta:Number(document.getElementById('corr-bids')?.value||0),p_description:desc,p_reverse_transaction_id:document.getElementById('corr-reverse')?.value||null},'Correction recorded.');});
}

async function subscribe(){if(state.realtime)await supabase.removeChannel(state.realtime);state.realtime=supabase.channel(`league-office-${ROOM_CODE}`).on('postgres_changes',{event:'*',schema:'public',table:'league_roster_entries'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'teams'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_contracts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_rule_settings'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'redistribution_rules'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadlines'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_deadline_team_status'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_seasons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_history_team_seasons'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_stats'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_lineups'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_weekly_player_scores'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_schedule'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_week_states'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_scoring_rules'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_projections'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_message_threads'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_message_posts'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_transactions'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_trades'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_status_updates'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_free_agent_settings'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_player_directory'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_waiver_holds'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_waiver_priority'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_waiver_runs'},refresh).on('postgres_changes',{event:'*',schema:'public',table:'league_chat_messages'},chatRefresh).on('postgres_changes',{event:'*',schema:'public',table:'league_chat_reactions'},chatRefresh).subscribe();}
let refreshTimer=null;function refresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(async()=>{try{await loadData();render();}catch(e){console.warn(e);}},180);}
let chatRefreshTimer=null;function chatRefresh(){clearTimeout(chatRefreshTimer);chatRefreshTimer=setTimeout(async()=>{try{await loadChat(false);await loadNotifications();if(state.tab==='chat')await markChatRead();render();}catch(e){console.warn(e);}},80);}

ensurePwaMetadata();

async function init(){
 if(!configured){state.loading=false;render();return;}
 try{
   const auth=await requireOwnerAccount({app,roomCode:ROOM_CODE,leagueName:LEAGUE_NAME,legacyStorageKey:STORAGE_KEY});
   state.authUser=auth.user;
   state.authAccount=auth.account;
   saveSession(legacySessionFromAccount(auth.account,auth.user));
   await loadData();
   state.loading=false;
   render();
   promptOwnerPush(ROOM_CODE,LEAGUE_NAME,auth.account).catch(()=>{});
   await subscribe();
 }catch(e){
   state.loading=false;
   app.innerHTML=`<div class="login-wrap"><div class="login-card"><div class="login-head"><h1>League Office</h1><p>Account setup required.</p></div><div class="login-body"><div class="error">${esc(e.message)}</div><p class="small muted">Run the GLSK v7 owner-account migration, then refresh.</p></div></div></div>`;
 }
}

init();
