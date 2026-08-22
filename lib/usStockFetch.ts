import { yahooSymbol } from "./stockMarket";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const QUOTE_CACHE_TTL_MS = 60 * 1000;
const DIVIDEND_CACHE_TTL_MS = 30 * 60 * 1000;

export interface UsStockQuote {
  found: boolean;
  symbol: string;
  name: string;
  closingPrice: number;
  priceSource: "yahoo";
  priceType: string;
  dataDate: string;
  dataTime: string;
}

export interface UsDividendEvent {
  date: string;
  amountPerShare: number;
}

const quoteCache = new Map<
  string,
  { value: UsStockQuote; expiresAt: number }
>();
const quoteInflight = new Map<string, Promise<UsStockQuote>>();
const dividendCache = new Map<
  string,
  { value: UsDividendEvent[]; expiresAt: number }
>();

function asFinitePositive(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function isoDateFromUnixSeconds(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function isoTimeFromUnixSeconds(value: unknown): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return new Date(seconds * 1000).toISOString();
}

export function parseYahooChartQuote(
  payload: unknown,
  requestedSymbol: string,
): UsStockQuote {
  const result = (payload as any)?.chart?.result?.[0];
  const meta = result?.meta || {};
  const quote = result?.indicators?.quote?.[0] || {};
  const closes = Array.isArray(quote.close) ? quote.close : [];
  const lastClose = [...closes]
    .reverse()
    .find((value) => asFinitePositive(value) > 0);
  const closingPrice =
    asFinitePositive(meta.regularMarketPrice) ||
    asFinitePositive(lastClose) ||
    asFinitePositive(meta.previousClose);
  const symbol = String(meta.symbol || requestedSymbol || "").toUpperCase();
  const marketTime =
    meta.regularMarketTime ||
    (Array.isArray(result?.timestamp) ? result.timestamp.at(-1) : 0);

  return {
    found: closingPrice > 0,
    symbol,
    name: String(meta.longName || meta.shortName || symbol),
    closingPrice,
    priceSource: "yahoo",
    priceType: "Yahoo Finance",
    dataDate: isoDateFromUnixSeconds(marketTime),
    dataTime: isoTimeFromUnixSeconds(marketTime),
  };
}

export function parseYahooSearchResult(
  payload: unknown,
  requestedSymbol: string,
): { symbol: string; name: string; stockType: string } | null {
  const wanted = yahooSymbol(requestedSymbol).toUpperCase();
  const quotes = Array.isArray((payload as any)?.quotes)
    ? (payload as any).quotes
    : [];
  const match = quotes.find(
    (quote: any) => String(quote?.symbol || "").toUpperCase() === wanted,
  );
  if (!match?.symbol) return null;
  const quoteType = String(match.quoteType || "").toUpperCase();
  return {
    symbol: String(match.symbol).toUpperCase(),
    name: String(
      match.longname ||
        match.longName ||
        match.shortname ||
        match.shortName ||
        match.symbol,
    ),
    stockType: quoteType === "ETF" ? "etf" : "stock",
  };
}

export function parseYahooHistoricalClose(payload: unknown): number {
  const quote = (payload as any)?.chart?.result?.[0]?.indicators?.quote?.[0];
  const closes = Array.isArray(quote?.close) ? quote.close : [];
  const lastClose = [...closes]
    .reverse()
    .find((value) => asFinitePositive(value) > 0);
  return asFinitePositive(lastClose);
}

export function parseYahooDividendEvents(payload: unknown): UsDividendEvent[] {
  const dividends = (payload as any)?.chart?.result?.[0]?.events?.dividends;
  if (!dividends || typeof dividends !== "object") return [];
  return Object.values(dividends)
    .map((event: any) => ({
      date: isoDateFromUnixSeconds(event?.date),
      amountPerShare: asFinitePositive(event?.amount),
    }))
    .filter((event) => Boolean(event.date) && event.amountPerShare > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "AssetPilot/stock-records",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
  return response.json();
}

export async function fetchUsQuote(symbol: string): Promise<UsStockQuote> {
  const normalized = yahooSymbol(symbol);
  const cached = quoteCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const pending = quoteInflight.get(normalized);
  if (pending) return pending;

  const request = (async () => {
    try {
      const payload = await fetchJson(
        `${YAHOO_CHART_URL}/${encodeURIComponent(normalized)}?range=1d&interval=1d&includePrePost=false&events=dividends`,
      );
      const quote = parseYahooChartQuote(payload, normalized);
      if (quote.found)
        quoteCache.set(normalized, {
          value: quote,
          expiresAt: Date.now() + QUOTE_CACHE_TTL_MS,
        });
      return quote;
    } finally {
      quoteInflight.delete(normalized);
    }
  })();
  quoteInflight.set(normalized, request);
  return request;
}

export async function fetchUsSymbolInfo(
  symbol: string,
): Promise<{ symbol: string; name: string; stockType: string } | null> {
  const normalized = yahooSymbol(symbol);
  const payload = await fetchJson(
    `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(normalized)}&quotesCount=10&newsCount=0`,
  );
  return parseYahooSearchResult(payload, normalized);
}

export async function fetchUsStockCloseOnDate(
  symbol: string,
  date: string,
): Promise<number> {
  const normalized = yahooSymbol(symbol);
  const start = Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
  const end = Math.floor(new Date(`${date}T23:59:59Z`).getTime() / 1000);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return 0;
  const payload = await fetchJson(
    `${YAHOO_CHART_URL}/${encodeURIComponent(normalized)}?period1=${start}&period2=${end}&interval=1d`,
  );
  return parseYahooHistoricalClose(payload);
}

export async function fetchUsDividends(
  symbol: string,
  startDate: string,
  endDate: string,
): Promise<UsDividendEvent[]> {
  const normalized = yahooSymbol(symbol);
  const key = `${normalized}:${startDate}:${endDate}`;
  const cached = dividendCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const start = Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000);
  const end = Math.floor(new Date(`${endDate}T23:59:59Z`).getTime() / 1000);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
    return [];

  const payload = await fetchJson(
    `${YAHOO_CHART_URL}/${encodeURIComponent(normalized)}?period1=${start}&period2=${end}&interval=1d&events=dividends`,
  );
  const events = parseYahooDividendEvents(payload);
  dividendCache.set(key, {
    value: events,
    expiresAt: Date.now() + DIVIDEND_CACHE_TTL_MS,
  });
  return events;
}
