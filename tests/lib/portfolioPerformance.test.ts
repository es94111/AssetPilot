// tests/lib/portfolioPerformance.test.ts — issue #310 投資組合績效分析純邏輯測試。
// 數值容差 1e-6（報酬率以 8 位小數字串輸出，比較時轉為 number）。
import assert from "node:assert/strict";
import test from "node:test";

import {
  PerformanceInputError,
  buildExternalFlows,
  buildPerformanceReport,
  computeBenchmarkReturn,
  computeXirr,
  convertWithFx,
  fxConversionRate,
  valuePortfolioAt,
  type BenchmarkInput,
  type PerformanceInput,
  type PricePoint,
} from "../../lib/portfolioPerformance.ts";

const TOLERANCE = 1e-6;

function near(actual: string | number | null | undefined, expected: number, message?: string) {
  assert.notEqual(actual, null, message ?? "value should not be null");
  const value = Number(actual);
  assert.ok(Math.abs(value - expected) < TOLERANCE, `${message ?? ""} expected ${expected}, got ${value}`);
}

function series(points: [string, number][]): PricePoint[] {
  return points.map(([date, close]) => ({ date, close }));
}

function baseInput(overrides: Partial<PerformanceInput> = {}): PerformanceInput {
  return {
    from: "2024-01-01",
    to: "2024-12-31",
    market: "TW",
    currency: "TWD",
    stocks: [{ id: "s1", symbol: "2330", currency: "TWD" }],
    transactions: [],
    dividends: [],
    prices: {},
    realizedPl: 0,
    benchmark: null,
    ...overrides,
  };
}

test("XIRR：單筆投入一年後 +10%（Actual/365，366 天）", () => {
  const result = computeXirr([
    { date: "2024-01-01", amount: -1000 },
    { date: "2025-01-01", amount: 1100 },
  ]);
  assert.equal(result.status, "ok");
  if (result.status === "ok") near(result.rate, Math.pow(1.1, 365 / 366) - 1);
});

test("XIRR：多重根（−100, +230, −132 → 10% 與 20%）回傳 multiple-roots", () => {
  const result = computeXirr([
    { date: "2023-01-01", amount: -100 },
    { date: "2024-01-01", amount: 230 },
    { date: "2025-01-01", amount: -132 },
  ]);
  assert.equal(result.status, "unavailable");
  if (result.status === "unavailable") {
    assert.equal(result.reason, "multiple-roots");
    assert.equal(result.rootCount, 2);
  }
});

test("XIRR：無根（−100, +50, −100）回傳 no-root", () => {
  const result = computeXirr([
    { date: "2023-01-01", amount: -100 },
    { date: "2024-01-01", amount: 50 },
    { date: "2025-01-01", amount: -100 },
  ]);
  assert.deepEqual(result, { status: "unavailable", reason: "no-root", rootCount: 0 });
});

test("XIRR：同號或不足兩筆、同日現金流的錯誤原因", () => {
  assert.deepEqual(computeXirr([{ date: "2024-01-01", amount: -100 }]), {
    status: "unavailable",
    reason: "insufficient-flows",
  });
  assert.deepEqual(
    computeXirr([
      { date: "2024-01-01", amount: -100 },
      { date: "2024-06-01", amount: -100 },
    ]),
    { status: "unavailable", reason: "insufficient-flows" },
  );
  assert.deepEqual(
    computeXirr([
      { date: "2024-01-01", amount: -100 },
      { date: "2024-01-01", amount: 120 },
    ]),
    { status: "unavailable", reason: "zero-period" },
  );
});

test("XIRR：負報酬（−1000 → +500，一年）", () => {
  const result = computeXirr([
    { date: "2023-01-01", amount: -1000 },
    { date: "2024-01-01", amount: 500 },
  ]);
  assert.equal(result.status, "ok");
  if (result.status === "ok") near(result.rate, -0.5);
});

test("單筆投入：期初無持股、期中買進，總損益與 TWR／XIRR 一致", () => {
  const report = buildPerformanceReport(
    baseInput({
      transactions: [{ stockId: "s1", type: "buy", date: "2024-01-02", shares: 10, price: 100, fee: 0, tax: 0 }],
      prices: { s1: series([["2024-01-02", 100], ["2024-12-31", 110]]) },
    }),
  );
  assert.equal(report.summary.startValue, "0.00");
  assert.equal(report.summary.endValue, "1100.00");
  assert.equal(report.summary.contributions, "1000.00");
  assert.equal(report.summary.totalGain, "100.00");
  assert.equal(report.summary.unrealizedChange, "100.00");
  assert.equal(report.twr.status, "ok");
  near(report.twr.twr, 0.1, "TWR");
  assert.equal(report.xirr.status, "ok");
  if (report.xirr.status === "ok") near(report.xirr.rate, Math.pow(1.1, 365 / 364) - 1, "XIRR");
  assert.equal(report.flows.length, 1);
  assert.equal(report.flows[0].direction, "in");
});

