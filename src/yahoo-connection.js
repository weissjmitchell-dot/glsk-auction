import {supabase} from './supabase.js';

const copy={
 connected:'Yahoo sign-in saved. Use Check API Access to verify Fantasy Sports permissions.',
 denied:'Yahoo sign-in was cancelled or permission was declined.',
 permissions:'Yahoo Fantasy access is not available yet. Check Fantasy Sports permissions in your Yahoo developer app.',
 state:'This Yahoo sign-in expired or was already used. Choose Connect Yahoo to start again.',
 auth:'Sign in to GLSK again, then connect Yahoo.',
 configuration:'Check the three Yahoo environment variables in Vercel, then deploy again.',
 setup:'Install the GLSK v745 Yahoo SQL migration in Supabase first.',
 forbidden:'Commissioner access is required.',
 conflict:'The connection changed. Refresh its status and retry.',
 busy:'Another Yahoo operation is in progress. Try again in a minute.',
 reconnect:'Yahoo requires a new sign-in. Choose Connect Yahoo again.',
 unavailable:'Yahoo is temporarily unavailable. Try again shortly.',
 database:'The Yahoo connection could not be saved. Please try again.',
 callback:'The Yahoo connection could not be completed. Please try again.'
};
const model={user:null,loaded:false,busy:false,connected:false,connectedAt:null,verified:false,checkedAt:null,message:'',error:false};
const time=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'':d.toLocaleString();};
export function yahooConnectionView(){
 return `<section class="card card-pad office-section" id="yahoo-connection" aria-labelledby="yahoo-heading">
  <div class="office-section-head"><h2 id="yahoo-heading">Yahoo Connection</h2><span class="status-chip" data-yahoo-status>Checking connection…</span></div>
  <p>Connect your Yahoo account and check Fantasy Sports API access.</p>
  <p class="small muted" data-yahoo-details></p>
  <div class="row gap-8 wrap" style="margin:16px 0">
   <button class="btn btn-primary" data-yahoo-action="connect">Connect Yahoo</button>
   <button class="btn btn-outline" data-yahoo-action="test" disabled>Check API Access</button>
   <button class="btn btn-outline" data-yahoo-action="status">Refresh Status</button>
   <button class="btn btn-reset" data-yahoo-action="disconnect" disabled>Disconnect</button>
  </div>
  <p data-yahoo-message role="status" aria-live="polite"></p>
  <div class="notice">Player-data imports are not enabled yet. Yahoo still needs to confirm permission for shared league use and what data is available.</div>
 </section>`;
}
function paint(root){
 if(!root?.isConnected)return;
 root.querySelector('[data-yahoo-status]').textContent=!model.loaded?'Not checked':model.connected?(model.verified?'API access verified':'Yahoo sign-in saved'):'Not connected';
 const details=[];
 if(model.connectedAt)details.push('Connected '+time(model.connectedAt));
 if(model.checkedAt)details.push('Access checked '+time(model.checkedAt));
 root.querySelector('[data-yahoo-details]').textContent=details.join(' • ');
 const message=root.querySelector('[data-yahoo-message]');message.textContent=model.message;message.className=model.error?'error':'';
 for(const button of root.querySelectorAll('[data-yahoo-action]')){
  const action=button.dataset.yahooAction;
  button.disabled=model.busy||(['test','disconnect'].includes(action)&&!model.connected);
 }
 root.setAttribute('aria-busy',String(model.busy));
}
async function request(action,user){
 const {data,error}=await supabase.auth.getSession(),session=data?.session;
 if(error||!session?.access_token||session.user?.id!==user)throw new Error(copy.auth);
 let response;
 try{response=await fetch('/api/yahoo-connection',{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action}),signal:AbortSignal.timeout(55000)});}
 catch{throw new Error('Could not reach the Yahoo connection service. Refresh its status before retrying.');}
 let result;try{result=await response.json();}catch{throw new Error('The Yahoo connection files are not deployed yet. Upload the update and redeploy.');}
 if(!response.ok){const error=new Error(result.error||'Yahoo connection unavailable.');error.code=result.code;throw error;}
 return result;
}
export function bindYahooConnection({state}){
 const root=document.getElementById('yahoo-connection');
 if(!root||state.tab!=='commissioner'||state.commissionerSection!=='yahoo'||!state.authAccount?.is_commissioner||!state.authUser?.id)return;
 const user=state.authUser.id;
 if(model.user!==user)Object.assign(model,{user,loaded:false,busy:false,connected:false,connectedAt:null,verified:false,checkedAt:null,message:'',error:false});
 const url=new URL(location.href),outcome=url.searchParams.get('yahoo');
 if(outcome){
  model.message=copy[outcome]||copy.callback;model.error=outcome!=='connected';model.loaded=false;
  url.searchParams.delete('yahoo');history.replaceState(null,'',url.pathname+url.search+url.hash);
 }
 const livePaint=()=>{if(model.user===user)paint(document.getElementById('yahoo-connection'));};
 const run=async action=>{
  if(model.busy)return;
  if(action==='disconnect'&&!confirm('Remove the saved Yahoo connection from GLSK? You can reconnect later.'))return;
  model.busy=true;model.error=false;livePaint();
  try{
   const result=await request(action,user);if(model.user!==user||state.authUser?.id!==user)return;
   if(action==='connect'){
    const destination=new URL(result.url);
    if(destination.origin!=='https://api.login.yahoo.com'||destination.pathname!=='/oauth2/request_auth')throw new Error('Yahoo returned an unexpected sign-in address.');
    location.assign(destination.href);return;
   }
   if(model.connectedAt!==result.connectedAt)Object.assign(model,{verified:false,checkedAt:null});
   model.loaded=true;model.connected=result.connected;model.connectedAt=result.connectedAt;
   if(!result.connected||action==='disconnect')Object.assign(model,{verified:false,checkedAt:null});
   if(action==='test')Object.assign(model,{verified:result.verified===true,checkedAt:result.checkedAt,message:'Yahoo Fantasy API access verified. Player-data imports are not enabled yet.'});
   else if(action==='disconnect')model.message='The saved Yahoo connection was removed from GLSK.';
  }catch(error){
   if(model.user!==user)return;
   model.message=error.message;model.error=true;
   if(action==='test')Object.assign(model,{verified:false,checkedAt:null});
  }finally{if(model.user===user){model.busy=false;livePaint();}}
 };
 for(const button of root.querySelectorAll('[data-yahoo-action]'))button.addEventListener('click',()=>run(button.dataset.yahooAction));
 paint(root);if(!model.loaded&&!model.busy)void run('status');
}
