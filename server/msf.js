// Trial diagnostics only: fixed NFL endpoints, no raw records sent to the browser.
export class MsfError extends Error {
  constructor(message,status=502) { super(message); this.status=status; }
}
export const FEEDS = {
  games: ['games', 'games.json'],
  players: ['gamelogs', 'player_gamelogs.json'],
  teams: ['gamelogs', 'team_gamelogs.json'],
  injuries: ['players', null]
};
export function validateRequest(body) {
  if (!body || !['status','test'].includes(body.action)) throw new MsfError('Invalid request.',400);
  if (body.action === 'status') return body;
  if (!Object.hasOwn(FEEDS,body.feed) || !Number.isInteger(body.year) || body.year < 2025 || body.year > 2100 ||
      !Number.isInteger(body.week) || body.week < 1 || body.week > 18) throw new MsfError('Choose a valid NFL regular-season year, week and feed.',400);
  return body;
}
export function providerURL({feed,year,week}) {
  validateRequest({action:'test',feed,year,week});
  return feed === 'injuries' ? 'https://api.mysportsfeeds.com/v2.1/pull/nfl/injuries.json' :
    `https://api.mysportsfeeds.com/v2.1/pull/nfl/${year}-regular/week/${week}/${FEEDS[feed][1]}`;
}
export async function rpc(auth, action, feed='games', fetcher=fetch) {
  const base=process.env.SUPABASE_URL || 'https://vavzeyewfipswyxeqdht.supabase.co';
  const key=process.env.SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vFPh7D0LYQ0n66n_jbBOKA_qTvpXsPq';
  let response;
  try { response=await fetcher(base+'/rest/v1/rpc/league_msf_trial_context',{
    method:'POST', headers:{apikey:key,Authorization:auth,'Content-Type':'application/json'},
    body:JSON.stringify({p_action:action,p_feed:feed}),signal:AbortSignal.timeout(10000),redirect:'error'
  }); } catch { throw new MsfError('Could not verify GLSK access. Try again.'); }
  const data=await response.json().catch(()=>null);
  if (!response.ok) {
    if (data?.code==='PGRST202' || data?.code==='42883') throw new MsfError('Install the MySportsFeeds trial SQL migration first.',503);
    if (String(data?.message).includes('MSF_COOLDOWN')) throw new MsfError('Wait at least three minutes before testing this feed again.',429);
    throw new MsfError('An active GLSK commissioner account is required.',403);
  }
  if (!data?.room_id || !data?.user_id || data.is_commissioner !== true) throw new MsfError('Commissioner access is required.',403);
  return data;
}
// Describe leaf field names/types, not player names, API credentials or stat values.
export function summarize(data, feed) {
  const collection=FEEDS[feed][0], matched=Array.isArray(data?.[collection]);
  const rows=matched?data[collection]:[data];
  const types=new Map(); let visits=0;
  function visit(value,path,depth=0) {
    if (++visits > 200000 || depth > 12 || types.size >= 800) return;
    if (Array.isArray(value)) { for (const item of value.slice(0,3)) visit(item,path+'[]',depth+1); return; }
    if (value && typeof value==='object') {
      for (const [key,item] of Object.entries(value)) {
        if (/^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(key)) visit(item,path?path+'.'+key:key,depth+1);
      }
      return;
    }
    const type=value===null?'null':typeof value;
    if (!types.has(path)) types.set(path,new Set());
    types.get(path).add(type);
  }
  for (const row of rows.slice(0,500)) visit(row,'');
  const fields=[...types].map(([path,t])=>({path,types:[...t].sort()})).sort((a,b)=>a.path.localeCompare(b.path));
  return {schemaRecognized:matched, records:matched?rows.length:null, inspected:matched?Math.min(rows.length,500):null, fields,
    schemaOnly:true, scoringVerified:false, importsEnabled:false,
    note:!matched?'MySportsFeeds returned HTTP 200 with a different JSON structure. Download the test report so its field names can be mapped before importing.':rows.length?'Access worked. Field names are available for mapping; scoring coverage is not verified.':'Access worked, but this feed contains no records for the selection.'};
}
async function boundedJSON(response) {
  if (!response.body) throw new MsfError('MySportsFeeds returned no content.');
  const reader=response.body.getReader(), chunks=[]; let size=0;
  try {
    while (true) {
      const {value,done}=await reader.read(); if (done) break;
      size+=value.byteLength;
      if (size>8*1024*1024) { await reader.cancel(); throw new MsfError('Feed exceeds the trial test size limit. Use a smaller feed.'); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) { if (e instanceof MsfError) throw e; throw new MsfError('MySportsFeeds returned an unreadable response.'); }
}
// Classify bounded provider errors into fixed messages; never expose the raw body.
async function errorHint(response) {
  if (!response.body) return '';
  const reader=response.body.getReader(); let text='',size=0;
  try {
    while (size<16384) {
      const {value,done}=await reader.read(); if(done) break;
      const part=value.subarray(0,16384-size);size+=part.length;
      text+=new TextDecoder().decode(part);
    }
  } catch {} finally {await reader.cancel().catch(()=>{});}
  const hints=[];
  if (/trial/i.test(text)) hints.push('trial restrictions');
  if (/season/i.test(text)) hints.push('season access or selection');
  if (/subscription|subscribed/i.test(text)) hints.push('subscription access');
  if (/frequency|rate limit|too many requests/i.test(text)) hints.push('request limits');
  return hints.length?' Provider response mentions: '+hints.join(', ')+'.':'';
}
export async function fetchFeed(input, fetcher=fetch) {
  const key=process.env.MSF_API_KEY?.trim();
  if (!key) throw new MsfError('Add MSF_API_KEY in Vercel and redeploy before testing.',503);
  let response;
  try { response=await fetcher(providerURL(input),{
    headers:{Authorization:'Basic '+Buffer.from(key+':MYSPORTSFEEDS').toString('base64'),Accept:'application/json'},
    signal:AbortSignal.timeout(20000),redirect:'error'
  }); } catch { throw new MsfError('MySportsFeeds did not respond. Try again later.'); }
  if (response.status!==200) {
    const hint=await errorHint(response);
    const messages={204:'The selected feed is not available yet. Trial restrictions or game timing may apply.',
      401:'MySportsFeeds rejected the API key. Check MSF_API_KEY in Vercel.',
      403:'MySportsFeeds denied this request (HTTP 403).',
      404:'This feed or season was not found. Check the selection and API documentation.',
      429:'MySportsFeeds rate limit reached. Wait before testing again.'};
    throw new MsfError((messages[response.status] || 'MySportsFeeds is temporarily unavailable.')+hint+' Request: '+new URL(providerURL(input)).pathname,response.status===429?429:502);
  }
  return boundedJSON(response);
}
export async function checkFeed(input, fetcher=fetch) {
  const summary=summarize(await fetchFeed(input,fetcher),input.feed);
  return {feed:input.feed,year:input.year,week:input.feed==='injuries'?null:input.week,checkedAt:new Date().toISOString(),...summary};
}
