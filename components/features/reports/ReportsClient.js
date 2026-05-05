'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet } from '../../../lib/clientApi';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function localDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

function getDateRange(period, customFrom, customTo) {
  const now = new Date();
  let from, to;
  to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'thisMonth':
      from = new Date(now.getFullYear(), now.getMonth(), 1); break;
    case 'lastMonth':
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0); break;
    case 'last3':
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
    case 'last6':
      from = new Date(now.getFullYear(), now.getMonth() - 5, 1); break;
    case 'thisYear':
      from = new Date(now.getFullYear(), 0, 1); break;
    case 'custom':
      if (customFrom && customTo) return { from: customFrom, to: customTo };
      if (customFrom) return { from: customFrom, to: localDateStr(to) };
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: localDateStr(from), to: customTo || localDateStr(to) };
    default:
      from = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { from: localDateStr(from), to: localDateStr(to) };
}

export default function ReportsClient() {
  const [activeTab, setActiveTab] = useState('category');
  const [period, setPeriod] = useState('thisMonth');
  const [type, setType] = useState('expense');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dualPie, setDualPie] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const fetchReport = useCallback(async () => {
    const { from, to } = getDateRange(period, customFrom, customTo);
    if (from && to && from > to) {
      setError('起始日不可晚於結束日');
      setReportData(null);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await apiGet(`/api/reports?type=${type}&from=${from}&to=${to}`);
      setReportData(data);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [period, customFrom, customTo, type]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  // Draw chart whenever data/tab/dualPie changes
  useEffect(() => {
    if (!reportData || !chartRef.current) return;

    let cancelled = false;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (cancelled) return;
      if (chartInstanceRef.current) { chartInstanceRef.current.destroy(); chartInstanceRef.current = null; }
      const ctx = chartRef.current.getContext('2d');
      const chart = drawChart(Chart, ctx, activeTab, reportData, type, dualPie,
        getDateRange(period, customFrom, customTo));
      if (chart) chartInstanceRef.current = chart;
    });

    return () => { cancelled = true; };
  }, [reportData, activeTab, dualPie, type, period, customFrom, customTo]);

  function drawChart(Chart, ctx, tab, data, type, useDualPie, dateRange) {
    const COLORS = ['#4f6ef7','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316','#6366f1'];

    if (tab === 'category') {
      const rows = Array.isArray(data?.categoryBreakdown) ? data.categoryBreakdown : [];
      const filtered = rows.filter(r => Number(r.total) > 0);
      if (filtered.length === 0) return null;
      const labels = filtered.map(r => r.name || r.childName || '未分類');
      const values = filtered.map(r => Number(r.total) || 0);
      const colors = filtered.map((r, i) => r.color || COLORS[i % COLORS.length]);
      return new Chart(ctx, {
        type: 'pie',
        data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 1 }] },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } },
      });
    }

    if (tab === 'trend') {
      const monthly = data?.monthlyTotals || data?.monthly || {};
      const sortedKeys = Object.keys(monthly).sort();
      if (sortedKeys.length === 0) return null;
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sortedKeys,
          datasets: [{
            label: type === 'expense' ? '支出' : '收入',
            data: sortedKeys.map(k => Number(monthly[k]) || 0),
            backgroundColor: type === 'expense' ? '#ef4444' : '#10b981',
          }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      });
    }

    if (tab === 'daily') {
      const daily = data?.dailyTotals || data?.daily || {};
      const sortedKeys = Object.keys(daily).sort();
      if (sortedKeys.length === 0) return null;
      return new Chart(ctx, {
        type: 'bar',
        data: {
          labels: sortedKeys,
          datasets: [{
            label: type === 'expense' ? '支出' : '收入',
            data: sortedKeys.map(k => Number(daily[k]) || 0),
            backgroundColor: type === 'expense' ? '#f97316' : '#06b6d4',
          }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      });
    }

    return null;
  }

  const catRows = Array.isArray(reportData?.categoryBreakdown)
    ? reportData.categoryBreakdown.filter(r => Number(r.total) > 0).sort((a, b) => Number(b.total) - Number(a.total))
    : [];

  const grandTotal = reportData?.total || reportData?.grandTotal || catRows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="page active">
      <h2 className="page-title">統計報表</h2>

      <div className="card report-controls">
        <div className="tab-bar">
          {['category', 'trend', 'daily'].map(t => (
            <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'category' ? '分類統計' : t === 'trend' ? '趨勢分析' : '每日消費'}
            </button>
          ))}
        </div>

        <div className="filter-bar" style={{ marginTop: '0.75rem' }}>
          <select value={period} onChange={e => setPeriod(e.target.value)}>
            <option value="thisMonth">本月</option>
            <option value="lastMonth">上月</option>
            <option value="last3">近3個月</option>
            <option value="last6">近6個月</option>
            <option value="thisYear">今年</option>
            <option value="custom">自訂時間</option>
          </select>

          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} title="起始日" />
              <span>~</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} title="結束日" />
            </>
          )}

          <select value={type} onChange={e => setType(e.target.value)}>
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>

          {activeTab === 'category' && (
            <label className="checkbox-inline">
              <input type="checkbox" checked={dualPie} onChange={e => setDualPie(e.target.checked)} />
              {' '}雙圓餅圖
            </label>
          )}
        </div>
      </div>

      {error && <p className="empty-hint" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading && <p className="empty-hint">載入中...</p>}

      {!loading && !error && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <div className="chart-container">
            <canvas ref={chartRef} />
          </div>
        </div>
      )}

      {!loading && !error && catRows.length > 0 && activeTab === 'category' && (
        <div className="card report-summary" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>
            {type === 'expense' ? '支出' : '收入'}明細
            <span style={{ float: 'right', color: 'var(--text-secondary)', fontWeight: 400 }}>合計：{fmt(grandTotal)}</span>
          </h3>
          <div className="category-breakdown">
            {catRows.map((r, i) => {
              const pct = grandTotal > 0 ? Math.round(Number(r.total) / grandTotal * 100) : 0;
              return (
                <div key={i} className="breakdown-row">
                  <span className="cat-dot" style={{ background: r.color || '#94a3b8' }} />
                  <span className="breakdown-name">{r.parentName && r.parentName !== r.name ? `${r.parentName} › ` : ''}{r.name || r.childName || '未分類'}</span>
                  <div className="breakdown-bar-wrap">
                    <div className="breakdown-bar" style={{ width: `${pct}%`, background: r.color || '#94a3b8' }} />
                  </div>
                  <span className="breakdown-pct">{pct}%</span>
                  <span className="breakdown-amt">{fmt(r.total)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && reportData && catRows.length === 0 && (
        <p className="empty-hint">此期間無資料</p>
      )}
    </div>
  );
}
