// lib/twseFetchNext.ts — TWSE/TPEx fetch helpers for Next.js API routes.

const TWSE_REALTIME_CACHE_TTL = 10 * 1000; // 10s
const STOCK_DAY_CACHE_TTL = 5 * 60 * 1000; // 5 min
const TPEX_CACHE_TTL = 10 * 60 * 1000; // 10 min
const TWSE_ALL_CACHE_TTL = 10 * 60 * 1000; // 10 min

export interface StockInfo {
  found: boolean;
  symbol: string;
  name: string;
  closingPrice: number;
  isRealtime: boolean;
  priceType: string;
  priceSource: string;
  dataDate: string;
  dataTime: string;
  timestamp?: number;
  openingPrice?: number;
  highestPrice?: number;
  lowestPrice?: number;
}

export interface StockListItem {
  Code: string;
  Name: string;
  ClosingPrice?: string;
  OpeningPrice?: string;
  HighestPrice?: string;
  LowestPrice?: string;
  Change?: string;
  TradeVolume?: string;
  Date?: string;
  _source?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Module-level caches (survive across requests within same process)
const realtimeCache: Record<string, StockInfo & { timestamp: number }> = {};
let twseCache: { data: StockListItem[] | null; timestamp: number } = { data: null, timestamp: 0 };
let tpexCache: { data: StockListItem[] | null; timestamp: number } = { data: null, timestamp: 0 };
const stockDayCache: Record<string, CacheEntry<StockInfo>> = {};
const tpexDayCache: Record<string, CacheEntry<StockInfo>> = {};

function formatTwseDate(yyyymmdd: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}

export async function fetchTwseRealtime(symbol: string): Promise<(StockInfo & { timestamp: number }) | null> {
  const now = Date.now();
  const cached = realtimeCache[symbol];
  if (cached && (now - cached.timestamp) < TWSE_REALTIME_CACHE_TTL) return cached;

  for (const ex of ['tse', 'otc']) {
    try {
      const url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${ex}_${symbol}.tw&json=1&delay=0`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.twse.com.tw/' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.msgArray || data.msgArray.length === 0) continue;
      const info = data.msgArray[0];
      if (!info.c || info.c !== symbol) continue;
      const isRealtime = info.z && info.z !== '-';
      const price = isRealtime ? parseFloat(info.z) : parseFloat(info.y || '0');
      const rawDate = info.d || '';
      const dataDate = formatTwseDate(rawDate);
      const dataTime = (isRealtime && info.t) ? info.t.slice(0, 5) : '';
      const result = {
        found: true, symbol: info.c, name: info.n,
        closingPrice: price || 0, isRealtime,
        priceType: isRealtime ? '即時成交價' : '昨收價',
        priceSource: isRealtime ? 'realtime' : 't+1',
        dataDate, dataTime, timestamp: now,
      };
      realtimeCache[symbol] = result;
      return result;
    } catch (_) { /* try next exchange */ }
  }
  return null;
}

export async function fetchTwseStockDay(symbol: string, dateStr: string): Promise<StockInfo | null> {
  const cacheKey = `${symbol}_${dateStr}`;
  const now = Date.now();
  const cached = stockDayCache[cacheKey];
  if (cached && (now - cached.timestamp) < STOCK_DAY_CACHE_TTL) return cached.data;

  try {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${dateStr}&stockNo=${symbol}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.twse.com.tw/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.stat !== 'OK' || !json.data || json.data.length === 0) return null;

    const rocYear = parseInt(dateStr.slice(0, 4)) - 1911;
    const rocMonth = dateStr.slice(4, 6);
    const rocDay = dateStr.slice(6, 8);
    const targetRoc = `${rocYear}/${rocMonth}/${rocDay}`;
    let row = json.data.find((r: string[]) => r[0] === targetRoc);
    if (!row) row = json.data[json.data.length - 1];

    const parts = row[0].split('/');
    const adYear = parseInt(parts[0]) + 1911;
    const rowDate = `${adYear}/${parts[1]}/${parts[2]}`;
    const toN = (s: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;

    let stockName = symbol;
    const allCached = twseCache.data;
    if (allCached) {
      const found = allCached.find(s => s.Code === symbol);
      if (found) stockName = found.Name;
    }
    if (stockName === symbol && json.title) {
      const m = json.title.match(/\d{3}年\d{2}月\s+(.+?)\s+月份/) || json.title.match(/^(.+?)\s+月份/);
      if (m) stockName = m[1];
    }

    const result: StockInfo = {
      found: true, symbol, name: stockName,
      closingPrice: toN(row[6]), openingPrice: toN(row[3]),
      highestPrice: toN(row[4]), lowestPrice: toN(row[5]),
      isRealtime: false, priceType: '收盤價', priceSource: 'close',
      dataDate: rowDate, dataTime: '',
    };
    stockDayCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('STOCK_DAY API 錯誤:', (e as Error).message);
    return null;
  }
}

export async function fetchTpexStockDay(symbol: string, dateStr: string): Promise<StockInfo | null> {
  const cacheKey = `${symbol}_${dateStr}`;
  const now = Date.now();
  const cached = tpexDayCache[cacheKey];
  if (cached && (now - cached.timestamp) < STOCK_DAY_CACHE_TTL) return cached.data;

  try {
    const rocYear = parseInt(dateStr.slice(0, 4)) - 1911;
    const rocDate = `${rocYear}/${dateStr.slice(4, 6)}/${dateStr.slice(6, 8)}`;
    const url = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${encodeURIComponent(rocDate)}&stkno=${symbol}&_=${now}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.tpex.org.tw/' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.aaData || json.aaData.length === 0) return null;

    const row = json.aaData[json.aaData.length - 1];
    const toN = (s: string) => parseFloat((s || '0').replace(/,/g, '')) || 0;
    const parts = row[0].split('/');
    const adYear = parseInt(parts[0]) + 1911;
    const rowDate = `${adYear}/${parts[1]}/${parts[2]}`;

    const result: StockInfo = {
      found: true, symbol, name: json.stkName || symbol,
      closingPrice: toN(row[6]), openingPrice: toN(row[3]),
      highestPrice: toN(row[4]), lowestPrice: toN(row[5]),
      isRealtime: false, priceType: '收盤價（櫃買）', priceSource: 'close',
      dataDate: rowDate, dataTime: '',
    };
    tpexDayCache[cacheKey] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('TPEx STOCK_DAY API 錯誤:', (e as Error).message);
    return null;
  }
}

export async function fetchTpexStockAll(): Promise<StockListItem[]> {
  const now = Date.now();
  if (tpexCache.data && (now - tpexCache.timestamp) < TPEX_CACHE_TTL) return tpexCache.data;
  try {
    const res = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return tpexCache.data || [];
    const raw = await res.json();
    const data: StockListItem[] = raw.map((r: Record<string, string>) => ({
      Code: r.SecuritiesCompanyCode, Name: r.CompanyName,
      ClosingPrice: r.Close, OpeningPrice: r.Open,
      HighestPrice: r.High, LowestPrice: r.Low,
      Change: r.Change, TradeVolume: r.TradeVolume, Date: r.Date,
      _source: 'tpex',
    }));
    tpexCache = { data, timestamp: now };
    return data;
  } catch (e) {
    console.error('TPEx ALL API 錯誤:', (e as Error).message);
    return tpexCache.data || [];
  }
}

export async function fetchTwseStockAll(): Promise<StockListItem[]> {
  const now = Date.now();
  if (twseCache.data && (now - twseCache.timestamp) < TWSE_ALL_CACHE_TTL) return twseCache.data;
  try {
    const [twseRes, tpexData] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetchTpexStockAll(),
    ]);
    if (!twseRes.ok) throw new Error('TWSE API 回應錯誤');
    const twseData: StockListItem[] = await twseRes.json();
    const merged = [...twseData, ...tpexData];
    twseCache = { data: merged, timestamp: now };
    return merged;
  } catch (e) {
    console.error('TWSE API 錯誤:', (e as Error).message);
    return twseCache.data || [];
  }
}

/** Infer stock type from symbol */
export function inferStockType(symbol: string): 'etf' | 'warrant' | 'stock' {
  const s = String(symbol || '').trim();
  // ETF: 00xxx or 006xxx style (4-6 digits starting with 0)
  if (/^00\d{2,4}[A-Z]?$/.test(s)) return 'etf';
  // Warrants: 7-8 chars
  if (/^[A-Z0-9]{7,8}$/.test(s)) return 'warrant';
  return 'stock';
}

export interface FetchAllResult<TItem, TValue = unknown> {
  ok: boolean;
  value?: TValue;
  error?: string;
  item: TItem;
}

/** Fetch all stocks with concurrency limit */
export async function fetchAllWithLimit<TItem, TValue = unknown>(
  items: TItem[],
  fetcher: (item: TItem) => Promise<TValue>,
  concurrency = 5
): Promise<FetchAllResult<TItem, TValue>[]> {
  const results: FetchAllResult<TItem, TValue>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(item => fetcher(item)));
    settled.forEach((r, idx) => {
      if (r.status === 'fulfilled') results.push({ ok: true, value: r.value, item: batch[idx] });
      else results.push({ ok: false, error: (r.reason as Error)?.message || String(r.reason), item: batch[idx] });
    });
  }
  return results;
}
