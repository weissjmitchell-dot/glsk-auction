// Commissioner-only UI. Authoritative calculations and mutations live in SQL RPCs.
let input=null,preview=null,runs=[],busy=false,error='',notice='',loadedKey=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rolloverView(){return '<section id="season-rollover" class="card card-pad office-section" aria-label="Season rollover"></section>';}
function initial(state){return {source:state.season.id,bid_pool:'',results_confirmed:false,teams:state.teams.map(t=>({team_id:t.id,regular_finish:'',bracket:'championship',finish:'',adjustment:'0'}))};}
function table(headers,rows){return `<div style="overflow:auto"><table class="ro-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function previewMarkup(p){return `<section class="ro-preview"><h3>${p.source_year} → ${p.target_year} Preview</h3><h4>Bid balances, cap and draft order</h4>${table(['Team','Regular finish','Draft slot','Pool share','Adjustment','New bids','Retained cap'],p.teams.map(t=>[t.name,t.regular_finish,t.draft_slot,t.allocation,t.adjustment,t.new_bids,t.cap_used]))}<details open><summary>Roster changes (${p.players.length})</summary>${table(['Team','Player','Action','Contract through','Cap','Rookie rights'],p.players.map(r=>[r.team,r.player_name,r.action,r.end_year??'—',r.cap_cost,r.rookie_rights?'Preserved':'—']))}</details><details><summary>Preserved rookie rights (${p.rights.length}) and future picks (${p.picks.length})</summary>${table(['Player','Draft year','Owner'],p.rights.map(r=>[r.player_name,r.rookie_draft_year,p.teams.find(t=>t.team_id===r.owner_team_id)?.name||r.owner_team_id]))}${table(['Draft year','Type','Round','Original team','Current owner'],p.picks.map(r=>[r.draft_year,r.draft_type,r.round,p.teams.find(t=>t.team_id===r.original_team_id)?.name||r.original_team_id,p.teams.find(t=>t.team_id===r.owner_team_id)?.name||r.owner_team_id]))}</details><ul>${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')}</ul></section>`;}
export function bindRollover({state,rpc,refresh}){
 const root=document.getElementById('season-rollover');if(!root)return;
 if(!state.session?.commishPin){root.textContent='Commissioner access is required.';return;}
 if(!state.season){root.textContent='No current season is configured.';return;}
 if(!input||input.source!==state.season.id){input=initial(state);preview=null;}
 const args={p_room_code:state.room.code,p_commish_pin:state.session.commishPin};
 const key=`${state.season.id}:${state.session.teamId}`;
 const draw=()=>{
 if(!root.isConnected)return;
 root.innerHTML=`<style>.ro-table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}.ro-table th,.ro-table td{padding:10px;border-bottom:1px solid #dce3ed;text-align:left}.ro-table th{background:#f0f3f7}.ro-table input,.ro-table select{min-width:90px}.ro-preview{margin-top:24px}.ro-preview details{margin:18px 0}.ro-preview li{margin:8px 0}.ro-actions{display:flex;flex-wrap:wrap;gap:12px;margin:18px 0}.ro-feedback{white-space:pre-wrap}</style>
 <h2>Season Rollover</h2><p>Prepare ${state.season.season_year+1}, review every change, then confirm. Undo is available only until subsequent league activity.</p>
 <div class="notice">New-year drafts require separate preparation. Rollover preserves the old rooms as read-only archives; it does not load next year's prospects or start drafts.</div>
 ${error?`<p class="error ro-feedback" role="alert">${esc(error)}</p>`:''}${notice?`<p class="notice ro-feedback" role="status">${esc(notice)}</p>`:''}
 <form id="ro-form"><fieldset ${busy?'disabled':''} style="border:0;padding:0;margin-top:20px"><label>Approved bid pool (whole bid dollars)<input class="input" name="bid_pool" type="number" min="0" max="1000000" step="1" value="${esc(input.bid_pool)}" required></label>
 <p>Enter final regular-season ranks for draft order and championship/consolation finishes for redistribution. Adjustments are reviewed carryover, penalties or corrections; unspent balances are not automatically carried over.</p>
 <div style="overflow:auto"><table class="ro-table"><thead><tr><th>Team</th><th>Regular finish</th><th>Bracket</th><th>Bracket finish</th><th>Bid adjustment</th></tr></thead><tbody>${input.teams.map(t=>`<tr data-ro-team="${esc(t.team_id)}"><th>${esc(state.teams.find(x=>x.id===t.team_id)?.name)}</th><td><input class="input" data-field="regular_finish" type="number" min="1" max="${state.teams.length}" step="1" value="${esc(t.regular_finish)}" required></td><td><select class="input" data-field="bracket"><option value="championship" ${t.bracket==='championship'?'selected':''}>Championship</option><option value="consolation" ${t.bracket==='consolation'?'selected':''}>Consolation</option></select></td><td><input class="input" data-field="finish" type="number" min="1" max="6" step="1" value="${esc(t.finish)}" required></td><td><input class="input" data-field="adjustment" type="number" min="-1000000" max="1000000" step="1" value="${esc(t.adjustment)}" required></td></tr>`).join('')}</tbody></table></div>
 <label style="display:block;margin:18px 0"><input name="results_confirmed" type="checkbox" ${input.results_confirmed?'checked':''} required> I have verified final results, the bid pool and all carryover/penalty adjustments.</label>
 <button class="btn btn-primary" type="submit">${busy?'Working…':'Preview Next Season'}</button></fieldset></form>
 ${preview?`${previewMarkup(preview.preview)}<div class="ro-actions"><label>Type ${preview.preview.target_year} to confirm <input class="input" id="ro-confirm-year" inputmode="numeric" autocomplete="off" ${busy?'disabled':''}></label><button class="btn btn-reset" id="ro-apply" ${busy?'disabled':''}>Confirm Season Rollover</button></div>`:''}
 <hr><h3>Rollover History & Undo</h3><button class="btn btn-outline" id="ro-refresh" ${busy?'disabled':''}>Refresh History</button>
 ${runs.length?runs.map(r=>`<section class="card card-pad" style="margin-top:14px"><strong>${r.preview.source_year} → ${r.preview.target_year} • ${esc(r.status)}</strong><details><summary>Review saved preview</summary>${previewMarkup(r.preview)}</details>${r.status==='applied'?r.can_undo?`<div class="ro-actions"><label>Type ${r.preview.source_year} to restore <input class="input" data-ro-undo-year="${r.id}" inputmode="numeric" autocomplete="off" ${busy?'disabled':''}></label><button class="btn btn-reset" data-ro-undo="${r.id}" ${busy?'disabled':''}>Undo Last Rollover</button></div>`:'<p>Undo is blocked because league activity occurred after rollover. Use a targeted correction to preserve that activity.</p>':''}</section>`).join(''):'<p>No completed rollover history loaded.</p>'}`;
 root.querySelector('#ro-form').addEventListener('input',capture);
 root.querySelector('#ro-form').addEventListener('change',capture);
 root.querySelector('#ro-form').addEventListener('submit',async e=>{e.preventDefault();capture();await action(async()=>{preview=await rpc('league_commish_preview_rollover',{...args,p_input:input});notice='Preview saved. Review roster changes, balances and draft order before confirming.';});});
 root.querySelector('#ro-refresh').onclick=()=>action(loadHistory);
 root.querySelector('#ro-apply')?.addEventListener('click',async()=>{
 const year=Number(root.querySelector('#ro-confirm-year').value);
 if(year!==preview.preview.target_year){error='Enter the next season year exactly.';draw();return;}
 if(!confirm(`Roll GLSK from ${preview.preview.source_year} to ${year}? Contract releases and new bid balances will take effect.`))return;
 const id=preview.id;await action(async()=>{await rpc('league_commish_apply_rollover',{...args,p_preview_id:id,p_confirm_year:year});preview=null;input=null;loadedKey=null;notice=`Season ${year} created. Previous-season draft rooms are archived.`;await reloadAfterSave();});
 });
 root.querySelectorAll('[data-ro-undo]').forEach(b=>b.onclick=async()=>{
 const r=runs.find(r=>r.id===b.dataset.roUndo),year=Number(root.querySelector(`[data-ro-undo-year="${r.id}"]`).value);
 if(year!==r.preview.source_year){error='Enter the original season year exactly.';draw();return;}
 if(!confirm(`Undo this rollover and restore ${year}? This is allowed only if no subsequent league activity would be erased.`))return;
 await action(async()=>{await rpc('league_commish_undo_rollover',{...args,p_rollover_id:r.id,p_confirm_year:year});input=null;preview=null;loadedKey=null;notice=`Restored season ${year}.`;await reloadAfterSave();});
 });
 };
 function capture(){
 if(busy)return;
 const form=root.querySelector('#ro-form');input.bid_pool=form.elements.bid_pool.value;input.results_confirmed=form.elements.results_confirmed.checked;
 root.querySelectorAll('[data-ro-team]').forEach(row=>{const t=input.teams.find(t=>t.team_id===row.dataset.roTeam);row.querySelectorAll('[data-field]').forEach(el=>t[el.dataset.field]=el.value);});
 if(preview){preview=null;root.querySelector('.ro-preview')?.remove();root.querySelector('#ro-apply')?.closest('.ro-actions')?.remove();}
 }
 async function loadHistory(){const result=await rpc('league_commish_get_rollovers',args);runs=result.runs;loadedKey=key;}
 async function reloadAfterSave(){try{await refresh();}catch{notice+=' Saved successfully, but the page could not reload. Refresh GLSK before continuing.';}}
 async function action(fn){if(busy)return;busy=true;error='';draw();try{await fn();}catch(e){error=e.message;if(/changed|no longer|already used/i.test(error))preview=null;}finally{busy=false;if(root.isConnected)draw();else bindRollover({state,rpc,refresh});}}
 draw();if(loadedKey!==key&&!busy)action(loadHistory);
}
