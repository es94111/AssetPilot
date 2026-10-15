import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateStockHistory,
  clearStockHistoryCache,
  fetchStockHistory,
  getStockHistoryBucketKey,
  isValidStockHistoryDate,
  parseTpexHistoryResponse,
  parseTwseHistoryResponse,
  type StockHistoryCandle,
} from "../../lib/stockHistory.ts";

const twsePayload = {
  stat: "OK",
  data: [
    ["114/01/02", "1,200", "1,000", "100.00", "105.00", "99.00", "104.00"],
    ["114/01/03", "2,300", "2,000", "104.00", "106.00", "101.00", "102.00"],
  ],
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

test("parses TWSE and TPEx daily OHLC rows and ignores malformed data", () => {
  const candles = parseTwseHistoryResponse(twsePayload);
  assert.deepEqual(candles, [
    { date: "2025-01-02", open: 100, high: 105, low: 99, close: 104, volume: 1200 },
    { date: "2025-01-03", open: 104, high: 106, low: 101, close: 102, volume: 2300 },
  ]);
  const tpexCandles = parseTpexHistoryResponse({
    stat: "ok",
    tables: [{ data: [...twsePayload.data, ["invalid", "", "", "", "", "", ""]] }],
  });
  assert.deepEqual(tpexCandles.map((candle) => candle.date), candles.map((candle) => candle.date));
  assert.equal(tpexCandles[0].volume, 1_200_000);
  assert.deepEqual(parseTwseHistoryResponse({ stat: "NO DATA", data: twsePayload.data }), []);
  assert.equal(isValidStockHistoryDate("2024-02-29"), true);
  assert.equal(isValidStockHistoryDate("2025-02-29"), false);
});

test("fetches and caches TWSE month history before filtering to the requested dates", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return response(twsePayload);
  }) as typeof fetch;
  try {
    const first = await fetchStockHistory("2330", "2025-01-03", "2025-01-31");
    const second = await fetchStockHistory("2330", "2025-01-03", "2025-01-31");
    assert.deepEqual(first.map((candle) => candle.date), ["2025-01-03"]);
    assert.deepEqual(second, first);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("falls back to the TPEx monthly history endpoint for OTC stocks", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return urls.length === 1
      ? response({ stat: "NO DATA", data: [] })
      : response({ stat: "ok", tables: [{ data: [["114/01/02", "10", "10", "20", "22", "19", "21"]] }] });
  }) as typeof fetch;
  try {
    const candles = await fetchStockHistory("6488", "2025-01-01", "2025-01-31");
    assert.equal(candles.length, 1);
    assert.equal(candles[0].close, 21);
    assert.match(urls[1], /tpex\.org\.tw\/www\/zh-tw\/afterTrading\/tradingStock/);
    assert.match(urls[1], /date=2025%2F01%2F01/);
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("aggregates daily candles into weekly and monthly OHLC candles", () => {
  const candles: StockHistoryCandle[] = [
    { date: "2024-12-30", open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { date: "2025-01-02", open: 11, high: 14, low: 10, close: 13, volume: 150 },
    { date: "2025-01-06", open: 13, high: 15, low: 12, close: 14, volume: 200 },
  ];
  const weekly = aggregateStockHistory(candles, "week");
  assert.deepEqual(weekly, [
    { date: "2024-12-30", open: 10, high: 14, low: 9, close: 13, volume: 250 },
    { date: "2025-01-06", open: 13, high: 15, low: 12, close: 14, volume: 200 },
  ]);
  assert.deepEqual(aggregateStockHistory(candles, "month"), [
    { date: "2024-12", open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { date: "2025-01", open: 11, high: 15, low: 10, close: 14, volume: 350 },
  ]);
  assert.equal(getStockHistoryBucketKey("2025-01-02", "week"), "2024-12-30");
});

test("retries a throttled request instead of dropping the month", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1 ? new Response("", { status: 429 }) : response(twsePayload);
  }) as typeof fetch;
  try {
    const candles = await fetchStockHistory("1201", "2025-01-01", "2025-01-31");
    assert.equal(candles.length, 2);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("does not cache failed months so a later call refetches", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  let failing = true;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    if (failing) return new Response("", { status: 503 });
    return response(twsePayload);
  }) as typeof fetch;
  try {
    await assert.rejects(fetchStockHistory("1432", "2025-01-01", "2025-01-31"));
    failing = false;
    const before = calls;
    const candles = await fetchStockHistory("1432", "2025-01-01", "2025-01-31");
    assert.equal(candles.length, 2);
    assert.ok(calls > before);
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("keeps successful months when another month keeps failing", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes("20250201") || url.includes("2025%2F02%2F01")) {
      return new Response("", { status: 429 });
    }
    return response(twsePayload);
  }) as typeof fetch;
  try {
    const candles = await fetchStockHistory("3090", "2025-01-01", "2025-02-28");
    assert.deepEqual(candles.map((candle) => candle.date), ["2025-01-02", "2025-01-03"]);
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("throws when every month fails so callers can tell it from no data", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 429 })) as typeof fetch;
  try {
    await assert.rejects(fetchStockHistory("9958", "2025-01-01", "2025-01-31"));
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});

test("caps concurrent upstream requests across symbols", async () => {
  clearStockHistoryCache();
  const originalFetch = globalThis.fetch;
  let active = 0;
  let peak = 0;
  globalThis.fetch = (async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 10));
    active--;
    return response(twsePayload);
  }) as typeof fetch;
  try {
    const symbols = Array.from({ length: 12 }, (_, index) => `10${String(index).padStart(2, "0")}`);
    const results = await Promise.all(
      symbols.map((symbol) => fetchStockHistory(symbol, "2025-01-01", "2025-01-31")),
    );
    assert.ok(results.every((candles) => candles.length === 2));
    assert.ok(peak <= 4, `peak concurrency was ${peak}`);
  } finally {
    globalThis.fetch = originalFetch;
    clearStockHistoryCache();
  }
});
