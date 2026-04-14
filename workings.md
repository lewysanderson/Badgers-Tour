# Badgers Tour -- Web App Workings

## Status: LIVE at https://badgers-tour.vercel.app

Auto-deploys from `main` branch on GitHub (`lewysanderson/Badgers-Tour`) via Vercel.

---

## Project Overview

Single-page golf society web app for "The Badgers" -- a group of friends who do an annual golf tour in Spain/Portugal. Tracks individual Stableford scores, team matchplay, career stats, and historical tour data from 2022-2026.

**Stack:** Single `index.html` (HTML + CSS + JS), Vercel serverless API routes, Neon Postgres database.

---

## File Structure

```
/
  index.html              -- Entire frontend (single-page app, ~2400 lines)
  package.json            -- @neondatabase/serverless dependency
  .gitignore              -- node_modules, .env, .vercel
  workings.md             -- This file
  api/
    _db.js                -- Neon Postgres connection, schema init, state helpers
    state.js              -- GET /api/state (public read)
    submit.js             -- POST /api/submit (public score submission)
    unsubmit.js           -- POST /api/unsubmit (public withdrawal)
    admin.js              -- POST /api/admin (PIN-gated admin mutations)
```

---

## Architecture

### Database (Neon Postgres)

Single table `badgers_state` -- a JSONB key-value store:

```sql
CREATE TABLE IF NOT EXISTS badgers_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Keys stored: `scores`, `published`, `pending`, `matchplay`

- `scores` -- `{ "Player Name": { "1": [18 hole scores], "2": [...], "3": [...] } }` -- approved scores by player/round
- `published` -- `{ "1": true/false, "2": true/false, "3": true/false }` -- which rounds are public
- `pending` -- Array of `{ id, player, rnd, holes, submittedAt, entered, total }` -- awaiting admin approval
- `matchplay` -- `{ "1": { pairs: [...] }, "2": { pairs: [...] }, "3": { pairs: [...] } }` -- match results

### API Routes

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/state` | Public | Returns full `{ scores, published, pending, matchplay }` |
| POST | `/api/submit` | Public | Appends score to pending queue |
| POST | `/api/unsubmit` | Public | Withdraws a pending submission by player+round |
| POST | `/api/admin` | PIN `2026` | All admin mutations (see below) |

### Admin Actions (POST /api/admin)

All require `{ pin: "2026", action: "...", ...params }`:

| Action | Params | Effect |
|--------|--------|--------|
| `approve` | `{ id }` | Moves pending submission to approved scores |
| `reject` | `{ id }` | Removes from pending queue |
| `save` | `{ player, round, holes }` | Direct save (bypasses pending) |
| `deleteScore` | `{ player, round }` | Removes a player's score for a round |
| `publish` | `{ round, value }` | Toggles round visibility on public leaderboard |
| `updateMatchplayRound` | `{ round, pairs }` | Saves matchplay config/results for a round |
| `resetMatchplay` | -- | Resets all matchplay to defaults |
| `clearScores` | -- | Wipes all 2026 scores |
| `clearPending` | -- | Empties pending queue |
| `importState` | `{ scores, published, pending, matchplay }` | Full state replacement |

### Frontend State Management

- **Server is source of truth** -- `syncFromServer()` fetches from `/api/state`
- **localStorage cache** -- `saveState()` writes to `badgers2026_cache` for offline fallback
- **Draft auto-save** -- `saveDraft()` writes to `badgersDraft26` localStorage
- **30s auto-refresh** -- `setInterval` calls `syncFromServer()` and rebuilds the active page
- **Optimistic UI** -- score submissions update locally immediately, then POST to server

---

## Environment Variables

```
DATABASE_URL=postgres://...neon.tech/...   -- Neon connection string (set by Vercel Storage integration)
ADMIN_PIN=2026                              -- optional, defaults to '2026'
```

---

## Frontend Pages (all in index.html)

### Navigation
- Sticky top nav bar with hamburger menu on mobile (<=768px)
- Pages: Home, Players, Tours, 2026 Tour, Stats, Insights, Score Entry
- Score Entry tab highlighted in accent color

