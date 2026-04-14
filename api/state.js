const { initDb, getState } = require('./_db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    await initDb();
    const state = await getState();
    // Cache for 5s — short enough for live score updates
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.json(state);
  } catch (err) {
    console.error('[state] GET error:', err);
    return res.status(500).json({ error: err.message });
  }
};
