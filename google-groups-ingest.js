const SUPABASE_URL = process.env.SUPABASE_URL || 'https://vavzeyewfipswyxeqdht.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';

function json(res, status, body){
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(body));
}
function cleanString(v, max=20000){
  return String(v == null ? '' : v).replace(/\0/g,'').trim().slice(0,max);
}

export default async function handler(req,res){
  if(req.method !== 'POST'){
    res.setHeader('Allow','POST');
    return json(res,405,{ok:false,error:'Method not allowed'});
  }

  const bridgeSecret = process.env.GOOGLE_GROUPS_INGEST_SECRET || '';
  const supplied = String(req.headers['x-glsk-ingest-secret'] || '');

  if(!bridgeSecret || supplied !== bridgeSecret){
    return json(res,401,{ok:false,error:'Unauthorized'});
  }

  let body = req.body;
  if(typeof body === 'string'){
    try{ body = JSON.parse(body); }
    catch{ return json(res,400,{ok:false,error:'Invalid JSON'}); }
  }
  body = body || {};

  const messageId = cleanString(body.message_id,500);
  const subject = cleanString(body.subject,500);
  const text = cleanString(body.body,20000);
  const sentAt = cleanString(body.sent_at,100);
  const refs = Array.isArray(body.reference_ids)
    ? body.reference_ids.map(x=>cleanString(x,500)).filter(Boolean).slice(-50)
    : [];

  if(!messageId || !sentAt){
    return json(res,400,{ok:false,error:'message_id and sent_at are required'});
  }

  const payload = {
    p_room_code: 'GLSK26',
    p_bridge_secret: bridgeSecret,
    p_message_id: messageId,
    p_reference_ids: refs,
    p_in_reply_to: cleanString(body.in_reply_to,500) || null,
    p_subject: subject || 'Google Groups Discussion',
    p_author_display_name: cleanString(body.author_display_name,120) || 'Google Groups Member',
    p_author_email: cleanString(body.author_email,320) || null,
    p_body: text || '[No message text]',
    p_sent_at: sentAt,
    p_metadata: {
      backfill: body.backfill === true,
      gmail_message_id: cleanString(body.gmail_message_id,200) || null,
      gmail_thread_id: cleanString(body.gmail_thread_id,200) || null,
      list_id: cleanString(body.list_id,500) || null,
      delivered_to: cleanString(body.delivered_to,500) || null
    }
  };

  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/league_ingest_google_group_message`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'apikey':SUPABASE_KEY
      },
      body:JSON.stringify(payload)
    });

    const data = await r.json().catch(()=>({}));
    if(!r.ok || data?.ok !== true){
      console.error('Google Groups ingest RPC failed',r.status,data);
      return json(res,502,{ok:false,error:data?.message||data?.error||'Supabase ingest failed'});
    }

    return json(res,200,data);
  }catch(e){
    console.error('Google Groups bridge error',e);
    return json(res,500,{ok:false,error:'Bridge request failed'});
  }
}
