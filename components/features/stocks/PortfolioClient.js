'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';
import StocksTabNav from './StocksTabNav';

const STOCK_TYPES = [
  { value: 'stock', label: '股票' },
  { value: 'etf', label: 'ETF' },
  { value: 'warrant', label: '權證' },
];

const EMPTY_FORM = { symbol: '', name: '', stockType: 'stock', note: '' };

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
function fmtPL(n) {
  const num = Math.round(Number(n) || 0);
  const sign = num > 0 ? '+' : '';
  return sign + 'NT$ ' + num.toLocaleString('zh-TW');
}
function plClass(n) {
  const num = Number(n) || 0;
  if (num > 0) return 'amount-income';
  if (num < 0) return 'amount-expense';
  return '';
}

export default function PortfolioClient() {
  const [stocks, setStocks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [priceModal, setPriceModal] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState({});
  const [updatingPrices, setUpdatingPrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, accts] = await Promise.all([
        apiGet('/api/stocks'),
        apiGet('/api/accounts').catch(() => []),
      ]);
      if (Array.isArray(resp)) {
        setStocks(resp);
        setSummary(null);
      } else if (resp?.stocks) {
        setStocks(resp.stocks);
        setSummary(resp.portfolioSummary || null);
      }
      setAccounts(accts);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(s) {
    setForm({ symbol: s.symbol || '', name: s.name || '', stockType: s.stockType || s.stock_type || 'stock', note: s.note || '' });
    setEditId(s.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.symbol.trim()) { setFormError('請輸入股票代碼'); return; }
    setSaving(true);
    setFormError('');
    const body = { symbol: form.symbol.trim().toUpperCase(), name: form.name.trim(), stockType: form.stockType, note: form.note };
    try {
      if (editId) { await apiPut(`/api/stocks/${editId}`, body); }
      else { await apiPost('/api/stocks', body); }
      setModal(false);
      await load();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stocks/${deleteId}`); setDeleteId(null); await load(); } catch (e) { alert(e.message); }
  }

  function openPriceModal() {
    const init = {};
    stocks.forEach(s => { init[s.id] = s.currentPrice || ''; });
    setPriceUpdates(init);
    setPriceModal(true);
  }

  async function handleUpdatePrices(e) {
    e.preventDefault();
    setUpdatingPrices(true);
    try {
      const updates = Object.entries(priceUpdates)
        .filter(([, v]) => v !== '' && !isNaN(Number(v)))
        .map(([id, price]) => ({ id, price: Number(price) }));
      await apiPost('/api/stocks/batch-price', { updates });
      setPriceModal(false);
      await load();
    } catch (err) { alert(err.message); }
    setUpdatingPrices(false);
  }

  const totalDiv = stocks.reduce((s, st) => s + (Number(st.totalDividend) || 0), 0);
  const totalMV = summary?.totalMarketValue ?? stocks.reduce((s, st) => s + (Number(st.marketValue) || 0), 0);
  const totalCost = summary?.totalCost ?? stocks.reduce((s, st) => s + (Number(st.totalCost) || 0), 0);
  const totalPL = summary?.totalPL ?? stocks.reduce((s, st) => s + (Number(st.estimatedProfit) || 0), 0);
  const overallRate = summary?.totalReturnRate ?? (totalCost > 0 ? Math.round(totalPL / totalCost * 10000) / 100 : null);

  const activeStocks = stocks.filter(s => (s.totalShares || 0) > 0 || (s.totalCost || 0) > 0 || (s.marketValue || 0) > 0);

  return (
    <div className="page active">
      <h2 className="page-title">持股總覽</h2>
      <StocksTabNav />

      <div className="summary-cards">
        <div className="card summary-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="card-icon" style={{ background: '#eef2ff', color: 'var(--primary)' }}><i className="fas fa-coins" /></div>
          <div className="card-info">
            <span className="card-label">股票總市值</span>
            <span className="card-value">{fmt(totalMV)}</span>
          </div>
        </div>
        <div className="card summary-card">
          <div className="card-icon"><i className="fas fa-money-bill-trend-up" /></div>
          <div className="card-info">
            <span className="card-label">總投入成本</span>
            <span className="card-value">{fmt(totalCost)}</span>
          </div>
        </div>
        <div className="card summary-card">
          <div className="card-icon"><i className="fas fa-scale-balanced" /></div>
          <div className="card-info">
            <span className="card-label">預估損益</span>
            <span className={`card-value ${plClass(totalPL)}`}>{fmtPL(totalPL)}</span>
          </div>
        </div>
        <div className="card summary-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="card-icon" style={{ background: '#fef3c7', color: '#f59e0b' }}><i className="fas fa-hand-holding-dollar" /></div>
          <div className="card-info">
            <span className="card-label">累計股利</span>
            <span className="card-value">{fmt(totalDiv)}</span>
          </div>
        </div>
        <div className="card summary-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div className="card-icon" style={{ background: '#eef2ff', color: 'var(--primary)' }}><i className="fas fa-percentage" /></div>
          <div className="card-info">
            <span className="card-label">整體報酬率</span>
            <span className={`card-value ${plClass(overallRate)}`}>
              {overallRate !== null && overallRate !== undefined ? `${overallRate >= 0 ? '+' : ''}${Number(overallRate).toFixed(2)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="stock-actions">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增股票</button>
        <button className="btn btn-outline" onClick={openPriceModal}><i className="fas fa-sync" /> 更新股價</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}

      {!loading && activeStocks.length === 0 && (
        <p className="empty-hint">尚無股票，點擊「新增股票」開始記錄</p>
      )}

      <div className="stock-portfolio-grid">
        {activeStocks.map(s => {
          const ep = Number(s.estimatedProfit) || 0;
          const rr = Number(s.returnRate) || 0;
          const rl = Number(s.realizedPL) || 0;
          const totalReturn = ep + rl + (Number(s.totalDividend) || 0);
          return (
            <div key={s.id} className={`stock-card${s.delisted ? ' stock-card--delisted' : ''}`}>
              <div className="stock-card-header">
                <div className="stock-card-header-left">
                  <span className="stock-card-symbol">{s.symbol}</span>
                  <span className="stock-card-name">{s.name}</span>
                  {s.delisted && <span className="delisted-badge">（已下市）</span>}
                </div>
                <div className="stock-card-price-wrap">
                  <div className="stock-card-price">${(s.currentPrice || 0).toLocaleString()}</div>
                  <div className={`stock-card-price-change ${plClass(ep)}`}>
                    {ep >= 0 ? '+' : ''}{rr.toFixed(2)}%
                  </div>
                </div>
              </div>
              <div className="stock-card-body">
                <div className="stock-card-item"><span className="label">持有股數</span><span className="value">{Number(s.totalShares).toLocaleString()}</span></div>
                <div className="stock-card-item"><span className="label">成本均價</span><span className="value">${Number(s.avgCost || 0).toLocaleString()}</span></div>
                <div className="stock-card-item"><span className="label">成本金額</span><span className="value">{fmt(s.totalCost)}</span></div>
                <div className="stock-card-item"><span className="label">市值</span><span className="value">{fmt(s.marketValue)}</span></div>
                <div className="stock-card-divider" />
                <div className="stock-card-item"><span className="label">預估損益</span><span className={`value ${plClass(ep)}`}>{ep >= 0 ? '+' : ''}{fmt(ep)} ({ep >= 0 ? '+' : ''}{rr.toFixed(2)}%)</span></div>
                <div className="stock-card-item"><span className="label">已實現損益</span><span className={`value ${plClass(rl)}`}>{rl >= 0 ? '+' : ''}{fmt(rl)}</span></div>
                <div className="stock-card-item"><span className="label">累計股利</span><span className="value" style={{ color: 'var(--today)' }}>{fmt(s.totalDividend)}</span></div>
                <div className="stock-card-item"><span className="label">總報酬</span><span className={`value ${plClass(totalReturn)}`}>{totalReturn > 0 ? '+' : ''}{fmt(totalReturn)}</span></div>
              </div>
              <div className="stock-card-actions">
                <button className="btn-icon" title="編輯" onClick={() => openEdit(s)}><i className="fas fa-pen" /></button>
                <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(s.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯股票' : '新增股票'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>股票代碼 *</label>
                <input type="text" required maxLength={20} value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} placeholder="例：2330" />
              </div>
              <div className="form-row">
                <label>股票名稱</label>
                <input type="text" maxLength={50} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：台積電" />
              </div>
              <div className="form-row">
                <label>類型</label>
                <select value={form.stockType} onChange={e => setForm(f => ({ ...f, stockType: e.target.value }))}>
                  {STOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>備註</label>
                <input type="text" maxLength={200} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              {formError && <div className="auth-error">{formError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Price Update Modal */}
      {priceModal && (
        <div className="modal-backdrop" onClick={() => setPriceModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>更新股價</h3>
              <button className="btn-icon" onClick={() => setPriceModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleUpdatePrices} className="modal-body">
              {stocks.map(s => (
                <div key={s.id} className="form-row">
                  <label>{s.symbol} {s.name}</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={priceUpdates[s.id] ?? ''}
                    onChange={e => setPriceUpdates(p => ({ ...p, [s.id]: e.target.value }))}
                    placeholder="目前股價"
                  />
                </div>
              ))}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setPriceModal(false)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={updatingPrices}>{updatingPrices ? '更新中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>確認刪除</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button></div>
            <div className="modal-body">
              <p>確定要刪除此股票嗎？相關交易及股利記錄也將一併刪除。</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>取消</button>
                <button className="btn btn-danger" onClick={handleDelete}>確認刪除</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
