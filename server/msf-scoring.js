// Provider-independent scorer. Inputs must be normalized and explicitly present.
// Missing fields never silently become zero. This module does not write scores.
export function scorePlayer(stats, rules, position, {bonusMode} = {}) {
  if (!stats || !Array.isArray(rules)) throw new Error('Invalid scoring input.');
  const category = ['DEF','DST','D/ST'].includes(position) ? 'Defense/Special Teams' : position === 'K' ? 'Kickers' : 'Offense';
  const missing = new Set(), breakdown = [], bonuses = new Map();
  const number = key => {
    const value = stats[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) { missing.add(key); return null; }
    return value;
  };
  for (const rule of rules.filter(r => r.active !== false && r.category === category)) {
    const key = rule.rule_key, points = Number(rule.points);
    if (!key || !Number.isFinite(points)) throw new Error('Invalid scoring rule.');
    let amount = 0;
    const bonus = /^(pass|rush|rec)_(\d+)_bonus$/.exec(key);
    const allowed = /^dst_pa_(\d+)(?:_(\d+|plus))?$/.exec(key);
    if (bonus) {
      if (!['cumulative','highest'].includes(bonusMode)) { missing.add('confirmed_bonus_mode'); continue; }
      const yards = number(bonus[1] + '_yds');
      if (yards === null) continue;
      if (yards >= Number(bonus[2])) {
        if (bonusMode === 'highest') {
          const previous = bonuses.get(bonus[1]);
          if (!previous || Number(bonus[2]) > previous.threshold) bonuses.set(bonus[1], {key, points, threshold:Number(bonus[2])});
          continue;
        }
        amount = points;
      }
    } else if (allowed) {
      const value = number('dst_points_allowed');
      if (value === null) continue;
      const low = Number(allowed[1]), high = allowed[2] === 'plus' ? Infinity : Number(allowed[2] ?? allowed[1]);
      amount = value >= low && value <= high ? points : 0;
    } else {
      const value = number(key);
      if (value === null) continue;
      if (rule.rate_value != null) {
        const divisor = Number(rule.rate_value);
        if (!Number.isFinite(divisor) || divisor <= 0) throw new Error('Invalid scoring divisor.');
        amount = value / divisor * points;
      } else amount = value * points;
    }
    breakdown.push({key, points:amount});
  }
  for (const {key,points} of bonuses.values()) breakdown.push({key,points});
  if (!breakdown.length) missing.add('applicable_scoring_rules');
  return {complete:missing.size === 0, points:missing.size ? null : Math.round((breakdown.reduce((n,r)=>n+r.points,0)+Number.EPSILON)*100)/100,
    missing:[...missing], breakdown};
}
