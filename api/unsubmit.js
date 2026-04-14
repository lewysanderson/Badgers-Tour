// Public endpoint — allows a player to withdraw their pending submission.
const { initDb, getState, setKey } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { player, round } = req.body || {};

  if (!player || !round) {
    return res.status(400).json({ error: 'Missing required fields: player, round' });
  }

  try {
    await initDb();
    const state = await getState();
    let pending = Array.isArray(state.pending) ? state.pending : [];

    // Find and remove the pending submission for this player + round
    const idx = pending.findIndex(p => p.player === player && p.rnd === round);
    if (idx === -1) {
      return res.status(404).json({ error: 'No pending submission found' });
    }

    const removed = pending.splice(idx, 1)[0];
    await setKey('pending', pending);
    
    return res.json({ ok: true, removed });
  } catch (err) {
    console.error('[unsubmit] POST error:', err);
    return res.status(500).json({ error: err.message });
  }
};
