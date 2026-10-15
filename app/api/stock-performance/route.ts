// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/apiHelpers";
import { queryAll } from "../../../lib/db";
import {
  buildCsv,
  writeOperationAudit,
} from "../../../lib/auditHelpers";
import { getRequestIpFromHeaders } from "../../../lib/loginHelpers";
import {
  createXlsxExportResponse,
  type XlsxColumn,
} from "../../../lib/xlsxExport";
import {
  buildPerformanceReport,
  PerformanceInputError,
  addDays,
  daysBetween,
  isIsoDate,
  type PerformanceStock,
  type PerformanceTransaction,
  type PerformanceDividend,
  type PricePoint,
  type BenchmarkInput,
  type FxInput,
  type PerformanceReport,
} from "../../../lib/portfolioPerformance";
import {
  normalizeStockMarket,
  stockCurrency,
  getStockRealizedPl,
  isProtectedSyntheticTransaction,
} from "../../../lib/stockHelpers";
import { fetchStockHistory } from "../../../lib/stockHistory";
import { fetchUsStockCloseRange } from "../../../lib/usStockFetch";
import { getReportCurrencyContext } from "../../../lib/reportCurrencyContext";
import { resolveReportBaseCurrency } from "../../../lib/reportCurrency";
import { todayInUserTz } from "../../../lib/userTime";

export const runtime = "nodejs";

const MAX_PERIOD_DAYS = 1096; // 3 年

interface ExportRowItem {
  section: string;
  item: string;
  date?: string;
  symbol?: string;
  direction?: string;
  value?: number;
  note?: string;
}

