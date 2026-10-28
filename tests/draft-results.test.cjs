const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/league.js'),'utf8').replace(/^import .*;\n/gm,'').replace(/^init\(\);/gm,'');
const element={appendChild(){},addEventListener(){},querySelectorAll(){return []},querySelector(){return null},remove(){}};
const context=vm.createContext({document:{createElement:()=>({...element}),getElementById:()=>null,querySelector:()=>element,addEventListener(){},head:element},window:{addEventListener(){}},localStorage:{getItem:()=>null},location:{search:'',href:'https://example.test/league'},URL,URLSearchParams,ROOM_CODE:'GLSK26',LEAGUE_NAME:'GLSK',console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,configured:true,msfConnectionView:()=>'',yahooConnectionView:()=>'',rolloverView:()=>''});
vm.runInContext(source,context);const run=s=>vm.runInContext(s,context);

run("state.loading=false;state.room={id:'room1'};state.session={teamId:'mine'};state.appMode='assets';state.appModeReady=true;render=()=>{};");
assert.match(run('draftHubView()'),/data-tab="draftresults"/);
run('state.draftPreparation=true');assert.match(run('draftHubView()'),/data-tab="draftresults"/);
for(const tab of ['auctionresults','supplementalresults','snakeresults']){assert.match(run('draftResultsHubView()'),new RegExp(`data-tab="${tab}"`));assert.equal(run(`navGroupForTab('${tab}')`),'draft');}
const queries=[];let fail=false;
const tables={sales:[{player_id:'p',team_id:'a',price:19}],players:[{id:'p',name:'A <Player>',position:'WR',nfl_team:'DAL'}],teams:[{id:'a',name:'Selecting Team'},{id:'b',name:'Winning Team'}],supplemental_players:[{id:'p',name:'Rookie'}],supplemental_picks:[{player_id:'p',pick_no:3,selecting_team_id:'a',winner_team_id:'b',outcome:'rights_auction',price:6}],phase3_players:[{id:'p',name:'Snake Player'}],phase3_picks:[{player_id:'p',pick_no:13,team_id:'a',round:2}]};
context.supabase={from(table){const q={table,filters:[]};queries.push(q);const chain={select(){return chain},eq(k,v){q.filters.push([k,v]);return chain},order(k,o){q.order=[k,o];return chain},then(resolve){resolve({data:tables[table],error:fail?{message:'offline'}:null})}};return chain}};
(async()=>{
for(const tab of ['auctionresults','supplementalresults','snakeresults']){run(`state.tab='${tab}'`);await run(`loadDraftResults('${tab}')`);const html=run('draftResultsView()');assert.match(html,/data-tab="draftresults"/);assert.doesNotMatch(html,/Loading draft results/);if(tab==='auctionresults'){assert.match(html,/A &lt;Player&gt;/);assert.match(html,/\$19/);}if(tab==='supplementalresults'){assert.match(html,/Selected by Selecting Team → won by Winning Team/);assert.match(html,/Rookie Rights H2H/);}if(tab==='snakeresults')assert.match(html,/Round 2/);}
assert(queries.every(q=>q.filters.some(([k,v])=>k==='room_id'&&v==='room1')));
assert(queries.find(q=>q.table==='sales').filters.some(([k,v])=>k==='undone'&&v===false));
const count=queries.length;await run("loadDraftResults('snakeresults')");assert.equal(queries.length,count);
fail=true;await run("loadDraftResults('snakeresults',true)");assert.match(run('draftResultsView()'),/Unable to load/);
fail=false;tables.phase3_picks=[];await run("loadDraftResults('snakeresults',true)");assert.match(run('draftResultsView()'),/No Snake results recorded yet/);
console.log('PASS draft navigation, read-only room-scoped queries, undone exclusion, winners, prices, escaping, cache, retry and empty states.');
})().catch(e=>{console.error(e);process.exitCode=1});
