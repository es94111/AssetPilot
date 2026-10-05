"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/clientApi";
import {
  aggregateStockHistory,
  getStockHistoryBucketKey,
  type StockHistoryCandle,
  type StockHistoryInterval,
  type StockHistoryTrade,
} from "@/lib/stockHistory";
import { useT } from "@/components/i18n/I18nProvider";
import { localeTag } from "@/lib/i18n/localeTag";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StockSummary = {
  id: string;
  symbol: string;
  name: string;
  currency?: string;
};

type HistoryResponse = {
  candles: StockHistoryCandle[];
  transactions: StockHistoryTrade[];
};

const WIDTH = 900;
const HEIGHT = 350;
const PLOT = { left: 66, right: 18, top: 18, bottom: 42 };
function dateLabel(value: string, locale: string, interval: StockHistoryInterval): string {
  const date = new Date(`${value.length === 7 ? `${value}-01` : value}T00:00:00Z`);
  if (interval === "month") {
    return new Intl.DateTimeFormat(localeTag(locale), { year: "2-digit", month: "2-digit", timeZone: "UTC" }).format(date);
  }
  return new Intl.DateTimeFormat(localeTag(locale), { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(date);
}

function StockCandlestickChart({
  candles,
  transactions,
  interval,
  locale,
  symbol,
  t,
}: {
  candles: StockHistoryCandle[];
  transactions: StockHistoryTrade[];
  interval: StockHistoryInterval;
  locale: string;
  symbol: string;
  t: (path: string, vars?: Record<string, string | number>) => string;
}) {
  const bars = useMemo(() => aggregateStockHistory(candles, interval), [candles, interval]);
  if (bars.length === 0) {
    return <p className="py-16 text-center text-sm text-[var(--text-secondary)]">{t("features.stocks.portfolio.chartNoData")}</p>;
  }

  const prices = [
    ...bars.flatMap((bar) => [bar.low, bar.high]),
    ...transactions.map((transaction) => transaction.price).filter((price) => price > 0),
  ];
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const pad = Math.max((rawMax - rawMin) * 0.08, rawMax * 0.005, 0.01);
  const minPrice = rawMin - pad;
  const maxPrice = rawMax + pad;
  const plotWidth = WIDTH - PLOT.left - PLOT.right;
  const plotHeight = HEIGHT - PLOT.top - PLOT.bottom;
  const slotWidth = plotWidth / bars.length;
  const candleWidth = Math.max(1.5, Math.min(12, slotWidth * 0.62));
  const y = (price: number) => PLOT.top + ((maxPrice - price) / (maxPrice - minPrice)) * plotHeight;
  const indexByBucket = new Map(bars.map((bar, index) => [getStockHistoryBucketKey(bar.date, interval), index]));
  const visibleTrades = transactions.flatMap((transaction) => {
    const index = indexByBucket.get(getStockHistoryBucketKey(transaction.date, interval));
    return index === undefined || transaction.price <= 0 ? [] : [{ ...transaction, index }];
  });
  const labelStep = Math.max(1, Math.ceil(bars.length / 8));
  const localeId = localeTag(locale);
  const priceFormatter = new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 });

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto w-full min-w-[620px]"
        role="img"
        aria-label={`${symbol} ${t("features.stocks.portfolio.historyChart")}`}
      >
        {[0, 1, 2, 3, 4].map((tick) => {
          const value = maxPrice - ((maxPrice - minPrice) * tick) / 4;
          const yPos = PLOT.top + (plotHeight * tick) / 4;
          return (
            <g key={tick}>
              <line x1={PLOT.left} x2={WIDTH - PLOT.right} y1={yPos} y2={yPos} stroke="var(--border)" strokeDasharray="3 5" />
              <text x={PLOT.left - 8} y={yPos + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">
                {priceFormatter.format(value)}
              </text>
            </g>
          );
        })}
        {bars.map((bar, index) => {
          const centerX = PLOT.left + slotWidth * (index + 0.5);
          const rising = bar.close >= bar.open;
          const color = rising ? "var(--danger)" : "var(--success)";
          const bodyTop = Math.min(y(bar.open), y(bar.close));
          const bodyHeight = Math.max(1.5, Math.abs(y(bar.open) - y(bar.close)));
          return (
            <g key={`${bar.date}-${index}`}>
              <title>{`${bar.date} · ${t("features.stocks.portfolio.chartOpen")}: ${bar.open} · ${t("features.stocks.portfolio.chartHigh")}: ${bar.high} · ${t("features.stocks.portfolio.chartLow")}: ${bar.low} · ${t("features.stocks.portfolio.chartClose")}: ${bar.close}`}</title>
              <line x1={centerX} x2={centerX} y1={y(bar.high)} y2={y(bar.low)} stroke={color} strokeWidth="1.5" />
              <rect
                x={centerX - candleWidth / 2}
                y={bodyTop}
                width={candleWidth}
                height={bodyHeight}
                rx="1"
                fill={color}
                stroke={color}
                strokeWidth="1"
              />
              {index % labelStep === 0 && (
                <text x={centerX} y={HEIGHT - 13} textAnchor="middle" fontSize="11" fill="var(--text-muted)">
                  {dateLabel(bar.date, locale, interval)}
                </text>
              )}
            </g>
          );
        })}
        {visibleTrades.map((trade, position) => {
          const centerX = PLOT.left + slotWidth * (trade.index + 0.5);
          const colliding = visibleTrades.slice(0, position).filter((other) => other.index === trade.index && Math.abs(other.price - trade.price) < (maxPrice - minPrice) * 0.02).length;
          const markerX = centerX + (colliding % 2 === 0 ? 1 : -1) * Math.ceil(colliding / 2) * 5;
          const markerY = y(trade.price);
          const color = trade.type === "buy" ? "var(--chart-buy)" : "var(--chart-sell)";
          return (
            <g key={trade.id}>
              <title>{`${trade.date} · ${t(trade.type === "buy" ? "features.stocks.portfolio.chartBuy" : "features.stocks.portfolio.chartSell")}: ${trade.shares} @ ${trade.price}`}</title>
              {trade.type === "buy" ? (
                <path d={`M ${markerX} ${markerY - 6} L ${markerX + 5} ${markerY + 4} L ${markerX - 5} ${markerY + 4} Z`} fill={color} stroke="var(--surface)" strokeWidth="1" />
              ) : (
                <path d={`M ${markerX} ${markerY + 6} L ${markerX + 5} ${markerY - 4} L ${markerX - 5} ${markerY - 4} Z`} fill={color} stroke="var(--surface)" strokeWidth="1" />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function StockHistoryDialog({
  stock,
  open,
  onOpenChange,
}: {
  stock: StockSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useT();
  const [interval, setInterval] = useState<StockHistoryInterval>("day");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !stock) return;
    let active = true;
    setLoading(true);
    setError("");
    setHistory(null);
    apiGet(`/api/stocks/${encodeURIComponent(stock.id)}/history`)
      .then((data) => {
        if (active) setHistory(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || t("features.stocks.portfolio.chartUnavailable"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, stock?.id]);

  const intervalOptions: Array<{ value: StockHistoryInterval; label: string }> = [
    { value: "day", label: t("features.stocks.portfolio.intervalDay") },
    { value: "week", label: t("features.stocks.portfolio.intervalWeek") },
    { value: "month", label: t("features.stocks.portfolio.intervalMonth") },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {stock ? `${stock.symbol} ${stock.name} · ` : ""}{t("features.stocks.portfolio.historyChart")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-[var(--border)] p-1" aria-label={t("features.stocks.portfolio.chartInterval")}>
              {intervalOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={interval === option.value ? "default" : "ghost"}
                  aria-pressed={interval === option.value}
                  onClick={() => setInterval(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-secondary)]">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-buy)]" />{t("features.stocks.portfolio.chartBuy")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[var(--chart-sell)]" />{t("features.stocks.portfolio.chartSell")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-2 rounded-sm bg-[var(--danger)]" />{t("features.stocks.portfolio.chartRising")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-2 rounded-sm bg-[var(--success)]" />{t("features.stocks.portfolio.chartFalling")}</span>
            </div>
          </div>
          {loading ? (
            <p className="py-16 text-center text-sm text-[var(--text-secondary)]">{t("features.stocks.portfolio.chartLoading")}</p>
          ) : error ? (
            <p className="rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger)]">{error}</p>
          ) : history ? (
            <StockCandlestickChart
              candles={history.candles}
              transactions={history.transactions}
              interval={interval}
              locale={locale}
              symbol={stock?.symbol || ""}
              t={t}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
