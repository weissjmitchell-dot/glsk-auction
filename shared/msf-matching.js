const nameKey=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const pos=s=>['DEF','DST','D/ST'].includes(String(s).toUpperCase())?'DST':String(s).toUpperCase();
const team=s=>({JAC:'JAX',WSH:'WAS',LA:'LAR'})[String(s).toUpperCase()]||String(s||'').toUpperCase();
export function matchPlayer(row,candidates) {
  // Conservative suggestions only; never merge fuzzy names or write IDs.
  const hits=candidates.filter(p=>p.player_key&&pos(p.position)===pos(row.position)&&team(p.nfl_team)===team(row.team)&&(pos(row.position)==='DST'||nameKey(p.player_name)===nameKey(row.name)));
  const keys=[...new Set(hits.map(p=>p.player_key))];
  return {status:keys.length===1?'Suggested match':keys.length?'Ambiguous':'Unmatched',playerKey:keys.length===1?keys[0]:null,candidates:keys};
}
