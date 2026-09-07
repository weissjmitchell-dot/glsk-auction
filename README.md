# Great Lake State Keepers — Live Auction Tool

A multiplayer, mobile-first fantasy football auction room built specifically for the 2026 Great Lake State Keepers auction.

## Already configured for your league

- 12 fantasy teams
- Revised starting bid dollars ($1 removed from each Drafty total)
- $1 minimum opening bid
- $1 bid increments
- 30-second timer
- Czar/commissioner nomination queue
- Exact 40-player auction pool, pre-queued in rank order
- Auction ends when all 40 players are sold
- Unsold players return to the undrafted pool
- Every accepted bid resets the clock to 30 seconds
- All phones/laptops update live through Supabase Realtime
- Server/database decides competing bids atomically
- Team PINs prevent accidental bidding as the wrong team
- Weiss Tea & Lemonade's team PIN also unlocks pause, queue, skip, undo, and force-sale controls
- CSV results export
- Commissioner-only **Reset Draft** button that restores all budgets, clears bids/results, and requeues all 40 players
- Built-in synthesized sound effects (no audio files required): new player, accepted bid, 10-second warning, 5-4-3-2-1 countdown, sold, pause/resume, and reset
- Per-device sound toggle so managers can mute their own phone/laptop

## Team starting budgets

| Team | Bid $ |
|---|---:|
| Weiss Tea & Lemonade | 99 |
| The Real McCoy | 104 |
| Team Ramrod | 95 |
| Slim Charles | 96 |
| The Hebrew Hammer | 114 |
| MEGATRONS V2 | 98 |
| Klyde Frogs | 137 |
| hugs not drugs | 91 |
| kerwinning it | 106 |
| Reggie Kush | 107 |
| Suburban White Kid | 99 |
| 7th Floor Crew | 100 |

Total auction pool: **$1,246**.

## Fast deployment for draft night

### 1. Create the live database

1. Create a free Supabase project at supabase.com.
2. Open **SQL Editor → New query**.
3. Paste the entire contents of `supabase/setup.sql` and click **Run**.
4. Run `supabase/rotate-to-12-pins.sql` once after setup. It generates exactly 12 team PINs.
5. Save that list immediately. Send each manager only their own team PIN. The Weiss Tea & Lemonade PIN also unlocks commissioner controls.

The plaintext PINs are **not stored in the database**; only password hashes are stored.

### 2. Supabase connection

This deployment package is already wired to the GLSK Supabase project using the browser-safe project URL and publishable key in `.env.production`. No secret/service-role key is included.

### 3. Run locally first

Then:

```bash
npm install
npm run dev
```

Open the local URL Vite prints.

### 4. Put it online with Vercel

The easiest route is:

1. Put this folder in a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite automatically.
4. Deploy. Vercel will build with the included `.env.production` values.
5. Send the Vercel URL + each manager's team PIN.

No manager needs a Supabase, GitHub, or Vercel account.

## Commissioner login

The commissioner joins **Weiss Tea & Lemonade** using that team's normal six-digit PIN. The app recognizes that team and automatically unlocks Czar controls after validating the same PIN against the commissioner credential. There is no separate commissioner PIN field.

## Auction behavior

- The 40 players begin in the nomination queue in the order supplied.
- Press **Start Draft** and Jahmyr Gibbs goes on the block immediately.
- The timer begins at 30 seconds.
- First bid is $1; each later tap is the next $1 increment.
- Every accepted bid resets the timer to 30 seconds.
- A manager who is already high bidder cannot bid against themselves.
- A manager cannot submit a bid above their remaining budget.
- When time expires, the database finalizes the sale once, even if many devices detect zero simultaneously.
- The next queued player automatically goes on the block.
- If nobody bids, that player returns to Undrafted and the next queued player goes on the block.
- The commissioner can requeue an unsold player later.
- After the 40th completed sale, the room changes to **Complete**.

## Emergency commissioner controls

The Czar can:

- Start
- Pause / Resume
- Skip the active player back to Undrafted
- Queue / remove players from the queue
- Undo the most recent completed sale
- Force-sell the active player to a selected team at a specified price


## Updating an existing live GLSK deployment to v5

If the database is already set up and the current auction app is live:

1. In Supabase open **SQL Editor → New query**.
2. Run `supabase/add-reset-function.sql` **once**. This only installs the reset RPC; it does not reset the current room.
3. Redeploy this v5 project folder/ZIP to Vercel.
4. Test the sound toggle and Reset Draft before sharing the room with managers.

The Reset Draft button requires a confirmation and then atomically restores all 12 starting budgets, clears bids and results, restores all 40 players to the rank-ordered queue, and returns the room to `setup`. Team PINs are preserved.

### Sound behavior

Sounds are generated locally with the browser Web Audio API, so there are no external audio files to load. Each device has its own **Sound / Muted** toggle. Browsers require a user interaction before audio can play; joining the room, tapping the sound button, or another normal tap unlocks audio.

Sound cues:

- New player on the block: rising three-note cue
- New accepted bid: short two-note ping
- 10 seconds remaining: warning beep
- 5, 4, 3, 2, 1 seconds: countdown ticks, stronger at 2 and 1
- Player sold: three-note sold cue
- Pause / resume: distinct down/up cues
- Full reset: descending reset cue

## Important draft-night test

Before the real auction, test from at least **three devices**:

1. Join three different teams.
2. Start the draft.
3. Tap bids rapidly from two devices at almost the same time.
4. Confirm only one bid wins each dollar level and all devices update.
5. Let one player expire and confirm the sale and budgets update everywhere.
6. Test pause/resume and undo.

Do not wait until the first real nomination to do this test.

## Commissioner login update
`Weiss Tea & Lemonade` is the commissioner team. Run `supabase/rotate-to-12-pins.sql` once after the main setup. It generates exactly 12 team PINs and makes the Weiss team PIN double as the commissioner/Czar PIN. The app automatically enables commissioner controls when Weiss joins; there is no second commissioner PIN field.
