// @ts-nocheck
// lib/stockPriceUpdater.ts — 伺服器排程：台股／美股交易時段內定時抓最新價，
// 跨使用者去重後寫回 stocks.current_price（只更新現價，不保留歷史）。
// 由 instrumentation.ts 的排程心跳每分鐘呼叫一次，內部自我節流與時段閘門。

import { getDB, queryAll, queryOne, saveDB } from "./db";
import {
  fetchTwseRealtime,
  fetchTwseStockDay,
  fetchTpexStockDay,
  fetchAllWithLimit,
} from "./twseFetchNext";
import * as userTime from "./userTime";
import { normalizeStockMarket } from "./stockMarket";
import { fetchUsQuote } from "./usStockFetch";

// 台股交易時段（台北時間）：週一~週五 09:00–14:00（涵蓋盤中即時 + 盤後收盤回填）
const TRADING_TZ = "Asia/Taipei";
const TRADING_START_MIN = 9 * 60; // 09:00
const TRADING_END_MIN = 14 * 60; // 14:00
const US_TRADING_TZ = "America/New_York";
const US_TRADING_START_MIN = 9 * 60 + 30;
const US_TRADING_END_MIN = 16 * 60;

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
  if (raw == null || raw === "") return null;
  return !["0", "false", "no", "off"].includes(
    String(raw).trim().toLowerCase(),
  );
}

function resolveIntervalMin(dbValue) {
  const envRaw = process.env.STOCK_AUTO_UPDATE_INTERVAL_MIN;
  if (envRaw != null && envRaw !== "")
    return clampInt(envRaw, 1, 1440, DEFAULT_INTERVAL_MIN);
  return clampInt(dbValue, 1, 1440, DEFAULT_INTERVAL_MIN);
}

function resolveConcurrency() {
  return clampInt(process.env.TWSE_MAX_CONCURRENCY, 1, 20, 5);
}

function isWithinMarketWindow(timeZone, startMin, endMin, now) {
  const p = userTime.partsInTz(timeZone, now);
  if (p.weekday < 1 || p.weekday > 5) return false; // 0=Sun, 6=Sat
  const minutes = p.hour * 60 + p.minute;
  return minutes >= startMin && minutes <= endMin;
}

// 是否落在台股或美股交易時段。
export function isWithinTradingWindow(now = Date.now()) {
  return (
    isWithinMarketWindow(TRADING_TZ, TRADING_START_MIN, TRADING_END_MIN, now) ||
    isWithinMarketWindow(
      US_TRADING_TZ,
      US_TRADING_START_MIN,
      US_TRADING_END_MIN,
      now,
    )
  );
}

function nowIso() {
  return new Date().toISOString();
}

function writeSummary(lastRun, summary) {
  const db = getDB();
  db.run(
    "UPDATE system_settings SET stock_auto_update_last_run = ?, stock_auto_update_last_summary = ? WHERE id = 1",
    [lastRun, String(summary || "").slice(0, 500)],
  );
  saveDB();
}

// 抓單一代號最新價：台股走 TWSE/TPEx，美股走 Yahoo Finance。
async function fetchSymbolPrice(symbol, todayYmd, market) {
  if (normalizeStockMarket(market) === "US") {
    const info = await fetchUsQuote(symbol);
    return info.found && info.closingPrice > 0
      ? { market: "US", symbol, ok: true, price: info.closingPrice }
      : { market: "US", symbol, ok: false };
  }
  let info = await fetchTwseRealtime(symbol);
  if (!info || !info.found || !(info.closingPrice > 0)) {
    info = await fetchTwseStockDay(symbol, todayYmd);
  }
  if (!info || !info.found || !(info.closingPrice > 0)) {
    info = await fetchTpexStockDay(symbol, todayYmd);
  }
  if (info && info.found && info.closingPrice > 0) {
    return { market: "TW", symbol, ok: true, price: info.closingPrice };
  }
  return { market: "TW", symbol, ok: false };
}

