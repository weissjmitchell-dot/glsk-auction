import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
import {createDraftRoom} from '../src/draft-room.js';
const saved=new Map();globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
function harness(file){
 let source=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8').replace(/^import .*;\s*$/mg,'').replace(/^boot\(\);?\s*$/mg,'');
 const app={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};
 const document={querySelector:s=>s==='#app'?app:null,querySelectorAll:()=>[],addEventListener:()=>{},activeElement:null};
 const sandbox={createDraftRoom,document,localStorage,ROOM_CODE:'TEST',LEAGUE_NAME:'Test League',configured:true,console,setTimeout,clearTimeout,URL,window:{},supabase:{}};
 // Shared capture uses document only for a present search input; no browser required.
 const c=vm.createContext(sandbox);vm.runInContext(source+'\nglobalThis.h={state,render,draftDeskView};',c);return {...c.h,app};
}
const teams=Array.from({length:12},(_,i)=>({id:'t'+i,name:'Team '+i,remaining_budget:100,starting_budget:100}));
const players=[{id:'p1',name:'Sam Darnold',position:'QB',nfl_team:'SEA',rank:1,yahoo_rank:1,status:'available',projection_stats:{PassYds:4200},rights_team_id:'t1'},{id:'p2',name:'Runner Example',position:'RB',nfl_team:'DET',rank:2,yahoo_rank:2,status:'available'},{id:'p3',name:'Drafted Example',position:'WR',rank:3,yahoo_rank:3,status:'drafted'}];
function fixture(h){Object.assign(h.state,{loading:false,teams:structuredClone(teams),players:structuredClone(players),room:{id:'room',status:'live',active_player_id:'p1',active_bid:5,active_bidder_team_id:'t1'},settings:{status:'live',stage:'pick',current_pick_no:1,current_turn_no:1,max_roster_size:18},session:{teamId:'t0',pin:'test'},order:teams.map((t,i)=>({team_id:t.id,slot:i+1})),rosterState:teams.map(t=>({team_id:t.id,roster_count:10,max_roster_size:18})),rosterEntries:[],leagueRosterEntries:[],picks:[],sales:[]});}
for(const [file,timer] of [['main.js','timer'],['supplemental.js','supp-timer'],['phase3.js','phase3-timer']]){
 const h=harness(file);fixture(h);h.render();let html=h.app.innerHTML;
 assert.equal((html.match(new RegExp('id="'+timer+'"','g'))||[]).length,1,file+' has exactly one clock');
 assert.match(html,/desk-player-table/);assert.match(html,/My Queue/);assert.match(html,/My Team/);assert.doesNotMatch(html,/>Drafted Example</);
 if(file==='main.js'){
  assert.match(html,/data-action="bid"/);assert.doesNotMatch(html,/data-queue="/);
  h.state.session.commishPin='test';h.render();assert.match(h.app.innerHTML,/data-queue="p2"/);
  h.state.room.status='paused';h.render();assert.match(h.app.innerHTML,/data-action="bid" disabled/);
  h.state.tab='log';h.render();assert.match(h.app.innerHTML,/id="timer"/);assert.match(h.app.innerHTML,/data-action="export"/);
 }else{
  assert.match(html,/data-select-player="p1"/);
  h.state.session.teamId='t2';h.render();assert.doesNotMatch(h.app.innerHTML,/data-select-player=/);
  h.state.session.teamId='t0';h.state.settings.status='paused';h.render();assert.doesNotMatch(h.app.innerHTML,/data-select-player=/);
  h.state.settings.status='live';
  if(file==='supplemental.js'){
   h.state.session.teamId='t1';Object.assign(h.state.settings,{stage:'challenge',selected_player_id:'p1',selected_by_team_id:'t0'});h.render();assert.match(h.app.innerHTML,/data-action="challenge-rights"/);assert.match(h.app.innerHTML,/data-action="challenge-open"/);
   Object.assign(h.state.settings,{stage:'rights_auction',active_bid:2,active_bidder_team_id:'t0'});h.render();assert.match(h.app.innerHTML,/H2H BID/);
   h.state.session.teamId='t2';h.render();assert.match(h.app.innerHTML,/Open to All/);
  }else{
   h.state.rosterState[0].roster_count=18;h.render();assert.doesNotMatch(h.app.innerHTML,/data-select-player=/);assert.match(h.app.innerHTML,/Your roster is full/);
  }
 }
 h.state.settings.status='complete';h.state.room.status='complete';h.state.tab=file==='main.js'?'action':'draft';h.render();assert.match(h.app.innerHTML,/Complete/);assert.match(h.app.innerHTML,/desk-player-table/);
 console.log(file+': rendered layout, clock, permissions and phase controls passed.');
}
// Exercise the shared UI through its event callbacks without a browser.
const desk=createDraftRoom('test','TEST');let config={players:structuredClone(players),teams,myTeam:teams[0],roster:[],rosterLimit:18,timerId:'timer',clockLabel:'Pick',clockDetail:'1',turnNote:'Your turn',stageHtml:'',orderHtml:'',orderTitle:'Order',tabs:[{key:'players',label:'Players',active:true}],playerAction:()=>'',sourceNote:''};
let html=desk.view(config),rerenders=0,handlers={};
function bind(selector,dataset={}){const el={dataset,addEventListener:(name,fn)=>{handlers[name]=fn}};desk.bind({querySelectorAll:s=>s===selector?[el]:[],querySelector:s=>s===selector?el:null},()=>{rerenders++;html=desk.view(config)});}
bind('[data-desk-search]');handlers.input({target:{value:'Dar'}});assert.match(html,/>Sam Darnold</);assert.doesNotMatch(html,/>Runner Example</);
bind('[data-desk-search]');handlers.input({target:{value:''}});
bind('[data-desk-star]',{deskStar:'p1'});handlers.click();assert.match(html,/Sam Darnold[\s\S]*Move Sam Darnold up/);
bind('[data-desk-star]',{deskStar:'p2'});handlers.click();bind('[data-desk-move]',{deskMove:'p2',direction:'-1'});handlers.click();assert.deepEqual(JSON.parse(saved.get('glsk-draft-shortlist-TEST-test-t0')).queue,['p2','p1']);
config={...config,myTeam:teams[1]};html=desk.view(config);assert.match(html,/Star a player in the table/);
config={...config,myTeam:teams[0]};html=desk.view(config);assert.match(html,/Move Runner Example up/);
config.players[1].status='drafted';html=desk.view(config);assert.doesNotMatch(html,/Move Runner Example up/);
bind('[data-desk-drafted]');handlers.change({target:{checked:true}});assert.match(html,/>Drafted Example</);
console.log('Shared search, personal queue, ordering, owner isolation and drafted filtering passed.');
