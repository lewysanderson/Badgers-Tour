# Badgers Tour — Web App Conversion Workings

## Status: CODE COMPLETE — Database-Only (No Google Sheets)

---

## What Was Done

### 1. UI Improvements (index.html)
- Mobile nav scrolls horizontally (no wrapping)
- Smooth page fade-in animations
- SVG sparklines on player cards showing tour-by-tour average trend
- New 💡 Insights tab: KPI cards, year bar chart, consistency rankings (CV%), most improved, tour records
- Export/Import JSON backup in admin panel
- ⌨ Keyboard score entry mode toggle (steppers ↔ direct number inputs with Tab navigation)
- ✎ Admin can edit or delete individual scores from the live leaderboard (edit/delete buttons visible in admin mode)
- ⏳ Pending score indicator — when a player submits a score, the scorecard shows "Pending approval" with Unsubmit and Edit buttons
- ✕ Players can unsubmit their pending scores before admin approval
- ✎ Players can edit pending scores (loads score into editor, removes from pending queue)

### 2. Backend Files Created (Database-Only Architecture)
| File | Purpose |
|------|---------|
| `package.json` | `@neondatabase/serverless ^1.0.2` dependency |
| `.gitignore` | Ignores `node_modules/`, `.env`, `.vercel` |
| `api/_db.js` | Lazy Neon connection, schema init, `getState()`, `setKey()` |
| `api/state.js` | `GET /api/state` — returns full `{ scores, published, pending, matchplay }` |
| `api/submit.js` | `POST /api/submit` — public, appends score to pending queue |
| `api/unsubmit.js` | `POST /api/unsubmit` — public, allows players to withdraw pending submissions |
| `api/admin.js` | `POST /api/admin` — PIN-gated, handles all admin mutations including `deleteScore` |

**Note:** All data is stored exclusively in Neon Postgres. Google Sheets integration has been completely removed.

### 3. index.html Script Changes (Database-Only)
- `loadState()` → async, fetches from `/api/state`, falls back to localStorage cache
- `saveState()` → writes localStorage cache only (server is source of truth)
- `submitForApproval()` → optimistic local update + POST `/api/submit`
- `unsubmitScore()` → removes pending submission + POST `/api/unsubmit` (public)
- `editPendingScore()` → loads pending score into editor, removes from queue + POST `/api/unsubmit`
- `unsubmitPendingScore()` → admin can unsubmit any pending score from the list
- `editPendingFromList()` → admin can edit any pending score from the list
- `updatePendingStatus()` → shows/hides pending indicator on scorecard
- `adminDirectSave()` → `adminPost('save', ...)`
- `approveScore()` → `adminPost('approve', ...)`
- `rejectScore()` → `adminPost('reject', ...)`
- `deleteScore()` → `adminPost('deleteScore', ...)` — deletes a single score
- `editScore()` → loads the score into the scorecard editor
- `clearPendingQueue()` → `adminPost('clearPending')`
- `togglePublish()` → `adminPost('publish', ...)`
- All matchplay mutations → `saveMpRound(rnd)` → `adminPost('updateMatchplayRound', ...)`
- `resetMatchplay()` → `adminPost('resetMatchplay')`
- `clearAllScores()` → `adminPost('clearScores')`
- `exportData()` → fetches fresh state from `/api/state` then downloads JSON
- `importData()` → restores local state + `adminPost('importState', ...)`
- `fetchStats()` → computes stats from TOURS data (no Google Sheets dependency)
- Init → `async` IIFE with `await loadState()`, 30s auto-refresh interval

**Removed:** All Google Sheets integration (`SCRIPT_URL`, `sheetsPost()`, `saveRoundToSheets()`, `saveMpToSheets()`, `bulkUploadToSheets()`)

---

## Architecture

### Database (Neon Postgres)
Single table `badgers_state` — a JSONB key-value store:
```sql
CREATE TABLE IF NOT EXISTS badgers_state (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
Keys: `scores`, `published`, `pending`, `matchplay`

### API Routes
| Method | Path | Auth | Action |
|--------|------|------|--------|
| GET | `/api/state` | Public | Read all state |
| POST | `/api/submit` | Public | Submit score to pending queue |
| POST | `/api/unsubmit` | Public | Withdraw pending submission |
| POST | `/api/admin` | PIN `2026` | All admin mutations |

### Admin Actions (POST /api/admin)
`approve`, `reject`, `save`, `deleteScore`, `publish`, `updateMatchplayRound`, `resetMatchplay`, `clearScores`, `clearPending`, `importState`

---

## Environment Variables Required
```
DATABASE_URL=postgres://...neon.tech/...   ← Neon connection string
ADMIN_PIN=2026                              ← optional, defaults to '2026'
```

---

## Deployment Steps

### Step 1 — Push to GitHub
```bash
cd /Users/lewysanderson/Desktop/Projects/Badgers-Tour
git init   # if not already a repo
git add .
git commit -m "Add full-stack web app with Neon Postgres backend"
git remote add origin https://github.com/YOUR_USERNAME/badgers-tour.git
git push -u origin main
```

### Step 2 — Import to Vercel
1. Go to https://vercel.com/new
2. Import your GitHub repo
3. No framework preset needed — Vercel auto-detects `api/` + `index.html`
4. Click **Deploy** (will fail on first deploy — that's expected, DB not set up yet)

### Step 3 — Add Neon Postgres
1. In your Vercel project → **Storage** tab → **Create Database** → **Neon**
2. Follow prompts — Vercel auto-sets `DATABASE_URL` in all environments
3. No manual schema needed — `initDb()` auto-creates tables on first request

### Step 4 — Add ADMIN_PIN env var (optional)
1. Vercel project → **Settings** → **Environment Variables**
2. Add `ADMIN_PIN = 2026` for Production, Preview, Development

### Step 5 — Redeploy
Trigger a redeploy from the Vercel dashboard (or push a commit).
The app will be live at `https://your-project.vercel.app`.

### Step 6 — Local development
```bash
npm install
vercel env pull .env.local    # pulls DATABASE_URL from Vercel to local
vercel dev                     # runs the app locally with live functions
```

---

## Key Constants (do not change without updating server too)
```js
// index.html
const ADMIN_PIN = '2026';   // must match ADMIN_PIN env var on Vercel
```

## Backup file (`badgers-app.html`)
Original unmodified HTML — safe to restore from if needed.