test("分批投入：TWR 不受投入時點影響，XIRR 受影響", () => {
  // 股價 100 → 200（+100%）→ 100（−50%）：TWR = 0，但第二筆在高點投入，資金加權為負。
  const report = buildPerformanceReport(
    baseInput({
      transactions: [
        { stockId: "s1", type: "buy", date: "2024-01-02", shares: 10, price: 100 },
        { stockId: "s1", type: "buy", date: "2024-07-01", shares: 10, price: 200 },
      ],
      prices: { s1: series([["2024-01-02", 100], ["2024-06-30", 200], ["2024-07-01", 200], ["2024-12-31", 100]]) },
    }),
  );
  assert.equal(report.twr.status, "ok");
  near(report.twr.twr, 0, "TWR");
  assert.equal(report.summary.contributions, "3000.00");
  assert.equal(report.summary.endValue, "2000.00");
  assert.equal(report.summary.totalGain, "-1000.00");
  assert.equal(report.xirr.status, "ok");
  if (report.xirr.status === "ok") assert.ok(Number(report.xirr.rate) < 0);
});

test("提出（賣出）：手續費與交易稅自提出金額扣除並單獨揭露", () => {
  const report = buildPerformanceReport(
    baseInput({
      transactions: [
        { stockId: "s1", type: "buy", date: "2023-06-01", shares: 10, price: 100, fee: 20 },
        { stockId: "s1", type: "sell", date: "2024-06-03", shares: 5, price: 120, fee: 10, tax: 5 },
      ],
      prices: { s1: series([["2023-12-29", 100], ["2024-06-03", 120], ["2024-12-31", 120]]) },
      realizedPl: 75,
    }),
  );
  assert.equal(report.summary.startValue, "1000.00");
  assert.equal(report.summary.withdrawals, "585.00");
  assert.equal(report.summary.contributions, "0.00");
  assert.equal(report.summary.feesAndTaxes, "15.00");
  assert.equal(report.summary.endValue, "600.00");
  // 總損益 = 600 − 1000 + 585 = 185；未實現 = 185 − 75 − 0 = 110
  assert.equal(report.summary.totalGain, "185.00");
  assert.equal(report.summary.unrealizedChange, "110.00");
  // TWR：(600 + 585)/1000 = 1.185，之後 600/600 = 1 → 0.185（手續費與交易稅計入績效減項）
  near(report.twr.twr, 0.185, "TWR");
});

test("僅股利：現金股利列為提出且不重複計入未實現", () => {
  const report = buildPerformanceReport(
    baseInput({
      transactions: [{ stockId: "s1", type: "buy", date: "2023-06-01", shares: 10, price: 100 }],
      dividends: [{ stockId: "s1", date: "2024-07-15", cashDividend: 50 }],
      prices: { s1: series([["2023-12-29", 100], ["2024-07-15", 100], ["2024-12-31", 100]]) },
    }),
  );
  assert.equal(report.summary.dividends, "50.00");
  assert.equal(report.summary.withdrawals, "50.00");
  assert.equal(report.summary.totalGain, "50.00");
  assert.equal(report.summary.unrealizedChange, "0.00");
  near(report.twr.twr, 0.05, "TWR");
  assert.equal(report.flows[0].kind, "dividend");
});

test("股利再投資：合成買進不列現金流，只有殘額列提出", () => {
  const flows = buildExternalFlows({
    from: "2024-01-01",
    to: "2024-12-31",
    stocks: [{ id: "s1", symbol: "0056", currency: "TWD" }],
    transactions: [
      { stockId: "s1", type: "buy", date: "2024-07-15", shares: 1, price: 40, synthetic: true },
    ],
    dividends: [{ stockId: "s1", date: "2024-07-15", cashDividend: 50, reinvest: true, reinvestShares: 1, reinvestPrice: 40 }],
  });
  assert.equal(flows.length, 1);
  assert.equal(flows[0].kind, "drip-residual");
  assert.equal(flows[0].amount, "10");
});

test("缺價：期末無收盤價 → 總損益、XIRR、TWR 明確標示不可用", () => {
  const report = buildPerformanceReport(
    baseInput({
      transactions: [{ stockId: "s1", type: "buy", date: "2024-01-02", shares: 10, price: 100 }],
      // 最後一筆收盤價距期末超過 7 天，不可沿用
      prices: { s1: series([["2024-01-02", 100], ["2024-12-01", 120]]) },
    }),
  );
  assert.equal(report.summary.endValue, null);
  assert.equal(report.summary.totalGain, null);
  assert.deepEqual(report.xirr, { status: "unavailable", reason: "missing-valuation" });
  assert.equal(report.twr.status, "incomplete");
  assert.equal(report.twr.twr, null);
  assert.ok(report.twr.missingDates.includes("2024-12-31"));
  assert.ok(report.missingPrices.some((m) => m.date === "2024-12-31" && m.symbol === "2330"));
});

