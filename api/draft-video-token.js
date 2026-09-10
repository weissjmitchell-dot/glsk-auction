import {createHash} from 'node:crypto';

// Called only after an owner chooses Join Video. Never expose DAILY_API_KEY.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
 const bearer=req.headers.authorization;
 if(typeof bearer!=='string'||!/^Bearer [^\s]+$/i.test(bearer))return res.status(401).json({error:'Sign in to join video.'});
 let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{return res.status(400).json({error:'Invalid request.'});}
 if(body?.roomCode!=='GLSK26')return res.status(400).json({error:'Unknown league.'});
 const sbUrl=process.env.SUPABASE_URL||'https://vavzeyewfipswyxeqdht.supabase.co';
 const sbKey=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';
 try{
  const membership=await fetch(`${sbUrl}/rest/v1/rpc/league_get_draft_context`,{method:'POST',headers:{apikey:sbKey,Authorization:bearer,'Content-Type':'application/json'},body:JSON.stringify({p_room_code:body.roomCode}),signal:AbortSignal.timeout(10000)});
  if(!membership.ok)return res.status(403).json({error:'An active GLSK owner account is required. Sign in again, or ask the commissioner to check access.'});
  const c=await membership.json();
  if(!c?.user_id||!c?.team_id||!c?.room_id||!c?.season_id)return res.status(403).json({error:'Active league membership required.'});
  const key=process.env.DAILY_API_KEY;
  if(!key)return res.status(503).json({error:'Video is not activated yet. The commissioner needs to complete the video setup.'});
  const name='glsk-'+createHash('sha256').update(`${c.room_id}:${c.season_id}`).digest('hex').slice(0,32);
  const daily=(path,options={})=>fetch('https://api.daily.co/v1/'+path,{...options,headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(10000)});
  let roomResponse=await daily('rooms/'+name);
  if(roomResponse.status===404){
   roomResponse=await daily('rooms',{method:'POST',body:JSON.stringify({name,privacy:'private',properties:{start_video_off:true,start_audio_off:true,enable_prejoin_ui:true,enable_knocking:false,enable_chat:false,max_participants:30}})});
   // Two owners can be the first to join at the same instant.
   if([400,409].includes(roomResponse.status))roomResponse=await daily('rooms/'+name);
  }
  if(!roomResponse.ok)throw new Error('room unavailable');
  const room=await roomResponse.json();const url=new URL(room.url);
  if(room.privacy!=='private'||room.name!==name||url.protocol!=='https:'||!url.hostname.endsWith('.daily.co'))throw new Error('room configuration');
  const tokenResponse=await daily('meeting-tokens',{method:'POST',body:JSON.stringify({properties:{room_name:name,user_id:c.user_id,user_name:String(c.team_name||'GLSK Owner').slice(0,60),is_owner:c.is_commissioner===true,exp:Math.floor(Date.now()/1000)+8*60*60,eject_at_token_exp:true,start_video_off:true,start_audio_off:true}})});
  if(!tokenResponse.ok)throw new Error('token unavailable');
  const result=await tokenResponse.json();if(typeof result.token!=='string')throw new Error('token missing');
  return res.status(200).json({url:room.url,token:result.token});
 }catch{return res.status(502).json({error:'Video is temporarily unavailable. Try again shortly; if it continues, ask the commissioner to check the video setup.'});}
}
