// Public endpoint — any player can submit a score for approval.
// Uses an atomic read-modify-write so concurrent submissions don't collide.
const { initDb, getState, setKey } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { player, round, holes, total, entered } = req.body || {};

  if (!player || !round || !Array.isArray(holes)) {
    return res.status(400).json({ error: 'Missing required fields: player, round, holes' });
  }

  try {
    await initDb();
    const state = await getState();
    const pending = Array.isArray(state.pending) ? state.pending : [];

    // Prevent duplicate pending submission for same player + round
    if (pending.some(p => p.player === player && p.rnd === round)) {
      return res.json({ ok: false, reason: 'Already pending' });
    }

    const id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    pending.push({
      id,
      player,
      rnd: round,
      holes,
      submittedAt: new Date().toISOString(),
      entered: entered ?? holes.filter(g => g > 0).length,
      total: total ?? 0
    });

    await setKey('pending', pending);
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('[submit] POST error:', err);
    return res.status(500).json({ error: err.message });
  }
};
