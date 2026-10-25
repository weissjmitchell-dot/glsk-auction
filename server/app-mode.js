// Fail closed: missing migration or failed lookup must never resume a cancelled feed.
export async function requireFullMode(auth,fetcher=fetch){
 const base=process.env.SUPABASE_URL||'https://vavzeyewfipswyxeqdht.supabase.co';
 const key=process.env.SUPABASE_PUBLISHABLE_KEY||'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';
 const response=await fetcher(base+'/rest/v1/rpc/league_app_mode',{
  method:'POST',headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},
  body:JSON.stringify({p_room_code:'GLSK26'}),signal:AbortSignal.timeout(10000),redirect:'error'
 });
 const data=await response.json();
 if(!response.ok||data?.mode!=='full')throw new Error('Feeds are disabled in Asset Management mode.');
}
