export const playerKey=p=>p.player_key||String(p.name||p.player_name||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
export function reorder(ids,id,rank){const out=ids.filter(x=>x!==id);out.splice(Math.max(0,Math.min(out.length,rank-1)),0,id);return out;}
export function parseMetricsCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('Unclosed quote in CSV.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=(rows.shift()||[]).map(x=>x.trim().replace(/^\uFEFF/,''));
 const keys=['player_name','yahoo_adp','previous_fantasy_points','projected_fantasy_points'];
 if(!keys.every(k=>headers.includes(k)))throw new Error('CSV headers must include: '+keys.join(', '));
 const seen=new Set();return rows.map((r,i)=>{const out={};for(const k of keys){const v=(r[headers.indexOf(k)]||'').trim();if(k==='player_name'){if(!v)throw new Error(`Row ${i+2}: player name required.`);out[k]=v;}else{out[k]=v===''?null:Number(v);if(v!==''&&(!Number.isFinite(out[k])||(k==='yahoo_adp'&&out[k]<=0)))throw new Error(`Row ${i+2}: invalid ${k}.`);}}const key=playerKey(out);if(seen.has(key))throw new Error('Duplicate player: '+out.player_name);seen.add(key);return out;});
}
// Personal ranking imports are matched locally; only the final player IDs are saved.
function rankingCSVRows(text){
 const rows=[];let row=[],cell='',mode='plain',line=1,startLine=1;
 const finishCell=()=>{row.push(cell.trim());cell='';mode='plain';};
 const finishRow=()=>{finishCell();if(row.some(Boolean))rows.push({cells:row,line:startLine});row=[];if(rows.length>3001)throw new Error('Use a CSV with at most 3,000 players.');};
 text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(mode==='quoted'){
   if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else mode='closed';}
   else{cell+=c;if(c==='\n')line++;}
   continue;
  }
  if(c===','){finishCell();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;finishRow();line++;startLine=line;continue;}
  if(mode==='closed'){if(c===' '||c==='\t')continue;throw new Error(`Row ${startLine}: unexpected text after a closing quote.`);}
  if(c==='"'){if(cell.trim())throw new Error(`Row ${startLine}: put quotes around the whole field.`);cell='';mode='quoted';}else cell+=c;
 }
 if(mode==='quoted')throw new Error(`Row ${startLine}: unclosed quote.`);
 finishRow();return rows;
}
export function parseRankingsCSV(text){
 if(String(text).length>1000000)throw new Error('Use a CSV smaller than 1 MB.');
 const rows=rankingCSVRows(text);if(!rows.length)throw new Error('The CSV is empty.');
 const normalize=h=>h.toLowerCase().replace(/[^a-z0-9]/g,'');
 const aliases={name:['playername','player','name'],rank:['rank','ranking','myrank','overallrank','overall','rk'],team:['team','nflteam','tm'],position:['position','pos']};
 const header=rows[0].cells.map(normalize),columns={};
 for(const [key,labels]of Object.entries(aliases)){
  const indexes=header.map((h,i)=>labels.includes(h)?i:-1).filter(i=>i>=0);
  if(indexes.length>1)throw new Error(`More than one ${key} column. Keep just one.`);
  columns[key]=indexes[0]??-1;
 }
 const hasHeader=columns.name>=0;
 if(hasHeader)rows.shift();
 else if(rows.every(r=>r.cells.length===1)){columns.name=0;columns.rank=-1;columns.team=-1;columns.position=-1;}
 else throw new Error('Use a player_name, name or player header. Example: rank,player_name,team,position.');
 if(!rows.length||rows.length>3000)throw new Error('Include between 1 and 3,000 players.');
 const ranks=new Set();
 return rows.map((r,i)=>{
  const name=r.cells[columns.name]||'',value=columns.rank<0?String(i+1):r.cells[columns.rank]||'';
  if(!name||name.length>150)throw new Error(`Row ${r.line}: provide a player name up to 150 characters.`);
  const rank=Number(value);
  if(!/^\d+$/.test(value)||!Number.isSafeInteger(rank)||rank<1)throw new Error(`Row ${r.line}: rank must be a positive whole number.`);
  if(ranks.has(rank))throw new Error(`Row ${r.line}: rank ${rank} appears more than once.`);ranks.add(rank);
  return {name,rank,line:r.line,team:r.cells[columns.team]||'',position:r.cells[columns.position]||''};
 }).sort((a,b)=>a.rank-b.rank);
}
const rankingName=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const rankingBase=s=>rankingName(String(s||'').replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i,''));
const rankingPosition=s=>{const p=String(s||'').toUpperCase().replace(/[^A-Z]/g,'');return ['D','DST','DEF','DEFENSE'].includes(p)?'DEF':p;};
export function matchRankings(rows,players){
 const exact=new Map(),base=new Map();
 for(const p of players){for(const [map,key]of [[exact,rankingName(p.name)],[base,rankingBase(p.name)]]){if(!map.has(key))map.set(key,[]);map.get(key).push(p);}}
 const used=new Map(),ids=[];
 const matches=rows.map(row=>{
  let candidates=exact.get(rankingName(row.name))||base.get(rankingBase(row.name))||[];
  if(candidates.length>1){
   if(row.position)candidates=candidates.filter(p=>rankingPosition(p.position)===rankingPosition(row.position));
   if(row.team)candidates=candidates.filter(p=>rankingName(p.nfl_team)===rankingName(row.team));
  }
  if(candidates.length!==1)return {...row,status:candidates.length?'ambiguous':'unmatched',note:candidates.length?'More than one match; add team or position.':'Not matched in this draft pool.'};
  const p=candidates[0],id=String(p.id);
  if(used.has(id))return {...row,status:'duplicate',id,playerName:p.name,note:`Duplicate player; already listed on row ${used.get(id)}.`};
  used.set(id,row.line);ids.push(id);
  return {...row,status:'matched',id,playerName:p.name,nflTeam:p.nfl_team||'',playerPosition:p.position||'',note:'Matched'};
 });
 return {rows:matches,ids,matched:ids.length,unmatched:matches.filter(x=>x.status==='unmatched').length,ambiguous:matches.filter(x=>x.status==='ambiguous').length,duplicates:matches.filter(x=>x.status==='duplicate').length};
}

