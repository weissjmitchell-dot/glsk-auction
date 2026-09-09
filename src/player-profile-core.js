export const normalizeName = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.'’]/g, '').trim();
export function profilePlayers(data) {
  const map = new Map();
  for (const p of [...(data.catalog || []), ...(data.playerStats || []), ...(data.playerProjections || []), ...(data.waiverCenter?.players || []), ...(data.roster || []).filter(r => r.active !== false)]) {
    const name = p.player_name || p.name;
    if (!name) continue;
    const id = p.player_key || `name:${normalizeName(name)}`;
    map.set(id, {...map.get(id), ...p, player_name: name});
  }
  return [...map.values()];
}
export function actionFor(data, player) {
  const me = data.session?.spectator ? null : data.session?.teamId;
  const owner = (data.roster || []).find(r => player.player_key && r.active !== false && r.player_key === player.player_key);
  if (owner) return {owner, type: me && data.session?.pin && String(owner.team_id) === String(me) ? 'drop' : null};
  if (!me || !data.session?.pin || !player.player_key || data.waiverCenter?.settings?.enabled === false) return {type: null};
  const available = data.waiverCenter?.players?.find(p => p.player_key === player.player_key);
  if (available?.availability === 'free_agent') return {type: 'add'};
  if (available?.availability === 'waivers' && available.claim_open && !available.awaiting_processing) return {type: 'claim'};
  return {type: null};
}
export function dropFine(data, key) {
  const c = data.contracts?.find(c => c.player_key === key && String(c.team_id) === String(data.session?.teamId) && c.status === 'active');
  if (!c) return 0;
  const year = Math.max(1, Math.min(Number(c.length_years || 1), Number(data.season?.season_year || c.start_year) - Number(c.start_year) + 1));
  return year === 1 ? Number(c.cap_cost || 0) * 2 : ({2:5, 3:10, 4:20}[Number(c.length_years)] || 0);
}
export function validateMove(data, player, type, drop, bid) {
  if (actionFor(data, player).type !== type) throw new Error('This action is no longer available. Close and reopen the profile.');
  const own = (data.roster || []).filter(r => r.active !== false && String(r.team_id) === String(data.session?.teamId));
  if (drop && !own.some(r => r.player_key === drop)) throw new Error('Select a player from your own roster to drop.');
  if (type !== 'drop' && own.filter(r => String(r.roster_slot || 'ACTIVE').toUpperCase() !== 'IR').length >= Number(data.season?.roster_limit || 18) && !drop) throw new Error('Your roster is full. Select a player to drop.');
  if (type === 'claim' && (!Number.isInteger(bid) || bid < 0)) throw new Error('Enter a whole-number bid of zero or more.');
}
