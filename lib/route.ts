// TWSE 查價共用 helper（006-stock-investments）。
// 後端使用：const { fetchWithRetry, chunk, fetchAllWithLimit, inferStockType } = require('./lib/twseFetch');
// 不引入新 npm 套件；以原生 fetch（Node 18+）+ setTimeout 實作指數退避重試與並發控制。
//
// FR-014 / 憲章 v1.3.0 Principle IV 例外：本檔涉及之 TWSE 開盤時間與股價節氣概念，
// 若日後加入「市場時段」邏輯，**永久鎖 Asia/Taipei**，與 users.timezone 無關。

'use strict';

// 指數退避重試：第 1 次失敗後等 1 秒，第 2 次失敗後等 2 秒；超過 retries 次仍失敗則拋出。
async function fetchWithRetry(url, options = {}, retries = 2) {
  const fetchFn = (typeof fetch !== 'undefined') ? fetch : null;
  if (!fetchFn) throw new Error('global fetch not available; require Node.js 18+');
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetchFn(url, options);
      if (!response.ok && response.status >= 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (e) {
      lastError = e;
      if (attempt < retries) {
        const delayMs = 1000 * Math.pow(2, attempt); // 1s, 2s
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError || new Error('fetchWithRetry failed without specific error');
}

// 將陣列分割為固定大小的 batch，純 JS。
function chunk(arr, size) {
  if (!Array.isArray(arr) || size <= 0) return [];
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// 並發查詢工具：將 items 依環境變數 TWSE_MAX_CONCURRENCY（預設 5）分批 Promise.all 執行 fetcher(item)。
// 每批內部失敗的 promise 會以 { ok: false, error } 回傳；不會中斷其他並發呼叫。
async function fetchAllWithLimit(items, fetcher) {
  const limit = Math.max(1, parseInt(process.env.TWSE_MAX_CONCURRENCY || '5', 10) || 5);
  const batches = chunk(items, limit);
  const results = [];
  for (const batch of batches) {
    const settled = await Promise.all(batch.map(async (item) => {
      try {
        const value = await fetcher(item);
        return { ok: true, item, value };
      } catch (e) {
        return { ok: false, item, error: e && e.message ? e.message : String(e) };
      }
    }));
    results.push(...settled);
  }
  return results;
}

// 由股票代號推斷類型（FR-001 / Pass 3 Q1）：
// - 0050、006208 等開頭為 00 的 4–5 碼 → ETF
// - 6 碼以上、或結尾為 ASCII 字母 → 權證
// - 其餘 → 一般股票
function inferStockType(symbol) {
  if (typeof symbol !== 'string') return 'stock';
  const s = symbol.trim().toUpperCase();
  if (!s) return 'stock';
  if (/^00\d{2,3}$/.test(s)) return 'etf';
  if (s.length >= 6 || /[A-Z]$/.test(s)) return 'warrant';
  return 'stock';
}

module.exports = {
  fetchWithRetry,
  chunk,
  fetchAllWithLimit,
  inferStockType,
};