### 1. Home (`page-home`)
- Hero banner: "THE BADGERS -- A Gentleman's Golf Society"
- 4 stat cards (Tours, Players, Rounds Played, Countries)
- Honours strip (3x Champion, Best Round, Team Champion, Next Destination)
- All-Time Leaderboard table -- **includes live 2026 data** via `getAllStats()`
- Tour History grid -- **includes live 2026** via `getToursWithLive()`

### 2. Players (`page-players`)
- 2-column grid (1-col on mobile) of player cards
- Each card: avatar, name, avg score, all-time total, best round, tours played
- Sparkline showing tour-by-tour average trend
- 2026 matchplay record (W/H/L/Pts)
- Expandable tour history table -- **includes 2026 rows with (Live) tag**
- Data from `getAllStats()` -- **includes live 2026 data**

### 3. Tours (`page-tours`)
- Expandable tour cards for each year (2022-2026)
- Each card: location, player count, winner, score table, team info
- **2026 appears as a live tour card** via `getToursWithLive()`
- Scores of 0 display as `--`

### 4. 2026 Tour Hub (`page-next`)
- Hero with year, location, course pills
- Matchplay hero board (Shankers vs Toppers with progress bar)
- Public leaderboard (only shows published rounds)
- Matchplay round-by-round summary (expandable)
- Team draw (Shankers / Toppers with player lists)
- Handicap table (WHS HI + course handicaps per round)

### 5. Stats (`page-stats`)
- Career stats table with avg, round count, total pts, best round
- Computed from `computeStatsFromTours()` -- **includes live 2026 data**
- Always refreshes on visit (no one-time gate)

### 6. Insights (`page-insights`)
- KPI cards: Players, Total Rounds, Field Avg, Tours, Most Consistent, Most Improved
- **KPI tile font auto-shrinks** for long names (>4 chars: 22px, >6 chars: 18px)
- Year-by-year performance bar chart with tab selector -- **includes 2026 (Live) tab**
- Consistency Rankings (CV% -- lower = more consistent, requires 3+ rounds)
- Most Improved (first tour avg vs latest tour avg)
- Tour Records table -- **includes 2026 with green "Live" badge**
- All powered by `getToursWithLive()` and `getAllStats()`

### 7. Score Entry (`page-score`)

This is the main interactive page. Detailed breakdown below.

---

## Score Entry Page -- Detailed Architecture

### Layout (top to bottom)

1. **Header row**: "2026 Score Entry" title + Keyboard toggle + Admin button
2. **Pending/Approved banners** (above scorecard for visibility)
3. **Player & Round selectors** (2-column grid, player grouped by team via optgroups)
4. **Course info strip** (HCP badge, course name, par, CR/Slope)
5. **Progress bar** (X/18 holes, turns green at 18, "Draft saved" flash indicator)
6. **Scorecard table** (Hole, Par, SI, shots dots, Score stepper/keyboard, Pts)
7. **Sticky total bar** (large total display + Clear/Save Direct/Submit buttons)
8. **Admin panel** (pending approvals, live leaderboard, publish toggles, matchplay config, backup/restore)

### Three Score States

| State | Banner | Scorecard | Actions |
|-------|--------|-----------|---------|
| **Editable** (no submission) | Hidden | Fully interactive | Submit for Approval visible |
| **Pending** | Gold "SUBMISSION RECEIVED" | Grayed out, locked | Edit This Submission + Withdraw |
| **Approved** | Green "SCORE APPROVED" | Grayed out, locked | None (contact admin) |

Managed by `updatePendingStatus()` which checks `pending2026` and `scores2026`.

### Score Input Modes

- **Stepper mode** (default): +/- buttons per hole. First tap on + sets to par. Empty holes show par as faded placeholder.
- **Keyboard mode**: Number inputs with `inputmode="numeric"`, Tab/Enter to advance, placeholder shows par.
- Toggle via "Keyboard"/"Stepper" button.

### Submission Flow

