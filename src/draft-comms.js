// A persistent sibling of #app: draft re-renders never replace the call or composer.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let dock=null,sdkPromise;
function dailySDK(){
 if(window.Daily)return Promise.resolve(window.Daily);
 if(sdkPromise)return sdkPromise;
 sdkPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://unpkg.com/@daily-co/daily-js';script.async=true;
  const timer=setTimeout(()=>fail(),20000);
  const fail=()=>{clearTimeout(timer);script.remove();sdkPromise=null;reject(new Error('Could not load video. Check your connection and try again.'));};
  script.onload=()=>{clearTimeout(timer);if(window.Daily)resolve(window.Daily);else fail();};script.onerror=fail;document.head.appendChild(script);
 });return sdkPromise;
}
export function unmountDraftComms(){dock?.dispose();dock=null;}
export function mountDraftComms(options){
 const {session,team,context}=options;
 if(!session||session.spectator||!team){unmountDraftComms();return;}
 const key=`${options.roomCode}:${team.id}:${context?.user_id||session.email||''}:${context?.season_id||''}`;
 if(dock?.key===key){dock.options=options;return;}
 unmountDraftComms();dock=createDock(options,key);
}
function createDock(options,key){
 const {supabase,roomCode,team}=options;
 let alive=true,messages=[],loading=false,sending=false,hasMore=false,oldest=null,initial=true,call=null,joining=false,videoGeneration=0;
 let historyLoaded=false;
 const el=document.createElement('aside');el.id='draft-comms';el.className='draft-comms';el.setAttribute('aria-label','League chat and video');
 el.innerHTML=`<section class="draft-video"><header><h2>Video Chat</h2><button data-video-expand aria-label="Expand video panel" aria-pressed="false">⤢</button></header><p class="draft-comms-note">Join your league here. Your camera and microphone start off.</p><div class="draft-video-frame" hidden></div><div class="draft-video-actions"><button data-video-join>Join Video</button><button data-video-leave hidden>Leave Video</button></div><p data-video-status role="status"></p></section><section class="draft-chat"><header><h2>League Chat</h2><button data-chat-refresh aria-label="Refresh chat">↻</button></header><p class="draft-comms-note">The same conversation as League Chat.</p><button data-chat-older hidden>Load earlier messages</button><div class="draft-chat-messages" aria-label="League messages" tabindex="0"></div><p data-chat-status role="status">Loading chat…</p><form class="draft-chat-compose"><label class="desk-sr" for="draft-chat-body">Message to league</label><textarea id="draft-chat-body" placeholder="Message the league…" rows="2" maxlength="4000"></textarea><button type="submit">Send</button></form></section>`;
 document.body.appendChild(el);document.body.classList.add('has-draft-comms');
 const q=s=>el.querySelector(s),list=q('.draft-chat-messages'),composer=q('textarea'),sendButton=q('[type=submit]');
 const model={key,options,dispose};
 const base=()=>({p_room_code:roomCode,p_team_id:team.id,p_pin:model.options.session.pin||''});
 async function rpc(name,args){const {data,error}=await supabase.rpc(name,args);if(error||data?.ok===false)throw new Error(error?.message||data.error||'Unable to connect.');return data;}
 function showMessages(older=false){
  const bottom=list.scrollHeight-list.scrollTop-list.clientHeight<60,top=list.scrollTop,height=list.scrollHeight;
  const html=messages.map(m=>`<article class="draft-chat-message ${m.is_mine?'is-mine':''}"><div><strong>${esc(m.author_display_name||m.team_name||'League member')}</strong><time datetime="${esc(m.sent_at)}">${esc(new Date(m.sent_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}))}</time></div>${m.status==='removed'?'<p class="draft-comms-note">Message removed</p>':`${m.reply_body?`<blockquote>${esc(m.reply_author_display_name||m.reply_team_name)}: ${esc(m.reply_body)}</blockquote>`:''}<p>${esc(m.body)}</p>`}</article>`).join('')||'<p class="draft-comms-note">No messages yet. Start the conversation.</p>';
  if(list.innerHTML!==html)list.innerHTML=html;
  if(older)list.scrollTop=top+list.scrollHeight-height;else if(bottom||initial)list.scrollTop=list.scrollHeight;
  initial=false;q('[data-chat-older]').hidden=!hasMore;
 }
 async function load(older=false){
  if(!alive||loading)return;loading=true;q('[data-chat-older]').disabled=true;
  try{
   const d=await rpc('league_owner_get_chat',{...base(),p_year:model.options.context?.season_year||2026,p_before:older?oldest:null,p_limit:120});
   if(!alive)return;
   const incoming=d?.messages||[];
   if(older){const ids=new Set(messages.map(m=>String(m.id)));messages=[...incoming.filter(m=>!ids.has(String(m.id))),...messages];historyLoaded=true;hasMore=!!d.has_more;oldest=messages[0]?.sent_at||d.oldest_at;}
   else if(historyLoaded){const map=new Map(messages.map(m=>[String(m.id),m]));for(const m of incoming)map.set(String(m.id),m);messages=[...map.values()].sort((a,b)=>new Date(a.sent_at)-new Date(b.sent_at));}
   else{messages=incoming;hasMore=!!d.has_more;oldest=messages[0]?.sent_at||d.oldest_at;}
   showMessages(older);q('[data-chat-status]').textContent='';
  }catch(e){if(alive)q('[data-chat-status]').textContent='Chat unavailable: '+e.message;}
  finally{loading=false;if(alive)q('[data-chat-older]').disabled=false;}
 }
 async function send(e){
  e?.preventDefault();const body=composer.value.trim();if(!body||sending||!alive)return;
  sending=true;sendButton.disabled=true;composer.readOnly=true;q('[data-chat-status]').textContent='Sending…';
  try{await rpc('league_owner_send_chat_message',{...base(),p_body:body,p_reply_to_message_id:null});if(!alive)return;composer.value='';q('[data-chat-status]').textContent='Message sent.';await load();}
  catch(e){if(alive)q('[data-chat-status]').textContent='Could not confirm delivery. Refresh chat before retrying: '+e.message;}
  finally{sending=false;if(alive){sendButton.disabled=false;composer.readOnly=false;composer.focus({preventScroll:true});}}
 }
 async function leaveVideo(){
  ++videoGeneration;joining=false;
  const oldCall=call;call=null;
  if(oldCall){try{await oldCall.destroy();}catch{}}
  if(!alive)return;q('.draft-video-frame').hidden=true;q('[data-video-join]').disabled=false;q('[data-video-join]').hidden=false;q('[data-video-leave]').hidden=true;q('[data-video-status]').textContent='You have left video.';
 }
 async function joinVideo(){
  if(joining||call||!alive)return;joining=true;const generation=++videoGeneration;
  q('[data-video-join]').disabled=true;q('[data-video-status]').textContent='Connecting to video…';
  try{
   const {data,error}=await supabase.auth.getSession();if(error||!data?.session?.access_token)throw new Error('Sign in to join video.');
   const response=await fetch('/api/draft-video-token',{method:'POST',headers:{Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({roomCode}),signal:AbortSignal.timeout(20000)});
   const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||'Video is unavailable.');
   if(!alive||generation!==videoGeneration)return;
   const Daily=await dailySDK();if(!alive||generation!==videoGeneration)return;
   q('.draft-video-frame').hidden=false;
   const frame=Daily.createFrame(q('.draft-video-frame'),{showLeaveButton:true,iframeStyle:{width:'100%',height:'100%',border:'0'}});call=frame;
   frame.on('left-meeting',()=>{if(call===frame)void leaveVideo();});
   frame.on('error',()=>{if(alive&&call===frame)q('[data-video-status]').textContent='Video connection interrupted. Leave and rejoin to try again.';});
   q('[data-video-join]').hidden=true;q('[data-video-leave]').hidden=false;
   await frame.join({url:result.url,token:result.token});
   if(alive&&generation===videoGeneration)q('[data-video-status]').textContent='Use the video controls to turn on your microphone or camera.';
  }catch(e){if(alive&&generation===videoGeneration){await leaveVideo();if(alive)q('[data-video-status]').textContent=e.message;}}
  finally{if(alive&&generation===videoGeneration){joining=false;q('[data-video-join]').disabled=false;}}
 }
 q('form').addEventListener('submit',send);composer.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void send();}});
 q('[data-chat-refresh]').onclick=()=>load();q('[data-chat-older]').onclick=()=>load(true);
 q('[data-video-join]').onclick=joinVideo;q('[data-video-leave]').onclick=leaveVideo;
 q('[data-video-expand]').onclick=()=>{const expanded=el.classList.toggle('is-expanded');q('[data-video-expand]').setAttribute('aria-pressed',String(expanded));};
 const channel=supabase.channel('draft-league-chat-'+team.id).on('postgres_changes',{event:'*',schema:'public',table:'league_chat_messages'},()=>load()).subscribe();
 const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},15000);
 const authSub=supabase.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT')unmountDraftComms();});
 void load();
 function dispose(){alive=false;++videoGeneration;clearInterval(timer);supabase.removeChannel(channel);authSub.data.subscription.unsubscribe();const old=call;call=null;if(old)Promise.resolve(old.destroy()).catch(()=>{});el.remove();document.body.classList.remove('has-draft-comms');}
 return model;
}