test("收盤價最多向前沿用 7 天（週末／連假）", () => {
  const tx = [{ stockId: "s1", type: "buy" as const, date: "2024-01-01", shares: 2, price: 10 }];
  const prices = { s1: series([["2024-01-05", 10]]) };
  assert.equal(valuePortfolioAt(tx, prices, "2024-01-12").value?.toString(), "20");
  assert.deepEqual(valuePortfolioAt(tx, prices, "2024-01-13").missing, ["s1"]);
});

test("負現金流淨額（賣出費稅大於成交金額）視為投入，維持金額守恆", () => {
  const flows = buildExternalFlows({
    from: "2024-01-01",
    to: "2024-12-31",
    stocks: [{ id: "s1", symbol: "X", currency: "TWD" }],
    transactions: [{ stockId: "s1", type: "sell", date: "2024-02-01", shares: 1, price: 1, fee: 20, tax: 0 }],
    dividends: [],
  });
  assert.equal(flows[0].direction, "in");
  assert.equal(flows[0].amount, "19");
});

test("多幣別：混入不同幣別持股時拒絕計算", () => {
  assert.throws(
    () =>
      buildPerformanceReport(
        baseInput({
          stocks: [
            { id: "s1", symbol: "2330", currency: "TWD" },
            { id: "s2", symbol: "AAPL", currency: "USD" },
          ],
        }),
      ),
    (error: unknown) => error instanceof PerformanceInputError && error.code === "mixed-currency",
  );
});

test("期間驗證：from > to 或日期格式錯誤", () => {
  assert.throws(() => buildPerformanceReport(baseInput({ from: "2024-12-31", to: "2024-01-01" })), PerformanceInputError);
  assert.throws(() => buildPerformanceReport(baseInput({ from: "2024-02-30" })), PerformanceInputError);
});

test("Benchmark：價格報酬、差異與不可用狀態", () => {
  const benchmark: BenchmarkInput = {
    meta: { type: "price", symbol: "0050", source: "TWSE", dividendsReinvested: false, currency: "TWD", feesIncluded: false },
    series: series([["2023-12-29", 100], ["2024-12-31", 105]]),
  };
  const report = buildPerformanceReport(
    baseInput({
      transactions: [{ stockId: "s1", type: "buy", date: "2023-06-01", shares: 10, price: 100 }],
      prices: { s1: series([["2023-12-29", 100], ["2024-12-31", 110]]) },
      benchmark,
    }),
  );
  assert.equal(report.benchmark.available, true);
  near(report.benchmark.return, 0.05, "benchmark");
  near(report.benchmark.difference, 0.05, "difference");
  assert.equal(report.benchmark.meta?.dividendsReinvested, false);

  const missing = computeBenchmarkReturn({ ...benchmark, series: null, error: "fetch-failed" }, "2023-12-31", "2024-12-31");
  assert.equal(missing.available, false);
  assert.equal(missing.reason, "fetch-failed");
  const stale = computeBenchmarkReturn(benchmark, "2023-12-31", "2025-06-30");
  assert.equal(stale.available, false);
  assert.equal(stale.reason, "missing-price");
});

test("趨勢：期初、每月月底、期末，缺價點以 null 呈現", () => {
  const report = buildPerformanceReport(
    baseInput({
      from: "2024-01-01",
      to: "2024-03-15",
      transactions: [{ stockId: "s1", type: "buy", date: "2024-01-02", shares: 1, price: 100 }],
      prices: { s1: series([["2024-01-31", 100], ["2024-03-15", 120]]) },
    }),
  );
  assert.deepEqual(
    report.trend.map((p) => p.date),
    ["2023-12-31", "2024-01-31", "2024-02-29", "2024-03-15"],
  );
  assert.equal(report.trend[1].marketValue, "100.00");
  assert.equal(report.trend[2].marketValue, null);
  assert.equal(report.trend[3].netContributions, "100.00");
});

test("匯率：以 spot 匯率換算摘要，缺匯率明確降級", () => {
  assert.equal(convertWithFx("100", fxConversionRate({
    baseCurrency: "TWD", nativeRateToTwd: "32", nativeSource: "manual", nativeFetchedAt: null,
    baseRateToTwd: "1", baseSource: "identity", baseFetchedAt: null,
  }, "USD")), "3200.00");

  const report = buildPerformanceReport(
    baseInput({
      market: "US",
      currency: "USD",
      stocks: [{ id: "s1", symbol: "AAPL", currency: "USD" }],
      transactions: [{ stockId: "s1", type: "buy", date: "2023-06-01", shares: 1, price: 100 }],
      prices: { s1: series([["2023-12-29", 100], ["2024-12-31", 110]]) },
      fx: {
        baseCurrency: "TWD", nativeRateToTwd: null, nativeSource: null, nativeFetchedAt: null,
        baseRateToTwd: "1", baseSource: "identity", baseFetchedAt: null,
      },
    }),
  );
  assert.equal(report.fx?.status, "unavailable");
  assert.equal(report.fx?.summary, null);
  assert.equal(report.summary.endValue, "110.00");
});
