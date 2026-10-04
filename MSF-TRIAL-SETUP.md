# GLSK — MySportsFeeds trial preparation

This update adds Settings → Commissioner → MySportsFeeds Trial. It tests access to NFL schedules, player game statistics, team game statistics and current injuries. Tests return record counts and field names/types, not actual player records. Downloaded reports contain no API key.

## Install before starting the trial

1. Extract `GLSK-MySportsFeeds-Trial-Update.zip` on your computer.
2. In Supabase's SQL Editor, open a new query, paste the entire contents of `supabase/msf-trial-v1.sql`, and run it. The script is transactional and safe to run again. It requires your existing account, weekly score, player-stat and projection tables and PostgreSQL 15 or later. If it fails, stop and share the error; do not remove the permission checks.
3. In your GLSK GitHub repository on `main`, upload the extracted files **with their folders preserved at the repository root**. Replace `src/league.js` and `tests/package.json`; the other files are new. Do not upload the ZIP itself or place the files inside an extra parent folder. If GitHub's browser upload does not preserve folders, upload into the corresponding `api`, `server`, `src`, `supabase`, and `tests` directories individually.
4. Let Vercel build and deploy the commit. The existing `npm run build` remains unchanged.
5. Open GLSK → Settings → Commissioner → MySportsFeeds Trial → Check Setup. Before credentials are added, it should say **Key not configured**. Yahoo's connection remains available separately.

The SQL also restricts reads of player stats, projections and weekly scores to active accounts in the corresponding league. Anonymous reads are revoked, and the existing matchup and standings views now respect those restrictions. Verify a normal owner can still open those pages after installation. It does not change existing scores, roster entries or scoring rules. This is targeted protection of the affected tables/views, not a full audit of all existing RPC functions and database grants.

## Start and connect the trial when ready to test

1. Start the intended NFL subscription in MySportsFeeds. Review the final selected package, delay, billing amount and trial end date before confirming. The latest three-minute CORE + STATS + DETAILS + PROJECTIONS quote supplied was CA$391/month after 14 days. No subscription is created by this code.
2. Copy the key for the API subscription you just enabled.
3. In Vercel → GLSK project → Settings → Environment Variables, add **MSF_API_KEY** for **Production**, using that key as the value. Keep it server-only; do not add a `VITE_` prefix or commit it to GitHub.
4. Save and redeploy Production. No new Yahoo client ID or callback URL is needed.
5. Use the production URL `https://glsk-auction.vercel.app`. If you later move to another domain, set `GLSK_APP_ORIGIN` to its exact HTTPS origin and redeploy. Do not use preview URLs for these tests.

The connection uses the same Supabase project as the existing Yahoo and video endpoints. `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` can override those existing defaults. A Supabase service-role key is not required.

## First tests

1. Sign in as commissioner and choose MySportsFeeds Trial → Check Setup. Expect **Ready to test**.
2. Select **2026**, **Week 1**, **Schedule and scores**, then Test Selected Feed.
3. Test **Player game statistics**, then **Team game statistics**. Each feed has its own three-minute cooldown across the league, including failed calls. Tests never run automatically.
4. Download each test report and send it back for field mapping. These reports are intentionally limited to field names/types and record counts.
5. Optionally test **Current injuries**. The selected season/week does not make this endpoint historical.

A successful request means access works; it does not mean scoring is correct. An empty result means there is no data for that selection, not a successful scoring validation. Trial restrictions may limit the selected season or feed.

## What is ready, and what still needs trial evidence

Ready: commissioner-only test endpoint and panel, fixed provider URLs, server-only credentials, request timeouts, bounded response size, per-feed database cooldown, member-only reads for the affected score/stat tables, and a separately tested provider-independent scoring function.

Not enabled: player matching, importing production stats, projections import, scheduled refresh, historical lineup reconstruction, or writing fantasy scores/standings. There is intentionally no flag that bypasses these missing steps.

Next, use the test reports and the signed-in MySportsFeeds API documentation to confirm exact field definitions and samples. The public documentation retrieved established the v2.1 request paths and authentication but did not establish a current projections endpoint or all NFL field semantics. Projections remain untested; do not treat this update as proof that the whole paid package is suitable.

Particular scoring checks needed:

- Tackles for loss, sacks and defensive interceptions.
- Individual return yards and return touchdowns, without double counting team defense.
- Made/missed field goals by distance and missed extra points.
- Offensive fumble-return touchdowns and two-point/extra-point returns.
- Fantasy defense points allowed, including which opposing scoring plays count. A game's final scoreboard alone may not match this definition.
- Yardage bonuses: the supplied rules list both thresholds but do not specify whether bonuses stack. The scoring helper requires an explicit `cumulative` or `highest` choice; compare known Yahoo results before choosing.
- Provider player IDs matched to GLSK players and team defenses; do not silently match ambiguous names.
- Corrected statistics after games, game status, timestamps, live update delay and projection coverage.

Once mappings are verified, add a separate preview of computed scores for a completed week, compare it with known league results, then implement controlled imports and scheduled updates. Do not finalize past weeks without their actual starting lineups. Track your trial end date and cancel before billing if the feed does not meet your needs.

## Validation and developer notes

- `npm run build` passed with the existing Vite dependency range.
- `node --test tests/msf-trial.test.mjs`: 9 tests passed covering custom scoring, missing values, authorization, provider errors and rate-limit ordering.
- `cd tests && npm install && npm run test:msf`: also runs PostgreSQL-compatible PGlite policy tests and Happy DOM UI checks.
- Database checks cover repeat installation, anonymous denial, league isolation, inactive accounts, commissioner permissions, cooldown and invoker views. They use a local fixture, not the live Supabase database.
- No live API call or live deployment has been performed. Provider responses in automated tests are synthetic.
- Existing scoring rules are read from `supabase/weekly-host-settings-v61.sql` in the scorer tests. Live database rules may have changed since the ZIP; validate them before future imports.
- Scoring module: `server/msf-scoring.js`. Expects normalized numeric stats keyed by GLSK's scoring rule names, plus `dst_points_allowed`. Missing values produce `points: null`, never an invented zero.

Reference used for v2 API paths: https://rdrr.io/github/MySportsFeeds/mysportsfeeds-r/src/R/msf_get_results.R (provider-owned wrapper source). Authentication: https://github.com/MySportsFeeds/mysportsfeeds-node . Account-specific MySportsFeeds terms and trial restrictions take precedence over older wrapper documentation.

## If installation needs to be backed out

Restore the previous `src/league.js` from GitHub history and redeploy to remove the panel. The new unused API/server files can remain or be removed. Keep the database privacy restrictions; reverting the frontend does not require reopening public data access. If an owner loses expected access, check that their `league_owner_accounts` record is active in the correct room rather than restoring anonymous reads.
