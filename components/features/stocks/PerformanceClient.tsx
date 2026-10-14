"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/clientApi";
import StocksTabNav from "./StocksTabNav";
import { Select } from "@/components/ui/Select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/i18n/I18nProvider";
import { localeTag } from "@/lib/i18n/localeTag";

function fmtMoney(n: number | string | null | undefined, currency: string, locale: string) {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const code = String(currency || "TWD").toUpperCase();
  const digits = code === "TWD" ? 0 : 2;
  const prefix = code === "TWD" ? "NT$ " : code === "USD" ? "$ " : `${code} `;
  return `${prefix}${num.toLocaleString(localeTag(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

function fmtRate(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  const pct = (num * 100).toFixed(2);
  return `${num > 0 ? "+" : ""}${pct}%`;
}

function rateClass(n: number | string | null | undefined): string {
  if (n === null || n === undefined) return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return "";
  return num > 0 ? "text-emerald-600 dark:text-emerald-400" : num < 0 ? "text-rose-600 dark:text-rose-400" : "";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toIsoStringDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function offsetDays(base: Date, days: number): string {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return toIsoStringDate(d);
}

export default function PerformanceClient() {
  const { t, locale } = useT();
  const searchParams = useSearchParams();

  const [market, setMarket] = useState<"TW" | "US">(() => {
    const m = (searchParams.get("market") || "TW").toUpperCase();
    return m === "US" ? "US" : "TW";
  });
  const [baseCurrency, setBaseCurrency] = useState<string>(() => searchParams.get("baseCurrency") || "");
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(["TWD", "USD"]);

  const todayStr = useMemo(() => toIsoStringDate(new Date()), []);
  const [to, setTo] = useState<string>(todayStr);
  const [from, setFrom] = useState<string>(() => offsetDays(new Date(), -365));

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      params.set("market", market);
      params.set("from", from);
      params.set("to", to);
      if (baseCurrency) params.set("baseCurrency", baseCurrency);

      const res = await apiGet(`/api/stock-performance?${params.toString()}`);
      setReport(res);
      if (Array.isArray(res?.availableCurrencies) && res.availableCurrencies.length > 0) {
        setAvailableCurrencies(res.availableCurrencies);
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[stock-performance] load failed", err);
      }
      setErrorMsg(err?.message || "載入績效分析失敗");
    } finally {
      setLoading(false);
    }
  }, [market, from, to, baseCurrency]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePreset = (type: "1m" | "3m" | "6m" | "1y" | "ytd" | "3y") => {
    const now = new Date();
    setTo(toIsoStringDate(now));
    if (type === "1m") setFrom(offsetDays(now, -30));
    else if (type === "3m") setFrom(offsetDays(now, -90));
    else if (type === "6m") setFrom(offsetDays(now, -180));
    else if (type === "1y") setFrom(offsetDays(now, -365));
    else if (type === "ytd") setFrom(`${now.getFullYear()}-01-01`);
    else if (type === "3y") setFrom(offsetDays(now, -1095));
  };

  const handleExport = (format: "csv" | "xlsx") => {
    const params = new URLSearchParams();
    params.set("market", market);
    params.set("from", from);
    params.set("to", to);
    if (baseCurrency) params.set("baseCurrency", baseCurrency);
    params.set("format", format);
    window.open(`/api/stock-performance?${params.toString()}`, "_blank");
  };

  // 數值提取（優先原幣；若 FX 可用且選擇切換時可用）
  const displayCurrency = report?.currency || (market === "US" ? "USD" : "TWD");
  const summary = report?.summary;
  const xirr = report?.xirr;
  const twr = report?.twr;
  const benchmark = report?.benchmark;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {t("features.stocks.performance.title")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t("features.stocks.performance.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2 sm:pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={loading || !report}
          >
            {t("features.stocks.performance.exportCsv")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            disabled={loading || !report}
          >
            {t("features.stocks.performance.exportXlsx")}
          </Button>
        </div>
      </div>

      <StocksTabNav />

      {/* 篩選條件區 */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t("features.stocks.performance.filterMarket")}
            </label>
            <Select
              value={market}
              onChange={(e) => setMarket(e.target.value as "TW" | "US")}
              options={[
                { label: t("features.stocks.common.marketTaiwan"), value: "TW" },
                { label: t("features.stocks.common.marketUs"), value: "US" },
              ]}
            />
          </div>

          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t("features.stocks.performance.filterFrom")}
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none dark:border-slate-700"
            />
          </div>

          <div className="w-36">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t("features.stocks.performance.filterTo")}
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-transparent px-3 py-1.5 text-sm shadow-sm focus:border-primary focus:outline-none dark:border-slate-700"
            />
          </div>

          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t("features.stocks.performance.filterBaseCurrency")}
            </label>
            <Select
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value)}
              options={[
                { label: `${t("features.stocks.common.autoCalculate")} (${displayCurrency})`, value: "" },
                ...availableCurrencies.map((c) => ({ label: c, value: c })),
              ]}
            />
          </div>

          <Button onClick={loadData} disabled={loading} size="sm" className="h-9">
            {t("features.stocks.performance.query")}
          </Button>

          {/* 期間快速選取標籤 */}
          <div className="ml-auto flex flex-wrap gap-1">
            {[
              { id: "1m", label: t("features.stocks.performance.preset1m") },
              { id: "3m", label: t("features.stocks.performance.preset3m") },
              { id: "6m", label: t("features.stocks.performance.preset6m") },
              { id: "1y", label: t("features.stocks.performance.preset1y") },
              { id: "ytd", label: t("features.stocks.performance.presetYtd") },
              { id: "3y", label: t("features.stocks.performance.preset3y") },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.id as any)}
                className="rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 警告通知 */}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {errorMsg}
        </div>
      )}

      {report?.missingPrices && report.missingPrices.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-semibold">{t("features.stocks.performance.missingPriceWarning")}</p>
          <p className="mt-1 opacity-90">
            {report.missingPrices.map((m: any) => `${m.symbol} (${m.date})`).join("、")}
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="ui-skeleton h-24 rounded-lg" />
            <div className="ui-skeleton h-24 rounded-lg" />
            <div className="ui-skeleton h-24 rounded-lg" />
            <div className="ui-skeleton h-24 rounded-lg" />
          </div>
          <div className="ui-skeleton h-64 rounded-lg" />
        </div>
      ) : report ? (
        <>
          {/* 四大核心指標卡片 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* XIRR */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {t("features.stocks.performance.xirr")}
                </span>
                {xirr?.status === "ok" ? (
                  <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    {xirr.iterations} iters
                  </span>
                ) : (
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {xirr?.reason || "unavailable"}
                  </span>
                )}
              </div>
              <p className={`mt-2 text-2xl font-bold ${rateClass(xirr?.status === "ok" ? xirr.rate : null)}`}>
                {xirr?.status === "ok" ? fmtRate(xirr.rate) : t("features.stocks.performance.xirrUnavailable")}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {t("features.stocks.performance.xirrDesc")}
              </p>
            </div>

            {/* TWR */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {t("features.stocks.performance.twr")}
                </span>
                {twr?.status === "incomplete" ? (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                    {t("features.stocks.performance.twrIncomplete")}
                  </span>
                ) : twr?.status === "ok" ? (
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {twr.subPeriods} subperiods
                  </span>
                ) : null}
              </div>
              <p className={`mt-2 text-2xl font-bold ${rateClass(twr?.twr)}`}>
                {fmtRate(twr?.twr)}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                {t("features.stocks.performance.twrDesc")}
              </p>
            </div>

            {/* Benchmark 對比 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {t("features.stocks.performance.benchmark")}
                </span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  {benchmark?.meta?.symbol ?? (market === "TW" ? "0050" : "SPY")}
                </span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${rateClass(benchmark?.return)}`}>
                {benchmark?.available ? fmtRate(benchmark.return) : "—"}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  {t("features.stocks.performance.excessReturn")}
                </span>
                <span className={`font-semibold ${rateClass(benchmark?.difference)}`}>
                  {benchmark?.available ? fmtRate(benchmark.difference) : "—"}
                </span>
              </div>
            </div>

            {/* 總損益 */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {t("features.stocks.performance.totalGain")}
                </span>
                <span className="text-xs text-slate-400">{displayCurrency}</span>
              </div>
              <p className={`mt-2 text-2xl font-bold ${rateClass(summary?.totalGain)}`}>
                {fmtMoney(summary?.totalGain, displayCurrency, locale)}
              </p>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{t("features.stocks.performance.netFlow")}:</span>
                <span className="font-medium text-slate-600 dark:text-slate-300">
                  {fmtMoney(summary?.netFlow, displayCurrency, locale)}
                </span>
              </div>
            </div>
          </div>

          {/* 收益歸因拆解 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              {t("features.stocks.performance.attributionTitle")}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {t("features.stocks.performance.attributionDesc")}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                  {t("features.stocks.performance.realizedPl")}
                </p>
                <p className={`mt-1 text-base font-semibold ${rateClass(summary?.realizedPl)}`}>
                  {fmtMoney(summary?.realizedPl, displayCurrency, locale)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                  {t("features.stocks.performance.unrealizedChange")}
                </p>
                <p className={`mt-1 text-base font-semibold ${rateClass(summary?.unrealizedChange)}`}>
                  {fmtMoney(summary?.unrealizedChange, displayCurrency, locale)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                  {t("features.stocks.performance.dividends")}
                </p>
                <p className="mt-1 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(summary?.dividends, displayCurrency, locale)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-xs text-slate-500">
                  {t("features.stocks.performance.feesAndTaxes")}
                </p>
                <p className="mt-1 text-base font-semibold text-rose-600 dark:text-rose-400">
                  {fmtMoney(summary?.feesAndTaxes, displayCurrency, locale)}
                </p>
              </div>
            </div>

            {/* 市值與現金流前後比對 */}
            <div className="mt-4 flex flex-wrap items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
              <span>
                {t("features.stocks.performance.startValue")}:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {fmtMoney(summary?.startValue, displayCurrency, locale)}
                </strong>
              </span>
              <span>
                {t("features.stocks.performance.contributions")}:{" "}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {fmtMoney(summary?.contributions, displayCurrency, locale)}
                </strong>
              </span>
              <span>
                {t("features.stocks.performance.withdrawals")}:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {fmtMoney(summary?.withdrawals, displayCurrency, locale)}
                </strong>
              </span>
              <span>
                {t("features.stocks.performance.endValue")}:{" "}
                <strong className="text-slate-700 dark:text-slate-300">
                  {fmtMoney(summary?.endValue, displayCurrency, locale)}
                </strong>
              </span>
            </div>
          </div>

          {/* 資產走勢與累積投入圖表 */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                  {t("features.stocks.performance.trendTitle")}
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t("features.stocks.performance.trendMarketValue")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 border-t-2 border-dashed border-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {t("features.stocks.performance.trendNetContributions")}
                  </span>
                </div>
              </div>
            </div>

            <PerformanceTrendChart
              trend={report.trend || []}
              currency={displayCurrency}
              locale={locale}
              noDataText={t("features.stocks.performance.trendNoData")}
            />
          </div>

          {/* 外部現金流明細 */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-100 p-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                {t("features.stocks.performance.flowsTitle")}
              </h3>
            </div>
            {report.flows && report.flows.length > 0 ? (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("features.stocks.performance.flowDate")}</TableHead>
                      <TableHead>{t("features.stocks.performance.flowKind")}</TableHead>
                      <TableHead>{t("features.stocks.performance.flowSymbol")}</TableHead>
                      <TableHead>{t("features.stocks.performance.flowDirection")}</TableHead>
                      <TableHead className="text-right">
                        {t("features.stocks.performance.flowAmount")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.flows.map((flow: any, index: number) => {
                      const isIn = flow.direction === "in";
                      return (
                        <TableRow key={`${flow.date}-${flow.stockId}-${index}`}>
                          <TableCell className="font-mono text-xs">{flow.date}</TableCell>
                          <TableCell className="text-xs uppercase">{flow.kind}</TableCell>
                          <TableCell className="font-medium">{flow.symbol}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                                isIn
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {isIn
                                ? t("features.stocks.performance.flowIn")
                                : t("features.stocks.performance.flowOut")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {fmtMoney(flow.amount, displayCurrency, locale)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="p-8 text-center text-sm text-slate-400">
                {t("features.stocks.performance.flowsEmpty")}
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG 走勢圖元件
// ---------------------------------------------------------------------------

function PerformanceTrendChart({
  trend,
  currency,
  locale,
  noDataText,
}: {
  trend: any[];
  currency: string;
  locale: string;
  noDataText: string;
}) {
  const points = useMemo(() => {
    return trend.map((t) => ({
      date: t.date,
      value: t.marketValue !== null ? Number(t.marketValue) : null,
      contrib: Number(t.netContributions) || 0,
    }));
  }, [trend]);

  if (points.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">{noDataText}</p>;
  }

  const WIDTH = 860;
  const HEIGHT = 260;
  const PAD = { left: 64, right: 24, top: 20, bottom: 32 };
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const validValues = points.flatMap((p) => [
    ...(p.value !== null ? [p.value] : []),
    p.contrib,
  ]);
  const minVal = validValues.length > 0 ? Math.min(0, ...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(1, ...validValues) : 1;
  const valRange = maxVal - minVal || 1;

  const getX = (index: number) => {
    if (points.length <= 1) return PAD.left + plotW / 2;
    return PAD.left + (index / (points.length - 1)) * plotW;
  };
  const getY = (val: number) => {
    return PAD.top + plotH - ((val - minVal) / valRange) * plotH;
  };

  // 生成 Market Value 折線 Path
  let marketPath = "";
  points.forEach((p, i) => {
    if (p.value !== null) {
      const x = getX(i);
      const y = getY(p.value);
      marketPath += marketPath === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
  });

  // 生成 Net Contributions 折線 Path
  let contribPath = "";
  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.contrib);
    contribPath += contribPath === "" ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  const numTicks = 4;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const val = minVal + (valRange / numTicks) * i;
    const y = getY(val);
    return { val, y };
  });

  const xLabelStep = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full min-w-[560px]"
        role="img"
        aria-label="Performance trend chart"
      >
        {/* 背景網格線與 Y 軸標籤 */}
        {ticks.map((tick, i) => (
          <g key={i}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={tick.y}
              y2={tick.y}
              stroke="currentColor"
              className="text-slate-100 dark:text-slate-800"
              strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="currentColor"
              className="text-slate-400"
            >
              {fmtMoney(tick.val, currency, locale)}
            </text>
          </g>
        ))}

        {/* 累積淨投入 (虛線) */}
        {contribPath && (
          <path
            d={contribPath}
            fill="none"
            stroke="currentColor"
            className="text-slate-400 dark:text-slate-500"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        )}

        {/* 市值折線 (藍色實線) */}
        {marketPath && (
          <path
            d={marketPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* 節點點點與 Tooltip */}
        {points.map((p, i) => {
          if (p.value === null) return null;
          const x = getX(i);
          const y = getY(p.value);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3.5"
              fill="#3b82f6"
              className="transition-all hover:r-5 cursor-pointer"
            >
              <title>{`${p.date}\n市值: ${fmtMoney(p.value, currency, locale)}\n投入: ${fmtMoney(p.contrib, currency, locale)}`}</title>
            </circle>
          );
        })}

        {/* X 軸日期標籤 */}
        {points.map((p, i) => {
          if (i % xLabelStep !== 0 && i !== points.length - 1) return null;
          const x = getX(i);
          return (
            <text
              key={i}
              x={x}
              y={HEIGHT - 10}
              textAnchor="middle"
              fontSize="10"
              fill="currentColor"
              className="text-slate-400"
            >
              {p.date.slice(5)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
