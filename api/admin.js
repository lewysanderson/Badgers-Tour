// Admin-only endpoint. All mutations go through here with PIN check.
const { initDb, getState, setKey, DEFAULT_MATCHPLAY } = require('./_db');

const ADMIN_PIN = process.env.ADMIN_PIN || '2026';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pin, action, ...params } = req.body || {};

  if (!pin || pin !== ADMIN_PIN) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }
  if (!action) {
    return res.status(400).json({ error: 'Missing action' });
  }

  try {
    await initDb();
    const state = await getState();

    let scores    = state.scores    || {};
    let published = state.published || { '1': false, '2': false, '3': false };
    let pending   = Array.isArray(state.pending) ? state.pending : [];
    let matchplay = state.matchplay || JSON.parse(JSON.stringify(DEFAULT_MATCHPLAY));

    switch (action) {

      // ── SCORE APPROVAL ───────────────────────────────────────
      case 'approve': {
        const idx = pending.findIndex(p => p.id === params.id);
        if (idx === -1) return res.status(404).json({ error: 'Pending item not found' });
        const item = pending[idx];
        if (!scores[item.player]) scores[item.player] = {};
        scores[item.player][item.rnd] = item.holes;
        pending.splice(idx, 1);
        await setKey('scores', scores);
        await setKey('pending', pending);
        return res.json({ ok: true, state: { scores, pending } });
      }

      case 'reject': {
        const idx = pending.findIndex(p => p.id === params.id);
        if (idx === -1) return res.status(404).json({ error: 'Pending item not found' });
        pending.splice(idx, 1);
        await setKey('pending', pending);
        return res.json({ ok: true, state: { pending } });
      }

      // ── DIRECT SAVE (admin bypass) ───────────────────────────
      case 'save': {
        const { player, round, holes } = params;
        if (!player || !round || !Array.isArray(holes)) {
          return res.status(400).json({ error: 'Missing player, round, or holes' });
        }
        if (!scores[player]) scores[player] = {};
        scores[player][round] = holes;
        await setKey('scores', scores);
        return res.json({ ok: true, state: { scores } });
      }

      // ── DELETE SCORE ─────────────────────────────────────────
      case 'deleteScore': {
        const { player, round } = params;
        if (!player || !round) {
          return res.status(400).json({ error: 'Missing player or round' });
        }
        if (scores[player] && scores[player][round]) {
          delete scores[player][round];
          // Clean up empty player objects
          if (Object.keys(scores[player]).length === 0) {
            delete scores[player];
          }
          await setKey('scores', scores);
          return res.json({ ok: true, state: { scores } });
        }
        return res.status(404).json({ error: 'Score not found' });
      }

      // ── PUBLISH ──────────────────────────────────────────────
      case 'publish': {
        const { round } = params;
        if (!round) return res.status(400).json({ error: 'Missing round' });
        published[round] = !published[round];
        await setKey('published', published);
        return res.json({ ok: true, state: { published } });
      }

      // ── MATCHPLAY ─────────────────────────────────────────────
      case 'updateMatchplayRound': {
        const { round, pairs } = params;
        if (!round || !Array.isArray(pairs)) {
          return res.status(400).json({ error: 'Missing round or pairs' });
        }
        if (!matchplay[round]) matchplay[round] = {};
        matchplay[round].pairs = pairs;
        await setKey('matchplay', matchplay);
        return res.json({ ok: true, state: { matchplay } });
      }

      case 'resetMatchplay': {
        matchplay = JSON.parse(JSON.stringify(DEFAULT_MATCHPLAY));
        await setKey('matchplay', matchplay);
        return res.json({ ok: true, state: { matchplay } });
      }

      // ── DATA MANAGEMENT ──────────────────────────────────────
      case 'clearScores': {
        scores    = {};
        published = { '1': false, '2': false, '3': false };
        await setKey('scores', scores);
        await setKey('published', published);
        return res.json({ ok: true, state: { scores, published } });
      }

      case 'clearPending': {
        pending = [];
        await setKey('pending', pending);
        return res.json({ ok: true, state: { pending } });
      }

      // ── IMPORT (full state restore) ───────────────────────────
      case 'importState': {
        const updates = [];
        if (params.scores    !== undefined) { scores    = params.scores;    updates.push(setKey('scores',    scores));    }
        if (params.published !== undefined) { published = params.published; updates.push(setKey('published', published)); }
        if (params.pending   !== undefined) { pending   = params.pending;   updates.push(setKey('pending',   pending));   }
        if (params.matchplay !== undefined) { matchplay = params.matchplay; updates.push(setKey('matchplay', matchplay)); }
        await Promise.all(updates);
        return res.json({ ok: true });
      }

      default:
        return res.status(400).json({ error: `Unknown action: ${action}` });
    }

  } catch (err) {
    console.error(`[admin] ${action} error:`, err);
    return res.status(500).json({ error: err.message });
  }
};
