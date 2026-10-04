import {Window} from 'happy-dom';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const window=new Window({url:'https://glsk-auction.vercel.app/league'}),document=window.document;
let fetches=0;
const response={records:1,inspected:1,note:'Access worked; scoring not verified.',fields:[{path:'stats.passYards',types:['number']}],feed:'players',year:2026,week:1};
const context=vm.createContext({document,Date,Number,Error,JSON,URL,Blob,setTimeout,AbortSignal,
  supabase:{auth:{getSession:async()=>({data:{session:{user:{id:'commissioner'},access_token:'fake'}}})}},
  fetch:async()=>{fetches++;return {ok:true,json:async()=>response};}});
const source=fs.readFileSync(new URL('../src/msf-connection.js',import.meta.url),'utf8').replace(/^import.*\n/,'').replaceAll('export function','function');
vm.runInContext(source,context);
document.body.innerHTML=vm.runInContext('msfConnectionView()',context);
context.state={tab:'commissioner',commissionerSection:'msf',authAccount:{is_commissioner:false},authUser:{id:'commissioner'}};
vm.runInContext('bindMsfConnection({state})',context);
document.querySelector('[data-msf-action="test"]').click();assert.equal(fetches,0);
context.state.authAccount.is_commissioner=true;vm.runInContext('bindMsfConnection({state})',context);
document.querySelector('[data-msf-feed]').value='players';
document.querySelector('[data-msf-action="test"]').click();
await new Promise(resolve=>setTimeout(resolve,20));
assert.equal(fetches,1);assert.equal(document.querySelector('[data-msf-result]').hidden,false);
assert.match(document.querySelector('[data-msf-fields]').textContent,/stats.passYards/);
assert.match(document.querySelector('[data-msf-summary]').textContent,/Scoring has not been verified/);
assert.equal(document.querySelector('[data-msf-action="test"]').disabled,false);
const league=fs.readFileSync(new URL('../src/league.js',import.meta.url),'utf8');
assert(league.includes("['msf','MySportsFeeds Trial'"));assert(league.includes('msf:msfConnectionView'));assert(league.includes('bindMsfConnection({state})'));
await window.happyDOM.close();console.log('PASS: commissioner-only trial UI, result rendering and navigation wiring.');
