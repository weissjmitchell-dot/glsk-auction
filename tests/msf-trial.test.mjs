import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {scorePlayer} from '../server/msf-scoring.js';
import {validateRequest,providerURL,summarize,checkFeed} from '../server/msf.js';
import handler from '../api/msf-connection.js';

// Derive the fixtures from the actual shipped league rules, not a second rule list.
const sql=fs.readFileSync(new URL('../supabase/weekly-host-settings-v61.sql',import.meta.url),'utf8');
const rules=[...sql.matchAll(/\('(Offense|Kickers|Defense\/Special Teams)','([^']+)','[^']*',(-?[\d.]+),(null|[\d.]+),/g)]
  .map(m=>({category:m[1],rule_key:m[2],points:Number(m[3]),rate_value:m[4]==='null'?null:Number(m[4])}));
function zero(category) {
  const stats=Object.fromEntries(rules.filter(r=>r.category===category && !/_bonus$/.test(r.rule_key) && !r.rule_key.startsWith('dst_pa_')).map(r=>[r.rule_key,0]));
  if (category==='Defense/Special Teams') stats.dst_points_allowed=0;
  return stats;
}
test('league-specific QB scoring and both explicit yardage bonus modes',()=>{
  assert.equal(rules.length,45);
  const stats={...zero('Offense'),pass_yds:420,pass_td:3,interceptions:1,rush_yds:20};
  assert.equal(scorePlayer(stats,rules,'QB',{bonusMode:'cumulative'}).points,32);
  assert.equal(scorePlayer(stats,rules,'QB',{bonusMode:'highest'}).points,31);
  assert.equal(scorePlayer(stats,rules,'QB').points,null);
});
test('half PPR, returns, bonuses and negative scores',()=>{
  const stats={...zero('Offense'),receptions:8,rec_yds:110,rec_td:1,return_yds:40,fumbles_lost:1};
  assert.equal(scorePlayer(stats,rules,'WR',{bonusMode:'cumulative'}).points,22);
  assert.equal(scorePlayer({...zero('Offense'),fumbles_lost:2},rules,'RB',{bonusMode:'highest'}).points,-4);
});
test('missing, null and nonfinite values cannot become zero',()=>{
  const stats=zero('Kickers');delete stats.fg_miss_20_29;
  const result=scorePlayer(stats,rules,'K');assert.equal(result.complete,false);assert.equal(result.points,null);
  assert(result.missing.includes('fg_miss_20_29'));
  assert.equal(scorePlayer({...zero('Kickers'),pat_made:null},rules,'K').points,null);
  assert.equal(scorePlayer({...zero('Kickers'),pat_made:NaN},rules,'K').points,null);
});
test('kicker distance bins and defensive points-allowed boundaries',()=>{
  assert.equal(scorePlayer({...zero('Kickers'),fg_0_19:1,fg_50_plus:2,fg_miss_30_39:1,pat_made:3},rules,'K').points,14);
  for (const [allowed,points] of [[0,10],[1,7],[6,7],[7,4],[13,4],[14,1],[20,1],[21,0],[27,0],[28,-1],[34,-1],[35,-4]]) {
    assert.equal(scorePlayer({...zero('Defense/Special Teams'),dst_points_allowed:allowed},rules,'DEF').points,points);
  }
  assert.equal(scorePlayer({...zero('Defense/Special Teams'),dst_sack:3,dst_int:1,dst_tfl:4,dst_points_allowed:14},rules,'DEF').points,11);
});
test('fixed NFL endpoints reject arbitrary paths and seasons',()=>{
  assert.equal(providerURL({feed:'players',year:2026,week:1}),'https://api.mysportsfeeds.com/v2.1/pull/nfl/2026-regular/week/1/player_gamelogs.json');
  for (const body of [{action:'import'},{action:'test',feed:'../secret',year:2026,week:1},{action:'test',feed:'players',year:'2026',week:1}]) assert.throws(()=>validateRequest(body));
});
test('schema report discards actual records and rejects unexpected shapes',()=>{
  const result=summarize({gamelogs:[{player:{id:123,firstName:'PRIVATE PLAYER'},stats:{passing:{passYards:321}}}]},'players');
  assert.equal(result.records,1);assert.equal(result.scoringVerified,false);
  assert(result.fields.some(f=>f.path==='stats.passing.passYards'));
  assert(!JSON.stringify(result).includes('PRIVATE PLAYER'));assert(!JSON.stringify(result).includes('321'));
  assert.throws(()=>summarize({unexpected:[]},'players'));
  assert.equal(summarize({gamelogs:[]},'players').records,0);
});
test('provider HTTP failures are distinct and never relay provider error bodies',async()=>{
  const previous=process.env.MSF_API_KEY;process.env.MSF_API_KEY='unit-test-key';
  try {
    for (const [status,message] of [[204,/not available yet/],[401,/rejected/],[403,/does not have access/],[429,/rate limit/],[500,/temporarily/]]) {
      await assert.rejects(()=>checkFeed({feed:'players',year:2026,week:1},async()=>new Response(status===204?null:'SECRET ERROR',{status})),message);
    }
    await assert.rejects(()=>checkFeed({feed:'players',year:2026,week:1},async()=>new Response('not json')),/unreadable/);
    const report=await checkFeed({feed:'players',year:2026,week:1},async(url,options)=>{
      assert.equal(options.redirect,'error');assert(options.headers.Authorization.startsWith('Basic '));
      return Response.json({gamelogs:[]});
    });assert.equal(report.records,0);
  } finally { if (previous===undefined) delete process.env.MSF_API_KEY;else process.env.MSF_API_KEY=previous; }
});
async function invoke(req) {
  const res={headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;}};
  await handler(req,res);return res;
}
test('endpoint blocks anonymous, cross-origin, invalid and noncommissioner requests before provider fetch',async()=>{
  const original=global.fetch;let requests=0;
  global.fetch=async()=>{requests++;return Response.json({message:'MSF_FORBIDDEN'},{status:403});};
  try {
    assert.equal((await invoke({method:'GET',headers:{}})).statusCode,405);
    assert.equal((await invoke({method:'POST',headers:{origin:'https://evil.test'}})).statusCode,403);
    assert.equal((await invoke({method:'POST',headers:{origin:'https://glsk-auction.vercel.app'}})).statusCode,401);
    assert.equal(requests,0);
    const request={method:'POST',headers:{origin:'https://glsk-auction.vercel.app',authorization:'Bearer test'},body:{action:'status'}};
    assert.equal((await invoke(request)).statusCode,403);assert.equal(requests,1);
    global.fetch=async()=>Response.json({room_id:'room',user_id:'user',is_commissioner:false});
    assert.equal((await invoke(request)).statusCode,403);
  } finally {global.fetch=original;}
});
test('authorized requests claim a persistent cooldown before fetching; status never fetches provider',async()=>{
  const original=global.fetch,previous=process.env.MSF_API_KEY;process.env.MSF_API_KEY='unit-test-key';
  const calls=[];
  global.fetch=async(url,options)=>{
    calls.push(url);
    if (url.includes('/rpc/')) return Response.json({room_id:'room',user_id:'user',is_commissioner:true});
    return Response.json({games:[]});
  };
  const req={method:'POST',headers:{origin:'https://glsk-auction.vercel.app',authorization:'Bearer test'},body:{action:'status'}};
  try {
    const status=await invoke(req);assert.equal(status.body.configured,true);assert.equal(calls.length,1);
    calls.length=0;req.body={action:'test',feed:'games',year:2026,week:1};
    const result=await invoke(req);assert.equal(result.statusCode,200);assert.equal(calls.length,3);assert(calls[2].startsWith('https://api.mysportsfeeds.com/'));
    let n=0;global.fetch=async()=>++n===1?Response.json({room_id:'room',user_id:'user',is_commissioner:true}):Response.json({message:'MSF_COOLDOWN'},{status:400});
    assert.equal((await invoke(req)).statusCode,429);assert.equal(n,2);
  } finally { global.fetch=original;if(previous===undefined)delete process.env.MSF_API_KEY;else process.env.MSF_API_KEY=previous; }
});
