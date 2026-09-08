import { supabase } from './supabase.js';

const PUSH_PROMPT_DELAY_MS = 900;
const PUSH_PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function esc(v=''){
  return String(v ?? '').replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}
async function rpc(name,args={}){
  const {data,error}=await supabase.rpc(name,args);
  if(error)throw new Error(error.message);
  if(data?.ok===false)throw new Error(data.error||'Request failed.');
  return data;
}
function normalizeEmail(v){return String(v||'').trim().toLowerCase();}
function validEmail(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(v));}
function passwordOkay(v){return String(v||'').length>=8;}
function resetUrl(){
  return `${location.origin}/league?reset=1`;
}
function claimRedirectUrl(){
  return `${location.origin}/league`;
}
function removeResetParam(){
  try{
    const u=new URL(location.href);
    u.searchParams.delete('reset');
    history.replaceState(null,'',u.pathname+(u.search?u.search:'')+u.hash);
  }catch{}
}
async function claimableTeams(roomCode){
  const {data,error}=await supabase.rpc('league_claimable_teams',{p_room_code:roomCode});
  if(error)throw new Error(error.message);
  return Array.isArray(data)?data:[];
}
async function currentAccount(roomCode){
  const {data,error}=await supabase.rpc('league_current_account',{p_room_code:roomCode});
  if(error)throw new Error(error.message);
  return data;
}
function authLogo(leagueName){
  return `<div class="glsk-auth-mark"><span>GLSK</span></div>
    <div class="glsk-auth-name">${esc(leagueName)}</div>`;
}
function showAuthMessage(root,message,type=''){
  const el=root.querySelector('#glsk-auth-message');
  if(el)el.innerHTML=`<div class="glsk-auth-message ${type}">${esc(message)}</div>`;
}
function authFrame(leagueName,content,foot=''){
  return `<div class="glsk-auth-screen">
    <div class="glsk-auth-card">
      <div class="glsk-auth-head">${authLogo(leagueName)}
        <p>Private League Access</p>
      </div>
      <div class="glsk-auth-body">${content}<div id="glsk-auth-message"></div></div>
      ${foot?`<div class="glsk-auth-foot">${foot}</div>`:''}
    </div>
  </div>`;
}
async function showPasswordRecovery(app,leagueName){
  return new Promise(resolve=>{
    const draw=(message='')=>{
      app.innerHTML=authFrame(leagueName,`
        <div class="glsk-auth-section-title">Create a new password</div>
        <p class="glsk-auth-copy">Enter a new password for your GLSK account.</p>
        <form id="glsk-reset-form" class="glsk-auth-form">
          <label>New password
            <input id="glsk-reset-password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>
          </label>
          <label>Confirm password
            <input id="glsk-reset-confirm" type="password" autocomplete="new-password" minlength="8" placeholder="Repeat password" required>
          </label>
          <button class="glsk-auth-primary" type="submit">Update Password</button>
        </form>
      `);
      if(message)showAuthMessage(app,message,'success');
      app.querySelector('#glsk-reset-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const password=app.querySelector('#glsk-reset-password')?.value||'';
        const confirm=app.querySelector('#glsk-reset-confirm')?.value||'';
        if(!passwordOkay(password))return showAuthMessage(app,'Password must be at least 8 characters.','error');
        if(password!==confirm)return showAuthMessage(app,'Passwords do not match.','error');
        const btn=e.submitter; if(btn)btn.disabled=true;
        const {error}=await supabase.auth.updateUser({password});
        if(btn)btn.disabled=false;
        if(error)return showAuthMessage(app,error.message,'error');
        removeResetParam();
        resolve();
      });
    };
    draw();
  });
}
async function showSignInGate(app,roomCode,leagueName){
  const teams=await claimableTeams(roomCode);
  return new Promise(resolve=>{
    let mode='signin';
    let verificationMessage='';

    const draw=()=>{
      const unclaimed=teams.filter(t=>!t.claimed);
      const content=mode==='signin'?`
        <div class="glsk-auth-tabs">
          <button type="button" class="active" data-auth-mode="signin">Sign In</button>
          <button type="button" data-auth-mode="claim">Claim Your Team</button>
        </div>
        <div class="glsk-auth-section-title">Welcome back</div>
        <p class="glsk-auth-copy">Sign in with your GLSK owner account. You will stay signed in on this device.</p>
        <form id="glsk-signin-form" class="glsk-auth-form">
          <label>Email
            <input id="glsk-signin-email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </label>
          <label>Password
            <input id="glsk-signin-password" type="password" autocomplete="current-password" placeholder="Your password" required>
          </label>
          <button class="glsk-auth-primary" type="submit">Sign In</button>
        </form>
        <button type="button" class="glsk-auth-link" data-auth-forgot>Forgot password?</button>
      `:`
        <div class="glsk-auth-tabs">
          <button type="button" data-auth-mode="signin">Sign In</button>
          <button type="button" class="active" data-auth-mode="claim">Claim Your Team</button>
        </div>
        <div class="glsk-auth-section-title">Create your owner account</div>
        <p class="glsk-auth-copy">Use your existing team PIN one final time to link your franchise to an email and password.</p>
        <form id="glsk-signup-form" class="glsk-auth-form">
          <label>Your team
            <select id="glsk-claim-team" required>
              <option value="">Select your team…</option>
              ${unclaimed.map(t=>`<option value="${t.team_id}">${esc(t.team_name)}</option>`).join('')}
            </select>
          </label>
          <label>Existing team PIN
            <input id="glsk-claim-pin" type="password" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit team PIN" required>
          </label>
          <label>Email
            <input id="glsk-signup-email" type="email" autocomplete="email" placeholder="you@example.com" required>
          </label>
          <label>Password
            <input id="glsk-signup-password" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required>
          </label>
          <button class="glsk-auth-primary" type="submit">Create Account & Claim Team</button>
        </form>
        ${verificationMessage?`<div class="glsk-auth-message success">${esc(verificationMessage)}</div>`:''}
        ${unclaimed.length===0?'<div class="glsk-auth-message">All GLSK teams have already been claimed.</div>':''}
      `;

      app.innerHTML=authFrame(
        leagueName,
        content,
        'League data is private. There is no spectator or public-view mode.'
      );

      app.querySelectorAll('[data-auth-mode]').forEach(b=>b.addEventListener('click',()=>{
        mode=b.dataset.authMode;draw();
      }));

      app.querySelector('#glsk-signin-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const email=normalizeEmail(app.querySelector('#glsk-signin-email')?.value);
        const password=app.querySelector('#glsk-signin-password')?.value||'';
        if(!validEmail(email))return showAuthMessage(app,'Enter a valid email address.','error');
        const btn=e.submitter;if(btn)btn.disabled=true;
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(btn)btn.disabled=false;
        if(error)return showAuthMessage(app,error.message,'error');
        resolve();
      });

      app.querySelector('#glsk-signup-form')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const teamId=app.querySelector('#glsk-claim-team')?.value;
        const teamPin=app.querySelector('#glsk-claim-pin')?.value.trim();
        const email=normalizeEmail(app.querySelector('#glsk-signup-email')?.value);
        const password=app.querySelector('#glsk-signup-password')?.value||'';
        if(!teamId||!teamPin)return showAuthMessage(app,'Select your team and enter its existing team PIN.','error');
        if(!validEmail(email))return showAuthMessage(app,'Enter a valid email address.','error');
        if(!passwordOkay(password))return showAuthMessage(app,'Password must be at least 8 characters.','error');

        const btn=e.submitter;if(btn)btn.disabled=true;
        const {data,error}=await supabase.auth.signUp({
          email,password,
          options:{emailRedirectTo:claimRedirectUrl()}
        });
        if(error){
          if(btn)btn.disabled=false;
          return showAuthMessage(app,error.message,'error');
        }

        if(data?.session){
          try{
            await rpc('league_claim_team',{
              p_room_code:roomCode,
              p_team_id:teamId,
              p_team_pin:teamPin
            });
            resolve();
          }catch(err){
            if(btn)btn.disabled=false;
            showAuthMessage(app,err.message,'error');
          }
          return;
        }

        if(btn)btn.disabled=false;
        verificationMessage='Check your email to confirm the new account. Then return to GLSK, sign in, and finish claiming your team with the same team PIN.';
        mode='claim';
        draw();
      });

      app.querySelector('[data-auth-forgot]')?.addEventListener('click',async()=>{
        const email=normalizeEmail(app.querySelector('#glsk-signin-email')?.value);
        if(!validEmail(email))return showAuthMessage(app,'Enter your email above first.','error');
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:resetUrl()});
        if(error)return showAuthMessage(app,error.message,'error');
        showAuthMessage(app,'Password reset email sent.','success');
      });
    };
    draw();
  });
}
async function showClaimGate(app,roomCode,leagueName,user){
  const teams=await claimableTeams(roomCode);
  return new Promise(resolve=>{
    const draw=()=>{
      const unclaimed=teams.filter(t=>!t.claimed);
      app.innerHTML=authFrame(
        leagueName,
        `<div class="glsk-auth-section-title">Finish linking your team</div>
         <p class="glsk-auth-copy"><strong>${esc(user?.email||'Your account')}</strong> is signed in, but it is not linked to a GLSK franchise yet.</p>
         <form id="glsk-finish-claim" class="glsk-auth-form">
           <label>Your team
             <select id="glsk-finish-team" required>
               <option value="">Select your team…</option>
               ${unclaimed.map(t=>`<option value="${t.team_id}">${esc(t.team_name)}</option>`).join('')}
             </select>
           </label>
           <label>Existing team PIN
             <input id="glsk-finish-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6-digit team PIN" required>
           </label>
           <button class="glsk-auth-primary" type="submit">Claim Team</button>
         </form>
         <button type="button" class="glsk-auth-link" data-auth-signout>Sign out and use a different email</button>`,
        'Your team PIN is used only to verify this one-time claim. It is not saved in your browser.'
      );

      app.querySelector('#glsk-finish-claim')?.addEventListener('submit',async e=>{
        e.preventDefault();
        const teamId=app.querySelector('#glsk-finish-team')?.value;
        const teamPin=app.querySelector('#glsk-finish-pin')?.value.trim();
        if(!teamId||!teamPin)return showAuthMessage(app,'Select your team and enter its existing PIN.','error');
        const btn=e.submitter;if(btn)btn.disabled=true;
        try{
          await rpc('league_claim_team',{
            p_room_code:roomCode,
            p_team_id:teamId,
            p_team_pin:teamPin
          });
          resolve();
        }catch(err){
          if(btn)btn.disabled=false;
          showAuthMessage(app,err.message,'error');
        }
      });

      app.querySelector('[data-auth-signout]')?.addEventListener('click',async()=>{
        await supabase.auth.signOut();
        resolve('signed-out');
      });
    };
    draw();
  });
}

