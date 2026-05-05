'use strict';

const { getDB, queryAll, queryOne, saveDB } = require('./db');
const { getUserExchangeRateMap, getExchangeRateSettings, normalizeCurrency, parseCurrencyCode } = require('./accountHelpers');
const fxCache = require('./exchangeRateCache');

const FX_AUTO_SYNC_MIN_INTERVAL_MS = 30 * 60 * 1000;
const GLOBAL_FX_CACHE_TTL = 5 * 60 * 1000;
const SHARED_AUTO_RATE_TTL = 30 * 60 * 1000;

let globalFxCache = { data: null, timestamp: 0 };
let globalFxInflight = null;
const sharedAutoRateCache = new Map();

async function fetchGlobalRealtimeRates() {
  const now = Date.now();
  if (globalFxCache.data && (now - globalFxCache.timestamp) < GLOBAL_FX_CACHE_TTL) {
    return globalFxCache.data;
  }
  if (globalFxInflight) return globalFxInflight;

  globalFxInflight = (async () => {
    try {
      const apiKey = process.env.EXCHANGE_RATE_API_KEY || 'free';
      const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/TWD`;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      globalFxCache = { data, timestamp: Date.now() };
      return data;
    } catch (e) {
      console.warn('[fxGlobal] fetch failed:', e.message);
      return globalFxCache.data;
    } finally {
      globalFxInflight = null;
    }
  })();
  return globalFxInflight;
}

function resolveRateToTwd(globalData, currency) {
  if (!globalData || !globalData.conversion_rates) return 0;
  const rate = globalData.conversion_rates[currency];
  if (!rate || rate <= 0) return 0;
  return Math.round((1 / rate) * 1e8) / 1e8;
}

function setExchangeRateAutoUpdate(userId, autoUpdate) {
  const db = getDB();
  db.run(
    `INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at)
     VALUES (?, ?, COALESCE((SELECT last_synced_at FROM exchange_rate_settings WHERE user_id = ?), 0), ?)
     ON CONFLICT(user_id) DO UPDATE SET auto_update = excluded.auto_update, updated_at = excluded.updated_at`,
    [userId, autoUpdate ? 1 : 0, userId, Date.now()]
  );
  saveDB();
  return getExchangeRateSettings(userId);
}

async function syncExchangeRatesFromGlobalAPI(userId, requestedCurrencies = []) {
  const db = getDB();
  const existingMap = getUserExchangeRateMap(userId);
  const targets = new Set(['TWD']);
  Object.keys(existingMap).forEach(c => targets.add(c));
  requestedCurrencies.forEach(c => {
    const parsed = parseCurrencyCode(c);
    if (parsed) targets.add(parsed);
  });

  const now = Date.now();
  const needsApi = [...targets].filter(c => {
    if (c === 'TWD') return false;
    const hit = sharedAutoRateCache.get(c);
    return !hit || (now - hit.fetchedAt) >= SHARED_AUTO_RATE_TTL;
  });
  const globalData = needsApi.length > 0 ? await fetchGlobalRealtimeRates() : null;

  const updated = [];
  const unsupported = [];
  for (const currency of targets) {
    const c = normalizeCurrency(currency);
    if (c === 'TWD') {
      db.run(
        `INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual) VALUES (?, 'TWD', 1, ?, 0)
         ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = 1, updated_at = excluded.updated_at, is_manual = 0`,
        [userId, now]
      );
      continue;
    }
    const hit = sharedAutoRateCache.get(c);
    let rate;
    if (hit && (now - hit.fetchedAt) < SHARED_AUTO_RATE_TTL) {
      rate = hit.rate;
    } else {
      rate = resolveRateToTwd(globalData, c);
      if (rate > 0) sharedAutoRateCache.set(c, { rate, fetchedAt: now });
    }
    if (!(rate > 0)) { unsupported.push(c); continue; }
    db.run(
      `INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual) VALUES (?, ?, ?, ?, 0)
       ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, updated_at = excluded.updated_at, is_manual = 0`,
      [userId, c, rate, now]
    );
    updated.push({ currency: c, rateToTwd: rate });
  }

  db.run(
    `INSERT INTO exchange_rate_settings (user_id, auto_update, last_synced_at, updated_at)
     VALUES (?, COALESCE((SELECT auto_update FROM exchange_rate_settings WHERE user_id = ?), 0), ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET last_synced_at = excluded.last_synced_at, updated_at = excluded.updated_at`,
    [userId, userId, now, now]
  );
  saveDB();
  return { updatedAt: now, updatedRates: updated, unsupportedCurrencies: unsupported };
}

module.exports = { FX_AUTO_SYNC_MIN_INTERVAL_MS, setExchangeRateAutoUpdate, syncExchangeRatesFromGlobalAPI, fxCache };
