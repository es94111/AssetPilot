'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';
import StocksTabNav from './StocksTabNav';

function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

const EMPTY_FORM = { stockId: '', date: '', cashDividend: '', stockDividendShares: '', note: '' };

export default function DividendsClient() {
  const [divs, setDivs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStockId, setFilterStockId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: today() });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filterStockId) params.set('stockId', filterStockId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      const result = await apiGet(`/api/stock-dividends?${params}`);
      setDivs(result.data || result.dividends || []);
      setTotal(result.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filterStockId, filterDateFrom, filterDateTo]);

  const loadMeta = useCallback(async () => {
    const stockResp = await apiGet('/api/stocks').catch(() => []);
    const stockList = Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []);
    setStocks(stockList);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { setPage(1); load(1); }, [filterStockId, filterDateFrom, filterDateTo]);
  useEffect(() => { load(page); }, [page]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, date: today(), stockId: stocks[0]?.id || '' });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(d) {
    setForm({
      stockId: d.stockId || d.stock_id || '',
      date: d.date || today(),
      cashDividend: d.cashDividend ?? d.cash_dividend ?? '',
      stockDividendShares: d.stockDividendShares ?? d.stock_dividend_shares ?? '',
      note: d.note || '',
    });
    setEditId(d.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.stockId) { setFormError('請選擇股票'); return; }
    if (!form.cashDividend && !form.stockDividendShares) { setFormError('請輸入現金股利或股票股利'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      stockId: form.stockId,
      date: form.date,
      cashDividend: Number(form.cashDividend) || 0,
      stockDividendShares: Number(form.stockDividendShares) || 0,
      note: form.note,
    };
    try {
      if (editId) { await apiPut(`/api/stock-dividends/${editId}`, body); }
      else { await apiPost('/api/stock-dividends', body); }
      setModal(false);
      await load(1);
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stock-dividends/${deleteId}`); setDeleteId(null); await load(page); } catch (e) { alert(e.message); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="page active">
      <h2 className="page-title">股利紀錄</h2>
      <StocksTabNav />

      <div className="filter-bar">
        <select value={filterStockId} onChange={e => setFilterStockId(e.target.value)}>
          <option value="">所有股票</option>
          {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} {s.name}</option>)}
        </select>
        <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} title="起始日期" />
        <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} title="結束日期" />
        <button className="btn btn-ghost btn-sm" onClick={() => { setFilterStockId(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
          <i className="fas fa-xmark" /> 清除
        </button>
      </div>

      <div className="tx-actions">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增股利</button>
        <span className="tx-count">共 {total} 筆</span>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && divs.length === 0 && <p className="empty-hint">沒有股利紀錄</p>}

      {!loading && divs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>日期</th><th>股票</th><th>現金股利</th><th>股票股利（股）</th><th>備註</th><th>操作</th></tr>
            </thead>
            <tbody>
              {divs.map(d => (
                <tr key={d.id}>
                  <td>{d.date}</td>
                  <td>{d.symbol} {d.stock_name || d.stockName || ''}</td>
                  <td className="amount-income">{fmt(d.cash_dividend ?? d.cashDividend)}</td>
                  <td>{d.stock_dividend_shares ?? d.stockDividendShares ?? '—'}</td>
                  <td>{d.note || '—'}</td>
                  <td>
                    <button className="btn-icon" title="編輯" onClick={() => openEdit(d)}><i className="fas fa-pen" /></button>
                    <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(d.id)}><i className="fas fa-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ 上一頁</button>
          <span className="page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一頁 ›</button>
        </div>
      )}

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯股利' : '新增股利'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>股票 *</label>
                <select value={form.stockId} onChange={e => setForm(f => ({ ...f, stockId: e.target.value }))}>
                  <option value="">請選擇股票</option>
                  {stocks.map(s => <option key={s.id} value={s.id}>{s.symbol} {s.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>日期</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>現金股利 (NT$)</label>
                <input type="number" min="0" step="0.01" value={form.cashDividend} onChange={e => setForm(f => ({ ...f, cashDividend: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-row">
                <label>股票股利（股數）</label>
                <input type="number" min="0" step="1" value={form.stockDividendShares} onChange={e => setForm(f => ({ ...f, stockDividendShares: e.target.value }))} placeholder="0" />
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

      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>確認刪除</h3><button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button></div>
            <div className="modal-body">
              <p>確定要刪除此股利紀錄嗎？</p>
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