1. Player fills in scores (auto-saved to localStorage draft on every change)
2. Taps "Submit for Approval" -> **confirmation modal** shows hole count, total pts, missing holes warning
3. On confirm -> `submitForApproval()`:
   - Optimistic local update (pushes to `pending2026`, calls `saveState()`, `updatePendingCount()`, `updatePendingStatus()`)
   - Page immediately shows "SUBMISSION RECEIVED" banner and locks scorecard
   - POST to `/api/submit` in background
4. Admin approves -> score moves to `scores2026`, appears on leaderboard when round is published

### Key Score Entry Functions

| Function | Purpose |
|----------|---------|
| `buildPlayerDropdown()` | Populates select with optgroups by team |
| `updateScorecard()` | Renders full scorecard table + course info + progress |
| `renderScoreCell(i, gross)` | Returns stepper HTML or keyboard input HTML |
| `incHole(i)` / `decHole(i)` | Stepper button handlers |
| `setHoleKbd(i, val)` | Keyboard input handler |
| `refreshHole(i)` | Updates a single row's display (pts, color, subtotals) |
| `updateTotal()` | Recalculates running Stableford total |
| `updateProgress()` | Updates progress bar and Clear button visibility |
| `updatePendingStatus()` | Shows/hides banners, locks/unlocks scorecard |
| `setScorecardLocked(locked)` | Disables inputs, grays out scorecard |
| `confirmSubmit()` | Shows confirmation modal before submission |
| `submitForApproval()` | Optimistic local + server submission |
| `editPendingScore()` | Loads pending back into editor, removes from queue |
| `unsubmitScore()` | Withdraws pending submission |
| `clearScorecard()` | Resets all 18 holes to 0 with confirmation |
| `adminDirectSave()` | Bypasses pending queue (admin only) |

### Stableford Calculation

```js
function getShots(ch, si) {
  const f = Math.floor(ch / 18);
  return f + (si <= ch % 18 ? 1 : 0);
}
function calcStableford(gross, par, shots) {
  if (!gross || gross < 1) return null;
  return Math.max(0, 2 + par - (gross - shots));
}
```

- `ch` = course handicap for that round
- `si` = stroke index of the hole
- Shots allocated: `floor(ch/18)` base + 1 extra if `si <= ch % 18`

---

## Live Data Integration (2026 -> Stats/Insights/Home/Players/Tours)

### The Problem (solved)

Stats, Insights, Home leaderboard, Players, and Tours pages originally only read from the hardcoded `TOURS` constant (2022-2025 historical data). Live 2026 scores in `scores2026` were siloed to the 2026 Tour tab.

### The Solution

Two key functions bridge live data into all pages:

```js
function get2026TourEntry() {
  // Converts scores2026 (hole-by-hole arrays) into TOURS-compatible format
  // { year: 2026, location: "Praia del Rey", flag: "PT", scores: [{player, r1, r2, r3}, ...], live: true }
  // Calculates Stableford totals per round from hole scores + course handicaps
  // Returns null if no approved scores exist
}

function getToursWithLive() {
  // Returns [...TOURS, get2026TourEntry()] if 2026 data exists
  // Otherwise returns [...TOURS]
}
```

### Where `getToursWithLive()` is used

- `getAllStats()` -- player averages, totals, bests, tour counts
- `computeStatsFromTours()` -- Stats page data
- `buildLeaderboard()` -- Home all-time leaderboard
- `buildHomeTours()` -- Home tour history grid
- `buildPlayers()` -- Player cards with tour history
- `buildTours()` -- Tours page expandable cards
- `_buildInsightKpi()` -- Insights KPI cards
- `_buildYrTabs()` -- Insights year tab selector (shows "2026 (Live)")
- `_buildYrChart()` -- Insights year-by-year performance chart
- `_buildConsistency()` -- Insights consistency rankings
- `_getMostImproved()` -- Insights most improved calculation
- `_buildTourRecords()` -- Insights tour records (shows green "Live" badge)

### Auto-refresh

Every 30 seconds, `syncFromServer()` pulls latest data and rebuilds whichever page is currently active. This means:

- Scores approved by admin appear on Stats/Insights/Home within 30 seconds
- No manual refresh needed
- Active page detection: `document.querySelector('.page.active').id`

