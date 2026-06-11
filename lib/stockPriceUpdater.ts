// @ts-nocheck
// lib/stockPriceUpdater.ts — 伺服器排程：台股交易時段內定時抓 TWSE/TPEx 最新價，
// 跨使用者去重後寫回 stocks.current_price（只更新現價，不保留歷史）。
// 由 instrumentation.ts 的排程心跳每分鐘呼叫一次，內部自我節流與時段閘門。

import { getDB, queryAll, queryOne, saveDB } from './db';
import {
  fetchTwseRealtime,
  fetchTwseStockDay,
  fetchTpexStockDay,
  fetchAllWithLimit,
} from './twseFetchNext';
import * as userTime from './userTime';

// 台股交易時段（台北時間）：週一~週五 09:00–14:00（涵蓋盤中即時 + 盤後收盤回填）
const TRADING_TZ = 'Asia/Taipei';
const TRADING_START_MIN = 9 * 60; // 09:00
const TRADING_END_MIN = 14 * 60; // 14:00

const DEFAULT_INTERVAL_MIN = 10;

// 同一時間僅允許一個更新任務（防心跳重入）
let running = false;

function clampInt(value, min, max, fallback) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 環境變數覆寫：未設定回 null（沿用 DB 設定）
function envEnabledOverride() {
  const raw = process.env.STOCK_AUTO_UPDATE_ENABLED;
  if (raw == null || raw === '') return null;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

function resolveIntervalMin(dbValue) {
  const envRaw = process.env.STOCK_AUTO_UPDATE_INTERVAL_MIN;
  if (envRaw != null && envRaw !== '') return clampInt(envRaw, 1, 1440, DEFAULT_INTERVAL_MIN);
  return clampInt(dbValue, 1, 1440, DEFAULT_INTERVAL_MIN);
}

function resolveConcurrency() {
  return clampInt(process.env.TWSE_MAX_CONCURRENCY, 1, 20, 5);
}

// 是否落在台股交易時段（週一~五 09:00–14:00 台北時間）
export function isWithinTradingWindow(now = Date.now()) {
  const p = userTime.partsInTz(TRADING_TZ, now);
  if (p.weekday < 1 || p.weekday > 5) return false; // 0=Sun, 6=Sat
  const minutes = p.hour * 60 + p.minute;
  return minutes >= TRADING_START_MIN && minutes <= TRADING_END_MIN;
}

function nowIso() {
  return new Date().toISOString();
}

function writeSummary(lastRun, summary) {
  const db = getDB();
  db.run(
    'UPDATE system_settings SET stock_auto_update_last_run = ?, stock_auto_update_last_summary = ? WHERE id = 1',
    [lastRun, String(summary || '').slice(0, 500)]
  );
  saveDB();
}

// 抓單一代號最新價：盤中即時 → 今日收盤 → 櫃買收盤（與 batch-fetch 同策略）
async function fetchSymbolPrice(symbol, todayYmd) {
  let info = await fetchTwseRealtime(symbol);
  if (!info || !info.found || !(info.closingPrice > 0)) {
    info = await fetchTwseStockDay(symbol, todayYmd);
  }
  if (!info || !info.found || !(info.closingPrice > 0)) {
    info = await fetchTpexStockDay(symbol, todayYmd);
  }
  if (info && info.found && info.closingPrice > 0) {
    return { symbol, ok: true, price: info.closingPrice };
  }
  return { symbol, ok: false };
}

// 執行一次完整更新（去重代號 → 抓價 → 批次寫回所有使用者持股）。
// 不做時段 / 節流判斷，呼叫端（心跳）負責閘門；管理員手動觸發即直接呼叫此函式。
export async function runStockPriceUpdate(triggeredBy = '排程') {
  if (running) {
    return { status: 'already_running', updatedSymbols: 0, updatedRows: 0, failed: 0 };
  }
  running = true;
  const startedAt = Date.now();
  try {
    // 跨使用者去重：同一代號（如 2330）只抓一次，再寫回所有持有者
    const rows = queryAll(
      "SELECT DISTINCT symbol FROM stocks WHERE COALESCE(delisted, 0) = 0 AND symbol IS NOT NULL AND symbol != ''"
    );
    const symbols = rows.map((r) => String(r.symbol).trim()).filter(Boolean);

    if (symbols.length === 0) {
      writeSummary(startedAt, `${nowIso()} ${triggeredBy}：無持股可更新`);
      return { status: 'completed', updatedSymbols: 0, updatedRows: 0, failed: 0 };
    }

    const today = new Date();
    const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    const settled = await fetchAllWithLimit(
      symbols,
      (symbol) => fetchSymbolPrice(symbol, todayYmd),
      resolveConcurrency()
    );

    const db = getDB();
    const finishedAtIso = nowIso();
    const okSymbols = [];
    let failed = 0;

    for (const r of settled) {
      const result = r.ok ? r.value : null;
      if (!result || !result.ok) {
        failed += 1;
        continue;
      }
      db.run(
        'UPDATE stocks SET current_price = ?, updated_at = ? WHERE symbol = ? AND COALESCE(delisted, 0) = 0',
        [result.price, startedAt, result.symbol]
      );
      okSymbols.push(result.symbol);
    }
    saveDB();

    const updatedSymbols = okSymbols.length;
    let updatedRows = 0;
    if (okSymbols.length > 0) {
      const placeholders = okSymbols.map(() => '?').join(',');
      const countRow = queryOne(
        `SELECT COUNT(*) AS n FROM stocks WHERE COALESCE(delisted, 0) = 0 AND symbol IN (${placeholders})`,
        okSymbols
      );
      updatedRows = Number(countRow?.n) || 0;
    }

    const summary = `${nowIso()} ${triggeredBy}：更新 ${updatedSymbols}/${symbols.length} 檔（${updatedRows} 筆持股）${failed ? `，失敗 ${failed} 檔` : ''}（完成於 ${finishedAtIso}）`;
    writeSummary(startedAt, summary);

    return { status: 'completed', updatedSymbols, updatedRows, failed, totalSymbols: symbols.length };
  } catch (e) {
    writeSummary(startedAt, `${nowIso()} ${triggeredBy}：更新失敗 — ${e?.message || e}`);
    return { status: 'failed', updatedSymbols: 0, updatedRows: 0, failed: 0, reason: e?.message || String(e) };
  } finally {
    running = false;
  }
}

// 心跳入口：判斷啟用 / 時段 / 節流後決定是否執行
export async function checkAndRunStockPriceUpdate() {
  try {
    const row = queryOne(
      'SELECT stock_auto_update_enabled, stock_auto_update_interval_min, stock_auto_update_last_run FROM system_settings WHERE id = 1'
    );
    if (!row) return;

    const envEnabled = envEnabledOverride();
    const enabled = envEnabled != null ? envEnabled : row.stock_auto_update_enabled !== 0;
    if (!enabled) return;

    const now = Date.now();
    if (!isWithinTradingWindow(now)) return;

    const intervalMs = resolveIntervalMin(row.stock_auto_update_interval_min) * 60 * 1000;
    const lastRun = Number(row.stock_auto_update_last_run) || 0;
    if (now - lastRun < intervalMs) return;

    await runStockPriceUpdate('排程');
  } catch (e) {
    console.error('[stock-price-update] check error', e);
  }
}
