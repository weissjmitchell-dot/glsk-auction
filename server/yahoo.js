import {createCipheriv,createDecipheriv,createHash,hkdfSync,randomBytes,timingSafeEqual} from 'node:crypto';

export const FLOW_COOKIE='__Host-glsk_yahoo_flow';
const LOGIN='https://api.login.yahoo.com/oauth2';
// This fixed, read-only request only checks the signed-in user's Fantasy access.
// Its response body is discarded; no Yahoo fantasy records leave this server.
const PROBE='https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_codes=nfl?format=json';
export class YahooError extends Error {constructor(code,status=400){super(code);this.code=code;this.status=status;}}
export const messages={
 configuration:'Check the three Yahoo environment variables in Vercel, then deploy again.',
 setup:'Install the GLSK v745 Yahoo SQL migration in Supabase first.',
 auth:'Sign in to GLSK again, then retry.', forbidden:'Commissioner access is required.',
 origin:'Open GLSK at the production address registered with Yahoo.',
 busy:'Another Yahoo operation is in progress. Try again in a minute.',
 state:'This Yahoo sign-in expired or was already used. Start again from GLSK.',
 conflict:'The connection changed during this request. Refresh its status and retry.',
 disconnected:'Connect your Yahoo account first.',
 denied:'Yahoo sign-in was cancelled or permission was declined.',
 permissions:'Yahoo Fantasy access is not available yet. Check Fantasy Sports permissions in your Yahoo developer app.',
 reconnect:'Yahoo requires a new sign-in. Choose Connect Yahoo again.',
 unavailable:'Yahoo is temporarily unavailable. Try again shortly.',
 database:'The connection could not be saved or read. Try again shortly.',
 callback:'The Yahoo connection could not be completed. Start again from GLSK.',
 invalid:'Invalid Yahoo connection request.'
};
export function config(){
 const id=process.env.YAHOO_CLIENT_ID?.trim(),secret=process.env.YAHOO_CLIENT_SECRET?.trim();
 let redirect;try{redirect=new URL(process.env.YAHOO_REDIRECT_URI);}catch{throw new YahooError('configuration',503);}
 if(!id||!secret||redirect.protocol!=='https:'||redirect.pathname!=='/api/yahoo-callback'||redirect.search||redirect.hash||redirect.username||redirect.password)
  throw new YahooError('configuration',503);
 return {id,secret,redirect:redirect.href,origin:redirect.origin};
}
export function headers(res){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Content-Type-Options','nosniff');
}
export function bearer(req){
 const b=req.headers.authorization;
 if(typeof b!=='string'||!/^Bearer [^\s]+$/i.test(b)||b.length>12000)throw new YahooError('auth',401);
 return b;
}
export function checkOrigin(req,cfg){
 if(req.headers.origin!==cfg.origin)throw new YahooError('origin',403);
}
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const nonce=()=>randomBytes(32).toString('hex');
function key(cfg){return hkdfSync('sha256',cfg.secret,cfg.id,'GLSK Yahoo credential encryption v1',32);}
export function seal(value,purpose,cfg){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(cfg),iv);
 cipher.setAAD(Buffer.from(purpose));
 const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return 'v1.'+Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64url');
}
export function unseal(value,purpose,cfg){
 try{
  if(typeof value!=='string'||!/^v1\.[A-Za-z0-9_-]+$/.test(value)||value.length>24000)throw new Error();
  const b=Buffer.from(value.slice(3),'base64url');if(b.length<29)throw new Error();
  const cipher=createDecipheriv('aes-256-gcm',key(cfg),b.subarray(0,12));
  cipher.setAuthTag(b.subarray(12,28));cipher.setAAD(Buffer.from(purpose));
  return JSON.parse(Buffer.concat([cipher.update(b.subarray(28)),cipher.final()]).toString('utf8'));
 }catch{throw new YahooError('reconnect',401);}
}
export const tokenPurpose=c=>`tokens:${c.room_id}:${c.user_id}`;
export function setFlowCookie(res,value=''){
 if(value.length>3700)throw new YahooError('auth',401);
 res.setHeader('Set-Cookie',`${FLOW_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${value?600:0}`);
}
export function readFlow(req,cfg){
 const matches=String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(FLOW_COOKIE+'='));
 if(matches.length!==1)throw new YahooError('state');
 let flow;try{flow=unseal(matches[0].slice(FLOW_COOKIE.length+1),'oauth-flow',cfg);}catch{throw new YahooError('state');}
 if(!flow?.state||!flow.bearer||!flow.user||flow.origin!==cfg.origin||!Number.isFinite(flow.exp)||flow.exp<=Date.now())throw new YahooError('state');
 return flow;
}
export function equal(a,b){return typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
export function authorizeURL(cfg,state){
 const url=new URL(LOGIN+'/request_auth');
 url.search=new URLSearchParams({client_id:cfg.id,redirect_uri:cfg.redirect,response_type:'code',scope:'fspt-r',state}).toString();
 return url.href;
}
export async function db(auth,action='read',args={}){
 const base=process.env.SUPABASE_URL||'https://vavzeyewfipswyxeqdht.supabase.co';
 const apiKey=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';
 let response;try{response=await fetch(base+'/rest/v1/rpc/league_yahoo_connection',{
  method:'POST',headers:{apikey:apiKey,Authorization:auth,'Content-Type':'application/json'},
  body:JSON.stringify({p_action:action,...args}),signal:AbortSignal.timeout(10000),redirect:'error'
 });}catch{throw new YahooError('database',502);}
 let data;try{data=await response.json();}catch{throw new YahooError('database',502);}
 if(!response.ok){
  const m=String(data?.message||'');
  if(data?.code==='PGRST202'||data?.code==='42883')throw new YahooError('setup',503);
  if(response.status===401||m.includes('YAHOO_AUTH'))throw new YahooError('auth',401);
  for(const [key,code,status] of [['FORBIDDEN','forbidden',403],['BUSY','busy',409],['STATE','state',400],['CONFLICT','conflict',409],['DISCONNECTED','disconnected',409]])
   if(m.includes('YAHOO_'+key))throw new YahooError(code,status);
  throw new YahooError(response.status===403?'forbidden':'database',response.status===403?403:502);
 }
 if(!data?.user_id||!data?.room_id||!Number.isSafeInteger(data.revision))throw new YahooError('forbidden',403);
 return data;
}
export async function exchange(cfg,fields,previous=null){
 let response;try{response=await fetch(LOGIN+'/get_token',{
  method:'POST',headers:{Authorization:'Basic '+Buffer.from(cfg.id+':'+cfg.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},
  body:new URLSearchParams(fields).toString(),signal:AbortSignal.timeout(10000),redirect:'error'
 });}catch{throw new YahooError('unavailable',502);}
 let data;try{data=await response.json();}catch{throw new YahooError('unavailable',502);}
 if(!response.ok){
  if(data?.error==='invalid_scope')throw new YahooError('permissions',403);
  if(data?.error==='invalid_client')throw new YahooError('configuration',503);
  if(data?.error==='invalid_grant')throw new YahooError('reconnect',401);
  throw new YahooError('unavailable',502);
 }
 const life=Number(data.expires_in),refresh=data.refresh_token||previous?.refresh_token;
 if(typeof data.access_token!=='string'||!data.access_token||data.access_token.length>10000||typeof refresh!=='string'||!refresh||refresh.length>6000||!Number.isFinite(life)||life<=0||life>31536000||String(data.token_type||'').toLowerCase()!=='bearer')
  throw new YahooError('unavailable',502);
 return {access_token:data.access_token,refresh_token:refresh,expires_at:Date.now()+life*1000};
}
export async function probe(token){
 let response;try{response=await fetch(PROBE,{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(10000),redirect:'error'});}catch{throw new YahooError('unavailable',502);}
 // Never parse, log, save, or forward the fantasy response.
 if(response.body)await response.body.cancel().catch(()=>{});
 if(response.ok)return true;
 if(response.status===401)return false;
 if(response.status===403)throw new YahooError('permissions',403);
 throw new YahooError('unavailable',502);
}
export function publicStatus(c){return {connected:Boolean(c.sealed_tokens),connectedAt:c.connected_at};}
export function sendError(res,error){
 const e=error instanceof YahooError?error:new YahooError('unavailable',502);
 return res.status(e.status).json({error:messages[e.code]||messages.unavailable,code:e.code});
}
