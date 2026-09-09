import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/player-profile-core.js',import.meta.url),'utf8');
const {actionFor,dropFine,validateMove,profilePlayers}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const player={player_key:'sam',player_name:'Sam Darnold'};
const data={session:{teamId:'mine',pin:'test'},season:{season_year:2026,roster_limit:1},roster:[{player_key:'caleb',player_name:'Caleb Williams',team_id:'mine',active:true}],contracts:[{player_key:'caleb',team_id:'mine',status:'active',start_year:2026,cap_cost:5,length_years:3}],waiverCenter:{settings:{enabled:true},players:[{...player,availability:'free_agent'}]}};
assert.equal(actionFor(data,player).type,'add');
assert.throws(()=>validateMove(data,player,'add',null,0),/full/);
assert.throws(()=>validateMove(data,player,'add','other',0),/own roster/);
assert.doesNotThrow(()=>validateMove(data,player,'add','caleb',0));
assert.equal(actionFor(data,{player_key:'caleb'}).type,'drop');
assert.equal(dropFine(data,'caleb'),10);
data.contracts[0].start_year=2025;assert.equal(dropFine(data,'caleb'),10);
data.session.teamId='other';assert.equal(actionFor(data,{player_key:'caleb'}).type,null);
data.session.teamId='mine';data.session.spectator=true;assert.equal(actionFor(data,player).type,null);assert.equal(actionFor(data,{player_key:'caleb'}).type,null);
data.session.spectator=false;data.waiverCenter.players[0].availability='waivers';assert.equal(actionFor(data,player).type,null);
data.waiverCenter.players[0].claim_open=true;assert.equal(actionFor(data,player).type,'claim');
assert.throws(()=>validateMove(data,player,'claim','caleb',1.5),/whole-number/);
assert.doesNotThrow(()=>validateMove(data,player,'claim','caleb',0));
data.waiverCenter.players[0].awaiting_processing=true;assert.equal(actionFor(data,player).type,null);
data.waiverCenter.settings.enabled=false;assert.equal(actionFor(data,player).type,null);
assert.equal(actionFor(data,{player_key:'unknown'}).type,null);
assert(profilePlayers(data).some(p=>p.player_name==='Sam Darnold'));
console.log('PASS: ownership, spectator, full roster, drop identity, fines, waiver windows, bids, paused adds and unknown players.');

// Regression: account-authenticated owners may have no legacy PIN.
for (const pin of [null, undefined, '']) {
 const accountData={...data,session:{teamId:'mine',pin},waiverCenter:{settings:{enabled:true},players:[{...player,availability:'free_agent'}]}};
 assert.equal(actionFor(accountData,{player_key:'caleb'}).type,'drop');
 assert.doesNotThrow(()=>validateMove(accountData,{player_key:'caleb'},'drop',null,0));
 assert.equal(actionFor(accountData,player).type,'add');
 assert.doesNotThrow(()=>validateMove(accountData,player,'add','caleb',0));
 accountData.waiverCenter.players[0]={...player,availability:'waivers',claim_open:true};
 assert.equal(actionFor(accountData,player).type,'claim');
 accountData.session.teamId='other';assert.equal(actionFor(accountData,{player_key:'caleb'}).type,null);
 accountData.session.teamId='mine';accountData.session.spectator=true;
 assert.equal(actionFor(accountData,{player_key:'caleb'}).type,null);
 assert.throws(()=>validateMove(accountData,{player_key:'caleb'},'drop',null,0),/no longer available/);
 accountData.session=null;assert.equal(actionFor(accountData,{player_key:'caleb'}).type,null);
}
console.log('PASS: owner Drop/Add/Claim without legacy PIN; other teams, spectators and signed-out sessions remain read-only.');
