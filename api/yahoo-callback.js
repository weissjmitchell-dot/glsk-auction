import {YahooError,config,headers,readFlow,equal,hash,seal,tokenPurpose,setFlowCookie,db,exchange,messages} from '../server/yahoo.js';

export default async function handler(req,res){
 headers(res);res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).end();}
 let cfg,flow,lock,outcome='callback';
 try{
  cfg=config();flow=readFlow(req,cfg);
  const url=new URL(req.url,cfg.origin),state=url.searchParams.get('state');
  if(url.searchParams.getAll('state').length!==1||!equal(state,flow.state))throw new YahooError('state');
  const current=await db(flow.bearer);
  if(current.user_id!==flow.user)throw new YahooError('auth',401);
  const proposedLock=hash(state),c=await db(flow.bearer,'consume',{p_hash:proposedLock});
  lock=proposedLock;
  if(url.searchParams.has('error'))throw new YahooError(url.searchParams.get('error')==='invalid_scope'?'permissions':'denied');
  const code=url.searchParams.get('code');
  if(url.searchParams.getAll('code').length!==1||!code||code.length>5000)throw new YahooError('callback');
  const tokens=await exchange(cfg,{grant_type:'authorization_code',code,redirect_uri:cfg.redirect});
  await db(flow.bearer,'save',{p_hash:lock,p_revision:c.revision,p_sealed_tokens:seal(tokens,tokenPurpose(c),cfg),p_new_connection:true});
  outcome='connected';
 }catch(error){outcome=error instanceof YahooError?error.code:'callback';}
 finally{
  setFlowCookie(res);
  if(flow&&lock)await db(flow.bearer,'release',{p_hash:lock}).catch(()=>{});
 }
 if(!cfg)return res.status(503).end(messages.configuration);
 // Fixed return destination: no user-supplied redirect, token, code, or raw error.
 res.setHeader('Location',cfg.origin+'/league?tab=commissioner&section=yahoo&yahoo='+encodeURIComponent(outcome));
 return res.status(303).end();
}
