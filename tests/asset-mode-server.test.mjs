import assert from 'node:assert/strict';
import {requireFullMode} from '../server/app-mode.js';
import msf from '../api/msf-connection.js';
import preview from '../api/msf-preview.js';
import yahoo from '../api/yahoo-connection.js';
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
await requireFullMode('Bearer test',async()=>reply({mode:'full'}));
for(const data of [{mode:'assets'},{},null,{mode:'other'}])await assert.rejects(()=>requireFullMode('Bearer test',async()=>reply(data)));
await assert.rejects(()=>requireFullMode('Bearer test',async()=>reply({mode:'full'},403)));
await assert.rejects(()=>requireFullMode('Bearer test',async()=>{throw Error('network')}));
process.env.MSF_API_KEY='test';process.env.YAHOO_CLIENT_ID='test';process.env.YAHOO_CLIENT_SECRET='test';process.env.YAHOO_REDIRECT_URI='https://glsk-auction.vercel.app/api/yahoo-callback';
const originalFetch=globalThis.fetch;
let urls=[];
globalThis.fetch=async(url)=>{
 urls.push(url);
 if(url.endsWith('/league_app_mode'))return reply({mode:'assets'});
 if(url.endsWith('/league_msf_trial_context'))return reply({room_id:'room',user_id:'user',is_commissioner:true});
 if(url.endsWith('/league_yahoo_connection'))return reply({room_id:'room',user_id:'user',revision:0});
 throw Error('Unexpected external call '+url);
};
function response(){return {setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;},end(){return this;}};}
for(const [handler,body] of [[msf,{action:'test',feed:'players',year:2026,week:4}],[preview,{action:'test',feed:'teams',year:2026,week:4}],[yahoo,{action:'connect'}],[yahoo,{action:'test'}]]){
 urls=[];const res=response();await handler({method:'POST',headers:{origin:'https://glsk-auction.vercel.app',authorization:'Bearer test'},body},res);
 assert.equal(res.code,409,JSON.stringify(res.body));assert(urls.some(u=>u.endsWith('/league_app_mode')));assert(urls.every(u=>u.includes('/rest/v1/rpc/')));
}
globalThis.fetch=originalFetch;
console.log('PASS full-mode guard, failure closure, blocked MSF tests/previews and Yahoo connect/probe without provider calls.');
