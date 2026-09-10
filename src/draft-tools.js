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
export function createDraftTools(client,phase,roomCode){
 const state={context:null,metrics:[],saved:[],order:[],revision:0,editing:false,busy:false,error:'',loadedAt:0,pendingImport:null,importSource:'',notice:''};
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error||data?.ok===false)throw new Error(error?.message||data.error);return data;};
 let loading;
 async function load(force=false){if(loading)return loading;if(!force&&Date.now()-state.loadedAt<60000)return;
  loading=(async()=>{try{const d=await rpc('league_get_draft_tools',{p_room_code:roomCode,p_phase:phase});state.context=d.context;state.metrics=d.metrics||[];if(!state.editing){state.saved=d.rankings.player_ids||[];state.order=[...state.saved];state.revision=d.rankings.revision||0;}state.error='';state.loadedAt=Date.now();}catch(e){state.error='Draft data and saved rankings unavailable: '+e.message;}finally{loading=null;}})();return loading;
 }
 function ordered(players){const base=players.slice().sort((a,b)=>Number(a.yahoo_rank??a.rank??99999)-Number(b.yahoo_rank??b.rank??99999)||a.name.localeCompare(b.name));const map=new Map(base.map(p=>[String(p.id),p]));const saved=state.editing?state.order:state.saved;const valid=saved.filter(id=>map.has(id));const used=new Set(valid);return [...valid.map(id=>map.get(id)),...base.filter(p=>!used.has(String(p.id)))];}
 function metric(p){return state.metrics.find(x=>x.player_key===playerKey(p))||{};}
 async function save(){if(state.busy||!state.context)return;state.busy=true;try{const d=await rpc('league_save_draft_rankings',{p_room_code:roomCode,p_phase:phase,p_player_ids:state.order,p_expected_revision:state.revision});state.revision=d.revision;state.saved=[...state.order];state.editing=false;state.notice='Rankings saved to your account.';}catch(e){state.notice=e.message;}finally{state.busy=false;}}
 function edit(players){if(!state.context)return;state.order=ordered(players).map(p=>String(p.id));state.editing=true;state.notice='Move players with their rank number, then Save Rankings.';}
 function move(id,rank){if(state.editing&&!state.busy&&Number.isInteger(rank)&&rank>=1&&rank<=state.order.length)state.order=reorder(state.order,id,rank);}
 async function importMetrics(){if(!state.pendingImport||state.busy)return;state.busy=true;try{const d=await rpc('league_import_draft_metrics',{p_room_code:roomCode,p_rows:state.pendingImport,p_source:state.importSource,p_season_year:state.context.season_year});state.pendingImport=null;state.notice=`Imported ${d.imported} player records.`;await load(true);}catch(e){state.notice=e.message;}finally{state.busy=false;}}
 return {state,load,ordered,metric,save,edit,move,importMetrics};
}
