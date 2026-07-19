const { parentPort } = require('node:worker_threads');
const { Pool, types } = require('pg');

// db.ts 的 translateDdlTypes 會把 schema 中所有 INTEGER 欄位（含 is_active、
// exclude_from_stats、needs_attention 等布林旗標）建成 PostgreSQL BIGINT，
// 避免時間戳欄位溢位 int4。但 node-postgres 對 BIGINT(OID 20) 預設回傳字串，
// 導致像 `!!row.exclude_from_stats` 這類寫法對字串 "0" 誤判為 true。
// 本專案所有 BIGINT 欄位（毫秒時間戳、0/1 旗標）都在安全整數範圍內，改回傳數字。
types.setTypeParser(20, (value) => parseInt(value, 10));

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
