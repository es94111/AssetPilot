'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../../lib/clientApi';
import StocksTabNav from './StocksTabNav';

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
function fmtPL(n) {
  const num = Math.round(Number(n) || 0);
  return (num > 0 ? '+' : '') + 'NT$ ' + num.toLocaleString('zh-TW');
}
function plClass(n) {
  const num = Number(n) || 0;
  if (num > 0) return 'amount-income';
  if (num < 0) return 'amount-expense';
  return '';
}

export default function RealizedClient() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [filterStockId, setFilterStockId] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, stockResp] = await Promise.all([
        apiGet('/api/stock-realized-pl'),
        apiGet('/api/stocks').catch(() => []),
      ]);
      const stockList = Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []);
      setStocks(stockList);

      const allEntries = Array.isArray(resp?.entries) ? resp.entries : [];
      const normalized = allEntries.map(e => ({
        id: e.transactionId,
        date: e.sellDate,
        stockId: e.stockId,
        symbol: e.symbol,
        name: e.name,
        shares: e.shares,
        sellPrice: e.sellPrice,
        feeAndTax: e.feeAndTax,
        costPerShare: e.costPrice,
        totalCost: e.totalCost,
        realizedPL: e.realizedPL,
        returnRate: e.returnRate,
      }));
      setRecords(normalized);
      setSummary(resp?.summary || null);
    } catch (_) {
      try {
        const fallback = await apiGet('/api/stock-realized');
        setRecords(Array.isArray(fallback) ? fallback : []);
      } catch (_) {}
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterStockId ? records.filter(r => r.stockId === filterStockId) : records;

  const thisYear = new Date().getFullYear().toString();
  const totalPL = summary ? summary.totalRealizedPL : filtered.reduce((s, r) => s + (Number(r.realizedPL) || 0), 0);
  const totalCost = filtered.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
  const overallRate = (summary && !filterStockId) && summary.overallReturnRate !== null
    ? summary.overallReturnRate
    : (totalCost > 0 ? Math.round(totalPL / totalCost * 10000) / 100 : null);
  const yearPL = (summary && !filterStockId)
    ? summary.ytdRealizedPL
    : filtered.filter(r => (r.date || '').startsWith(thisYear)).reduce((s, r) => s + (Number(r.realizedPL) || 0), 0);

  return (
    <div className="page active">
      <h2 className="page-title">實現損益</h2>
      <StocksTabNav />

      <div className="summary-cards">
        <div className={`card summary-card ${totalPL >= 0 ? 'income' : 'expense'}`}>
          <div className="card-icon"><i className="fas fa-chart-line" /></div>
          <div className="card-info">
            <span className="card-label">總實現損益</span>
            <span className={`card-value ${plClass(totalPL)}`}>{fmtPL(totalPL)}</span>
          </div>
        </div>
        <div className="card summary-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="card-icon" style={{ background: '#ede9fe', color: '#6366f1' }}><i className="fas fa-percent" /></div>
          <div className="card-info">
            <span className="card-label">整體報酬率</span>
            <span className={`card-value ${plClass(overallRate)}`}>
              {overallRate === null ? '—' : `${overallRate >= 0 ? '+' : ''}${Number(overallRate).toFixed(2)}%`}
            </span>
          </div>
        </div>
        <div className="card summary-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="card-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}><i className="fas fa-calendar-check" /></div>
          <div className="card-info">
            <span className="card-label">今年實現損益</span>
            <span className={`card-value ${plClass(yearPL)}`}>{fmtPL(yearPL)}</span>
          </div>
        </div>
        <div className="card summary-card" style={{ borderLeft: '4px solid #64748b' }}>
          <div className="card-icon" style={{ background: '#f1f5f9', color: '#64748b' }}><i className="fas fa-receipt" /></div>
          <div className="card-info">
            <span className="card-label">已實現筆數</span>
            <span className="card-value">{filtered.length} 筆</span>
          </div>
        </div>
      </div>

      <div className="filter-bar" style={{ marginTop: '1rem' }}>
        <select value={filterStockId} onChange={e => setFilterStockId(e.target.value)}>
          <option value="">所有股票</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} {s.name}</option>)}
        </select>
        {filterStockId && (
          <button className="btn btn-ghost btn-sm" onClick={() => setFilterStockId('')}>
            <i className="fas fa-xmark" /> 清除
          </button>
        )}
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && filtered.length === 0 && <p className="empty-hint">尚無已實現的賣出紀錄</p>}

      {!loading && filtered.length > 0 && (
        <div className="table-wrap" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>日期</th><th>股票</th><th>股數</th><th>賣出均價</th><th>成本均價</th><th>手續費+稅</th><th>實現損益</th><th>報酬率</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id || i}>
                  <td>{r.date}</td>
                  <td>{r.symbol} {r.name}</td>
                  <td>{Number(r.shares).toLocaleString()}</td>
                  <td>${Number(r.sellPrice).toLocaleString()}</td>
                  <td>${Number(r.costPerShare || 0).toLocaleString()}</td>
                  <td>{fmt(r.feeAndTax ?? ((r.fee || 0) + (r.tax || 0)))}</td>
                  <td className={plClass(r.realizedPL)}>{fmtPL(r.realizedPL)}</td>
                  <td className={plClass(r.returnRate)}>
                    {r.returnRate >= 0 ? '+' : ''}{Number(r.returnRate || 0).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