function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
function standalone(){return Boolean(window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true);}
function b64ToBytes(value){
  const pad='='.repeat((4-value.length%4)%4);
  const raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
async function pushRegistration(){
  if(!('serviceWorker' in navigator))return null;
  try{
    await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    return await navigator.serviceWorker.ready;
  }catch{return null;}
}
async function enablePush(roomCode,account){
  if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator)){
    throw new Error('Push notifications are not supported on this browser.');
  }
  if(isIOS()&&!standalone()){
    throw new Error('On iPhone/iPad, add GLSK to your Home Screen first, then open the Home Screen app and enable notifications.');
  }

  const permission=await Notification.requestPermission();
  if(permission!=='granted')throw new Error('Notification permission was not granted.');

  const reg=await pushRegistration();
  if(!reg)throw new Error('GLSK could not start background notifications.');

  const cfgRes=await fetch('/api/push-config',{cache:'no-store'});
  if(!cfgRes.ok)throw new Error('Push configuration is unavailable.');
  const cfg=await cfgRes.json();

  let sub=await reg.pushManager.getSubscription();
  if(!sub){
    sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:b64ToBytes(cfg.publicKey)
    });
  }

  const j=sub.toJSON(),keys=j.keys||{};
  await rpc('league_owner_save_push_subscription',{
    p_room_code:roomCode,
    p_team_id:account.team_id,
    p_pin:'',
    p_endpoint:j.endpoint,
    p_p256dh:keys.p256dh,
    p_auth:keys.auth,
    p_expiration_time:j.expirationTime||null,
    p_user_agent:navigator.userAgent,
    p_device_label:navigator.userAgentData?.platform||navigator.platform||'Device'
  });
}
async function maybePromptPush(roomCode,leagueName,account){
  if(!account?.team_id)return;
  if(!('Notification' in window)||!('PushManager' in window)||!('serviceWorker' in navigator))return;
  if(Notification.permission==='denied')return;

  const reg=await pushRegistration();
  const existing=reg?await reg.pushManager.getSubscription():null;
  if(existing)return;

  const key=`glsk-push-prompt-snooze-${roomCode}`;
  const last=Number(localStorage.getItem(key)||0);
  if(last&&Date.now()-last<PUSH_PROMPT_SNOOZE_MS)return;

  setTimeout(()=>{
    if(document.querySelector('.glsk-push-prompt'))return;
    const iosNeedsInstall=isIOS()&&!standalone();
    const overlay=document.createElement('div');
    overlay.className='glsk-push-prompt';
    overlay.innerHTML=`<div class="glsk-push-prompt-card">
      <button class="glsk-push-close" type="button" aria-label="Not now">×</button>
      <div class="glsk-push-icon">🔔</div>
      <h2>${iosNeedsInstall?'Get GLSK alerts on your iPhone':'Never miss league activity'}</h2>
      <p>${iosNeedsInstall
        ?'To receive GLSK notifications when Safari is closed, add GLSK to your Home Screen. In Safari tap Share → Add to Home Screen, then open GLSK from the new icon.'
        :'Get push alerts for trades, player moves, draft picks, injuries, deadlines and league discussions—even when GLSK is closed.'}</p>
      <div id="glsk-push-error"></div>
      <div class="glsk-push-actions">
        ${iosNeedsInstall
          ?'<button class="glsk-auth-primary" type="button" data-push-done>Got It</button>'
          :'<button class="glsk-auth-primary" type="button" data-push-enable>Enable Notifications</button>'}
        <button class="glsk-auth-secondary" type="button" data-push-later>Not Now</button>
      </div>
      <span>You can change notification categories anytime in League Office → Notifications.</span>
    </div>`;
    document.body.appendChild(overlay);

    const dismiss=()=>{
      localStorage.setItem(key,String(Date.now()));
      overlay.remove();
    };
    overlay.querySelector('.glsk-push-close')?.addEventListener('click',dismiss);
    overlay.querySelector('[data-push-later]')?.addEventListener('click',dismiss);
    overlay.querySelector('[data-push-done]')?.addEventListener('click',dismiss);
    overlay.querySelector('[data-push-enable]')?.addEventListener('click',async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent='Enabling…';
      try{
        await enablePush(roomCode,account);
        overlay.remove();
      }catch(err){
        btn.disabled=false;btn.textContent='Enable Notifications';
        const box=overlay.querySelector('#glsk-push-error');
        if(box)box.innerHTML=`<div class="glsk-auth-message error">${esc(err.message)}</div>`;
      }
    });
  },PUSH_PROMPT_DELAY_MS);
}

