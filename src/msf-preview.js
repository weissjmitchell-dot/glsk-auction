import {supabase} from './supabase.js';
import {scorePlayer} from '../server/msf-scoring.js';
import {matchPlayer} from '../shared/msf-matching.js';

export function previewView() {
  return `<section style="margin-top:24px;border-top:1px solid #ccd4df;padding-top:16px" data-preview>
    <h3>Scoring preview</h3><p>Use the season, week and feed above. Choose player or team statistics. This preview uses your current GLSK scoring rules and suggests matches against the loaded player directory and rosters.</p>
    <button class="btn btn-primary" data-preview-run>Preview Selected Feed</button>
    <p data-preview-message role="status" aria-live="polite"></p>
    <div data-preview-results hidden><p data-preview-summary></p>
    <p>Passing bonuses are confirmed to stack from the Burrow comparison. Rushing/receiving bonus stacking still needs confirmation. Provisional calculations only. “Stacked” adds every reached yardage bonus; “highest” uses only the highest reached bonus. Missing required statistics produce no total. Defense comparison totals use the assumptions shown in View details, including ZERO defensive extra-point returns. They are not verified scores. Enter Yahoo scores from the same week and league; differences use the Stacked column. Entries are saved only in the downloaded report and are lost on refresh or rerun.</p>
    <label>Find player or team <input class="input" data-preview-search type="search"></label>
    <button class="btn btn-outline" data-preview-download>Download Scoring Preview</button>
    <div style="overflow:auto;max-height:650px;margin-top:12px"><table style="width:100%;min-width:650px"><thead><tr><th>Player</th><th>GLSK match</th><th>Stacked</th><th>Highest</th><th>Yahoo score</th><th>GLSK − Yahoo</th><th>Breakdown / issues</th></tr></thead><tbody data-preview-rows></tbody></table></div></div>
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
      const tr=document.createElement('tr');cell(tr,`${row.name} · ${row.team} · ${row.position}`);const matchCell=cell(tr,row.match.status);
      if(row.match.candidates.length>1||(!row.match.playerKey&&row.match.candidates.length)) {
        const select=document.createElement('select');select.className='input';select.setAttribute('aria-label','Review GLSK match for '+row.name);
        const blank=document.createElement('option');blank.value='';blank.textContent='Choose after review';select.append(blank);
        for(const key of row.match.candidates){const opt=document.createElement('option');opt.value=key;opt.textContent=key;select.append(opt);}
        select.value=row.match.playerKey||'';
        select.addEventListener('change',()=>{if(!active())return;row.match={...row.match,playerKey:select.value||null,status:select.value?'Commissioner-selected (preview only)':'Needs review'};render();});matchCell.append(select);
      }
      cell(tr,row.stacked.points===null?'Incomplete':row.stacked.points.toFixed(2));cell(tr,row.highest.points===null?'Incomplete':row.highest.points.toFixed(2));
      const yahooCell=cell(tr,''), yahoo=document.createElement('input');yahoo.type='number';yahoo.step='0.01';yahoo.style.width='90px';yahoo.setAttribute('aria-label','Yahoo score for '+row.name);yahoo.value=row.yahooPoints??'';yahooCell.append(yahoo);
      const delta=cell(tr,'');
      const updateDelta=()=>{row.difference=row.yahooPoints!==null&&row.yahooPoints!==undefined&&row.stacked.points!==null?Math.round((row.stacked.points-row.yahooPoints)*100)/100:null;delta.textContent=row.difference===null?'—':row.difference.toFixed(2);};
      yahoo.addEventListener('input',()=>{if(!active())return;row.yahooPoints=yahoo.value.trim()===''||!Number.isFinite(yahoo.valueAsNumber)?null:yahoo.valueAsNumber;updateDelta();});updateDelta();
      const td=cell(tr,''),details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='View details';details.append(summary);
      const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.style.maxWidth='500px';
      pre.textContent=JSON.stringify({providerId:row.providerId,gameId:row.gameId,match:row.match,stats:row.stats,sources:row.sources,stacked:row.stacked,highest:row.highest,review:row.review,providerEvidence:row.providerEvidence,comparisonStats:row.comparisonStats,comparisonAssumptions:row.comparisonAssumptions,normalizedInputScore:row.normalizedInputScore},null,2);details.append(pre);td.append(details);tbody.append(tr);
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
    const candidates=[...(state.waiverCenter?.players||[]),...(state.roster||[]).filter(p=>p.active!==false&&(!p.season_id||p.season_id===state.season.id)).map(p=>({...p,matchSource:'active-roster'}))];
    busy=true;button.disabled=true;msg.textContent='Loading statistics and calculating preview…';
    try {
      const {data,error}=await supabase.auth.getSession();
      if(error||data?.session?.user?.id!==user)throw new Error('Sign in to GLSK again.');
      let directoryNote='Full directory loaded.';
      try {
        if(!state.room?.id)throw new Error('No room');
        let finished=false;
        for(let start=0;start<10000;start+=1000) {
          const {data:players,error:directoryError}=await supabase.from('league_player_directory').select('player_key,player_name,nfl_team,position').eq('room_id',state.room.id).order('player_key').range(start,start+999);
          if(directoryError||!Array.isArray(players))throw new Error('Directory unavailable');
          candidates.push(...players);
          if(players.length<1000){finished=true;break;}
        }
        if(!finished)directoryNote='Directory capped at 10,000 records; some matches may be unavailable.';
      }catch{directoryNote='Full directory unavailable; matching uses loaded players and active rosters.';}
      if(!active())return;
      const response=await fetch('/api/msf-preview',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'test',year,week,feed}),signal:AbortSignal.timeout(55000)});
      const result=await response.json();
      if(!active())return;
      if(!response.ok)throw new Error(result.error||'Preview failed.');
      report={...result,seasonId:state.season.id,rules,matchingScope:directoryNote+' Active roster IDs take priority over aliases; suggestions only.',
        rows:result.rows.map(row=>({...row,match:matchPlayer(row,candidates),normalizedInputScore:scorePlayer(row.stats,rules,row.position,{bonusMode:'cumulative'}),stacked:scorePlayer(row.comparisonStats||row.stats,rules,row.position,{bonusMode:'cumulative'}),highest:scorePlayer(row.comparisonStats||row.stats,rules,row.position,{bonusMode:'highest'})}))};
      const matched=report.rows.filter(r=>r.match.playerKey).length,complete=report.rows.filter(r=>r.stacked.complete).length;
      msg.textContent='Preview ready. No league data was changed.';
      panel.querySelector('[data-preview-summary]').textContent=`${year} Week ${week}: ${report.rows.length} fantasy-position game records from ${result.providerRecords} provider records. ${matched} suggested matches; ${complete} have enough fields for provisional totals. Verify totals and matches before importing. ${directoryNote}`;
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
