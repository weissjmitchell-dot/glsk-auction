import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeLog,previewFeed} from '../server/msf-preview.js';
import {scorePlayer} from '../server/msf-scoring.js';
import {matchPlayer} from '../shared/msf-matching.js';
import handler from '../api/msf-preview.js';
const sql=fs.readFileSync(new URL('../supabase/weekly-host-settings-v61.sql',import.meta.url),'utf8');
const rules=[...sql.matchAll(/\('(Offense|Kickers|Defense\/Special Teams)','([^']+)','[^']*',(-?[\d.]+),(null|[\d.]+),/g)].map(m=>({category:m[1],rule_key:m[2],points:Number(m[3]),rate_value:m[4]==='null'?null:Number(m[4])}));
const log={player:{id:1,firstName:'Test',lastName:'Player',position:'QB'},team:{id:2,abbreviation:'DET'},game:{id:3,week:4},stats:{passing:{passYards:420,passTD:3,passInt:1},rushing:{rushYards:20,rushTD:0},receiving:{receptions:0,recYards:0,recTD:0},fumbles:{fumLost:0,offFumTD:0},kickoffReturns:{krYds:0,krTD:0},puntReturns:{prYds:0,prTD:0},twoPointAttempts:{twoPtPassMade:0,twoPtPassRec:0,twoPtRushMade:0}}};
test('provider QB fields yield expected GLSK totals in both bonus modes',()=>{
 const r=normalizeLog(log,'players');assert.equal(scorePlayer(r.stats,rules,'QB',{bonusMode:'cumulative'}).points,32);assert.equal(scorePlayer(r.stats,rules,'QB',{bonusMode:'highest'}).points,31);
 const missing=structuredClone(log);delete missing.stats.puntReturns;assert.equal(scorePlayer(normalizeLog(missing,'players').stats,rules,'QB',{bonusMode:'highest'}).points,null);
});
test('kicking bins calculate misses; inconsistent attempts remain unknown',()=>{
 const x={stats:{fieldGoals:{fgMade1_19:1,fgAtt1_19:1,fgMade20_29:0,fgAtt20_29:0,fgMade30_39:0,fgAtt30_39:1,fgMade40_49:0,fgAtt40_49:0,fgMade50Plus:2},extraPointAttempts:{xpMade:3,xpAtt:3}}};
 assert.equal(scorePlayer(normalizeLog(x,'players').stats,rules,'K').points,14);
 x.stats.fieldGoals.fgAtt1_19=0;assert.equal(scorePlayer(normalizeLog(x,'players').stats,rules,'K').points,null);
});
test('D/ST unknowns cannot silently become zero or a complete total',()=>{
 const r=normalizeLog({stats:{tackles:{sacks:3,tacklesForLoss:4},interceptions:{interceptions:1,safeties:0},fumbles:{fumOppRec:0}}},'teams');
 const score=scorePlayer(r.stats,rules,'DST');assert.equal(score.points,null);assert(score.missing.includes('dst_points_allowed'));assert(score.missing.includes('dst_extra_point_return'));
});
test('matching is exact normalized name plus team and position, ambiguity preserved',()=>{
 const r={name:'A.J. Brown',position:'WR',team:'PHI'},p={player_name:'AJ Brown',position:'WR',nfl_team:'PHI',player_key:'a'};
 assert.equal(matchPlayer(r,[p,p]).playerKey,'a');assert.equal(matchPlayer(r,[p,{...p,player_key:'b'}]).status,'Ambiguous');assert.equal(matchPlayer({...r,team:'DET'},[p]).status,'Unmatched');
 assert.equal(matchPlayer({name:'DET D/ST',position:'DST',team:'DET'},[{player_name:'Lions',position:'DEF',nfl_team:'DET',player_key:'d'}]).playerKey,'d');
});
test('preview returns fantasy positions only and no raw provider fields',()=>{
 const result=previewFeed({secret:'do not relay',gamelogs:[log,{...log,player:{position:'LB'}}]}, {feed:'players',year:2026,week:4});assert.equal(result.rows.length,1);assert.equal(result.providerRecords,2);assert.equal(result.importsEnabled,false);assert(!JSON.stringify(result).includes('do not relay'));
});
function response(){return {setHeader(){},status(s){this.code=s;return this;},json(v){this.body=v;return this;}};}
test('preview authenticates and claims cooldown before fetching provider',async()=>{
 const old=global.fetch,key=process.env.MSF_API_KEY;process.env.MSF_API_KEY='test-only';let calls=[];
 try {
 global.fetch=async(url,opts)=>{calls.push([url,opts]);if(url.includes('/rpc/'))return Response.json({room_id:'r',user_id:'u',is_commissioner:true});return Response.json({gamelogs:[log]});};
 let res=response();await handler({method:'POST',headers:{origin:'https://glsk-auction.vercel.app'},body:{action:'test',feed:'players',year:2026,week:4}},res);assert.equal(res.code,401);assert.equal(calls.length,0);
 res=response();await handler({method:'POST',headers:{origin:'https://glsk-auction.vercel.app',authorization:'Bearer fake'},body:{action:'test',feed:'players',year:2026,week:4}},res);assert.equal(res.code,200);assert.equal(calls.length,3);assert.equal(JSON.parse(calls[1][1].body).p_action,'claim');assert.equal(res.body.rows.length,1);assert(!JSON.stringify(res.body).includes('test-only'));
 calls=[];global.fetch=async()=>Response.json({message:'forbidden'},{status:403});res=response();await handler({method:'POST',headers:{origin:'https://glsk-auction.vercel.app',authorization:'Bearer fake'},body:{action:'test',feed:'players',year:2026,week:4}},res);assert.equal(res.code,403);
 }finally{global.fetch=old;if(key===undefined)delete process.env.MSF_API_KEY;else process.env.MSF_API_KEY=key;}
});
test('one active defense roster ID takes priority while aliases stay visible',()=>{
 const row={name:'BAL D/ST',team:'BAL',position:'DST'};
 const roster={player_key:'baltimoreravens',nfl_team:'BAL',position:'DEF',matchSource:'active-roster'};
 const directory={player_key:'dst:bal',nfl_team:'BAL',position:'DST'};
 const result=matchPlayer(row,[directory,roster]);assert.equal(result.playerKey,'baltimoreravens');assert.equal(result.candidates.length,2);
 assert.equal(matchPlayer(row,[roster,{...directory,matchSource:'active-roster'}]).status,'Ambiguous');
});
test('suffix variations require review rather than silent matching',()=>{
 const m=matchPlayer({name:'James Cook',position:'RB',team:'BUF'},[{player_key:'jamescookiii',player_name:'James Cook III',position:'RB',nfl_team:'BUF'}]);assert.equal(m.playerKey,null);assert.equal(m.status,'Name variation — review');assert.deepEqual(m.candidates,['jamescookiii']);
});
test('defense evidence preserves numbers and missing fields without claiming scoring coverage',()=>{
 const r=normalizeLog({stats:{standings:{pointsAgainst:24},interceptions:{intTD:1,kB:0}}},'teams');assert.equal(r.providerEvidence['standings.pointsAgainst'],24);assert.equal(r.providerEvidence['interceptions.intTD'],1);assert.equal(r.providerEvidence['fumbles.fumTD'],null);assert.equal(r.stats.dst_td,undefined);
});
test('user-supplied Burrow and Giants comparison cases reproduce expected totals',()=>{
 const b=structuredClone(log);Object.assign(b.stats.passing,{passYards:428,passTD:1,passInt:2});Object.assign(b.stats.rushing,{rushYards:6,rushTD:1});assert.equal(scorePlayer(normalizeLog(b,'players').stats,rules,'QB',{bonusMode:'cumulative'}).points,24.87);
 // Screenshot reference only: these are not inferred provider mappings.
 const reference={dst_sack:2,dst_int:3,dst_tfl:5,dst_fumble_recovery:0,dst_safety:0,dst_td:1,dst_block_kick:0,dst_points_allowed:24,dst_extra_point_return:0};assert.equal(scorePlayer(reference,rules,'DST').points,22);
});
test('provisional defense comparison is separate, explicit, and still rejects missing TD components',()=>{
 const fixture={stats:{tackles:{sacks:2,tacklesForLoss:5},interceptions:{interceptions:3,safeties:0,intTD:1,kB:0},fumbles:{fumOppRec:0,fumTD:0},kickoffReturns:{krTD:0},puntReturns:{prTD:0},standings:{pointsAgainst:24},fieldGoals:{fgBlk:1}}};
 const row=normalizeLog(fixture,'teams');
 assert.equal(scorePlayer(row.stats,rules,'DST').points,null);
 assert.equal(scorePlayer(row.comparisonStats,rules,'DST').points,22);
 assert.equal(row.comparisonStats.dst_block_kick,0); // Do not score the team's own blocked kick.
 assert(row.comparisonAssumptions.some(s=>s.includes('ZERO')));
 delete fixture.stats.puntReturns;
 assert.equal(scorePlayer(normalizeLog(fixture,'teams').comparisonStats,rules,'DST').points,null);
});
