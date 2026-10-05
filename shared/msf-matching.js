const nameKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const baseName=s=>nameKey(String(s||'').replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i,''));
const pos=s=>['DEF','DST','D/ST'].includes(String(s).toUpperCase())?'DST':String(s).toUpperCase();
const team=s=>({JAC:'JAX',WSH:'WAS',LA:'LAR'})[String(s).toUpperCase()]||String(s||'').toUpperCase();
export function matchPlayer(row,candidates) {
  const eligible=candidates.filter(p=>p.player_key&&pos(p.position)===pos(row.position)&&team(p.nfl_team)===team(row.team));
  const hits=eligible.filter(p=>pos(row.position)==='DST'||nameKey(p.player_name)===nameKey(row.name));
  const keys=[...new Set(hits.map(p=>p.player_key))];
  const rosterKeys=[...new Set(hits.filter(p=>p.matchSource==='active-roster').map(p=>p.player_key))];
  if(keys.length>1&&rosterKeys.length===1)return {status:'Roster match — review aliases',playerKey:rosterKeys[0],candidates:keys,reason:'One active roster ID takes priority over directory aliases; no IDs were merged.'};
  if(!keys.length){
    const alternatives=[...new Set(eligible.filter(p=>baseName(p.player_name)===baseName(row.name)).map(p=>p.player_key))];
    return {status:alternatives.length?'Name variation — review':'Unmatched',playerKey:null,candidates:alternatives,reason:alternatives.length?'Suffix differs; select the correct GLSK entry after review.':'No matching entry in the loaded directory or active roster.'};
  }
  return {status:keys.length===1?'Suggested match':'Ambiguous',playerKey:keys.length===1?keys[0]:null,candidates:keys};
}
