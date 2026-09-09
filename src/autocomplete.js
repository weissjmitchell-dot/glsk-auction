import { supabase } from './supabase.js';
import { ROOM_CODE } from './config.js';

// Imported once from the shared Supabase module so every GLSK page gets it.
const names = new Set();
let loadedFor=null,loading=null,activeId=null,caret=null;
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[.'’\-]/g,'').trim();
const isSearch=el=>el instanceof HTMLInputElement&&['text','search',''].includes(el.type)&&/search/i.test(`${el.id} ${el.placeholder} ${el.getAttribute('aria-label')||''}`);
const list=document.createElement('datalist');list.id='glsk-name-suggestions';
function attach(){
 if(!document.body)return;
 if(!list.isConnected)document.body.appendChild(list);
 document.querySelectorAll('input').forEach(input=>{if(isSearch(input)&&(!input.hasAttribute('list')||input.getAttribute('list')===list.id)){input.setAttribute('list',list.id);input.setAttribute('autocomplete','off');}});
 if(activeId&&document.activeElement===document.body){const input=document.getElementById(activeId);if(isSearch(input)){input.focus({preventScroll:true});if(caret)input.setSelectionRange(caret[0],caret[1]);}}
}
function populate(input){
 const q=normalize(input.value);
 const matches=[...names].filter(name=>!q||normalize(name).includes(q)).sort((a,b)=>Number(!normalize(a).startsWith(q))-Number(!normalize(b).startsWith(q))||a.localeCompare(b)).slice(0,30);
 list.replaceChildren(...matches.map(name=>{const option=document.createElement('option');option.value=name;return option;}));
}
async function loadNames(){
 const {data}=await supabase.auth.getSession();
 const identity=data?.session?.user?.id||'guest';
 if(loadedFor===identity)return;
 if(loading)return loading;
 names.clear();
 loading=(async()=>{
   const {data:room,error}=await supabase.from('rooms').select('id').eq('code',ROOM_CODE).single();if(error)throw error;
   const results=await Promise.allSettled(['players','phase3_players','teams'].map(async table=>{
     let after=null;const found=[];
     for(;;){let query=supabase.from(table).select('id,name').eq('room_id',room.id).order('id',{ascending:true}).limit(500);if(after!==null)query=query.gt('id',after);
       const {data:rows,error}=await query;if(error)throw error;if(!rows?.length)break;
       found.push(...rows.map(r=>r.name).filter(Boolean));const next=rows.at(-1).id;if(next===after)break;after=next;
     }return found;
   }));
   results.forEach(r=>{if(r.status==='fulfilled')r.value.forEach(name=>names.add(name));});
   if(results.every(r=>r.status==='fulfilled'))loadedFor=identity;
 })().finally(()=>{loading=null;});
 return loading;
}
// Supplement names with the current page's records without making extra queries.
window.GLSKAutocomplete={addNames(values){values.filter(Boolean).forEach(name=>names.add(String(name)));}};
document.addEventListener('focusin',event=>{
 if(!isSearch(event.target)){activeId=null;return;}
 const input=event.target;activeId=input.id||null;caret=[input.selectionStart,input.selectionEnd];attach();
 populate(input);loadNames().then(()=>{if(document.activeElement===input)populate(input);}).catch(()=>{});
});
document.addEventListener('input',event=>{if(isSearch(event.target)){activeId=event.target.id||null;caret=[event.target.selectionStart,event.target.selectionEnd];populate(event.target);}},true);
document.addEventListener('pointerdown',event=>{if(!isSearch(event.target))activeId=null;},true);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){activeId=null;}},true);
const observe=()=>{attach();new MutationObserver(records=>{if(records.some(r=>r.target!==list&&!list.contains(r.target)))attach();}).observe(document.body,{childList:true,subtree:true});};
if(document.body)observe();else document.addEventListener('DOMContentLoaded',observe,{once:true});