// 執行一次完整更新（去重代號 → 抓價 → 批次寫回所有使用者持股）。
// 不做時段 / 節流判斷，呼叫端（心跳）負責閘門；管理員手動觸發即直接呼叫此函式。
export async function runStockPriceUpdate(triggeredBy = "排程") {
  if (running) {
    return {
      status: "already_running",
      updatedSymbols: 0,
      updatedRows: 0,
      failed: 0,
    };
  }
  running = true;
  const startedAt = Date.now();
  try {
    // 跨使用者去重：同一市場的同一代號只抓一次，再寫回所有持有者。
    const rows = queryAll(
      "SELECT DISTINCT market, symbol FROM stocks WHERE COALESCE(delisted, 0) = 0 AND symbol IS NOT NULL AND symbol != ''",
    );
    const symbols = rows
      .map((r) => ({
        market: normalizeStockMarket(r.market),
        symbol: String(r.symbol).trim(),
      }))
      .filter((item) => item.symbol);

    if (symbols.length === 0) {
      writeSummary(startedAt, `${nowIso()} ${triggeredBy}：無持股可更新`);
      return {
        status: "completed",
        updatedSymbols: 0,
        updatedRows: 0,
        failed: 0,
      };
    }

    const today = new Date();
    const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

    const settled = await fetchAllWithLimit(
      symbols,
      (item) => fetchSymbolPrice(item.symbol, todayYmd, item.market),
      resolveConcurrency(),
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
        "UPDATE stocks SET current_price = ?, updated_at = ? WHERE market = ? AND symbol = ? AND COALESCE(delisted, 0) = 0",
        [result.price, startedAt, result.market, result.symbol],
      );
      okSymbols.push({ market: result.market, symbol: result.symbol });
    }
    saveDB();

    const updatedSymbols = okSymbols.length;
    let updatedRows = 0;
    if (okSymbols.length > 0) {
      const pairSql = okSymbols
        .map(() => "(market = ? AND symbol = ?)")
        .join(" OR ");
      const pairParams = okSymbols.flatMap((item) => [
        item.market,
        item.symbol,
      ]);
      const countRow = queryOne(
        `SELECT COUNT(*) AS n FROM stocks WHERE COALESCE(delisted, 0) = 0 AND (${pairSql})`,
        pairParams,
      );
      updatedRows = Number(countRow?.n) || 0;
    }

    const summary = `${nowIso()} ${triggeredBy}：更新 ${updatedSymbols}/${symbols.length} 檔（${updatedRows} 筆持股）${failed ? `，失敗 ${failed} 檔` : ""}（完成於 ${finishedAtIso}）`;
    writeSummary(startedAt, summary);

    return {
      status: "completed",
      updatedSymbols,
      updatedRows,
      failed,
      totalSymbols: symbols.length,
    };
  } catch (e) {
    writeSummary(
      startedAt,
      `${nowIso()} ${triggeredBy}：更新失敗 — ${e?.message || e}`,
    );
    return {
      status: "failed",
      updatedSymbols: 0,
      updatedRows: 0,
      failed: 0,
      reason: e?.message || String(e),
    };
  } finally {
    running = false;
  }
}

// 心跳入口：判斷啟用 / 時段 / 節流後決定是否執行
export async function checkAndRunStockPriceUpdate() {
  try {
    const row = queryOne(
      "SELECT stock_auto_update_enabled, stock_auto_update_interval_min, stock_auto_update_last_run FROM system_settings WHERE id = 1",
    );
    if (!row) return;

    const envEnabled = envEnabledOverride();
    const enabled =
      envEnabled == null ? row.stock_auto_update_enabled !== 0 : envEnabled;
    if (!enabled) return;

    const now = Date.now();
    if (!isWithinTradingWindow(now)) return;

    const intervalMs =
      resolveIntervalMin(row.stock_auto_update_interval_min) * 60 * 1000;
    const lastRun = Number(row.stock_auto_update_last_run) || 0;
    if (now - lastRun < intervalMs) return;

    await runStockPriceUpdate("排程");
  } catch (e) {
    console.error("[stock-price-update] check error", e);
  }
}
