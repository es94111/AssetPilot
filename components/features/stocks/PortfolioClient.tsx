"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/clientApi";
import StocksTabNav from "./StocksTabNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/components/i18n/I18nProvider";
import { localeTag } from "@/lib/i18n/localeTag";
import { Plus, RefreshCw, Trash2, Edit3 } from "lucide-react";

const STOCK_TYPE_VALUES = ["stock", "etf", "warrant"] as const;

const EMPTY_FORM = {
  market: "TW",
  symbol: "",
  name: "",
  stockType: "stock",
  note: "",
};

function fmt(n: number | string, locale: string) {
  return "NT$ " + Math.round(Number(n) || 0).toLocaleString(localeTag(locale));
}
function fmtCurrency(n: number | string, currency: string, locale: string) {
  const code = String(currency || "TWD").toUpperCase();
  const digits = code === "TWD" ? 0 : 2;
  const value = Number(n) || 0;
  return `${code === "TWD" ? "NT$" : "$"} ${value.toLocaleString(localeTag(locale), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
function fmtPL(n: number | string, locale: string, currency = "TWD") {
  const num = Number(n) || 0;
  return `${num > 0 ? "+" : ""}${fmtCurrency(num, currency, locale)}`;
}
function plClass(n: number | string) {
  const num = Number(n) || 0;
  return num > 0 ? "text-green-600" : num < 0 ? "text-red-600" : "";
}

function parseQuoteNumber(value: unknown) {
  return Number(String(value || "").replace(/,/g, "")) || 0;
}

function formatDividendMonths(months: number[], locale: string) {
  const tag = localeTag(locale);
  const names = months.map((m) =>
    new Intl.DateTimeFormat(tag, { month: "short" }).format(
      new Date(2000, m - 1, 1),
    ),
  );
  try {
    return new Intl.ListFormat(tag, {
      style: "short",
      type: "conjunction",
    }).format(names);
  } catch (_) {
    return names.join(", ");
  }
}

async function fetchBrowserStockPrices(
  stocks: any[],
  unavailableMessage: string,
) {
  const activeStocks = stocks.filter(
    (s) =>
      !s.delisted &&
      s.id &&
      s.symbol &&
      String(s.market || "TW").toUpperCase() === "TW",
  );
  if (activeStocks.length === 0) return { updates: [], failed: 0 };

  const [twseSettled, tpexSettled] = await Promise.allSettled([
    fetch("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL", {
      cache: "no-store",
    }),
    fetch(
      "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes",
      { cache: "no-store" },
    ),
  ]);

  const quoteMap = new Map<string, number>();

  if (twseSettled.status === "fulfilled" && twseSettled.value.ok) {
    const twseRows = await twseSettled.value.json().catch(() => []);
    if (Array.isArray(twseRows)) {
      twseRows.forEach((row: any) => {
        const code = String(row.Code || "").trim();
        const price = parseQuoteNumber(row.ClosingPrice);
        if (code && price > 0) quoteMap.set(code, price);
      });
    }
  }

  if (tpexSettled.status === "fulfilled" && tpexSettled.value.ok) {
    const tpexRows = await tpexSettled.value.json().catch(() => []);
    if (Array.isArray(tpexRows)) {
      tpexRows.forEach((row: any) => {
        const code = String(row.SecuritiesCompanyCode || "").trim();
        const price = parseQuoteNumber(row.Close);
        if (code && price > 0) quoteMap.set(code, price);
      });
    }
  }

  if (quoteMap.size === 0) {
    throw new Error(unavailableMessage);
  }

  const updates = activeStocks
    .map((s) => ({
      stockId: s.id,
      currentPrice: quoteMap.get(String(s.symbol).trim()) || 0,
    }))
    .filter((u) => u.currentPrice > 0);

  return { updates, failed: activeStocks.length - updates.length };
}

async function fetchServerStockPrices(stocks: any[]) {
  if (stocks.length === 0) return { updates: [], failed: 0 };
  const fetchRes = await apiPost("/api/stocks/batch-fetch", {
    stockIds: stocks.map((s) => s.id),
  });
  const results: any[] = fetchRes.results || [];
  const successful = results.filter(
    (r: any) => r.status === "ok" && Number(r.currentPrice) > 0,
  );
  return {
    updates: successful.map((r: any) => ({
      stockId: r.stockId,
      currentPrice: r.currentPrice,
    })),
    failed: stocks.length - successful.length,
  };
}

async function fetchUserSideStockPrices(
  stocks: any[],
  unavailableMessage: string,
) {
  const twStocks = stocks.filter(
    (s) => String(s.market || "TW").toUpperCase() === "TW",
  );
  const usStocks = stocks.filter(
    (s) => String(s.market || "TW").toUpperCase() === "US",
  );
  let twResult;
  try {
    twResult = await fetchBrowserStockPrices(twStocks, unavailableMessage);
  } catch (error) {
    if (process.env.NODE_ENV === "development")
      console.warn("[stocks] browser Taiwan quote failed", error);
    twResult = await fetchServerStockPrices(twStocks);
  }
  const usResult = await fetchServerStockPrices(usStocks);
  return {
    updates: [...twResult.updates, ...usResult.updates],
    failed: twResult.failed + usResult.failed,
  };
}

export default function PortfolioClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const [stocks, setStocks] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [symbolLooking, setSymbolLooking] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [priceModal, setPriceModal] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceResult, setPriceResult] = useState<{
    updated: number;
    failed: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet("/api/stocks");
      if (Array.isArray(resp)) {
        setStocks(resp);
        setSummary(null);
      } else if (resp?.stocks) {
        setStocks(resp.stocks);
        setSummary(resp.portfolioSummary || null);
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development")
        console.warn("[stocks] load failed", error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSymbolBlur() {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym || editId) return;
    setSymbolLooking(true);
    try {
      const data = await apiGet(
        `/api/stocks/quote?symbol=${encodeURIComponent(sym)}&market=${form.market}`,
      );
      if (data?.name) setForm((f) => ({ ...f, name: f.name || data.name }));
      const t =
        data?.stockType ||
        (form.market === "TW"
          ? /^00\d|^006/.test(sym)
            ? "etf"
            : sym.length >= 7
              ? "warrant"
              : "stock"
          : "stock");
      setForm((f) => ({ ...f, stockType: t }));
    } catch (error) {
      if (process.env.NODE_ENV === "development")
        console.warn("[stocks] symbol lookup failed", error);
    }
    setSymbolLooking(false);
  }

  async function handleBatchFetchPrices() {
    setUpdatingPrices(true);
    setPriceResult(null);
    try {
      const { updates, failed } = await fetchUserSideStockPrices(
        stocks,
        t("features.stocks.portfolio.browserQuoteUnavailable"),
      );
      if (updates.length > 0) {
        await apiPost("/api/stocks/batch-price", { updates });
      }
      setPriceResult({ updated: updates.length, failed });
      await load();
    } catch (e: any) {
      alert(e.message);
    }
    setUpdatingPrices(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim()) {
      setFormError(t("features.stocks.portfolio.messages.symbolRequired"));
      return;
    }
    setSaving(true);
    setFormError("");
    const body = {
      market: form.market,
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim(),
      stockType: form.stockType,
      note: form.note,
    };
    try {
      if (editId) {
        await apiPut(`/api/stocks/${editId}`, body);
      } else {
        await apiPost("/api/stocks", body);
      }
      await load();
    } catch (e: any) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function handleDelete(stock: any) {
    if (
      !confirm(
        t("mobile.dynamic.deleteStock", {
          symbol: stock.symbol,
          name: stock.name,
        }),
      )
    )
      return;
    try {
      await apiDelete(`/api/stocks/${stock.id}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  const totalDiv =
    summary?.totalDividendTwd ??
    stocks.reduce(
      (s, st) => s + (Number(st.totalDividendTwd ?? st.totalDividend) || 0),
      0,
    );
  const totalMV =
    summary?.totalMarketValue ??
    stocks.reduce((s, st) => s + (Number(st.marketValue) || 0), 0);
  const totalCost =
    summary?.totalCost ??
    stocks.reduce((s, st) => s + (Number(st.totalCost) || 0), 0);
  const totalPL =
    summary?.totalPL ??
    stocks.reduce((s, st) => s + (Number(st.estimatedProfit) || 0), 0);
  const overallRate =
    summary?.totalReturnRate ??
    (totalCost > 0 ? Math.round((totalPL / totalCost) * 10000) / 100 : null);
  const activeStocks = stocks.filter(
    (s) =>
      (s.totalShares || 0) > 0 ||
      (s.totalCost || 0) > 0 ||
      (s.marketValue || 0) > 0,
  );
  const stockTypeOptions = STOCK_TYPE_VALUES.map((value) => ({
    value,
    label: t(`features.stocks.common.stockType.${value}`),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {t("features.stocks.portfolio.title")}
      </h2>
      <StocksTabNav />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: t("features.stocks.portfolio.totalMarketValue"),
            value: fmt(totalMV, locale),
            color: "text-[var(--primary)]",
          },
          {
            label: t("features.stocks.portfolio.totalCost"),
            value: fmt(totalCost, locale),
            color: "text-[var(--text)]",
          },
          {
            label: t("features.stocks.common.estimatedPL"),
            value: fmtPL(totalPL, locale),
            color: plClass(totalPL),
          },
          {
            label: t("features.stocks.portfolio.totalDividend"),
            value: fmt(totalDiv, locale),
            color: "text-[var(--today)]",
          },
          {
            label: t("features.stocks.common.overallReturnRate"),
            value:
              overallRate === null
                ? t("features.common.notRecorded")
                : `${overallRate >= 0 ? "+" : ""}${overallRate}%`,
            color: plClass(overallRate || 0),
          },
        ].map((item, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
              {item.label}
            </p>
            <p
              className={`text-xl font-bold ${item.color || "text-[var(--text)]"}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditId(null);
            setFormError("");
            setAddDialogOpen(true);
          }}
        >
          <Plus size={16} className="mr-2" />{" "}
          {t("features.stocks.portfolio.addStock")}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setPriceResult(null);
            setPriceModal(true);
          }}
        >
          <RefreshCw size={16} className="mr-2" />{" "}
          {t("features.stocks.portfolio.updatePrices")}
        </Button>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId
                ? t("features.stocks.portfolio.editStock")
                : t("features.stocks.portfolio.newStock")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select
              label={t("features.stocks.common.market")}
              options={[
                {
                  value: "TW",
                  label: t("features.stocks.common.marketTaiwan"),
                },
                { value: "US", label: t("features.stocks.common.marketUs") },
              ]}
              value={form.market}
              onChange={(e) =>
                setForm((f) => ({ ...f, market: e.target.value, name: "" }))
              }
            />
            <div className="relative">
              <Input
                label={t("features.stocks.common.stockSymbol")}
                value={form.symbol}
                onChange={(e) =>
                  setForm((f) => ({ ...f, symbol: e.target.value }))
                }
                onBlur={handleSymbolBlur}
              />
              {symbolLooking && (
                <p className="text-xs text-slate-400 mt-1">
                  {t("features.stocks.common.searching")}
                </p>
              )}
            </div>
            <Input
              label={t("features.stocks.common.stockName")}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Select
              label={t("features.common.type")}
              options={stockTypeOptions}
              value={form.stockType}
              onChange={(e) =>
                setForm((f) => ({ ...f, stockType: e.target.value }))
              }
            />
            <Input
              label={t("features.common.note")}
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={priceModal} onOpenChange={setPriceModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("features.stocks.portfolio.updatePrices")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              {t("features.stocks.portfolio.priceModalDescription")}
            </p>
            {priceResult && (
              <p className="text-sm text-green-700 bg-green-50 p-3 rounded">
                {t(
                  priceResult.failed > 0
                    ? "features.stocks.portfolio.priceResultWithFailed"
                    : "features.stocks.portfolio.priceResult",
                  { updated: priceResult.updated, failed: priceResult.failed },
                )}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPriceModal(false)}>
                {t("common.close")}
              </Button>
              <Button
                onClick={handleBatchFetchPrices}
                disabled={updatingPrices}
              >
                {updatingPrices
                  ? t("features.stocks.portfolio.updating")
                  : t("features.stocks.portfolio.batchUpdate")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-5 w-12 rounded-full bg-[var(--border)]" />
                <div className="h-6 w-20 rounded bg-[var(--border)]" />
              </div>
              <div className="border-t border-[var(--border)] pt-3 grid grid-cols-2 gap-y-2 gap-x-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className="h-4 rounded bg-[var(--border)]" />
                ))}
              </div>
              <div className="h-16 rounded-lg bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeStocks.map((s) => {
            const ep = Number(s.estimatedProfit) || 0;
            const rr = Number(s.returnRate) || 0;
            const typeBadge = {
              etf: {
                label: "ETF",
                cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
              },
              warrant: {
                label: t("features.stocks.common.stockType.warrant"),
                cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
              },
              stock: {
                label: t("features.stocks.common.stockType.stock"),
                cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
              },
            }[s.stockType as "etf" | "warrant" | "stock"] ?? {
              label: s.stockType,
              cls: "bg-slate-100 text-slate-600",
            };
            const plBg =
              ep > 0
                ? "bg-[var(--success-bg)]"
                : ep < 0
                  ? "bg-[var(--danger-bg)]"
                  : "bg-[var(--border)]/30";
            return (
              <div
                key={s.id}
                className="card group p-5 space-y-3 cursor-default transition-[box-shadow,transform] duration-[250ms] ease-[cubic-bezier(.4,0,.2,1)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${typeBadge.cls}`}
                    >
                      {typeBadge.label}
                    </span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {String(s.market || "TW").toUpperCase() === "US"
                        ? t("features.stocks.common.marketUs")
                        : t("features.stocks.common.marketTaiwan")}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text)] truncate">
                      {s.symbol}
                    </h3>
                    <span className="text-sm text-[var(--text-secondary)] truncate">
                      {s.name}
                    </span>
                  </div>
                  <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setForm({
                          market: s.market || "TW",
                          symbol: s.symbol,
                          name: s.name,
                          stockType: s.stockType,
                          note: s.note,
                        });
                        setEditId(s.id);
                        setFormError("");
                        setAddDialogOpen(true);
                      }}
                    >
                      <Edit3 size={15} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-[var(--danger)]"
                      onClick={() => handleDelete(s)}
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                {/* ETF dividend months */}
                {s.stockType === "etf" && (
                  <p className="text-xs text-[var(--text-muted)]">
                    {Array.isArray(s.dividendMonths) &&
                    s.dividendMonths.length > 0
                      ? t("features.stocks.portfolio.dividendMonths", {
                          months: formatDividendMonths(
                            s.dividendMonths,
                            locale,
                          ),
                        })
                      : t("features.stocks.portfolio.dividendMonthsEmpty")}
                  </p>
                )}

                {/* Metrics grid */}
                <div className="border-t border-[var(--border)] pt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <div>
                    <span className="text-[var(--text-muted)]">
                      {t("features.stocks.portfolio.heldShares")}
                    </span>
                    <p className="font-medium text-[var(--text)]">
                      {t("features.stocks.portfolio.shareUnit", {
                        count: Number(s.totalShares).toLocaleString(
                          localeTag(locale),
                        ),
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">
                      {t("features.stocks.portfolio.currentPrice")}
                    </span>
                    <p className="font-medium text-[var(--text)]">
                      {s.currentPrice > 0
                        ? fmtCurrency(s.currentPrice, s.currency, locale)
                        : t("features.common.notRecorded")}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">
                      {t("features.stocks.common.costAverage")}
                    </span>
                    <p className="font-medium text-[var(--text)]">
                      {fmtCurrency(s.avgCost || 0, s.currency, locale)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">
                      {t("features.stocks.portfolio.marketValue")}
                    </span>
                    <p className="font-medium text-[var(--text)]">
                      {fmtCurrency(s.marketValue, s.currency, locale)}
                    </p>
                  </div>
                </div>

                {/* P&L block */}
                <div
                  className={`${plBg} rounded-lg p-3 flex items-center justify-between gap-2`}
                >
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">
                      {t("features.stocks.common.estimatedPL")}
                    </p>
                    <p className={`text-base font-bold ${plClass(ep)}`}>
                      {fmtPL(ep, locale, s.currency)}
                      <span className="ml-1.5 text-sm font-semibold">
                        {ep === 0
                          ? ""
                          : `(${rr >= 0 ? "+" : ""}${rr.toFixed(2)}%)`}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">
                      {t("features.stocks.portfolio.totalDividend")}
                    </p>
                    <p className="text-sm font-semibold text-[var(--today)]">
                      {fmtCurrency(s.totalDividend, s.currency, locale)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
