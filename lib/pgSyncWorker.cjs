const { parentPort } = require('node:worker_threads');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const pool = new Pool({ connectionString });
let txClient = null;

function writeResult(shared, payload) {
  const i32 = new Int32Array(shared, 0, 2);
  const bytes = new Uint8Array(shared, 8);
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8');
  if (encoded.length > bytes.length) {
    const fallback = Buffer.from(JSON.stringify({ ok: false, error: `PostgreSQL result too large (${encoded.length} bytes)` }), 'utf8');
    bytes.set(fallback.subarray(0, bytes.length));
    Atomics.store(i32, 1, Math.min(fallback.length, bytes.length));
  } else {
    bytes.fill(0, 0, Math.min(bytes.length, encoded.length + 16));
    bytes.set(encoded);
    Atomics.store(i32, 1, encoded.length);
  }
  Atomics.store(i32, 0, 1);
  Atomics.notify(i32, 0, 1);
}

async function runQuery(sql, params) {
  const normalized = sql.trim().replace(/;+\s*$/, '');
  const upper = normalized.toUpperCase();

  if (upper === 'BEGIN') {
    if (!txClient) {
      txClient = await pool.connect();
      await txClient.query('BEGIN');
    }
    return { rows: [], fields: [], rowCount: 0 };
  }
  if (upper === 'COMMIT') {
    if (txClient) {
      await txClient.query('COMMIT');
      txClient.release();
      txClient = null;
    }
    return { rows: [], fields: [], rowCount: 0 };
  }
  if (upper === 'ROLLBACK') {
    if (txClient) {
      await txClient.query('ROLLBACK');
      txClient.release();
      txClient = null;
    }
    return { rows: [], fields: [], rowCount: 0 };
  }

  const runner = txClient || pool;
  const result = await runner.query(normalized, params || []);
  return {
    rows: result.rows || [],
    fields: (result.fields || []).map((field) => field.name),
    rowCount: result.rowCount || 0,
  };
}

parentPort.on('message', async (message) => {
  try {
    const result = await runQuery(message.sql, message.params);
    writeResult(message.shared, { ok: true, result });
  } catch (error) {
    writeResult(message.shared, { ok: false, error: error && error.message ? error.message : String(error) });
  }
});
