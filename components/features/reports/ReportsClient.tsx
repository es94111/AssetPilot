'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet } from '@/lib/clientApi';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Chart from 'chart.js/auto';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

function fmt(n: number | string, locale: string) {
  return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString(localeTag(locale));
}

function percentOf(total: number, value: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function groupCategoryRows(rows: any[], uncategorized: string) {
  const groups = new Map<string, any>();
  rows.forEach((row, index) => {
    const parentName = row.parentName || row.name || uncategorized;
    const parentId = row.parentId || `parent-${parentName}-${index}`;
    if (!groups.has(parentId)) {
      groups.set(parentId, {
        parentId,
        parentName,
        parentColor: row.parentColor || row.color || '#94a3b8',
        total: 0,
        children: [],
      });
    }
    const group = groups.get(parentId);
    const amount = Number(row.total) || 0;
    group.total += amount;
    group.children.push({
      ...row,
      name: row.name || parentName,
      color: row.color || row.parentColor || '#94a3b8',
      total: amount,
    });
  });
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

function getDateRange(period: string, customFrom: string, customTo: string) {
  const now = new Date();
  let from = new Date(now.getFullYear(), now.getMonth(), 1);
  let to = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'lastMonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'last3':
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      break;
    case 'last6':
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      break;
    case 'thisYear':
      from = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      if (customFrom) from = new Date(customFrom);
      if (customTo) to = new Date(customTo);
      break;
  }
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

function shiftPeriod(from: string, to: string) {
  const start = new Date(from);
  const end = new Date(to);
  const span = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const previousStart = new Date(previousEnd.getTime() - span);
  return {
    from: previousStart.toISOString().split('T')[0],
    to: previousEnd.toISOString().split('T')[0],
  };
}

function compareText(current: number, previous: number, locale: string, t: (path: string, vars?: Record<string, string | number>) => string) {
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  const formattedDelta = `${sign}${fmt(delta, locale)}`;
  if (previous === 0) return t('features.reports.previousNoData', { delta: formattedDelta });
  const rate = Math.round((delta / previous) * 10000) / 100;
  return t('features.reports.compareWithRate', { delta: formattedDelta, rate: `${sign}${rate}` });
}

function categoryRowKey(row: any) {
  return [
    row?.parentId || '',
    row?.categoryId || '',
    row?.name || '',
    row?.isOtherGroup ? 'other' : 'item',
  ].join('|');
}

export default function ReportsClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const initialTab = searchParams.get('tab');
  const initialPeriod = searchParams.get('period');
  const initialType = searchParams.get('type');
  const [activeTab, setActiveTab] = useState<'category' | 'trend' | 'daily'>(initialTab === 'trend' || initialTab === 'daily' ? initialTab : 'category');
  const [period, setPeriod] = useState(initialPeriod || 'thisMonth');
  const [type, setType] = useState(initialType === 'income' ? 'income' : 'expense');
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') || '');
  const [customTo, setCustomTo] = useState(searchParams.get('to') || '');
  const [reportData, setReportData] = useState<any>(null);
  const [previousReportData, setPreviousReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);
  // Chart data signature: skip rebuilds when data is unchanged during polling.
  const chartSignatureRef = useRef<string | null>(null);
  // Track the active theme so charts re-render with theme-matched axis/legend colors.
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const readTheme = () => setIsDarkTheme(root.classList.contains('dark-mode'));
    readTheme();
    const observer = new MutationObserver(readTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const fetchReport = useCallback(async (opts: { silent?: boolean } = {}) => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    const previous = shiftPeriod(from, to);
    if (!opts.silent) setLoading(true);
    try {
      const [currentData, previousData] = await Promise.all([
        apiGet(`/api/reports?type=${type}&from=${from}&to=${to}`),
        apiGet(`/api/reports?type=${type}&from=${previous.from}&to=${previous.to}`).catch(() => null),
      ]);
      setReportData(currentData);
      setPreviousReportData(previousData);
    } catch (_) {}
    if (!opts.silent) setLoading(false);
  }, [period, customFrom, customTo, type]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    const nextTab = searchParams.get('tab');
    const nextPeriod = searchParams.get('period') || 'thisMonth';
    const nextType = searchParams.get('type') === 'income' ? 'income' : 'expense';
    const nextFrom = searchParams.get('from') || '';
    const nextTo = searchParams.get('to') || '';
    const normalizedTab = nextTab === 'trend' || nextTab === 'daily' ? nextTab : 'category';
    if (normalizedTab !== activeTab) setActiveTab(normalizedTab);
    if (nextPeriod !== period) setPeriod(nextPeriod);
    if (nextType !== type) setType(nextType);
    if (nextFrom !== customFrom) setCustomFrom(nextFrom);
    if (nextTo !== customTo) setCustomTo(nextTo);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    params.set('period', period);
    params.set('type', type);
    if (customFrom) params.set('from', customFrom);
    if (customTo) params.set('to', customTo);
    const nextQuery = params.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [activeTab, period, type, customFrom, customTo, currentQuery, pathname, router]);

  useEffect(() => {
    function refreshVisibleReport() {
      if (document.visibilityState === 'visible') void fetchReport();
    }

    window.addEventListener('focus', refreshVisibleReport);
    document.addEventListener('visibilitychange', refreshVisibleReport);
    return () => {
      window.removeEventListener('focus', refreshVisibleReport);
      document.removeEventListener('visibilitychange', refreshVisibleReport);
    };
  }, [fetchReport]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchReport({ silent: true });
    }, 10000);
    return () => window.clearInterval(timer);
  }, [fetchReport]);

  const catRows = useMemo(() => Array.isArray(reportData?.categoryBreakdown)
    ? reportData.categoryBreakdown.filter((row: any) => Number(row.total) > 0).sort((a: any, b: any) => Number(b.total) - Number(a.total))
    : [], [reportData]);

  useEffect(() => {
    if (!reportData || !chartRef.current) return;

    // Rebuild the chart only when the data signature actually changes.
    // This keeps silent polling from causing visible chart flicker.
    let signature: string;
    if (activeTab === 'category') {
      signature = 'category|' + type + '|' + catRows.map((r: any) => `${r.name}:${r.total}:${r.color}`).join(',');
    } else {
      const dataSet = activeTab === 'trend' ? (reportData?.monthlyMap || {}) : (reportData?.dailyMap || {});
      signature = activeTab + '|' + type + '|' + Object.keys(dataSet).sort().map((k) => `${k}:${dataSet[k]}`).join(',');
    }
    // Theme participates in the signature so switching light/dark rebuilds the chart.
    signature += '|theme:' + (isDarkTheme ? 'dark' : 'light');
    const sameCanvas = chartInstanceRef.current?.canvas === chartRef.current;
    if (chartInstanceRef.current && sameCanvas && chartSignatureRef.current === signature) return;

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Theme-aware chrome resolved from CSS variables at render time.
    const styles = getComputedStyle(document.documentElement);
    const cssVar = (name: string, fallback: string) => (styles.getPropertyValue(name) || '').trim() || fallback;
    const textColor = cssVar('--text-secondary', isDarkTheme ? '#b3a99c' : '#6b6157');
    const gridColor = isDarkTheme ? 'rgba(255, 255, 255, 0.08)' : 'rgba(38, 34, 28, 0.08)';
    const legendLabels = {
      color: textColor,
      usePointStyle: true,
      pointStyle: 'circle' as const,
      padding: 16,
      font: { size: 12 },
    };
    // Warm Console palette: 暖赭為首，後接語意色與暖色階輪替。
    const colors = ['#b0521c', '#1e6b52', '#8a5a1f', '#b3372f', '#d98a4a', '#5f8d7a', '#c98a3d', '#9c4a3a', '#7d9464', '#a8683a'];
    let chartConfig: any = { type: 'bar', data: { datasets: [] }, options: { responsive: true } };

    if (activeTab === 'category') {
      const filtered = catRows;
      chartConfig = {
        type: 'pie',
        data: {
          labels: filtered.map((row: any) => row.name || t('features.common.uncategorized')),
          datasets: [{
            data: filtered.map((row: any) => Number(row.total) || 0),
            backgroundColor: filtered.map((row: any, index: number) => row.color || colors[index % colors.length]),
            borderColor: isDarkTheme ? '#1d1a16' : '#fffdf9',
            borderWidth: 2,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: legendLabels },
            tooltip: {
              backgroundColor: isDarkTheme ? '#242019' : '#26221c',
              titleColor: '#ece7de',
              bodyColor: '#ece7de',
              padding: 10,
              cornerRadius: 8,
            },
          },
          onClick: (_event: any, elements: any[]) => {
            if (!elements.length) return;
            const row = filtered[elements[0].index];
            setSelectedCategoryKey(row ? categoryRowKey(row) : null);
          },
        },
      };
    } else {
      const dataSet = activeTab === 'trend' ? (reportData?.monthlyMap || {}) : (reportData?.dailyMap || {});
      const sortedKeys = Object.keys(dataSet).sort();
      chartConfig = {
        type: 'bar',
        data: {
          labels: sortedKeys,
          datasets: [{
            label: type === 'expense' ? t('features.common.expense') : t('features.common.income'),
            data: sortedKeys.map((key) => Number(dataSet[key]) || 0),
            backgroundColor: type === 'expense'
              ? (isDarkTheme ? 'rgba(224, 130, 121, 0.75)' : 'rgba(179, 55, 47, 0.8)')
              : (isDarkTheme ? 'rgba(108, 194, 155, 0.75)' : 'rgba(30, 107, 82, 0.8)'),
            borderRadius: 6,
            maxBarThickness: 48,
          }],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: legendLabels },
            tooltip: {
              backgroundColor: isDarkTheme ? '#242019' : '#26221c',
              titleColor: '#ece7de',
              bodyColor: '#ece7de',
              padding: 10,
              cornerRadius: 8,
            },
          },
          scales: {
            x: {
              ticks: { color: textColor, font: { size: 11 } },
              grid: { display: false },
              border: { color: gridColor },
            },
            y: {
              beginAtZero: true,
              ticks: { color: textColor, font: { size: 11 } },
              grid: { color: gridColor, drawTicks: false },
              border: { display: false },
            },
          },
        },
      };
    }

    chartInstanceRef.current = new Chart(ctx, chartConfig);
    chartSignatureRef.current = signature;
  }, [reportData, activeTab, type, catRows, t, isDarkTheme]);

  // Destroy the chart only on unmount so data refreshes can reuse it.
  useEffect(() => () => {
    chartInstanceRef.current?.destroy();
    chartInstanceRef.current = null;
  }, []);

  const grandTotal = reportData?.total || catRows.reduce((sum: number, row: any) => sum + Number(row.total), 0);
  const previousTotal = previousReportData?.total || 0;
  const selectedRow = selectedCategoryKey ? catRows.find((row: any) => categoryRowKey(row) === selectedCategoryKey) : null;
  const expenseGroups = useMemo(() => groupCategoryRows(catRows, t('features.common.uncategorized')), [catRows, t]);

  function jumpToTransactions(row: any) {
    const { from, to } = getDateRange(period, customFrom, customTo);
    const categoryId = row?.categoryId || (row?.isOtherGroup ? row?.parentId : '');
    const params = new URLSearchParams({
      type,
      dateFrom: from,
      dateTo: to,
    });
    if (categoryId) params.set('categoryId', categoryId);
    router.push(`/finance/transactions?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('features.reports.title')}</h2>
      <div className="flex gap-2 border-b" style={{ borderColor: 'var(--border)' }}>
        {(['category', 'trend', 'daily'] as const).map((tab) => (
          <button
            key={tab}
            className="relative px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ color: activeTab === tab ? 'var(--primary)' : 'var(--text-secondary)', fontWeight: activeTab === tab ? 600 : 500 }}
            onClick={() => setActiveTab(tab)}
          >
            {t(`features.reports.tabs.${tab}`)}
            <span
              aria-hidden="true"
              className="absolute inset-x-2 bottom-0 h-0.5 rounded-full"
              style={{ background: activeTab === tab ? 'var(--primary)' : 'transparent' }}
            />
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select options={[
          { label: t('features.reports.periods.thisMonth'), value: 'thisMonth' },
          { label: t('features.reports.periods.lastMonth'), value: 'lastMonth' },
          { label: t('features.reports.periods.last3'), value: 'last3' },
          { label: t('features.reports.periods.last6'), value: 'last6' },
          { label: t('features.reports.periods.thisYear'), value: 'thisYear' },
          { label: t('features.reports.periods.custom'), value: 'custom' },
        ]} value={period} onChange={(e) => setPeriod(e.target.value)} label={t('features.reports.periodLabel')} className="w-40" />
        {period === 'custom' && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} label={t('features.reports.start')} />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} label={t('features.reports.end')} />
          </>
        )}
        <Select options={[{ label: t('features.common.expense'), value: 'expense' }, { label: t('features.common.income'), value: 'income' }]} value={type} onChange={(e) => setType(e.target.value)} label={t('features.common.type')} className="w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">{t('features.reports.currentTotal')}</p>
          <p className="text-2xl font-semibold text-slate-900">{fmt(grandTotal, locale)}</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">{t('features.reports.comparedPrevious')}</p>
          <p className={`text-xl font-semibold ${(grandTotal - previousTotal) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{compareText(grandTotal, previousTotal, locale, t)}</p>
        </div>
      </div>

      {loading ? (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm space-y-3" aria-busy="true">
          <div className="ui-skeleton h-64 w-full" />
        </div>
      ) : (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <canvas ref={chartRef} className="max-h-96" />
        </div>
      )}

      {activeTab === 'category' && catRows.length > 0 && (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-lg">{t('features.reports.detailTitle', { type: type === 'expense' ? t('features.common.expense') : t('features.common.income') })}</h3>
            <p className="font-bold">{t('features.reports.total', { amount: fmt(grandTotal, locale) })}</p>
          </div>
          {selectedRow && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{t('features.reports.selectedCategory')}<strong>{selectedRow.parentName && selectedRow.parentName !== selectedRow.name ? `${selectedRow.parentName} › ` : ''}{selectedRow.name}</strong>{t('features.reports.selectedCategoryAmount', { amount: fmt(selectedRow.total, locale) })}</span>
                <button type="button" className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/50" onClick={() => jumpToTransactions(selectedRow)}>
                  {t('features.reports.viewTransactions')}
                </button>
              </div>
            </div>
          )}
          {type === 'expense' ? expenseGroups.map((group: any) => {
            const percentage = grandTotal > 0 ? Math.round((Number(group.total) / grandTotal) * 100) : 0;
            return (
              <div key={group.parentId} className="rounded-lg px-2 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: group.parentColor }} />
                  <span className="flex-1 text-left font-medium">{group.parentName}</span>
                  <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full flex overflow-hidden" style={{ width: `${percentOf(grandTotal, group.total)}%`, background: group.parentColor }}>
                      {group.children.map((child: any, childIndex: number) => {
                        const width = group.total > 0 ? (Number(child.total) / group.total) * 100 : 0;
                        return (
                          <div
                            key={`${group.parentId}-${child.name}-bar-${childIndex}`}
                            title={`${child.name} ${fmt(child.total, locale)}`}
                            style={{ width: `${width}%`, background: child.color || '#94a3b8', height: '100%' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className="w-12 text-right">{percentage}%</span>
                  <span className="w-24 text-right font-medium">{fmt(group.total, locale)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-slate-500 dark:text-slate-400">
                  {group.children.map((child: any, childIndex: number) => {
                    const selected = selectedCategoryKey === categoryRowKey(child);
                    return (
                      <button key={`${group.parentId}-${child.name}-${childIndex}`} type="button" className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`} onClick={() => setSelectedCategoryKey(categoryRowKey(child))} onDoubleClick={() => jumpToTransactions(child)}>
                        <span className="w-2 h-2 rounded-full" style={{ background: child.color || '#94a3b8' }} />
                        {child.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }) : catRows.map((row: any, index: number) => {
            const percentage = grandTotal > 0 ? Math.round((Number(row.total) / grandTotal) * 100) : 0;
            const selected = selectedCategoryKey === categoryRowKey(row);
            return (
              <button key={`${row.parentId}-${index}`} type="button" className={`w-full flex items-center gap-3 text-sm rounded-lg px-2 py-2 transition ${selected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`} onClick={() => setSelectedCategoryKey(categoryRowKey(row))} onDoubleClick={() => jumpToTransactions(row)}>
                <span className="w-3 h-3 rounded-full" style={{ background: row.color || '#94a3b8' }} />
                <span className="flex-1 text-left">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name || t('features.common.uncategorized')}</span>
                <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: row.color || '#94a3b8' }} />
                </div>
                <span className="w-12 text-right">{percentage}%</span>
                <span className="w-24 text-right font-medium">{fmt(row.total, locale)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
