import {YahooError,config,headers,bearer,checkOrigin,nonce,hash,seal,unseal,tokenPurpose,setFlowCookie,authorizeURL,db,exchange,probe,publicStatus,sendError} from '../server/yahoo.js';

export default async function handler(req,res){
 headers(res);
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Use POST.'});}
 let auth,lock;
 const release=async()=>{if(auth&&lock){const held=lock;lock=null;await db(auth,'release',{p_hash:held}).catch(()=>{});}};
 try{
  const cfg=config();checkOrigin(req,cfg);auth=bearer(req);
  let body;try{body=typeof req.body==='string'?JSON.parse(req.body):req.body;}catch{throw new YahooError('invalid');}
  if(!body||!['status','connect','test','disconnect'].includes(body.action))throw new YahooError('invalid');
  const c=await db(auth);
  if(body.action==='status')return res.status(200).json(publicStatus(c));
  if(body.action==='disconnect'){
   const result=await db(auth,'disconnect');setFlowCookie(res);
   return res.status(200).json(publicStatus(result));
  }
  if(body.action==='connect'){
   const state=nonce(),flow=seal({state,bearer:auth,user:c.user_id,origin:cfg.origin,exp:Date.now()+600000},'oauth-flow',cfg);
   // Reject an oversized session before making a pending authorization.
   if(flow.length>3700)throw new YahooError('auth',401);
   await db(auth,'start',{p_hash:hash(state)});setFlowCookie(res,flow);
   return res.status(200).json({url:authorizeURL(cfg,state)});
  }
  lock=nonce();let leased=await db(auth,'claim',{p_hash:lock});
  let tokens=unseal(leased.sealed_tokens,tokenPurpose(leased),cfg),refreshed=false;
  const refresh=async()=>{
   tokens=await exchange(cfg,{grant_type:'refresh_token',refresh_token:tokens.refresh_token},tokens);
   leased=await db(auth,'save',{p_hash:lock,p_revision:leased.revision,p_sealed_tokens:seal(tokens,tokenPurpose(leased),cfg)});
   refreshed=true;
  };
  if(!Number.isFinite(tokens.expires_at)||tokens.expires_at<=Date.now()+60000)await refresh();
  if(!await probe(tokens.access_token)){
   if(refreshed)throw new YahooError('reconnect',401);
   await refresh();if(!await probe(tokens.access_token))throw new YahooError('reconnect',401);
  }
  await release();
  return res.status(200).json({...publicStatus(leased),verified:true,checkedAt:new Date().toISOString()});
 }catch(error){await release();return sendError(res,error);}
}
