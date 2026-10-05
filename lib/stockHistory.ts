export interface StockHistoryCandle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockHistoryTrade {
  id: string;
  date: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
}

interface CachedMonth {
  candles: StockHistoryCandle[];
  expiresAt: number;
}

const TPEX_TRADING_LOT_SIZE = 1000;
const HISTORY_TTL_MS = 6 * 60 * 60 * 1000;
const CURRENT_MONTH_TTL_MS = 5 * 60 * 1000;
const monthCache = new Map<string, CachedMonth>();
const inFlightMonths = new Map<string, Promise<StockHistoryCandle[]>>();

function toNumber(value: unknown): number {
  const parsed = Number.parseFloat(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseRocDate(value: unknown): string | null {
  const match = String(value ?? "").trim().match(/^(\d{2,3})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]) + 1911;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRows(rows: unknown, volumeMultiplier = 1): StockHistoryCandle[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row: unknown) => {
    if (!Array.isArray(row) || row.length < 7) return [];
    const date = parseRocDate(row[0]);
    const open = toNumber(row[3]);
    const high = toNumber(row[4]);
    const low = toNumber(row[5]);
    const close = toNumber(row[6]);
    if (!date || open <= 0 || high <= 0 || low <= 0 || close <= 0) return [];
    return [{ date, open, high, low, close, volume: toNumber(row[1]) * volumeMultiplier }];
  });
}

export function parseTwseHistoryResponse(payload: unknown): StockHistoryCandle[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { stat?: string; data?: unknown };
  return body.stat === "OK" ? parseRows(body.data) : [];
}

export function parseTpexHistoryResponse(payload: unknown): StockHistoryCandle[] {
  if (!payload || typeof payload !== "object") return [];
  const body = payload as { stat?: string; tables?: Array<{ data?: unknown }> };
  if (body.stat !== "ok" || !Array.isArray(body.tables)) return [];
  return body.tables.flatMap((table) => parseRows(table?.data, TPEX_TRADING_LOT_SIZE));
}

export function isValidStockHistoryDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

async function getJson(url: string, referer: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Referer: referer },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Historical price service returned ${response.status}`);
  return response.json();
}

async function fetchMonthFromTwse(symbol: string, month: string): Promise<StockHistoryCandle[]> {
  const date = `${month.replace("-", "")}01`;
  const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${encodeURIComponent(symbol)}`;
  return parseTwseHistoryResponse(await getJson(url, "https://www.twse.com.tw/"));
}

async function fetchMonthFromTpex(symbol: string, month: string): Promise<StockHistoryCandle[]> {
  const [year, monthNumber] = month.split("-");
  const date = `${year}/${monthNumber}/01`;
  const url = new URL("https://www.tpex.org.tw/www/zh-tw/afterTrading/tradingStock");
  url.searchParams.set("code", symbol);
  url.searchParams.set("date", date);
  return parseTpexHistoryResponse(await getJson(url.toString(), "https://www.tpex.org.tw/"));
}

async function fetchMonth(symbol: string, month: string): Promise<StockHistoryCandle[]> {
  const cacheKey = `${symbol.toUpperCase()}:${month}`;
  const now = Date.now();
  const cached = monthCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.candles;
  const pending = inFlightMonths.get(cacheKey);
  if (pending) return pending;

  const request = (async () => {
    let twseError: unknown;
    try {
      const twseRows = await fetchMonthFromTwse(symbol, month);
      if (twseRows.length > 0) return twseRows;
    } catch (error) {
      twseError = error;
    }

    try {
      return await fetchMonthFromTpex(symbol, month);
    } catch (tpexError) {
      if (twseError) {
        throw new Error(
          `TWSE and TPEx historical price requests failed: ${String(twseError)}; ${String(tpexError)}`,
        );
      }
      throw tpexError;
    }
  })();

  inFlightMonths.set(cacheKey, request);
  try {
    const candles = await request;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const ttl = month === currentMonth ? CURRENT_MONTH_TTL_MS : HISTORY_TTL_MS;
    monthCache.set(cacheKey, { candles, expiresAt: Date.now() + ttl });
    return candles;
  } finally {
    inFlightMonths.delete(cacheKey);
  }
}

function monthRange(from: string, to: string): string[] {
  const [startYear, startMonth] = from.split("-").map(Number);
  const [endYear, endMonth] = to.split("-").map(Number);
  const months: string[] = [];
  for (let year = startYear, month = startMonth; year < endYear || (year === endYear && month <= endMonth);) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
  }
  return months;
}

export async function fetchStockHistory(
  symbol: string,
  from: string,
  to: string,
): Promise<StockHistoryCandle[]> {
  const months = monthRange(from, to);
  const collected: StockHistoryCandle[] = [];
  const concurrency = 3;
  for (let index = 0; index < months.length; index += concurrency) {
    const batch = months.slice(index, index + concurrency);
    const results = await Promise.all(batch.map((month) => fetchMonth(symbol, month)));
    collected.push(...results.flat());
  }

  const byDate = new Map<string, StockHistoryCandle>();
  for (const candle of collected) {
    if (candle.date >= from && candle.date <= to) byDate.set(candle.date, candle);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export type StockHistoryInterval = "day" | "week" | "month";

export function getStockHistoryBucketKey(date: string, interval: StockHistoryInterval): string {
  if (interval === "day") return date;
  if (interval === "month") return date.slice(0, 7);

  const [year, month, day] = date.split("-").map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  const weekday = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - weekday + 1);
  return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(2, "0")}`;
}

export function aggregateStockHistory(
  candles: StockHistoryCandle[],
  interval: StockHistoryInterval,
): StockHistoryCandle[] {
  if (interval === "day") return candles;
  const grouped = new Map<string, StockHistoryCandle>();
  for (const candle of candles) {
    const key = getStockHistoryBucketKey(candle.date, interval);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...candle, date: key });
      continue;
    }
    existing.date = key;
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
    existing.volume += candle.volume;
  }
  return Array.from(grouped.values());
}

export function clearStockHistoryCache(): void {
  monthCache.clear();
  inFlightMonths.clear();
}