function buildExportRows(report: PerformanceReport, baseCurrency: string): ExportRowItem[] {
  const rows: ExportRowItem[] = [];

  // 1. 期間與市場
  rows.push({ section: "期間", item: "開始日期", date: report.period.from, value: 0, note: "" });
  rows.push({ section: "期間", item: "結束日期", date: report.period.to, value: 0, note: "" });
  rows.push({ section: "期間", item: "天數", value: report.period.days, note: "" });
  rows.push({ section: "期間", item: "市場", note: report.market });
  rows.push({ section: "期間", item: "原幣", note: report.currency });
  rows.push({ section: "期間", item: "基準幣別", note: baseCurrency });

  // 2. 原幣損益彙總
  const secNative = `損益彙總 (${report.currency})`;
  rows.push({ section: secNative, item: "期初市值", value: report.summary.startValue !== null ? Number(report.summary.startValue) : 0, note: report.summary.startValue !== null ? "" : "無法估值" });
  rows.push({ section: secNative, item: "期末市值", value: report.summary.endValue !== null ? Number(report.summary.endValue) : 0, note: report.summary.endValue !== null ? "" : "無法估值" });
  rows.push({ section: secNative, item: "投入資金", value: Number(report.summary.contributions) });
  rows.push({ section: secNative, item: "取回資金", value: Number(report.summary.withdrawals) });
  rows.push({ section: secNative, item: "淨現金流", value: Number(report.summary.netFlow) });
  rows.push({ section: secNative, item: "總損益", value: report.summary.totalGain !== null ? Number(report.summary.totalGain) : 0, note: report.summary.totalGain !== null ? "" : "無法估值" });
  rows.push({ section: secNative, item: "已實現損益", value: Number(report.summary.realizedPl) });
  rows.push({ section: secNative, item: "未實現損益變動", value: report.summary.unrealizedChange !== null ? Number(report.summary.unrealizedChange) : 0, note: report.summary.unrealizedChange !== null ? "" : "無法估值" });
  rows.push({ section: secNative, item: "現金股利", value: Number(report.summary.dividends) });
  rows.push({ section: secNative, item: "手續費與稅", value: Number(report.summary.feesAndTaxes) });

  // 3. 基準幣別損益彙總（若不同）
  if (report.fx?.summary && baseCurrency !== report.currency) {
    const secBase = `損益彙總 (${baseCurrency})`;
    rows.push({ section: secBase, item: "期初市值", value: report.fx.summary.startValue !== null ? Number(report.fx.summary.startValue) : 0, note: report.fx.summary.startValue !== null ? "" : "無法估值" });
    rows.push({ section: secBase, item: "期末市值", value: report.fx.summary.endValue !== null ? Number(report.fx.summary.endValue) : 0, note: report.fx.summary.endValue !== null ? "" : "無法估值" });
    rows.push({ section: secBase, item: "投入資金", value: Number(report.fx.summary.contributions) });
    rows.push({ section: secBase, item: "取回資金", value: Number(report.fx.summary.withdrawals) });
    rows.push({ section: secBase, item: "淨現金流", value: Number(report.fx.summary.netFlow) });
    rows.push({ section: secBase, item: "總損益", value: report.fx.summary.totalGain !== null ? Number(report.fx.summary.totalGain) : 0, note: report.fx.summary.totalGain !== null ? "" : "無法估值" });
    rows.push({ section: secBase, item: "已實現損益", value: Number(report.fx.summary.realizedPl) });
    rows.push({ section: secBase, item: "未實現損益變動", value: report.fx.summary.unrealizedChange !== null ? Number(report.fx.summary.unrealizedChange) : 0, note: report.fx.summary.unrealizedChange !== null ? "" : "無法估值" });
    rows.push({ section: secBase, item: "現金股利", value: Number(report.fx.summary.dividends) });
    rows.push({ section: secBase, item: "手續費與稅", value: Number(report.fx.summary.feesAndTaxes) });
  }

  // 4. 報酬率
  const secReturn = "報酬率";
  rows.push({
    section: secReturn,
    item: "XIRR 年化報酬率",
    value: report.xirr.status === "ok" ? Number(report.xirr.rate) : 0,
    note: report.xirr.status === "ok" ? `疊代次數: ${report.xirr.iterations}` : `無法計算 (${report.xirr.reason})`,
  });
  rows.push({
    section: secReturn,
    item: "TWR 時間加權報酬率",
    value: report.twr.status !== "unavailable" && report.twr.twr !== null ? Number(report.twr.twr) : 0,
    note: report.twr.status === "ok"
      ? `子期間數: ${report.twr.subPeriods}`
      : report.twr.status === "incomplete"
      ? `部分子期間缺價跳過 (${report.twr.skippedPeriods.length} 期)`
      : "無法計算",
  });
  rows.push({
    section: secReturn,
    item: `Benchmark (${report.benchmark.meta?.symbol ?? ""})`,
    value: report.benchmark.available && report.benchmark.return !== null ? Number(report.benchmark.return) : 0,
    note: report.benchmark.available
      ? `${report.benchmark.meta?.source ?? ""} (${report.benchmark.startDate} ~ ${report.benchmark.endDate})`
      : (report.benchmark.reason ?? "無法取得"),
  });
  rows.push({
    section: secReturn,
    item: "超額報酬 (TWR - Benchmark)",
    value: report.benchmark.available && report.benchmark.difference !== null ? Number(report.benchmark.difference) : 0,
    note: "",
  });

  // 5. 現金流
  for (const flow of report.flows) {
    rows.push({
      section: "現金流",
      item: flow.kind,
      date: flow.date,
      symbol: flow.symbol,
      direction: flow.direction === "in" ? "流入" : "流出",
      value: Number(flow.amount),
    });
  }

  // 6. 走勢
  for (const t of report.trend) {
    rows.push({
      section: "走勢",
      item: "每日估值",
      date: t.date,
      value: t.marketValue !== null ? Number(t.marketValue) : 0,
      note: `累積淨投入: ${t.netContributions}`,
    });
  }

  return rows;
}

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const rawMarket = searchParams.get("market");
  const rawFormat = searchParams.get("format");
  const rawBaseCurrency = searchParams.get("baseCurrency");
  const rawFrom = searchParams.get("from");
  const rawTo = searchParams.get("to");

  const format = (rawFormat || "json").toLowerCase();
  if (format !== "json" && format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "invalid-format" }, { status: 400 });
  }

  const baseCurrency = resolveReportBaseCurrency(rawBaseCurrency);
  if (rawBaseCurrency && baseCurrency === null) {
    return NextResponse.json({ error: "invalid-currency" }, { status: 400 });
  }
  const effectiveBaseCurrency = baseCurrency || "TWD";

  const market = normalizeStockMarket(rawMarket || "TW");
  const currency = stockCurrency(market);

  const tz = auth.userTimezone || "Asia/Taipei";
  const defaultTo = todayInUserTz(tz);
  const defaultFrom = addDays(defaultTo, -364);

  const from = rawFrom || defaultFrom;
  const to = rawTo || defaultTo;

  if (!isIsoDate(from) || !isIsoDate(to)) {
    return NextResponse.json({ error: "invalid-date" }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "invalid-period" }, { status: 400 });
  }
  if (daysBetween(from, to) > MAX_PERIOD_DAYS) {
    return NextResponse.json(
      { error: "invalid-period", message: "查詢期間不可超過 3 年（1096 天）" },
      { status: 400 },
    );
  }

  try {
    // 1. 查詢該市場下的使用者持股
    const rawStocks = queryAll(
      "SELECT id, symbol, market, name, shares, currency FROM stocks WHERE user_id = ?",
      [auth.userId],
    );
    const marketStocks = rawStocks.filter(
      (s: any) => normalizeStockMarket(s.market) === market,
    );
    const stockIdSet = new Set(marketStocks.map((s: any) => String(s.id)));

    const stocks: PerformanceStock[] = marketStocks.map((s: any) => ({
      id: String(s.id),
      symbol: String(s.symbol || ""),
      currency,
    }));

    // 2. 查詢至 to 日為止的所有交易與股利（以計算期初／期末持有部位與現金流）
    let transactions: PerformanceTransaction[] = [];
    let dividends: PerformanceDividend[] = [];

    if (stockIdSet.size > 0) {
      const rawTxs = queryAll(
        "SELECT id, stock_id, type, shares, price, fee, tax, date, note, linked_dividend_id FROM stock_transactions WHERE user_id = ? AND date <= ? ORDER BY date, id",
        [auth.userId, to],
      );
      transactions = rawTxs
        .filter((t: any) => stockIdSet.has(String(t.stock_id)))
        .map((t: any) => ({
          stockId: String(t.stock_id),
          type: t.type === "buy" ? "buy" : "sell",
          date: String(t.date),
          shares: Number(t.shares) || 0,
          price: Number(t.price) || 0,
          fee: Number(t.fee) || 0,
          tax: Number(t.tax) || 0,
          synthetic:
            isProtectedSyntheticTransaction(t.note) ||
            Boolean(t.linked_dividend_id),
        }));

      const rawDivs = queryAll(
        "SELECT id, stock_id, amount, date, reinvest, reinvest_shares, reinvest_price, cash_dividend, stock_dividend_shares FROM stock_dividends WHERE user_id = ? AND date <= ? ORDER BY date, id",
        [auth.userId, to],
      );
      dividends = rawDivs
        .filter((d: any) => stockIdSet.has(String(d.stock_id)))
        .map((d: any) => ({
          stockId: String(d.stock_id),
          date: String(d.date),
          cashDividend: Number(d.cash_dividend ?? d.amount) || 0,
          reinvest: Number(d.reinvest) === 1,
          reinvestShares:
            d.reinvest_shares !== null ? Number(d.reinvest_shares) : null,
          reinvestPrice:
            d.reinvest_price !== null ? Number(d.reinvest_price) : null,
        }));
    }

    // 3. 平行抓取歷史價格（含 carry forward 7 天緩衝，從 addDays(from, -8) 至 to）
    const priceStart = addDays(from, -8);
    const prices: Record<string, PricePoint[]> = {};

    const priceFetchPromises = marketStocks.map(async (s: any) => {
      const stockId = String(s.id);
      const sym = String(s.symbol || "");
      try {
        if (market === "TW") {
          const candles = await fetchStockHistory(sym, priceStart, to);
          prices[stockId] = candles.map((c) => ({ date: c.date, close: c.close }));
        } else {
          const points = await fetchUsStockCloseRange(sym, priceStart, to);
          prices[stockId] = points.map((p) => ({ date: p.date, close: p.close }));
        }
      } catch (err) {
        console.warn(`[stock-performance] price fetch failed for ${sym}:`, err);
        prices[stockId] = [];
      }
    });

    // 4. 抓取 Benchmark
    const benchmarkSymbol = market === "TW" ? "0050" : "SPY";
    const benchmarkSource = market === "TW" ? "TWSE" : "Yahoo Finance";
    let benchmark: BenchmarkInput | null = null;

    const benchmarkFetchPromise = (async () => {
      try {
        let series: PricePoint[] = [];
        if (market === "TW") {
          const candles = await fetchStockHistory(benchmarkSymbol, priceStart, to);
          series = candles.map((c) => ({ date: c.date, close: c.close }));
        } else {
          const points = await fetchUsStockCloseRange(benchmarkSymbol, priceStart, to);
          series = points.map((p) => ({ date: p.date, close: p.close }));
        }
        benchmark = {
          meta: {
            type: "price",
            symbol: benchmarkSymbol,
            source: benchmarkSource,
            dividendsReinvested: false,
            currency,
            feesIncluded: false,
          },
          series,
        };
      } catch (err) {
        benchmark = {
          meta: {
            type: "price",
            symbol: benchmarkSymbol,
            source: benchmarkSource,
            dividendsReinvested: false,
            currency,
            feesIncluded: false,
          },
          series: null,
          error: "fetch-failed",
        };
      }
    })();

    await Promise.allSettled([...priceFetchPromises, benchmarkFetchPromise]);

    // 5. 已實現損益計算（篩選該市場）
    const plData = getStockRealizedPl(auth.userId, { dateFrom: from, dateTo: to });
    const marketPlEntries = plData.entries.filter((e) => e.market === market);
    const realizedPlNumber = marketPlEntries.reduce((sum, e) => sum + e.realizedPL, 0);
    const realizedPl = realizedPlNumber.toFixed(2);

    // 6. 基準幣別匯率 context
    const nativeContext = getReportCurrencyContext(auth.userId, currency);
    const baseContext = getReportCurrencyContext(auth.userId, effectiveBaseCurrency);

    const fx: FxInput = {
      baseCurrency: effectiveBaseCurrency,
      nativeRateToTwd: nativeContext?.rate?.rateToBase ?? (currency === "TWD" ? "1" : null),
      nativeSource: nativeContext?.rate?.source ?? (currency === "TWD" ? "identity" : null),
      nativeFetchedAt: nativeContext?.rate?.fetchedAt ?? null,
      baseRateToTwd: baseContext?.rate?.rateToBase ?? (effectiveBaseCurrency === "TWD" ? "1" : null),
      baseSource: baseContext?.rate?.source ?? (effectiveBaseCurrency === "TWD" ? "identity" : null),
      baseFetchedAt: baseContext?.rate?.fetchedAt ?? null,
    };

    // 7. 生成報告
    const report = buildPerformanceReport({
      from,
      to,
      market,
      currency,
      stocks,
      transactions,
      dividends,
      prices,
      realizedPl,
      benchmark,
      fx,
    });

    const availableCurrencies = baseContext?.availableCurrencies ?? ["TWD", "USD"];

    // 8. 輸出格式處理
    if (format === "json") {
      return NextResponse.json({
        ...report,
        availableCurrencies,
      });
    }

    const ipAddress = getRequestIpFromHeaders(request.headers) || "";
    const userAgent = request.headers.get("user-agent") || "";
    const exportRows = buildExportRows(report, effectiveBaseCurrency);
    const filenamePrefix = `stock-performance-${market}`;

    if (format === "xlsx") {
      const columns: XlsxColumn[] = [
        { header: "區段", type: "text" },
        { header: "項目", type: "text" },
        { header: "日期", type: "text" },
        { header: "代號", type: "text" },
        { header: "方向", type: "text" },
        { header: "數值", type: "number", format: "#,##0.00########" },
        { header: "說明", type: "text" },
      ];
      const xlsxRows = exportRows.map((r) => [
        r.section,
        r.item,
        r.date || "",
        r.symbol || "",
        r.direction || "",
        r.value ?? 0,
        r.note || "",
      ]);

      return createXlsxExportResponse({
        columns,
        rows: xlsxRows,
        filenamePrefix,
        audit: {
          userId: auth.userId,
          role: "user",
          action: "export_stock_performance",
          ipAddress,
          userAgent,
          dateFrom: from,
          dateTo: to,
        },
      });
    }

    // CSV format
    const headers = ["區段", "項目", "日期", "代號", "方向", "數值", "說明"];
    const csvDataRows = exportRows.map((r) => [
      r.section,
      r.item,
      r.date || "",
      r.symbol || "",
      r.direction || "",
      r.value ?? 0,
      r.note || "",
    ]);
    const csv = buildCsv(headers, csvDataRows);
    const filename = `${filenamePrefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role: "user",
      action: "export_stock_performance",
      ipAddress,
      userAgent,
      result: "success",
      isAdminOperation: false,
      metadata: {
        rows: csvDataRows.length,
        byteSize: Buffer.byteLength(csv, "utf8"),
        dateFrom: from,
        dateTo: to,
        format: "csv",
      },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    if (err instanceof PerformanceInputError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "performance-failed", message: String(err?.message || err) },
      { status: 500 },
    );
  }
}
