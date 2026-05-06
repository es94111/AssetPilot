'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Chart from 'chart.js/auto';

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

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
    to: to.toISOString().split('T')[0] 
  };
}

export default function ReportsClient(_props: { user?: any } = {}) {
  const [activeTab, setActiveTab] = useState<'category' | 'trend' | 'daily'>('category');
  const [period, setPeriod] = useState('thisMonth');
  const [type, setType] = useState('expense');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  const fetchReport = useCallback(async () => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    setLoading(true);
    try {
      const data = await apiGet(`/api/reports?type=${type}&from=${from}&to=${to}`);
      setReportData(data);
    } catch (_) {}
    setLoading(false);
  }, [period, customFrom, customTo, type]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  useEffect(() => {
    if (!reportData || !chartRef.current) return;
    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    const COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];
    
    let chartConfig: any = { type: 'bar', data: { datasets: [] }, options: { responsive: true } };

    if (activeTab === 'category') {
      const rows = Array.isArray(reportData?.categoryBreakdown) ? reportData.categoryBreakdown : [];
      const filtered = rows.filter((r: any) => Number(r.total) > 0);
      chartConfig = {
        type: 'pie',
        data: {
          labels: filtered.map((r: any) => r.name || r.childName || '未分類'),
          datasets: [{
            data: filtered.map((r: any) => Number(r.total) || 0),
            backgroundColor: filtered.map((r: any, i: number) => r.color || COLORS[i % COLORS.length]),
          }],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
      };
    } else {
      const dataSet = activeTab === 'trend' ? (reportData?.monthlyTotals || reportData?.monthly || {}) : (reportData?.dailyTotals || reportData?.daily || {});
      const sortedKeys = Object.keys(dataSet).sort();
      chartConfig = {
        type: 'bar',
        data: {
          labels: sortedKeys,
          datasets: [{
            label: type === 'expense' ? '支出' : '收入',
            data: sortedKeys.map(k => Number(dataSet[k]) || 0),
            backgroundColor: type === 'expense' ? '#ef4444' : '#10b981',
          }],
        },
        options: { responsive: true, scales: { y: { beginAtZero: true } } }
      };
    }

    chartInstanceRef.current = new Chart(ctx, chartConfig);
    return () => { chartInstanceRef.current?.destroy(); };
  }, [reportData, activeTab, type]);

  const catRows = Array.isArray(reportData?.categoryBreakdown)
    ? reportData.categoryBreakdown.filter((r: any) => Number(r.total) > 0).sort((a: any, b: any) => Number(b.total) - Number(a.total))
    : [];
  const grandTotal = reportData?.total || reportData?.grandTotal || catRows.reduce((s: number, r: any) => s + Number(r.total), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">統計報表</h2>
      <div className="flex gap-2 border-b">
        {(['category', 'trend', 'daily'] as const).map(tab => (
          <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'category' ? '分類統計' : tab === 'trend' ? '趨勢分析' : '每日消費'}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-4 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
        <Select options={[{label: '本月', value: 'thisMonth'}, {label: '上月', value: 'lastMonth'}, {label: '近3個月', value: 'last3'}, {label: '近6個月', value: 'last6'}, {label: '今年', value: 'thisYear'}, {label: '自訂', value: 'custom'}]} value={period} onChange={e => setPeriod(e.target.value)} label="期間" className="w-40" />
        {period === 'custom' && (
          <>
            <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} label="開始" />
            <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} label="結束" />
          </>
        )}
        <Select options={[{label: '支出', value: 'expense'}, {label: '收入', value: 'income'}]} value={type} onChange={e => setType(e.target.value)} label="類型" className="w-32" />
      </div>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
          <canvas ref={chartRef} className="max-h-96" />
        </div>
      )}

      {activeTab === 'category' && catRows.length > 0 && (
        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-lg">{type === 'expense' ? '支出' : '收入'}明細</h3>
            <p className="font-bold">合計：{fmt(grandTotal)}</p>
          </div>
          {catRows.map((r: any, i: number) => {
            const percentage = grandTotal > 0 ? Math.round(Number(r.total) / grandTotal * 100) : 0;
            return (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded-full" style={{ background: r.color || '#94a3b8' }} />
                <span className="flex-1">{r.parentName && r.parentName !== r.name ? `${r.parentName} › ` : ''}{r.name || r.childName || '未分類'}</span>
                <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: r.color || '#94a3b8' }} />
                </div>
                <span className="w-12 text-right">{percentage}%</span>
                <span className="w-24 text-right font-medium">{fmt(r.total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
