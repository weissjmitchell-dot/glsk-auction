import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(p,'utf8');
const config=JSON.parse(read('capacitor.config.json'));
assert.equal(config.appId,'com.mitchellweiss.glsk');
assert.equal(config.server.appStartPath,'league.html');assert.ok(!config.server.url);
for(const file of ['league','auction','supplemental','phase3']) {
 const html=read('dist-ios/'+file+'.html');
 assert.ok(!html.includes('/src/'),'Native source must be bundled');
 for(const [,path] of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g))assert.ok(existsSync('dist-ios'+path));
}
assert.match(read('dist-ios/auction.html'),/Auction Room/);
assert.match(read('dist-ios/league.html'),/League Office/);
let fetchCall, handler, navigation, external;
class Anchor {click(){} }
const body={appendChild(){}};
const location={href:'capacitor://localhost/league.html',assign:x=>navigation=x,reload(){}};
const window={fetch:async(...a)=>{fetchCall=a;return {}},alert(){}};
const context={window,location,URL,Request,HTMLAnchorElement:Anchor,Capacitor:{isNativePlatform:()=>true},Browser:{open:async x=>{external=x.url}},Share:{},Filesystem:{},Directory:{},confirm:()=>false,
 document:{body,createElement:()=>({setAttribute(){},style:{}}),addEventListener:(type,fn)=>handler=fn}};
const source=read('src/native-runtime.js').replace(/^import .*;\n/gm,'').replace(/export /g,'');
vm.runInNewContext(source,context);
await window.fetch('/api/draft-video-token',{method:'POST',headers:{Authorization:'Bearer test'},body:'{}'});
assert.equal(fetchCall[0],'https://glsk-auction.vercel.app/api/draft-video-token');assert.equal(fetchCall[1].headers.Authorization,'Bearer test');
await window.fetch('https://example.supabase.co/rest/v1/test');assert.equal(fetchCall[0],'https://example.supabase.co/rest/v1/test');
async function click(href){let prevented=false;const a={href:new URL(href,location.href).href,getAttribute:()=>href};await handler({target:{closest:()=>a},preventDefault:()=>prevented=true});return prevented;}
assert.equal(await click('/'),true);assert.equal(navigation,'/auction.html');
await click('/supplemental');assert.equal(navigation,'/supplemental.html');
await click('/phase3');assert.equal(navigation,'/phase3.html');
assert.equal(await click('?tab=team&team=123'),false);
await click('https://example.com/rules');assert.equal(external,'https://example.com/rules');
assert.match(read('src/auth.js'),/location.protocol==='capacitor:'/);
assert.match(read('ios/App/App.xcodeproj/project.pbxproj'),/PrivacyInfo.xcprivacy in Resources/);
assert.match(read('ios/App/App/PrivacyInfo.xcprivacy'),/C617.1/);
assert.match(read('codemagic.yaml'),/submit_to_app_store: false/);
assert.ok(readdirSync('dist-ios/assets').some(f=>read('dist-ios/assets/'+f).includes('Refresh GLSK')));
console.log('PASS native entry points, bundled bridge, draft navigation, query links, authenticated API routing, external links, privacy and release guards');
