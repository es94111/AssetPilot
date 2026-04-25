// 跨使用者共用匯率快取（server-only）。
// FR-023：5 分鐘 in-flight dedup + 30 分鐘 server cache。
// FR-024：API 失敗時 fallback 至最近成功快取（< 30 分鐘）→ 使用者手動輸入。

const Decimal = require('decimal.js');

const TTL_MS = 30 * 60 * 1000;        // 30 分鐘快取
const FETCH_TIMEOUT_MS = 2000;         // 單次外部 API 逾時
const RETRY_COUNT = 1;                 // 失敗重試 1 次

// 跨使用者共用記憶體 cache：currency → { rate, fetchedAt, source }
const cache = new Map();
// In-flight requests：currency → Promise（5 分鐘 dedup 由 cache 自行覆蓋）
const inFlight = new Map();

// 註冊 db 物件（由 server.js 啟動時注入；避免 lib 強依賴 sql.js 載入順序）
let _db = null;
function setDb(dbInstance) { _db = dbInstance; }
function getDb() { return _db; }

// 從 DB 暖機 cache（server 啟動時呼叫一次）
function primeFromDb() {
  if (!_db) return;
  try {
    const rows = _runQuery('SELECT currency, rate_to_twd, fetched_at, source FROM exchange_rates_global');
    for (const r of rows) {
      cache.set(r.currency, {
        rate: String(r.rate_to_twd),
        fetchedAt: Number(r.fetched_at),
        source: String(r.source || 'exchangerate-api'),
      });
    }
    console.log(`[fxCache] primed ${rows.length} currencies from DB`);
  } catch (e) {
    console.warn('[fxCache] primeFromDb failed:', e.message);
  }
}

function _runQuery(sql, params) {
  if (!_db) return [];
  const stmt = _db.prepare(sql);
  if (params) stmt.bind(params);
  const out = [];
  while (stmt.step()) out.push(stmt.getAsObject());
  stmt.free();
  return out;
}

function _runUpsert(currency, rate, fetchedAt, source) {
  if (!_db) return;
  // SQLite UPSERT 語法（PK currency）
  const stmt = _db.prepare(
    'INSERT INTO exchange_rates_global (currency, rate_to_twd, fetched_at, source) VALUES (?, ?, ?, ?) ' +
    'ON CONFLICT(currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, fetched_at = excluded.fetched_at, source = excluded.source'
  );
  stmt.bind([currency, String(rate), Number(fetchedAt), String(source)]);
  stmt.step();
  stmt.free();
}

// 取得匯率：先查 cache，命中且未過期 → 回傳；否則查 in-flight；都無 → fetchAndCache
async function getRate(currency) {
  const upper = String(currency || '').toUpperCase();
  if (upper === 'TWD') {
    return { currency: 'TWD', rate: '1', fetchedAt: Date.now(), source: 'identity', cached: true };
  }
  const now = Date.now();
  const hit = cache.get(upper);
  if (hit && (now - hit.fetchedAt) < TTL_MS) {
    return { currency: upper, rate: hit.rate, fetchedAt: hit.fetchedAt, source: hit.source, cached: true };
  }
  // In-flight dedup
  if (inFlight.has(upper)) {
    return await inFlight.get(upper);
  }
  const p = fetchAndCache(upper).finally(() => inFlight.delete(upper));
  inFlight.set(upper, p);
  return await p;
}

// 從外部 API 取匯率並寫入 cache + DB
async function fetchAndCache(currency) {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY || 'free';
  const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/TWD`;
  let lastErr = null;
  for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data && data.result === 'success' && data.conversion_rates && data.conversion_rates[currency]) {
        const rateToCurrency = data.conversion_rates[currency];
        // rate_to_twd = 1 / rate_to_currency；以 decimal 計算避免浮點誤差
        const rateToTwd = new Decimal(1).dividedBy(rateToCurrency).toFixed(8);
        const fetchedAt = Date.now();
        const source = 'exchangerate-api';
        cache.set(currency, { rate: rateToTwd, fetchedAt, source });
        try { _runUpsert(currency, rateToTwd, fetchedAt, source); } catch (e) { console.warn('[fxCache] DB upsert failed:', e.message); }
        return { currency, rate: rateToTwd, fetchedAt, source, cached: false };
      }
      throw new Error(`API response missing conversion_rates.${currency}`);
    } catch (e) {
      lastErr = e;
      if (attempt < RETRY_COUNT) continue;
    }
  }
  // Fallback：最近 30 分鐘成功的快取（FR-024）
  const stale = cache.get(currency);
  if (stale && (Date.now() - stale.fetchedAt) < TTL_MS) {
    return { currency, rate: stale.rate, fetchedAt: stale.fetchedAt, source: stale.source, cached: true, stale: true };
  }
  const err = new Error(`匯率暫不可用，請手動輸入：${lastErr ? lastErr.message : 'unknown'}`);
  err.code = 'RateUnavailable';
  err.cause = lastErr;
  throw err;
}

module.exports = {
  setDb,
  getDb,
  primeFromDb,
  getRate,
  fetchAndCache,
  // 便於測試／除錯
  _cache: cache,
  _inFlight: inFlight,
};
