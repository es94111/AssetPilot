// @ts-nocheck
import { getDB, queryAll, queryOne, saveDB } from "./db";
import { uid } from "./userDefaults";
import { todayInUserTz } from "./userTime";
import { getStockSettings, calcStockFee } from "./stockHelpers";
import { fetchTwseStockDay, fetchTpexStockDay } from "./twseFetchNext";
import {
  calculateStockSharesForAmount,
  isValidStockShareQuantity,
  normalizeStockMarket,
} from "./stockMarket";
import { fetchUsStockCloseOnDate } from "./usStockFetch";

export interface StockRecurringResult {
  generated: number;
  skipped: number;
  postponed: number;
}

export interface StockRecurringOptions {
  userTimezone?: string;
}

export function getNextStockRecurringDate(
  prevIsoDate: string,
  freq: string,
): string | null {
  const m = String(prevIsoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (freq === "daily") {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === "weekly") {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === "monthly") {
    let nm = mo + 1;
    let ny = y;
    if (nm > 12) {
      nm = 1;
      ny++;
    }
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  if (freq === "yearly") {
    const ny = y + 1;
    if (mo === 2 && d === 29) {
      const isLeap = (ny % 4 === 0 && ny % 100 !== 0) || ny % 400 === 0;
      return `${ny}-02-${isLeap ? "29" : "28"}`;
    }
    return `${ny}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

const twseHolidayCache = { set: null, timestamp: 0, lastFailedAt: 0 };
const TWSE_HOLIDAY_CACHE_TTL = 24 * 60 * 60 * 1000;
const TWSE_HOLIDAY_FAILURE_BACKOFF = 5 * 60 * 1000;
let twseHolidayInflight = null;

async function fetchTwseHolidaySet(): Promise<Set<string>> {
  const now = Date.now();
  if (
    twseHolidayCache.set &&
    now - twseHolidayCache.timestamp < TWSE_HOLIDAY_CACHE_TTL
  ) {
    return twseHolidayCache.set;
  }
  if (now - twseHolidayCache.lastFailedAt < TWSE_HOLIDAY_FAILURE_BACKOFF) {
    return twseHolidayCache.set || new Set();
  }
  if (twseHolidayInflight) return twseHolidayInflight;
  twseHolidayInflight = (async () => {
    try {
      const res = await fetch(
        "https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule",
        {
          headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!res.ok) {
        twseHolidayCache.lastFailedAt = Date.now();
        return twseHolidayCache.set || new Set();
      }
      const list = await res.json();
      const set = new Set<string>();
      list.forEach((item) => {
        if (/開始交易|最後交易/.test(item.Name || "")) return;
        const rocDate = String(item.Date || "");
        if (!/^\d{7}$/.test(rocDate)) return;
        const y = parseInt(rocDate.slice(0, 3), 10) + 1911;
        set.add(`${y}-${rocDate.slice(3, 5)}-${rocDate.slice(5, 7)}`);
      });
      twseHolidayCache.set = set;
      twseHolidayCache.timestamp = Date.now();
      twseHolidayCache.lastFailedAt = 0;
      return set;
    } catch (_) {
      twseHolidayCache.lastFailedAt = Date.now();
      return twseHolidayCache.set || new Set();
    } finally {
      twseHolidayInflight = null;
    }
  })();
  return twseHolidayInflight;
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nthWeekday(
  year: number,
  month: number,
  weekday: number,
  occurrence: number,
): string {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const day =
    1 + ((weekday - first.getUTCDay() + 7) % 7) + (occurrence - 1) * 7;
  return isoDate(year, month, day);
}

function lastWeekday(year: number, month: number, weekday: number): string {
  const last = new Date(Date.UTC(year, month, 0));
  const day = last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7);
  return isoDate(year, month, day);
}

function observedFixedDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay();
  if (weekday === 6) date.setUTCDate(day - 1);
  if (weekday === 0) date.setUTCDate(day + 1);
  return date.toISOString().slice(0, 10);
}

function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function usMarketHolidays(year: number): Set<string> {
  const easter = easterDate(year);
  easter.setUTCDate(easter.getUTCDate() - 2);
  return new Set([
    observedFixedDate(year, 1, 1),
    observedFixedDate(year + 1, 1, 1),
    nthWeekday(year, 1, 1, 3),
    nthWeekday(year, 2, 1, 3),
    easter.toISOString().slice(0, 10),
    lastWeekday(year, 5, 1),
    observedFixedDate(year, 6, 19),
    observedFixedDate(year, 7, 4),
    nthWeekday(year, 9, 1, 1),
    nthWeekday(year, 11, 4, 4),
    observedFixedDate(year, 12, 25),
  ]);
}

function nextUsTradingDay(dateStr: string): string {
  let cur = dateStr;
  let safety = 15;
  while (safety-- > 0) {
    const [y, m, d] = cur.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6 && !usMarketHolidays(y).has(cur)) break;
    const nx = new Date(Date.UTC(y, m - 1, d + 1));
    cur = nx.toISOString().slice(0, 10);
  }
  return cur;
}

function nextTwseTradingDay(dateStr: string, holidaySet: Set<string>): string {
  let cur = dateStr;
  let safety = 60;
  while (safety-- > 0) {
    const [y, m, d] = cur.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6 && !(holidaySet && holidaySet.has(cur))) break;
    const nx = new Date(Date.UTC(y, m - 1, d + 1));
    cur = nx.toISOString().slice(0, 10);
  }
  return cur;
}

async function resolveStockPrice(
  userId: string,
  stockId: string,
  actualDate: string,
): Promise<number> {
  const stockRow = queryOne(
    "SELECT id, symbol, market, current_price FROM stocks WHERE id = ? AND user_id = ?",
    [stockId, userId],
  );
  if (!stockRow?.symbol) return 0;

  if (normalizeStockMarket(stockRow.market) === "US") {
    const historicalPrice = await fetchUsStockCloseOnDate(
      String(stockRow.symbol),
      actualDate,
    );
    return historicalPrice > 0
      ? historicalPrice
      : Number(stockRow.current_price || 0);
  }

  const ymd = String(actualDate).replace(/-/g, "");
  let info = await fetchTwseStockDay(stockRow.symbol, ymd);
  if (!info?.found || !(info.closingPrice > 0)) {
    info = await fetchTpexStockDay(stockRow.symbol, ymd);
  }
  return info?.found && info.closingPrice > 0
    ? Number(info.closingPrice)
    : Number(stockRow.current_price || 0);
}

export async function processStockRecurringForUser(
  userId: string,
  opts: StockRecurringOptions = {},
): Promise<StockRecurringResult> {
  const recs = queryAll(
    "SELECT * FROM stock_recurring WHERE user_id = ? AND is_active = 1",
    [userId],
  );
  if (recs.length === 0) return { generated: 0, skipped: 0, postponed: 0 };

  const settings = getStockSettings(userId);
  const todayS = todayInUserTz(opts.userTimezone || "Asia/Taipei");
  const holidaySet = await fetchTwseHolidaySet();
  const db = getDB();
  const now = Date.now();
  let generated = 0;
  let skipped = 0;
  let postponed = 0;
  let touched = false;

  for (const r of recs) {
    const frequency = String(r.frequency || r.freq || "");
    const startDate = String(r.start_date || r.next_date || "");
    const recurringAmount =
      Number(r.amount) > 0
        ? Number(r.amount)
        : Number(r.shares || 0) * Number(r.price || 0);
    let scheduledDate = r.last_generated
      ? getNextStockRecurringDate(r.last_generated, frequency)
      : startDate;

    while (scheduledDate && scheduledDate <= todayS) {
      const stock = queryOne(
        "SELECT market FROM stocks WHERE id = ? AND user_id = ?",
        [r.stock_id, userId],
      );
      const market = normalizeStockMarket(stock?.market);
      const actualDate =
        market === "US"
          ? nextUsTradingDay(scheduledDate)
          : nextTwseTradingDay(scheduledDate, holidaySet);
      if (actualDate > todayS) break;
      if (actualDate !== scheduledDate) postponed++;

      let price = 0;
      try {
        price = await resolveStockPrice(userId, r.stock_id, actualDate);
      } catch (e) {
        console.warn("[stock-recurring] price query failed", {
          recurringId: r.id,
          actualDate,
          error: e?.message || String(e),
        });
      }

      if (!(price > 0)) {
        skipped++;
        break;
      }

      const shares = calculateStockSharesForAmount(
        recurringAmount,
        price,
        market,
      );
      if (!isValidStockShareQuantity(shares, market)) {
        db.run(
          "UPDATE stock_recurring SET last_generated = ?, updated_at = ? WHERE id = ?",
          [scheduledDate, now, r.id],
        );
        touched = true;
        skipped++;
        scheduledDate = getNextStockRecurringDate(scheduledDate, frequency);
        continue;
      }

      const amount = shares * price;
      const fee = calcStockFee(amount, shares, settings, market);
      const noteParts = [r.note || "", "定期定額自動"];
      if (actualDate !== scheduledDate)
        noteParts.push(`原排程 ${scheduledDate} 順延`);
      try {
        db.run(
          "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,recurring_plan_id,period_start_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING",
          [
            uid(),
            userId,
            r.stock_id,
            actualDate,
            "buy",
            shares,
            price,
            fee,
            0,
            r.account_id || "",
            noteParts.filter(Boolean).join(" | "),
            now,
            1,
            r.id,
            scheduledDate,
          ],
        );
        if (db.getRowsModified() > 0) generated++;
        else skipped++;
      } catch (e) {
        console.warn(
          "[stock-recurring] INSERT failed:",
          e?.message || String(e),
        );
        skipped++;
      }

      db.run(
        "UPDATE stock_recurring SET last_generated = ?, updated_at = ? WHERE id = ?",
        [scheduledDate, now, r.id],
      );
      touched = true;
      scheduledDate = getNextStockRecurringDate(scheduledDate, frequency);
    }
  }

  if (touched) saveDB();
  return { generated, skipped, postponed };
}
