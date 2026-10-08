// Explicit, provisional provider mapping. Missing values stay missing.
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
const get=(s,path)=>path.split('.').reduce((v,k)=>v?.[k],s);
export function normalizeLog(log,feed) {
  const s=log.stats||{}, stats={}, sources={};
  const put=(key,path)=>{const v=get(s,path);if(typeof v==='number'&&Number.isFinite(v))stats[key]=v;sources[key]=path;};
  const sum=(key,paths)=>{const v=paths.map(p=>get(s,p));if(v.every(x=>typeof x==='number'&&Number.isFinite(x)))stats[key]=v.reduce((a,b)=>a+b,0);sources[key]=paths.join(' + ');};
  const diff=(key,a,b)=>{const x=get(s,a),y=get(s,b);if(finite(x)&&finite(y)&&x>=y)stats[key]=x-y;sources[key]=a+' - '+b;};
  const review=[], providerEvidence={}, comparisonAssumptions=[];
  let comparisonStats=null;
  if(feed==='teams') {
    for(const path of ['standings.pointsAgainst','interceptions.intTD','interceptions.kB','fumbles.fumTD','fumbles.offFumTD','kickoffReturns.krTD','puntReturns.prTD','extraPointAttempt.xpBlk','fieldGoals.fgBlk','punting.puntBlk','twoPointAttempts.twoPtMade']) {
      const v=get(s,path);providerEvidence[path]=typeof v==='number'&&Number.isFinite(v)?v:null;
    }
  }
  if(feed==='players') {
    const mapping={pass_yds:'passing.passYards',pass_td:'passing.passTD',interceptions:'passing.passInt',rush_yds:'rushing.rushYards',rush_td:'rushing.rushTD',receptions:'receiving.receptions',rec_yds:'receiving.recYards',rec_td:'receiving.recTD',fumbles_lost:'fumbles.fumLost',off_fumble_return_td:'fumbles.offFumTD',pat_made:'extraPointAttempts.xpMade'};
    for(const [k,p] of Object.entries(mapping))put(k,p);
    sum('return_yds',['kickoffReturns.krYds','puntReturns.prYds']);
    sum('return_td',['kickoffReturns.krTD','puntReturns.prTD']);
    sum('two_point',['twoPointAttempts.twoPtPassMade','twoPointAttempts.twoPtPassRec','twoPointAttempts.twoPtRushMade']);
    for(const [k,p] of [['0_19','1_19'],['20_29','20_29'],['30_39','30_39'],['40_49','40_49'],['50_plus','50Plus']]) {
      put('fg_'+k,'fieldGoals.fgMade'+p);
      diff('fg_miss_'+k,'fieldGoals.fgAtt'+p,'fieldGoals.fgMade'+p);
    }
    diff('pat_missed','extraPointAttempts.xpAtt','extraPointAttempts.xpMade');
  } else {
    for(const [k,p] of Object.entries({dst_sack:'tackles.sacks',dst_int:'interceptions.interceptions',dst_fumble_recovery:'fumbles.fumOppRec',dst_safety:'interceptions.safeties',dst_tfl:'tackles.tacklesForLoss'}))put(k,p);
    // Do not equate all points against with fantasy D/ST points allowed, or
    // infer rare return/blocked-kick touchdowns from incomplete aggregates.
    review.push('D/ST comparison totals are provisional, not verified or importable.');
    comparisonStats={...stats};
    const evidence=(key,path)=>{const v=get(s,path);if(finite(v))comparisonStats[key]=v;};
    evidence('dst_points_allowed','standings.pointsAgainst');
    evidence('dst_block_kick','interceptions.kB');
    const tdPaths=['interceptions.intTD','fumbles.fumTD','kickoffReturns.krTD','puntReturns.prTD'];
    const touchdowns=tdPaths.map(path=>get(s,path));
    if(touchdowns.every(finite))comparisonStats.dst_td=touchdowns.reduce((a,b)=>a+b,0);
    comparisonStats.dst_extra_point_return=0;
    comparisonAssumptions.push(
      'Points allowed uses total standings.pointsAgainst without fantasy exclusions.',
      'Blocked kicks uses interceptions.kB only; own kicking/punting blocked fields are not added.',
      'Touchdowns sums intTD + fumTD + krTD + prTD; fumble classification and rare return coverage are unverified.',
      'Defensive extra-point returns assumed ZERO for comparison only because no verified source field is mapped.'
    );
  }
  return {providerId:feed==='players'?log.player?.id:log.team?.id,gameId:log.game?.id,week:log.game?.week,
    name:feed==='players'?[log.player?.firstName,log.player?.lastName].filter(Boolean).join(' '):String(log.team?.abbreviation||'')+' D/ST',
    position:feed==='players'?String(log.player?.position||''):'DST',team:String(log.team?.abbreviation||''),stats,sources,review,providerEvidence,comparisonStats,comparisonAssumptions};
}
export function previewFeed(data,input) {
  if(!Array.isArray(data?.gamelogs))throw new Error('Unrecognized game-log response.');
  const eligible=data.gamelogs.filter(r=>input.feed==='teams'||['QB','RB','FB','WR','TE','K'].includes(r.player?.position));
  return {feed:input.feed,year:input.year,week:input.week,checkedAt:new Date().toISOString(),providerRecords:data.gamelogs.length,
    rows:eligible.map(r=>normalizeLog(r,input.feed)),importsEnabled:false,scoringVerified:false};
}
