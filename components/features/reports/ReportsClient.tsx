'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiGet } from '@/lib/clientApi';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Chart from 'chart.js/auto';
import { useRouter } from 'next/navigation';

function fmt(n: number | string) {
  return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW');
}

function percentOf(total: number, value: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function groupCategoryRows(rows: any[]) {
  const groups = new Map<string, any>();
  rows.forEach((row, index) => {
    const parentName = row.parentName || row.name || '未分類';
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

function compareText(current: number, previous: number) {
  const delta = current - previous;
  const sign = delta > 0 ? '+' : '';
  if (previous === 0) return `${sign}${fmt(delta)}，前期無資料`;
  const rate = Math.round((delta / previous) * 10000) / 100;
  return `${sign}${fmt(delta)} (${sign}${rate}%)`;
}

export default function ReportsClient(_props: { user?: any } = {}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'category' | 'trend' | 'daily'>('category');
  const [period, setPeriod] = useState('thisMonth');
  const [type, setType] = useState('expense');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [previousReportData, setPreviousReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const fetchReport = useCallback(async () => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    const previous = shiftPeriod(from, to);
    setLoading(true);
    try {
      const [currentData, previousData] = await Promise.all([
        apiGet(`/api/reports?type=${type}&from=${from}&to=${to}`),
        apiGet(`/api/reports?type=${type}&from=${previous.from}&to=${previous.to}`).catch(() => null),
      ]);
      setReportData(currentData);
      setPreviousReportData(previousData);
    } catch (_) {}
    setLoading(false);
  }, [period, customFrom, customTo, type]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

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

  const catRows = useMemo(() => Array.isArray(reportData?.categoryBreakdown)
    ? reportData.categoryBreakdown.filter((row: any) => Number(row.total) > 0).sort((a: any, b: any) => Number(b.total) - Number(a.total))
    : [], [reportData]);

  useEffect(() => {
    if (!reportData || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
    let chartConfig: any = { type: 'bar', data: { datasets: [] }, options: { responsive: true } };

    if (activeTab === 'category') {
      const filtered = catRows;
      chartConfig = {
        type: 'pie',
        data: {
          labels: filtered.map((row: any) => row.name || '未分類'),
          datasets: [{
            data: filtered.map((row: any) => Number(row.total) || 0),
            backgroundColor: filtered.map((row: any, index: number) => row.color || colors[index % colors.length]),
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'bottom' } },
          onClick: (_event: any, elements: any[]) => {
            if (!elements.length) return;
            const row = filtered[elements[0].index];
            setSelectedCategory(row?.name || null);
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
            label: type === 'expense' ? '支出' : '收入',
            data: sortedKeys.map((key) => Number(dataSet[key]) || 0),
            backgroundColor: type === 'expense' ? '#ef4444' : '#10b981',
          }],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } },
      };
    }

    chartInstanceRef.current = new Chart(ctx, chartConfig);
    return () => { chartInstanceRef.current?.destroy(); };
  }, [reportData, activeTab, type, catRows]);

  const grandTotal = reportData?.total || catRows.reduce((sum: number, row: any) => sum + Number(row.total), 0);
  const previousTotal = previousReportData?.total || 0;
  const selectedRow = selectedCategory ? catRows.find((row: any) => row.name === selectedCategory) : null;
  const expenseGroups = useMemo(() => groupCategoryRows(catRows), [catRows]);

  function jumpToTransactions(row: any) {
    const { from, to } = getDateRange(period, customFrom, customTo);
    const params = new URLSearchParams({
      type,
      dateFrom: from,
      dateTo: to,
    });
    if (row?.categoryId) params.set('categoryId', row.categoryId);
    router.push(`/finance/transactions?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">統計報表</h2>
      <div className="flex gap-2 border-b">
        {(['category', 'trend', 'daily'] as const).map((tab) => (
          <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'category' ? '分類統計' : tab === 'trend' ? '趨勢分析' : '每日消費'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select options={[{ label: '本月', value: 'thisMonth' }, { label: '上月', value: 'lastMonth' }, { label: '近3個月', value: 'last3' }, { label: '近6個月', value: 'last6' }, { label: '今年', value: 'thisYear' }, { label: '自訂', value: 'custom' }]} value={period} onChange={(e) => setPeriod(e.target.value)} label="期間" className="w-40" />
        {period === 'custom' && (
          <>
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} label="開始" />
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} label="結束" />
          </>
        )}
        <Select options={[{ label: '支出', value: 'expense' }, { label: '收入', value: 'income' }]} value={type} onChange={(e) => setType(e.target.value)} label="類型" className="w-32" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">本期合計</p>
          <p className="text-2xl font-semibold text-slate-900">{fmt(grandTotal)}</p>
        </div>
        <div className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">相較前期</p>
          <p className={`text-xl font-semibold ${(grandTotal - previousTotal) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{compareText(grandTotal, previousTotal)}</p>
        </div>
      </div>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <canvas ref={chartRef} className="max-h-96" />
        </div>
      )}

      {activeTab === 'category' && catRows.length > 0 && (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-lg">{type === 'expense' ? '支出' : '收入'}明細</h3>
            <p className="font-bold">合計：{fmt(grandTotal)}</p>
          </div>
          {selectedRow && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>已選取分類：<strong>{selectedRow.parentName && selectedRow.parentName !== selectedRow.name ? `${selectedRow.parentName} › ` : ''}{selectedRow.name}</strong>，金額 {fmt(selectedRow.total)}</span>
                <button type="button" className="rounded-md border border-blue-300 px-3 py-1 text-xs font-medium hover:bg-blue-100 dark:border-blue-800 dark:hover:bg-blue-900/50" onClick={() => jumpToTransactions(selectedRow)}>
                  查看對應交易
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
                            title={`${child.name} ${fmt(child.total)}`}
                            style={{ width: `${width}%`, background: child.color || '#94a3b8', height: '100%' }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <span className="w-12 text-right">{percentage}%</span>
                  <span className="w-24 text-right font-medium">{fmt(group.total)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 pl-6 text-xs text-slate-500 dark:text-slate-400">
                  {group.children.map((child: any, childIndex: number) => {
                    const selected = selectedCategory === child.name;
                    return (
                      <button key={`${group.parentId}-${child.name}-${childIndex}`} type="button" className={`inline-flex items-center gap-1.5 rounded px-1 py-0.5 transition ${selected ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`} onClick={() => setSelectedCategory(child.name)} onDoubleClick={() => jumpToTransactions(child)}>
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
            const selected = selectedCategory === row.name;
            return (
              <button key={`${row.parentId}-${index}`} type="button" className={`w-full flex items-center gap-3 text-sm rounded-lg px-2 py-2 transition ${selected ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`} onClick={() => setSelectedCategory(row.name)} onDoubleClick={() => jumpToTransactions(row)}>
                <span className="w-3 h-3 rounded-full" style={{ background: row.color || '#94a3b8' }} />
                <span className="flex-1 text-left">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name || '未分類'}</span>
                <div className="w-32 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: row.color || '#94a3b8' }} />
                </div>
                <span className="w-12 text-right">{percentage}%</span>
                <span className="w-24 text-right font-medium">{fmt(row.total)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
