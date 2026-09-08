# GLSK League Office v1

This patch adds a new `/league` route to the existing Great Lake State Keepers Vercel/Supabase app.

## What v1 includes
- League dashboard with live roster counts, bid balances, contract cap usage and deadlines
- Team/roster pages backed by the shared live roster table
- Contract & salary-cap dashboard, with commissioner add/update/void controls
- Season-versioned rule settings
- Commissioner-editable bid-dollar redistribution with a required 100% total
- Deadline manager with per-team submission tracking and optional automatic lock at the due time
- PIN-validated finance ledger (finance rows are not publicly selectable from Supabase)
- Links to Auction, Supplemental and Phase 3 draft rooms
- Audit log foundation for commissioner changes

## Current seeded rules/data
- 2026 season, roster limit 18, salary cap 100 points
- Contract options: 2yr/15, 3yr/25, 4yr/45
- 2026 contract import from the workbook, corrected so Slim Charles has Chase Brown under contract and AJ Brown is a free agent
- 2026 redistribution snapshot imported from the workbook (editable)
- Draft defaults already agreed for Auction/Supplemental/Phase 3
- Rookie-rights lifecycle rules stored as league settings

## Install
1. Run `supabase/league-office-v1.sql` once in Supabase SQL Editor using **Run without RLS**.
2. At the GitHub repository root, upload `league.html`, `vite.config.js`, and `vercel.json`.
3. Inside the existing GitHub `src` folder, upload `league.js` and `league.css`.
4. Optionally store the SQL file in the existing GitHub `supabase` folder.
5. Commit to `main`; Vercel should deploy automatically.
6. Open `https://glsk-auction.vercel.app/league`.

The same team PIN/session used by the draft rooms works in League Office. Weiss Tea & Lemonade receives commissioner controls with its existing PIN.
