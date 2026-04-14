# The Badgers ⛳ — Golf Society Web App

**Live app:** https://badgers-tour.vercel.app

A shared web application for The Badgers Golf Society. Players submit scorecards from their phones during the tour. Scores go into a live leaderboard once approved by an admin. The app also tracks matchplay results, historical tour data, and player statistics across all tours.

---

## Table of Contents

1. [Quick Start for Players](#quick-start-for-players)
2. [App Pages](#app-pages)
3. [Submitting a Scorecard](#submitting-a-scorecard)
4. [Admin Rights](#admin-rights)
5. [Admin — Score Approval](#admin--score-approval)
6. [Admin — Direct Save](#admin--direct-save)
7. [Admin — Publish Rounds](#admin--publish-rounds)
8. [Admin — Matchplay](#admin--matchplay)
9. [Admin — Data Management](#admin--data-management)
10. [How It Works Technically](#how-it-works-technically)
11. [Changing the Admin PIN](#changing-the-admin-pin)
12. [Local Development](#local-development)

---

## Quick Start for Players

1. Open **https://badgers-tour.vercel.app** on your phone.
2. Tap **⛳ Score Entry** in the nav bar.
3. Select your name and your round number.
4. Enter your gross scores hole by hole.
5. Tap **Submit for Approval**.
6. Your score appears in the leaderboard once an admin approves it.

No account or login needed. The app works on any phone browser.

---

## App Pages

| Tab | What it shows |
|-----|---------------|
| **Home** | Overall tour summary — total tours, players, rounds played, all-time Stableford record |
| **Players** | Player cards for every member who has played. Shows career average, best round, sparkline trend across tours, and matchplay W/D/L record |
| **Tours** | Results from all past tours (2022–2025) broken down by round with full scorecard leaderboards |
| **2026 — Praia del Rey** | The live 2026 tour: team draw (Shankers vs Toppers), handicaps for all three courses, and the live Stableford leaderboard for each round |
| **📊 Stats** | The main live leaderboard for 2026 sorted by total Stableford points, plus individual round breakdowns |
| **💡 Insights** | Analytics across all tours — KPI cards, per-player bar chart (filterable by year), consistency rankings (coefficient of variation), most improved player, and tour records |
| **⛳ Score Entry** | Where players submit scorecards |

---

## Submitting a Scorecard

### Stepper mode (default)
Each hole shows a **−** and **+** button. Tap them to increase or decrease your gross score for that hole. The Stableford points for each hole calculate automatically based on the course par, stroke index, and your handicap.

### Keyboard mode
Tap the **⌨ Keyboard** toggle button in the top-right of the Score Entry page. This switches the steppers to number input boxes. Tab between holes for fast entry on a phone keyboard. Scores highlight gold once entered.

### Partial submission
You do not have to complete all 18 holes before submitting. Enter as many holes as you have played and submit — the admin can see exactly which holes were recorded.

### Rules
- You can only have one pending submission per player per round at a time. If you submit and then realise a mistake, ask an admin to reject it so you can resubmit.
- Scores are calculated as Stableford points using full handicap allowance against course rating and slope.

---

## Admin Rights

Admin mode unlocks additional controls: approving/rejecting submitted scores, saving scores directly, publishing rounds, editing matchplay results, and resetting data.

### Entering admin mode
1. On the **⛳ Score Entry** page, tap the **🔒 Admin** button.
2. Enter the PIN: **`2026`**
3. The button changes to **🔓 Admin On** and the admin panel appears below the scorecard.

Admin mode is local to your browser session. Closing or refreshing the page returns it to locked mode.

### Pending badge
If any scores are waiting for approval the Admin button shows a red badge with the count (e.g. `🔒 Admin 3`) even when locked, so you know to log in.

---

## Admin — Score Approval

When a player submits a scorecard it goes into a **pending queue**. The admin panel shows each pending submission with:

- Player name and team colour
- Course name, round number, how many holes were entered, and submission time
- Gross score per hole (empty holes shown as grey chips)
- Stableford total

**Approve** — moves the score into the official leaderboard and removes it from the queue.

**Reject** — discards the submission. The player can then resubmit a corrected scorecard.

**Clear all pending** — discards the entire pending queue in one action (requires confirmation).

---

## Admin — Direct Save

In admin mode the **Save directly** button on the Score Entry page bypasses the approval queue entirely. Use this when entering scores on behalf of someone else or correcting an already-approved score. The score writes to the leaderboard immediately.

---

## Admin — Publish Rounds

Each of the three rounds can be independently published or unpublished. Unpublished rounds are visible in the leaderboard to admins but hidden from regular players.

Toggle the publish state with the **Publish / Unpublish** button next to each round in the admin panel.

---

## Admin — Matchplay

The **2026 — Praia del Rey** page shows the Shankers vs Toppers matchplay competition across all three rounds. Each round has six singles matches.

In admin mode an **Edit** section appears for each round where you can:

- **Change the players** in each match using the dropdown selectors.
- **Record a result** — tap **S** (Shankers win), **H** (Toppers win), or **T** (Halved).
- **Enter the margin** — type in the hole margin (e.g. `3&2`, `1up`, `19th`).
- **Add a match** — add an extra match row to the round.
- **Remove a match** — tap the red ✕ on any row to delete it.
- **Reset matchplay** — wipes all results and pairings back to the default draw (requires confirmation).

The scoreboard at the top of the page updates automatically as results are entered, showing total points and a progress bar.

---

## Admin — Data Management

All controls are in the **Data** section of the admin panel at the bottom of the Score Entry page.

| Action | What it does |
|--------|--------------|
| **Export JSON** | Downloads a full backup of all current data (scores, matchplay, pending queue, publish state) as a `.json` file |
| **Import JSON** | Restores from a previously exported backup. The file is validated before applying |
| **Clear all scores** | Wipes all 2026 scores and resets published state. Does **not** affect matchplay or historical tour data. Requires confirmation |

> **Tip:** Export a backup before any bulk import or clear operation.

---

## How It Works Technically

### Architecture

```
Browser (index.html)
    │
    ├── GET  /api/state    → returns all live data (scores, matchplay, pending, published)
    ├── POST /api/submit   → player submits a scorecard (no auth required)
    └── POST /api/admin    → all admin mutations (PIN required)
```

### Database

All state is stored in a **Neon Postgres** database (provisioned via Vercel). The schema is a single key-value table:

```sql
CREATE TABLE badgers_state (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Four keys are used: `scores`, `published`, `pending`, `matchplay`. The table is created automatically on first request — no manual migration needed.

### Frontend behaviour

- **Optimistic UI** — when a player submits a score the leaderboard updates instantly in their browser, then the API call is made in the background.
- **Auto-refresh** — the app polls `/api/state` every 30 seconds so all viewers see live updates without reloading.
- **Offline fallback** — the last successful API response is cached in `localStorage`. If the network is unavailable the app loads from cache.
- **Historical data** — all tours before 2026 are hard-coded in the HTML. Only 2026 data is stored in the database.

### Stableford calculation

Points per hole = `2 + par − gross + shots_received`, floored at 0.

`shots_received` is calculated from the player's course handicap and the hole's stroke index, using the standard WHS allocation method.

---

## Changing the Admin PIN

The PIN is stored in two places and both must be updated together:

1. **`index.html`** — find the line `const ADMIN_PIN = '2026';` (around line 518) and change the value.
2. **Vercel environment variable** — go to the Vercel dashboard → **Settings** → **Environment Variables** → update `ADMIN_PIN` for all environments.

After changing the env var, trigger a redeploy from the Vercel dashboard (or push a commit).

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Pull environment variables from Vercel (requires vercel CLI and project link)
vercel env pull .env.local

# 3. Run locally with live serverless functions
vercel dev
```

The app is then available at `http://localhost:3000`.

To deploy a new production build:

```bash
vercel --prod
```

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Neon Postgres connection string — auto-set by Vercel Marketplace |
| `ADMIN_PIN` | No | `2026` | Overrides the default admin PIN |

---

## Past Tours

| Year | Location | Country | Winner |
|------|----------|---------|--------|
| 2022 | Torremolinos | Spain | Harry Blake |
| 2023 | Vilamoura | Portugal | Harry Blake |
| 2024 | Amendoeira | Portugal | Team 2 🏆 |
| 2025 | La Manga | Spain | Team 1 🏆 |
| **2026** | **Praia del Rey** | **Portugal** | *TBD* |

### 2026 Courses

| Round | Course | Par | CR | Slope |
|-------|--------|-----|----|-------|
| 1 | Royal Obidos | 72 | 74.0 | 135 |
| 2 | West Cliffs | 72 | 70.3 | 138 |
| 3 | Praia del Rey | 73 | 70.3 | 123 |

### 2026 Teams

**Shankers** — Jack Turner, George Colleran, Craig Wilson, Jordan Leigh, Rory Lindsay Brown, Peter Eaton

**Toppers** — Lewys Anderson, George Apel, David Canavan, Ben Cowley, Josh Hopkins, James Rickard
