// Lazy init — neon() must NOT be called at module scope.
// Calling it before DATABASE_URL is set crashes the process.
const { neon } = require('@neondatabase/serverless');

// ── DEFAULT STATE ─────────────────────────────────────────────
const DEFAULT_PAIRS = [
  { type: 'singles', shankers: ['Jack Turner'],          toppers: ['George Apel'],      result: null, margin: '' },
  { type: 'singles', shankers: ['George Colleran'],      toppers: ['Lewys Anderson'],   result: null, margin: '' },
  { type: 'singles', shankers: ['Craig Wilson'],         toppers: ['Ben Cowley'],       result: null, margin: '' },
  { type: 'singles', shankers: ['Jordan Leigh'],         toppers: ['Josh Hopkins'],     result: null, margin: '' },
  { type: 'singles', shankers: ['Rory Lindsay Brown'],   toppers: ['James Rickard'],    result: null, margin: '' },
  { type: 'singles', shankers: ['Peter Eaton'],          toppers: ['David Canavan'],    result: null, margin: '' }
];

const DEFAULT_MATCHPLAY = {
  1: { pairs: JSON.parse(JSON.stringify(DEFAULT_PAIRS)) },
  2: { pairs: JSON.parse(JSON.stringify(DEFAULT_PAIRS)) },
  3: { pairs: JSON.parse(JSON.stringify(DEFAULT_PAIRS)) }
};

// ── LAZY CONNECTION ───────────────────────────────────────────
function getSql() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return neon(process.env.DATABASE_URL);
}

// ── SCHEMA + SEED ─────────────────────────────────────────────
async function initDb() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS badgers_state (
      key        TEXT        PRIMARY KEY,
      value      JSONB       NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed defaults — silent no-op if rows already exist
  const defaults = [
    ['scores',    JSON.stringify({})],
    ['published', JSON.stringify({ '1': false, '2': false, '3': false })],
    ['pending',   JSON.stringify([])],
    ['matchplay', JSON.stringify(DEFAULT_MATCHPLAY)]
  ];

  for (const [key, valueJson] of defaults) {
    await sql`
      INSERT INTO badgers_state (key, value)
      VALUES (${key}, ${valueJson}::jsonb)
      ON CONFLICT (key) DO NOTHING
    `;
  }
}

// ── READ ALL ──────────────────────────────────────────────────
async function getState() {
  const sql = getSql();
  const rows = await sql`SELECT key, value FROM badgers_state`;
  const state = {};
  for (const row of rows) state[row.key] = row.value;
  return state;
}

// ── WRITE ONE KEY ─────────────────────────────────────────────
async function setKey(key, value) {
  const sql = getSql();
  const valueJson = JSON.stringify(value);
  await sql`
    INSERT INTO badgers_state (key, value, updated_at)
    VALUES (${key}, ${valueJson}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE
      SET value      = EXCLUDED.value,
          updated_at = NOW()
  `;
}

module.exports = { initDb, getState, setKey, DEFAULT_MATCHPLAY };
