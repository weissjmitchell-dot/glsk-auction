import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../supabase/glsk-email-default-on-20261118.sql',import.meta.url),'utf8');
const client=readFileSync(new URL('../src/league.js',import.meta.url),'utf8');
const privacy=readFileSync(new URL('../public/privacy.html',import.meta.url),'utf8');

assert.match(migration,/alter column enabled set default true/);
assert.match(migration,/after insert or update of active,room_id,user_id/);
assert.match(migration,/new.active is true/);
assert.match(migration,/from public.league_owner_accounts a/);
assert.equal((migration.match(/on conflict\(room_id,user_id,category\) do nothing/g)||[]).length,2);
for(const category of [
 'trades','roster_moves','drafts','contracts','rookie_rights',
 'message_board','league_chat','deadlines','matchups',
 'injuries','player_availability','other_activity'
]){
 assert.match(migration,new RegExp("'"+category+"'"));
}
assert.match(client,/return pref \? pref.enabled!==false : true/);
assert.match(client,/Email alerts are on by default for registered GLSK owners/);
assert.match(privacy,/Every owner can turn off individual email alert categories/);
console.log('GLSK default-on email preferences source checks passed');
