import {Window} from 'happy-dom';
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const html=readFileSync('public/install.html','utf8');
const code=readFileSync('public/install.js','utf8');
async function run({share,copy,standalone=false}) {
 const w=new Window({url:'https://glsk-auction.vercel.app/install.html'});
 w.document.write(html.replace(/<script.*?<\/script>/s,''));
 Object.defineProperty(w.navigator,'standalone',{value:standalone});
 Object.defineProperty(w.navigator,'share',{value:share});
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:copy}});
 w.eval(code);return w;
}
let copied='';let w=await run({copy:async v=>{copied=v;}});
w.document.getElementById('share').click();await new Promise(r=>setTimeout(r,0));
assert.equal(copied,'https://glsk-auction.vercel.app/install.html');
assert.match(w.document.getElementById('status').textContent,/copied/);
w=await run({share:async()=>{throw {name:'AbortError'}},copy:async()=>{throw Error('Should not copy')}});
w.document.getElementById('share').click();await new Promise(r=>setTimeout(r,0));assert.equal(w.document.getElementById('status').textContent,'');
w=await run({copy:async()=>{throw Error('denied')}});w.document.getElementById('copy').click();await new Promise(r=>setTimeout(r,0));assert.match(w.document.getElementById('status').textContent,/shown below/);
w=await run({standalone:true});assert.equal(w.document.getElementById('install').hidden,true);
const manifest=JSON.parse(readFileSync('dist/manifest.webmanifest','utf8'));assert.equal(manifest.start_url,'/league');
for(const file of ['install.html','install.js','league.html',...manifest.icons.map(i=>i.src.slice(1))])assert.ok(existsSync('dist/'+file));
console.log('PASS sharing fallback, cancelled share, clipboard denial, installed view, production entry points and icons');
