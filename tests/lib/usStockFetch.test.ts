import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidStockSymbol,
  normalizeStockMarket,
  normalizeStockSymbol,
  stockCurrency,
} from "../../lib/stockMarket.ts";
import {
  parseYahooChartQuote,
  parseYahooDividendEvents,
  parseYahooSearchResult,
} from "../../lib/usStockFetch.ts";
import {
  calcStockFee,
  calcStockTax,
  DEFAULT_STOCK_SETTINGS,
} from "../../lib/stockHelpers.ts";

test("stock markets normalize independently and keep US symbols distinct", () => {
  assert.equal(normalizeStockMarket("us"), "US");
  assert.equal(normalizeStockMarket("anything"), "TW");
  assert.equal(stockCurrency("US"), "USD");
  assert.equal(stockCurrency("TW"), "TWD");
  assert.equal(normalizeStockSymbol(" brk.b ", "US"), "BRK.B");
  assert.equal(isValidStockSymbol("BRK.B", "US"), true);
  assert.equal(isValidStockSymbol("2330", "TW"), true);
  assert.equal(isValidStockSymbol("BRK/B", "US"), false);
});

test("Yahoo chart quote parser uses regular market price and falls back to the last close", () => {
  const quote = parseYahooChartQuote(
    {
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              regularMarketPrice: 212.34,
              regularMarketTime: 1_754_000_000,
            },
            timestamp: [1_754_000_000],
            indicators: { quote: [{ close: [211.2, 212.34] }] },
          },
        ],
      },
    },
    "AAPL",
  );
  assert.equal(quote.found, true);
  assert.equal(quote.symbol, "AAPL");
  assert.equal(quote.closingPrice, 212.34);

  const fallback = parseYahooChartQuote(
    {
      chart: {
        result: [
          {
            meta: { symbol: "MSFT" },
            indicators: { quote: [{ close: [0, 401.5] }] },
          },
        ],
      },
    },
    "MSFT",
  );
  assert.equal(fallback.closingPrice, 401.5);
});

test("Yahoo search and dividend event parsers return stable normalized records", () => {
  const info = parseYahooSearchResult(
    {
      quotes: [{ symbol: "AAPL", longname: "Apple Inc.", quoteType: "EQUITY" }],
    },
    "AAPL",
  );
  assert.deepEqual(info, {
    symbol: "AAPL",
    name: "Apple Inc.",
    stockType: "stock",
  });
  const etf = parseYahooSearchResult(
    {
      quotes: [
        { symbol: "VOO", shortname: "Vanguard S&P 500 ETF", quoteType: "ETF" },
      ],
    },
    "VOO",
  );
  assert.equal(etf?.stockType, "etf");
  assert.equal(
    parseYahooSearchResult(
      {
        quotes: [
          { symbol: "MSFT", longname: "Microsoft", quoteType: "EQUITY" },
        ],
      },
      "AAPL",
    ),
    null,
  );

  const dividends = parseYahooDividendEvents({
    chart: {
      result: [
        {
          events: {
            dividends: {
              "1754000000": { date: 1754000000, amount: 0.25 },
              "1755000000": { date: 1755000000, amount: 0 },
            },
          },
        },
      ],
    },
  });
  assert.equal(dividends.length, 1);
  assert.equal(dividends[0].amountPerShare, 0.25);
});

test("US trades do not inherit Taiwan fee and tax defaults", () => {
  assert.equal(calcStockFee(100_000, 1_000, DEFAULT_STOCK_SETTINGS, "US"), 0);
  assert.equal(calcStockTax(100_000, "stock", DEFAULT_STOCK_SETTINGS, "US"), 0);
  assert.equal(calcStockFee(100_000, 1_000, DEFAULT_STOCK_SETTINGS, "TW"), 142);
  assert.equal(
    calcStockTax(100_000, "stock", DEFAULT_STOCK_SETTINGS, "TW"),
    300,
  );
});