export async function requireOwnerAccount({app,roomCode,leagueName,legacyStorageKey}){
  if(legacyStorageKey){
    try{localStorage.removeItem(legacyStorageKey);}catch{}
  }

  while(true){
    const {data:{session},error}=await supabase.auth.getSession();
    if(error)throw error;

    if(!session){
      await showSignInGate(app,roomCode,leagueName);
      continue;
    }

    if(new URLSearchParams(location.search).get('reset')==='1'){
      await showPasswordRecovery(app,leagueName);
    }

    const account=await currentAccount(roomCode);
    if(account?.claimed){
      maybePromptPush(roomCode,leagueName,account).catch(()=>{});
      return {user:session.user,account};
    }

    const result=await showClaimGate(app,roomCode,leagueName,session.user);
    if(result==='signed-out')continue;
  }
}

export function legacySessionFromAccount(account,user){
  return {
    teamId:account.team_id,
    pin:'',
    commishPin:account.is_commissioner?'AUTH':'',
    spectator:false,
    auth:true,
    email:user?.email||''
  };
}

export async function sendPasswordResetEmail(email){
  const address=normalizeEmail(email);
  if(!validEmail(address))throw new Error('No valid email is available for this account.');
  const {error}=await supabase.auth.resetPasswordForEmail(address,{redirectTo:resetUrl()});
  if(error)throw error;
  return true;
}

export async function signOutOwner({roomCode,teamId,legacyStorageKey}={}){
  try{
    if(teamId&&'serviceWorker' in navigator){
      const reg=await navigator.serviceWorker.ready.catch(()=>null);
      const sub=reg?await reg.pushManager?.getSubscription():null;
      if(sub){
        try{
          await rpc('league_owner_remove_push_subscription',{
            p_room_code:roomCode,
            p_team_id:teamId,
            p_pin:'',
            p_endpoint:sub.endpoint
          });
        }catch{}
        try{await sub.unsubscribe();}catch{}
      }
    }
  }catch{}

  if(legacyStorageKey){
    try{localStorage.removeItem(legacyStorageKey);}catch{}
  }
  await supabase.auth.signOut();
}
