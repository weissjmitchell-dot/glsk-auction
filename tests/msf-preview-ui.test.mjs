import {Window} from 'happy-dom';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {scorePlayer} from '../server/msf-scoring.js';
import {matchPlayer} from '../shared/msf-matching.js';
const window=new Window(),document=window.document;
let fetches=0;
const context=vm.createContext({document,Date,Number,String,Error,JSON,URL,Blob,setTimeout,clearTimeout,AbortSignal,structuredClone,scorePlayer,matchPlayer,
 supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'u'},access_token:'fake'}}})}},
 fetch:async()=>{fetches++;return {ok:true,json:async()=>({feed:'players',year:2026,week:4,providerRecords:1,rows:[{name:'<img src=x onerror=alert(1)>',position:'QB',team:'DET',stats:{pass_yds:300},sources:{pass_yds:'passing.passYards'},review:[]}]})};}});
vm.runInContext(fs.readFileSync(new URL('../src/msf-preview.js',import.meta.url),'utf8').replace(/^import.*\n/gm,'').replaceAll('export function','function'),context);
document.body.innerHTML='<section id="root"><input data-msf-year value="2026"><input data-msf-week value="4"><select data-msf-feed><option value="players">Players</option></select>'+vm.runInContext('previewView()',context)+'</section>';
context.state={authUser:{id:'u'},authAccount:{is_commissioner:true},season:{id:'s',season_year:2026},scoringRules:[{category:'Offense',rule_key:'pass_yds',points:1,rate_value:30}],roster:[]};context.root=document.getElementById('root');
vm.runInContext('bindPreview({state,root})',context);
document.querySelector('[data-preview-run]').click();await new Promise(r=>setTimeout(r,25));
assert.equal(fetches,1);assert.equal(document.querySelector('[data-preview-results]').hidden,false);assert.equal(document.querySelectorAll('[data-preview-rows] tr').length,1);assert.equal(document.querySelectorAll('img').length,0);assert.match(document.querySelector('[data-preview-rows]').textContent,/10.00/);assert.match(document.querySelector('[data-preview-rows]').textContent,/Unmatched/);
const yahoo=document.querySelector('[aria-label^="Yahoo score"]');yahoo.value='12';yahoo.dispatchEvent(new window.Event('input'));assert.match(document.querySelector('[data-preview-rows]').textContent,/-2.00/);
yahoo.value='';yahoo.dispatchEvent(new window.Event('input'));assert(!document.querySelector('[data-preview-rows]').textContent.includes('-2.00'));
document.querySelector('[data-msf-year]').value='2025';document.querySelector('[data-preview-run]').click();await new Promise(r=>setTimeout(r,10));assert.equal(fetches,1);assert.match(document.querySelector('[data-preview-message]').textContent,/current GLSK season/);
await window.happyDOM.close();console.log('PASS: preview renders totals safely and blocks wrong-season rules.');
