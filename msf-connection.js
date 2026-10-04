import {supabase} from './supabase.js';

export function msfConnectionView() {
  return `<section class="card card-pad office-section" id="msf-connection" aria-labelledby="msf-heading">
    <div class="office-section-head"><h2 id="msf-heading">MySportsFeeds Trial</h2><span class="status-chip" data-msf-status>Not checked</span></div>
    <p>Test NFL feed access before importing player data into GLSK.</p>
    <div class="row gap-8 wrap" style="margin:16px 0">
      <label>Season <input class="input" data-msf-year type="number" min="2025" max="2100" value="${new Date().getFullYear()}"></label>
      <label>Week <input class="input" data-msf-week type="number" min="1" max="18" value="1"></label>
      <label>Feed <select class="input" data-msf-feed><option value="games">Schedule and scores</option><option value="players">Player game statistics</option><option value="teams">Team game statistics</option><option value="injuries">Current injuries</option></select></label>
    </div>
    <div class="row gap-8 wrap"><button class="btn btn-outline" data-msf-action="status">Check Setup</button><button class="btn btn-primary" data-msf-action="test">Test Selected Feed</button></div>
    <p data-msf-message role="status" aria-live="polite"></p>
    <div data-msf-result hidden><p data-msf-summary></p><button class="btn btn-outline" data-msf-download>Download Test Report</button><details style="margin-top:12px"><summary>Field names found</summary><pre data-msf-fields style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:320px;overflow:auto"></pre></details></div>
    <div class="notice" style="margin-top:16px">Trial tests do not change rosters, scores or standings. A successful request confirms access only. Projections and custom scoring still require validation. Injury results are current, regardless of the selected week.</div>
  </section>`;
}
export function bindMsfConnection({state}) {
  const root=document.getElementById('msf-connection');
  if (!root || state.tab!=='commissioner' || state.commissionerSection!=='msf' || !state.authAccount?.is_commissioner || !state.authUser?.id) return;
  const user=state.authUser.id;
  let busy=false, report=null;
  const message=root.querySelector('[data-msf-message]'), status=root.querySelector('[data-msf-status]');
  async function run(action) {
    if (busy) return;
    busy=true; root.setAttribute('aria-busy','true');
    for (const b of root.querySelectorAll('[data-msf-action]')) b.disabled=true;
    message.className=''; message.textContent=action==='test'?'Testing the selected feed…':'Checking setup…';
    if (action==='test') { report=null; root.querySelector('[data-msf-result]').hidden=true; }
    try {
      const {data,error}=await supabase.auth.getSession();
      if (error || data?.session?.user?.id!==user || state.authUser?.id!==user) throw new Error('Sign in to GLSK again.');
      const payload=action==='status'?{action}:{action,year:Number(root.querySelector('[data-msf-year]').value),week:Number(root.querySelector('[data-msf-week]').value),feed:root.querySelector('[data-msf-feed]').value};
      const response=await fetch('/api/msf-connection',{method:'POST',cache:'no-store',credentials:'same-origin',
        headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(55000)});
      const result=await response.json().catch(()=>{throw new Error('The MySportsFeeds endpoint is not deployed yet.');});
      if (state.authUser?.id!==user || !root.isConnected) return;
      if (!response.ok) throw new Error(result.error || 'The feed test failed.');
      if (action==='status') {
        status.textContent=result.configured?'Ready to test':'Key not configured';
        message.textContent=result.configured?'Select a feed and test it. Start with a completed week.':'Add MSF_API_KEY in Vercel after starting your trial, then redeploy.';
      } else {
        report=result; status.textContent=result.schemaRecognized===false?'Response received — mapping needed':result.records?'Feed access confirmed':'No records returned';
        message.textContent=result.note;
        root.querySelector('[data-msf-summary]').textContent=result.schemaRecognized===false?'Field names and types only; no player values are included. Scoring has not been verified.':`${result.records} records returned; ${result.inspected} inspected. Scoring has not been verified.`;
        root.querySelector('[data-msf-fields]').textContent=result.fields.map(f=>f.path+' ('+f.types.join(', ')+')').join('\n');
        root.querySelector('[data-msf-result]').hidden=false;
      }
    } catch (e) {
      if (state.authUser?.id!==user || !root.isConnected) return;
      status.textContent='Needs attention'; message.className='error';
      message.textContent=e.name==='TimeoutError'?'The test timed out. Wait three minutes before retrying.':e.message;
    } finally {
      busy=false; root.setAttribute('aria-busy','false');
      for (const b of root.querySelectorAll('[data-msf-action]')) b.disabled=false;
    }
  }
  for (const button of root.querySelectorAll('[data-msf-action]')) button.addEventListener('click',()=>run(button.dataset.msfAction));
  root.querySelector('[data-msf-download]').addEventListener('click',()=>{
    if (!report || state.authUser?.id!==user) return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=`glsk-msf-${report.feed}-${report.year}-week-${report.week??'current'}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
