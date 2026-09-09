const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/league.js'),'utf8').replace(/^import .*;\n/gm,'').replace(/\ninit\(\);\s*$/,'');
const element={appendChild(){},addEventListener(){},querySelectorAll(){return []},querySelector(){return null},remove(){}};
const context=vm.createContext({document:{createElement:()=>({...element}),getElementById:()=>null,querySelector:()=>element,addEventListener(){},head:element},window:{addEventListener(){}},localStorage:{getItem:()=>null},location:{search:'',href:'https://example.test/league'},URL,URLSearchParams,ROOM_CODE:'test',LEAGUE_NAME:'GLSK',console,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,configured:true});
vm.runInContext(source,context);
function run(s){return vm.runInContext(s,context)}
run(`state.loading=false;state.session={teamId:'mine',commishPin:'commissioner'};state.season={season_year:2026,roster_limit:18,salary_cap_points:100};state.teams=[{id:'mine',name:'My Team',remaining_budget:10}];state.roster=[{player_key:'caleb',player_name:'Caleb Williams',position:'QB',nfl_team:'CHI',team_id:'mine',active:true}];state.contractOptions=[{years:2,cap_cost:15}];state.contracts=[{id:1,player_key:'caleb',player_name:'Caleb Williams',team_id:'mine',status:'active',length_years:2,start_year:2026,end_year:2027,cap_cost:15}];state.deadlines=[{id:1,title:'Contract Due',status:'open',due_at:'2026-09-10T00:00:00Z',deadline_type:'contracts'}];state.rules=[{category:'Roster',rule_key:'roster_limit',label:'Roster',numeric_value:18}];state.waiverCenter={players:[],claims:[],priority:[],settings:{},runs:[]};`);
assert.match(run('bottomNav()'),/>Commissioner<|Commissioner<\/button>/);
assert.doesNotMatch(run('leagueHubView()'),/Open Reconcile/);
assert.match(run('leagueHubView()'),/data-tab="rules"/);
for(const [view,tab,control] of [['teamsView','teams','data-action="commish-add-player"'],['contractsView','contracts','data-action="save-contract"'],['deadlinesView','deadlines','data-action="create-deadline"'],['rulesView','rules','data-action="save-rules"'],['financesView','finances','data-action="add-finance"'],['transactionsView','transactions','data-action="save-correction"'],['freeAgencyView','freeagents','data-action="fa-save-settings"']]){
 run(`state.tab='${tab}'`);assert(!run(`${view}()`).includes(control),`${tab} must hide commissioner tools`);
 run(`state.tab='settingshub';state.commissionerSection='${tab}'`);assert(run('settingsHubView()').includes(control),`${tab} tools must be reachable in Commissioner`);
}
run("state.tab='teams'");assert.match(run('teamsView()'),/data-drop-player="caleb"/);assert.doesNotMatch(run('teamsView()'),/data-exception-drop/);
run("state.tab='settingshub';state.commissionerSection='teams'");assert.match(run('settingsHubView()'),/data-exception-drop/);
// Every commissioner section can render with the existing shared state.
for(const section of run('commissionerSections.map(([key])=>key)')) {
 run(`state.tab='settingshub';state.commissionerSection='${section}'`);
 assert.match(run('settingsHubView()'),/All Commissioner Tools/);
}
run(`state.boardThreads=[{id:1,title:'Test Thread',status:'active',season_year:2026,source:'glsk',created_at:'2026-09-09T12:00:00Z'}];state.boardSelectedThread=1;state.boardPosts=[{id:2,thread_id:1,status:'active',body:'Test message',created_at:'2026-09-09T12:00:00Z'}];state.tab='board'`);
assert.doesNotMatch(run('boardView()'),/data-board-delete-post/);
run("state.tab='settingshub';state.commissionerSection='board'");
assert.match(run('settingsHubView()'),/data-board-delete-post/);
run("state.session={teamId:'mine'};state.tab='settingshub'");assert.doesNotMatch(run('bottomNav()'),/data-tab="settingshub"/);assert.match(run('settingsHubView()'),/access is required/);assert.equal(run('commissionerToolsActive()'),false);
console.log('PASS: commissioner-only navigation; tools moved from seven normal views; owner Drop retained; admin Retire/Ban moved; direct owner access blocked.');