---

## CSS Design System

### Color Palette (`:root` variables)

```css
--bg: #0f1318          /* Deep charcoal background */
--surface: #171c24     /* Nav, slightly lighter */
--card: #1c222d        /* Card backgrounds */
--card2: #232a37       /* Table headers, secondary cards */
--accent: #b8956a      /* Warm brass/gold -- primary accent */
--accent2: #d4b48a     /* Lighter brass */
--accent-dim: rgba(184,149,106,0.10)
--accent-border: rgba(184,149,106,0.22)
--text: #e8e4dc        /* Primary text */
--muted: #737980       /* Secondary text */
--green: #5ca87c       /* Positive/approved */
--red: #c9524b         /* Negative/danger */
--blue: #6da4d4        /* Shankers team color */
--rose: #d47a72        /* Toppers team color */
```

### Typography

- **Headings**: Cormorant Garamond (serif, from Google Fonts)
- **Body**: Inter (sans-serif, from Google Fonts)
- **Big numbers**: Cormorant Garamond at large sizes (28-96px)

### Responsive Breakpoints

- **768px**: Mobile -- hamburger nav, single-column grids, smaller matchplay hero
- **400px**: Small mobile -- larger touch targets (44px steppers), tighter scorecard (min-width 300px)

### Key CSS Classes

| Class | Purpose |
|-------|---------|
| `.admin-section` | Card container with border |
| `.course-info-strip` | Structured course info bar |
| `.total-bar` | Sticky bottom bar in scorecard |
| `.sc-table` | Scorecard table (min-width 340px) |
| `.stepper` / `.step-btn` | +/- button group (40px, 44px on small) |
| `.score-val-empty` | Faded par placeholder in empty stepper |
| `.score-kbd` | Keyboard mode number input |
| `.pending-card` | Pending approval card in admin |
| `.approve-btn` / `.reject-btn` | Admin action buttons |
| `.mp-hero` | Large matchplay scoreboard |
| `.insight-card` / `.insight-num` | Insights KPI tiles (auto-shrinking font) |
| `.tour-card` | Expandable tour card |
| `.player-card` | Player profile card |
| `.medal` | Gold/silver/bronze circle indicators |

---

## Data Constants (in index.html)

### TOURS (lines ~636-682)

Hardcoded array of 4 tour objects (2022, 2023, 2024, 2025). Each has:
```js
{ year, location, country, flag, scores: [{player, r1, r2, r3}, ...], teams?, teamStandings? }
```

### NEXT_TOUR (lines ~683-703)

2026 tour configuration:
- Location: Praia del Rey, Portugal
- Teams: Shankers (6 players) and Toppers (6 players)
- Handicaps: WHS HI + course handicaps for all 3 courses

### COURSES (lines ~716-738)

3 course objects keyed by round number (1, 2, 3):
```js
{ name, par, cr, slope, holes: [{n, par, si}, ...] }  // 18 holes each
```
- Round 1: Royal Obidos (par 72, CR 74.0, Slope 135)
- Round 2: West Cliffs (par 72, CR 70.3, Slope 138)
- Round 3: Praia del Rey (par 73, CR 70.3, Slope 123)

### PLAYERS_2026 (lines ~740-753)

12 players with name, team, and course handicaps:
```js
{ name, team, ch: [c1, c2, c3] }  // ch[0] = Royal Obidos hcp, etc.
```

### DEFAULT_PAIRS (lines ~707-714)

6 default singles matchplay pairings (Shankers vs Toppers).

---

## Admin Panel Features

- **Pending Approvals**: Cards showing submitted scores with hole-by-hole chips, approve/reject/unsubmit/edit buttons
- **Live Leaderboard**: Full table of all approved scores (all rounds, regardless of publish status)
- **Publish Toggles**: Per-round buttons to show/hide rounds on public leaderboard
- **Matchplay Config**: Add/remove matches (singles or fourball), pick players, set results (Shanker win/Topper win/Halved) with margins
- **Backup & Restore**: Export JSON backup, import from file
- **Data Management**: Clear all scores, clear pending queue, reset matchplay draw

