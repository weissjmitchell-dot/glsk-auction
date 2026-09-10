import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {parseRankingsCSV,matchRankings,createDraftTools} from '../src/draft-tools.js';
import {createDraftRoom} from '../src/draft-room.js';
const players=[
 {id:'a',name:'Sam Darnold',position:'QB',nfl_team:'SEA',rank:1},
 {id:'b',name:"D'Andre Swift",position:'RB',nfl_team:'CHI',rank:2},
 {id:'c',name:'Brian Thomas Jr.',position:'WR',nfl_team:'JAX',rank:3},
 {id:'d',name:'Detroit Lions',position:'DEF',nfl_team:'DET',rank:4},
 {id:'e',name:'Same Name',position:'WR',nfl_team:'AAA',rank:5},
 {id:'f',name:'Same Name',position:'RB',nfl_team:'BBB',rank:6},
];
const csv='\uFEFFPlayer Name,Overall Rank,Team,Pos\r\nBrian Thomas,9,JAX,WR\r\nD’Andre Swift,2,CHI,RB\r\nSam Darnold,4,SEA,QB\r\nUnknown Player,8,FA,WR\r\n';
const parsed=parseRankingsCSV(csv),result=matchRankings(parsed,players);
assert.deepEqual(result.ids,['b','a','c']);assert.equal(result.unmatched,1);
assert.deepEqual(parseRankingsCSV('name\nSam Darnold\nBrian Thomas').map(r=>r.rank),[1,2]);
assert.deepEqual(parseRankingsCSV('Sam Darnold\nBrian Thomas').map(r=>r.name),['Sam Darnold','Brian Thomas']);
assert.equal(parseRankingsCSV('rank,player\n1,"Brian Thomas, Jr."')[0].name,'Brian Thomas, Jr.');
assert.equal(parseRankingsCSV('rank,player\n1,"Name ""Nickname"" Smith"')[0].name,'Name "Nickname" Smith');
for(const invalid of ['rank,name\n1,Sam Darnold\n1,Brian Thomas','rank,name\n-1,Sam Darnold','rank,name\n1.5,Sam Darnold','rank,name\n,Sam Darnold','rank,name\n1,"Unclosed','rank,name\n1,"Bad"name','rank,name\n1,','adp,athlete\n1,Sam Darnold'])assert.throws(()=>parseRankingsCSV(invalid));
assert.throws(()=>parseRankingsCSV('name\n'+'Sam Darnold\n'.repeat(3001)),/3,000/);
assert.equal(matchRankings(parseRankingsCSV('name\nSame Name'),players).ambiguous,1);
assert.deepEqual(matchRankings(parseRankingsCSV('name,team,position\nSame Name,BBB,RB'),players).ids,['f']);
assert.equal(matchRankings(parseRankingsCSV('name\nBrian Thomas\nBrian Thomas Jr.'),players).duplicates,1);
// No approximate matching of unrelated names.
assert.equal(matchRankings(parseRankingsCSV('name\nSam Donald'),players).matched,0);
const file=(text,name='rankings.csv')=>({name,size:text.length,text:async()=>text});
const win=new Window();globalThis.document=win.document;globalThis.localStorage=win.localStorage;
const app=document.createElement('div');document.body.appendChild(app);
for(const phase of ['auction','supplemental','snake']){
 let saves=0,failSave=false;
 const t=createDraftTools({rpc:async(name,args)=>{
  assert.equal(name,'league_save_draft_rankings');assert.equal(args.p_phase,phase);saves++;
  if(failSave)return {error:{message:'Rankings changed in another tab'}};
  return {data:{revision:2}};
 }},phase,'TEST');
 Object.assign(t.state,{context:{user_id:'owner',season_id:'season',season_year:2026},saved:['c','b','d','a','e','f'],order:['c','b','d','a','e','f'],revision:1});
 const before=[...t.state.saved];const desk=createDraftRoom(phase,'TEST');
 const config={tools:t,players,teams:[],myTeam:{id:'team'},roster:[],rosterLimit:18,timerId:'timer',clockLabel:'Pick',clockDetail:'1',turnNote:'Your turn',stageHtml:'',orderTitle:'Order',orderHtml:'',tabs:[{key:'players',label:'Players',active:true}],playerAction:()=>'',sourceNote:''};
 const render=()=>{app.innerHTML=desk.view(config);desk.bind(app,render);};render();
 assert(app.querySelector('[data-rank-upload]'));
 app.querySelector('[data-rank-upload]').click();assert(app.querySelector('[data-rank-file]'));
 await t.previewRankingFile(file('rank,name\n10,Sam Darnold\n3,D’Andre Swift\n20,Unknown Player'),players);render();
 assert.equal(saves,0);assert.deepEqual(t.state.saved,before);assert.deepEqual(t.state.order,before);
 assert.match(app.textContent,/Unmatched rows will be skipped/);assert.match(app.textContent,/Unknown Player/);
 app.querySelector('[data-rank-use]').click();assert.deepEqual(t.state.order,['b','a','c','d','e','f']);assert.deepEqual(t.state.saved,before);assert.equal(saves,0);
 app.querySelector('[data-rank-cancel]').click();assert.deepEqual(t.state.order,before);
 await t.previewRankingFile(file('name\nSam Darnold\nBrian Thomas'),players);assert(t.useRankingPreview(players));render();
 app.querySelector('[data-rank-save]').click();for(let i=0;i<6;i++)await Promise.resolve();
 assert.equal(saves,1);assert.deepEqual(t.state.saved,['a','c','b','d','e','f']);assert.equal(t.state.editing,false);
 await t.previewRankingFile(file('name\nBrian Thomas\nBrian Thomas Jr.'),players);render();assert(app.querySelector('[data-rank-use]').disabled);assert.equal(t.useRankingPreview(players),false);await t.save();assert.equal(saves,1);t.closeRankingUpload();
 await t.previewRankingFile(file('name\nUnknown Player'),players);assert.equal(t.useRankingPreview(players),false);t.closeRankingUpload();
 // Names and filenames render as text, not HTML.
 await t.previewRankingFile(file('name\n<img src=x onerror=alert(1)>','<script>alert(1)</script>.csv'),players);render();assert.equal(app.querySelector('img'),null);assert.equal(app.querySelector('script'),null);t.closeRankingUpload();
 // A pool edit must be reviewed again, and stale database writes remain blocked.
 await t.previewRankingFile(file('name\nSam Darnold'),players);assert.equal(t.useRankingPreview(players.filter(p=>p.id!=='a')),false);assert.match(t.state.rankingError,/pool changed/);t.closeRankingUpload();
 await t.previewRankingFile(file('name\nD’Andre Swift'),players);assert(t.useRankingPreview(players));failSave=true;await t.save();assert.equal(t.state.editing,true);assert.match(t.state.notice,/another tab/);
 // Cancel during a slow file read, or change season, without applying old input.
 let finish;const loading=t.previewRankingFile({name:'slow.csv',size:10,text:()=>new Promise(r=>finish=r)},players);t.closeRankingUpload();finish('name\nSam Darnold');await loading;assert.equal(t.state.rankingPreview,null);assert.equal(t.state.rankingUploadOpen,false);
 await t.previewRankingFile(file('name\nSam Darnold'),players);t.state.context.season_id='next-season';assert.equal(t.useRankingPreview(players),false);assert.match(t.state.rankingError,/season changed/);
 console.log(phase+': preview, explicit save, cancel, private RPC, matching and error checks passed.');
}
await win.happyDOM.close();
console.log('CSV rank sorting, quoted fields, names-only lists, suffix matching, ambiguity, duplicates, malformed files and escaped previews passed.');