export function createDraftTools(client,phase,roomCode){
 const state={context:null,metrics:[],saved:[],order:[],revision:0,editing:false,busy:false,error:'',loadedAt:0,pendingImport:null,importSource:'',notice:'',rankingUploadOpen:false,rankingReading:false,rankingPreview:null,rankingFileName:'',rankingError:''};
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error||data?.ok===false)throw new Error(error?.message||data.error);return data;};
 let loading,rankingReadId=0;
 async function load(force=false){if(loading)return loading;if(!force&&Date.now()-state.loadedAt<60000)return;
  loading=(async()=>{try{const d=await rpc('league_get_draft_tools',{p_room_code:roomCode,p_phase:phase});state.context=d.context;state.metrics=d.metrics||[];if(!state.editing){state.saved=d.rankings.player_ids||[];state.order=[...state.saved];state.revision=d.rankings.revision||0;}state.error='';state.loadedAt=Date.now();}catch(e){state.error='Draft data and saved rankings unavailable: '+e.message;}finally{loading=null;}})();return loading;
 }
 function ordered(players){const base=players.slice().sort((a,b)=>Number(a.yahoo_rank??a.rank??99999)-Number(b.yahoo_rank??b.rank??99999)||a.name.localeCompare(b.name));const map=new Map(base.map(p=>[String(p.id),p]));const saved=state.editing?state.order:state.saved;const valid=saved.filter(id=>map.has(id));const used=new Set(valid);return [...valid.map(id=>map.get(id)),...base.filter(p=>!used.has(String(p.id)))];}
 function metric(p){return state.metrics.find(x=>x.player_key===playerKey(p))||{};}
 async function save(){if(state.busy||state.rankingReading||state.rankingPreview||!state.context)return;state.busy=true;try{const d=await rpc('league_save_draft_rankings',{p_room_code:roomCode,p_phase:phase,p_player_ids:state.order,p_expected_revision:state.revision});state.revision=d.revision;state.saved=[...state.order];state.editing=false;state.notice='Rankings saved to your account.';}catch(e){state.notice=e.message;}finally{state.busy=false;}}
 function edit(players){if(!state.context||state.busy||state.rankingReading||state.rankingPreview)return;state.order=ordered(players).map(p=>String(p.id));state.editing=true;state.notice='Move players with their rank number, then Save Rankings.';}
 function move(id,rank){if(state.editing&&!state.busy&&!state.rankingReading&&!state.rankingPreview&&Number.isInteger(rank)&&rank>=1&&rank<=state.order.length)state.order=reorder(state.order,id,rank);}
 function closeRankingUpload(){rankingReadId++;state.rankingUploadOpen=false;state.rankingReading=false;state.rankingPreview=null;state.rankingFileName='';state.rankingError='';}
 const rankingContext=()=>JSON.stringify([state.context?.user_id,state.context?.season_id]);
 async function previewRankingFile(file,players){
  if(!file||!state.context||state.busy)return;
  const request=++rankingReadId,context=rankingContext();
  state.rankingUploadOpen=true;state.rankingReading=true;state.rankingPreview=null;state.rankingError='';state.rankingFileName=file.name;
  try{
   if(file.size>1000000)throw new Error('Use a CSV smaller than 1 MB.');
   const rows=parseRankingsCSV(await file.text());
   if(request!==rankingReadId)return;
   if(context!==rankingContext())throw new Error('Your account or season changed. Upload the file again.');
   state.rankingPreview={...matchRankings(rows,players),input:rows,context};
  }catch(e){if(request===rankingReadId)state.rankingError=e.message;}
  finally{if(request===rankingReadId)state.rankingReading=false;}
 }
 function useRankingPreview(players){
  const preview=state.rankingPreview;
  if(!preview||!state.context||state.busy||state.rankingReading)return false;
  if(preview.context!==rankingContext()){state.rankingError='Your account or season changed. Upload the file again.';state.rankingPreview=null;return false;}
  const current=matchRankings(preview.input,players);
  if(JSON.stringify(current.rows)!==JSON.stringify(preview.rows)){state.rankingPreview={...current,input:preview.input,context:preview.context};state.rankingError='The draft pool changed. Review the updated matches before using them.';return false;}
  if(!current.matched||current.duplicates)return false;
  const used=new Set(current.ids),remaining=ordered(players).map(p=>String(p.id)).filter(id=>!used.has(id));
  state.order=[...current.ids,...remaining];state.editing=true;closeRankingUpload();
  state.notice=`${current.matched} CSV players placed first in My Rank. Click Save Rankings to save them.`;
  return true;
 }
 async function importMetrics(){if(!state.pendingImport||state.busy)return;state.busy=true;try{const d=await rpc('league_import_draft_metrics',{p_room_code:roomCode,p_rows:state.pendingImport,p_source:state.importSource,p_season_year:state.context.season_year});state.pendingImport=null;state.notice=`Imported ${d.imported} player records.`;await load(true);}catch(e){state.notice=e.message;}finally{state.busy=false;}}
 return {state,load,ordered,metric,save,edit,move,importMetrics,previewRankingFile,useRankingPreview,closeRankingUpload};
}