### Admin PIN

Hardcoded as `2026` in `index.html` line ~560. Also checked server-side in `api/admin.js`.

---

## Confirm Modal System

The `showConfirm(msg, onOk, okLabel, style)` function supports:
- **`'destructive'`** (default): Red button for dangerous actions (clear, delete, unsubmit)
- **`'positive'`**: Gold/brass button for confirmations (submit score)
- Multi-line messages via `\n` (rendered with `white-space: pre-line`)

---

## Development Commands

```bash
# Local development
npm install
vercel env pull .env.local    # pulls DATABASE_URL from Vercel
vercel dev                     # runs locally with serverless functions

# Deploy
git add .
git commit -m "Description"
git push                       # Vercel auto-deploys from main

# Manual deploy
npx vercel --prod

# Check live site
open https://badgers-tour.vercel.app
```

---

## Known Limitations / Future Work

### Current Limitations
- No user authentication (anyone can submit scores for any player, protected only by admin PIN for approvals)
- No audit log for admin actions
- Pending submissions don't show timestamps to players on the scorecard
- `allStats` computed at init is stale (but `getAllStats()` is called fresh when pages render)
- Git commits show local username/email warnings

### Potential Improvements
1. Player authentication (so only you can submit your own score)
2. Push notifications when score is approved/rejected
3. Audit log for admin actions
4. PWA manifest for "Add to Home Screen"
5. Service worker for full offline mode
6. Real-time updates via WebSocket instead of 30s polling
7. Score validation warnings (unusually high/low scores)
8. Hole-by-hole stats (eagles, birdies, pars) -- currently stubbed as 0 in `computeStatsFromTours()`
9. Photo gallery per tour
10. Historical matchplay data (currently only 2026 is tracked)

---

## Recent Changes (newest first)

### Auto-shrink Insight KPI tiles
- `_buildInsightKpi()` calculates font size based on text length
- <=4 chars: 28px, 5-6 chars: 22px, 7+ chars: 18px
- `.insight-num` has `white-space: nowrap` to prevent wrapping

### Live 2026 data in Stats/Insights/Home/Players/Tours
- Added `get2026TourEntry()` -- converts `scores2026` hole data into `{player, r1, r2, r3}` format
- Added `getToursWithLive()` -- returns `TOURS` + synthetic 2026 entry
- Updated `getAllStats()`, `computeStatsFromTours()`, and all Insights/Home/Players/Tours functions
- 2026 shows as "(Live)" in year tabs, green "Live" badges in tour records
- Home tour grid shows "Current Leader" instead of "Individual Winner" for live tours
- Stats page always refreshes on visit (removed one-time `statsLoaded` gate)
- Auto-refresh now rebuilds whichever page is currently active

### Score Entry Page UX Overhaul (10 improvements)
1. **Banners above scorecard** -- pending/approved banners moved to top for immediate visibility
2. **Progress bar** -- shows X/18 holes entered, turns green at 18
3. **Larger stepper buttons** -- 40px (44px on small screens), par placeholder for empty holes
4. **Confirmation before submit** -- modal shows hole count, total, missing holes warning
5. **Tighter scorecard** -- removed Net column, compact padding, min-width 340px (300px small)
6. **Draft auto-save indicator** -- "Draft saved" flashes next to progress bar
7. **Player dropdown grouped by team** -- optgroups for Shankers/Toppers
8. **Course info strip** -- structured card with HCP badge, separators
9. **Clear scorecard button** -- appears when holes entered, confirms before clearing
10. **Sticky total bar** -- larger 32px total, sticky at bottom of card

### Immediate UI update after submission
- Added `updatePendingStatus()` call after optimistic local update in `submitForApproval()`
- Page instantly shows pending banner and locks scorecard on submit

### Previous work (complete list in git history)
- Full UI redesign (color palette, typography, emoji removal, mobile-first)
- Admin score management (edit, delete from leaderboard)
- Player score unsubmit/edit features
- Google Sheets integration removed entirely
- Database-only architecture (Neon Postgres)
- Matchplay tournament system (singles + fourball)
- Export/import backup system
