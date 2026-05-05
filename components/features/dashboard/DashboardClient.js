'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

function fmt(n) {
  const num = Math.round(Number(n) || 0);
  return 'NT$ ' + num.toLocaleString('zh-TW');
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return `${y} 年 ${parseInt(m, 10)} 月`;
}

function prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function DashboardClient() {
  const [ym, setYm] = useState(currentYearMonth());
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const pieRef = useRef(null);
  const incomePieRef = useRef(null);
  const chartInstances = useRef({});

  const load = useCallback(async (month) => {
    setLoading(true);
    try {
      const [dashRes, acctRes] = await Promise.all([
        fetch(`/api/dashboard?yearMonth=${encodeURIComponent(month)}`, { credentials: 'include' }),
        fetch('/api/accounts', { credentials: 'include' }),
      ]);
      if (dashRes.ok) setData(await dashRes.json());
      if (acctRes.ok) setAccounts(await acctRes.json());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(ym); }, [ym, load]);

  useEffect(() => {
    if (!data) return;
    drawPie('dashPie', pieRef, data.catBreakdown, chartInstances);
    drawPie('dashIncomePie', incomePieRef, data.incomeCatBreakdown, chartInstances);
  }, [data]);

  function drawPie(key, ref, breakdown, instances) {
    if (!ref.current || !breakdown?.length) return;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (instances.current[key]) { instances.current[key].destroy(); }
      instances.current[key] = new Chart(ref.current, {
        type: 'doughnut',
        data: {
          labels: breakdown.slice(0, 8).map(c => c.name || '未分類'),
          datasets: [{ data: breakdown.slice(0, 8).map(c => c.total), backgroundColor: breakdown.slice(0, 8).map(c => c.color || '#94a3b8'), borderWidth: 2 }],
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } } } },
      });
    }).catch(() => {});
  }

  const totalAssets = accounts
    .filter(a => !a.exclude_from_total)
    .reduce((sum, a) => sum + (Number(a.twdAccumulated) || Number(a.balance) || 0), 0);

  const top5Expense = (data?.catBreakdown || []).slice(0, 5);
  const top5Income = (data?.incomeCatBreakdown || []).slice(0, 5);

  return (
    <div className="page active" id="page-dashboard">
      <h2 className="page-title">儀表板</h2>

      <div className="month-nav">
        <button type="button" className="month-nav__btn" onClick={() => setYm(prevMonth(ym))} aria-label="上一月">‹</button>
        <span className="month-nav__label">{monthLabel(ym)}</span>
        <button type="button" className="month-nav__btn" onClick={() => setYm(nextMonth(ym))} aria-label="下一月">›</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}

      {!loading && (
        <>
          <div className="summary-cards">
            <div className="card summary-card income">
              <div className="card-icon"><i className="fas fa-arrow-down" /></div>
              <div className="card-info">
                <span className="card-label">本月收入</span>
                <span className="card-value">{fmt(data?.income)}</span>
              </div>
            </div>
            <div className="card summary-card expense">
              <div className="card-icon"><i className="fas fa-arrow-up" /></div>
              <div className="card-info">
                <span className="card-label">本月支出</span>
                <span className="card-value">{fmt(data?.expense)}</span>
              </div>
            </div>
            <div className="card summary-card net">
              <div className="card-icon"><i className="fas fa-scale-balanced" /></div>
              <div className="card-info">
                <span className="card-label">淨收支</span>
                <span className="card-value">{fmt(data?.net)}</span>
              </div>
            </div>
            <div className="card summary-card today">
              <div className="card-icon"><i className="fas fa-calendar-day" /></div>
              <div className="card-info">
                <span className="card-label">今日支出</span>
                <span className="card-value">{fmt(data?.todayExpense)}</span>
              </div>
            </div>
            <div className="card summary-card net">
              <div className="card-icon"><i className="fas fa-landmark" /></div>
              <div className="card-info">
                <span className="card-label">總資產</span>
                <span className="card-value">{fmt(totalAssets)}</span>
              </div>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="card">
              <h3>支出分類</h3>
              <div className="chart-container-sm"><canvas ref={pieRef} /></div>
              <div className="dash-top5-section">
                {top5Expense.length === 0 && <p className="empty-hint">本月無支出記錄</p>}
                {top5Expense.map((c, i) => (
                  <div key={i} className="dash-top5-row">
                    <span className="dash-top5-dot" style={{ background: c.color || '#94a3b8' }} />
                    <span className="dash-top5-name">{c.name || '未分類'}</span>
                    <span className="dash-top5-val">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>收入分類</h3>
              <div className="chart-container-sm"><canvas ref={incomePieRef} /></div>
              <div className="dash-top5-section">
                {top5Income.length === 0 && <p className="empty-hint">本月無收入記錄</p>}
                {top5Income.map((c, i) => (
                  <div key={i} className="dash-top5-row">
                    <span className="dash-top5-dot" style={{ background: c.color || '#94a3b8' }} />
                    <span className="dash-top5-name">{c.name || '未分類'}</span>
                    <span className="dash-top5-val">{fmt(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card full-width">
              <h3>近期交易</h3>
              {(!data?.recent || data.recent.length === 0) && <p className="empty-hint">本月尚無交易記錄</p>}
              {data?.recent?.length > 0 && (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>日期</th><th>類型</th><th>分類</th><th>備註</th><th>金額</th></tr>
                    </thead>
                    <tbody>
                      {data.recent.map(t => (
                        <tr key={t.id}>
                          <td>{t.date}</td>
                          <td><span className={`badge badge-${t.type}`}>{t.type === 'income' ? '收入' : '支出'}</span></td>
                          <td>
                            {t.cat_color && <span className="cat-dot" style={{ background: t.cat_color }} />}
                            {t.cat_name || '—'}
                          </td>
                          <td>{t.note || '—'}</td>
                          <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                            {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
