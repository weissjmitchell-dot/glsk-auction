import {supabase} from './supabase.js';
import {scorePlayer} from '../server/msf-scoring.js';
import {matchPlayer} from '../shared/msf-matching.js';

export function previewView() {
  return `<section style="margin-top:24px;border-top:1px solid #ccd4df;padding-top:16px" data-preview>
    <h3>Scoring preview</h3><p>Use the season, week and feed above. Choose player or team statistics. This preview uses your current GLSK scoring rules and suggests matches against the loaded player directory and rosters.</p>
    <button class="btn btn-primary" data-preview-run>Preview Selected Feed</button>
    <p data-preview-message role="status" aria-live="polite"></p>
    <div data-preview-results hidden><p data-preview-summary></p>
    <p>Provisional calculations only. “Stacked” adds every reached yardage bonus; “highest” uses only the highest reached bonus. Missing required statistics produce no total. Defense totals remain incomplete until the flagged rules are validated.</p>
    <label>Find player or team <input class="input" data-preview-search type="search"></label>
    <button class="btn btn-outline" data-preview-download>Download Scoring Preview</button>
    <div style="overflow:auto;max-height:650px;margin-top:12px"><table style="width:100%;min-width:650px"><thead><tr><th>Player</th><th>GLSK match</th><th>Stacked</th><th>Highest</th><th>Breakdown / issues</th></tr></thead><tbody data-preview-rows></tbody></table></div></div>
    <p class="small muted">No imports or automatic updates. Matches must be reviewed before use. Players absent from the feed are not assigned zero points.</p>
  </section>`;
}
export function bindPreview({state,root}) {
  const user=state.authUser.id, panel=root.querySelector('[data-preview]');
  let report=null,busy=false;
  const msg=panel.querySelector('[data-preview-message]'),button=panel.querySelector('[data-preview-run]');
  const active=()=>root.isConnected&&state.authUser?.id===user&&state.authAccount?.is_commissioner;
  const cell=(tr,value)=>{const td=document.createElement('td');td.textContent=value;tr.append(td);return td;};
  function render() {
    const tbody=panel.querySelector('[data-preview-rows]');tbody.replaceChildren();
    const query=panel.querySelector('[data-preview-search]').value.toLowerCase();
    for(const row of report.rows.filter(r=>`${r.name} ${r.team} ${r.position} ${r.match.status}`.toLowerCase().includes(query))) {
      const tr=document.createElement('tr');cell(tr,`${row.name} · ${row.team} · ${row.position}`);cell(tr,row.match.status);
      cell(tr,row.stacked.points===null?'Incomplete':row.stacked.points.toFixed(2));cell(tr,row.highest.points===null?'Incomplete':row.highest.points.toFixed(2));
      const td=cell(tr,''),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='View details';details.append(summary);
      const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.maxWidth='500px';
      pre.textContent=JSON.stringify({providerId:row.providerId,gameId:row.gameId,match:row.match,stats:row.stats,sources:row.sources,stacked:row.stacked,highest:row.highest,review:row.review},null,2);details.append(pre);td.append(details);tbody.append(tr);
    }
  }
  button.addEventListener('click',async()=>{
    if(busy||!active())return;
    report=null;panel.querySelector('[data-preview-results]').hidden=true;
    const year=Number(root.querySelector('[data-msf-year]').value),week=Number(root.querySelector('[data-msf-week]').value),feed=root.querySelector('[data-msf-feed]').value;
    if(!['players','teams'].includes(feed)){msg.textContent='Select Player game statistics or Team game statistics above.';return;}
    if(year!==Number(state.season?.season_year)){msg.textContent='Select the current GLSK season so the correct scoring rules are used.';return;}
    const rules=structuredClone(state.scoringRules||[]);
    if(!rules.length){msg.textContent='No GLSK scoring rules are loaded. Refresh GLSK and check Scoring Settings.';return;}
    const candidates=[...(state.waiverCenter?.players||[]),...(state.roster||[]).filter(p=>p.active!==false&&(!p.season_id||p.season_id===state.season.id))];
    busy=true;button.disabled=true;msg.textContent='Loading statistics and calculating preview…';
    try {
      const {data,error}=await supabase.auth.getSession();
      if(error||data?.session?.user?.id!==user)throw new Error('Sign in to GLSK again.');
      const response=await fetch('/api/msf-preview',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'test',year,week,feed}),signal:AbortSignal.timeout(55000)});
      const result=await response.json();
      if(!active())return;
      if(!response.ok)throw new Error(result.error||'Preview failed.');
      report={...result,seasonId:state.season.id,rules,matchingScope:'Loaded directory and active current-season rosters; suggestions only',
        rows:result.rows.map(row=>({...row,match:matchPlayer(row,candidates),stacked:scorePlayer(row.stats,rules,row.position,{bonusMode:'cumulative'}),highest:scorePlayer(row.stats,rules,row.position,{bonusMode:'highest'})}))};
      const matched=report.rows.filter(r=>r.match.playerKey).length,complete=report.rows.filter(r=>r.stacked.complete).length;
      msg.textContent='Preview ready. No league data was changed.';
      panel.querySelector('[data-preview-summary]').textContent=`${year} Week ${week}: ${report.rows.length} fantasy-position game records from ${result.providerRecords} provider records. ${matched} suggested matches; ${complete} have enough fields for provisional totals. Verify totals and matches before importing.`;
      panel.querySelector('[data-preview-results]').hidden=false;render();
    }catch(e){if(active())msg.textContent=e.name==='TimeoutError'?'Preview timed out. Wait three minutes before retrying.':e.message;}
    finally{busy=false;button.disabled=false;}
  });
  panel.querySelector('[data-preview-search]').addEventListener('input',()=>{if(report&&active())render();});
  panel.querySelector('[data-preview-download]').addEventListener('click',()=>{
    if(!report||!active())return;
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`glsk-msf-scoring-${report.feed}-${report.year}-week-${report.week}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
}
