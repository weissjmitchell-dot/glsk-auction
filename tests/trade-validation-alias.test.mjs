import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const file of ['supabase/trade-rules-v53.sql','supabase/trade-ambiguity-fix-2026-11-18.sql']) {
  const text = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  assert.match(text,/create or replace function public\._league_validate_trade\(p_trade_id uuid\)/);
  assert.doesNotMatch(text,/from public\.league_trade_assets a join public\.league_contracts c/);
  assert.equal((text.match(/^  from public\.league_trade_assets trade_asset join public\.league_contracts c/gm)||[]).length,2);
  assert.equal((text.match(/c\.player_key=trade_asset\.asset_key/g)||[]).length,2);
}
console.log('GLSK trade validator SQL source alias checks passed');
