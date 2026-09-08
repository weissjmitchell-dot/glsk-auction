# Great Lake State Keepers Draft Tool — v9

This build keeps the working Phase 1 live auction and adds Phase 2 Supplemental Draft.

## Phase 1 additions
- Commissioner-only rookie-rights transfer after an auction sale.
- Original winner is refunded the exact sale price.
- Rights holder is charged the exact sale price.
- Player and active sale ownership move to the rights holder in one database transaction.

## Phase 2 Supplemental Draft
- Same team PINs and same remaining bid-dollar balances as Phase 1.
- 2-round snake draft.
- Preloaded Round 1 order, automatic Round 2 reverse.
- Commissioner can adjust order and timers.
- Defaults: 45-second pick / 10-second challenge / 30-second challenge auction.
- Unchallenged selection costs $0.
- Normal challenge opens at 6 bids and becomes an open auction.
- Restricted rookie-rights holder can open a two-team auction at 2 bids.
- A third team can convert the rookie-rights auction to open bidding at at least 6 bids.
- If the original selector loses an auction, the Supplemental pick is still used.
- Challenge winner retains their normal snake pick.
- Undo and Reset Supplemental refund only Supplemental bid spending, preserving Phase 1 results.
- All positions included: QB, RB, WR, TE, K, D/ST.
- Yahoo Sports Half-PPR Top 300 ordering with Yahoo Sports-hosted raw projection stats where available.
- Player pool excludes contracted players, all 40 auction players, and the 24 players from the 2026 rookie draft.

## Install
1. **Run `supabase/phase2.sql` in the existing GLSK Supabase project using Run without RLS.**
   - It does not reset the Phase 1 auction, PINs, budgets, bids, or sales.
2. Upload/commit all files in this folder to the existing `glsk-auction` GitHub repo `main` branch.
3. Vercel will redeploy automatically.
4. Phase 1 remains at `/`.
5. Phase 2 is at `/supplemental.html` (and `/supplemental`).

## Data notes
- AJ Brown is treated as a free agent in the Top 40 auction.
- Chase Brown is treated as contracted and is excluded from Supplemental.
- Tyler Warren rookie rights belong to Reggie Kush.
