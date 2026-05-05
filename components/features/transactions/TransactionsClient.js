'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';

const EMPTY_FORM = { date: '', type: 'expense', amount: '', categoryId: '', accountId: '', note: '', excludeFromStats: false };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function TransactionsClient() {
  const [txs, setTxs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ type: '', accountId: '', categoryId: '', dateFrom: '', dateTo: '', q: '' });
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: today() });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p), pageSize: String(pageSize),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.q ? { q: filters.q } : {}),
      });
      const data = await apiGet(`/api/transactions?${params}`);
      setTxs(data.transactions || data.data || []);
      setTotal(data.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filters]);

  const loadMeta = useCallback(async () => {
    const [accts, cats] = await Promise.all([
      apiGet('/api/accounts').catch(() => []),
      apiGet('/api/categories').catch(() => []),
    ]);
    setAccounts(accts);
    setCategories(cats);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { setPage(1); load(1); }, [filters]);
  useEffect(() => { load(page); }, [page]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, date: today(), accountId: accounts[0]?.id || '' });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(tx) {
    setForm({
      date: tx.date || today(),
      type: tx.type || 'expense',
      amount: tx.amount ?? '',
      categoryId: tx.category_id || tx.categoryId || '',
      accountId: tx.account_id || tx.accountId || '',
      note: tx.note || '',
      excludeFromStats: !!tx.exclude_from_stats,
    });
    setEditId(tx.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.date) { setFormError('請選擇日期'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError('請輸入有效金額'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      date: form.date, type: form.type, amount: Number(form.amount),
      categoryId: form.categoryId || null, accountId: form.accountId || null,
      note: form.note, excludeFromStats: form.excludeFromStats,
    };
    try {
      if (editId) { await apiPut(`/api/transactions/${editId}`, body); }
      else { await apiPost('/api/transactions', body); }
      setModal(false);
      setPage(1);
      await load(1);
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/transactions/${deleteId}`); setDeleteId(null); await load(page); } catch (e) { alert(e.message); }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`確定要刪除選取的 ${selected.size} 筆交易嗎？`)) return;
    try {
      await apiPost('/api/transactions/batch-delete', { ids: [...selected] });
      setSelected(new Set());
      await load(page);
    } catch (e) { alert(e.message); }
  }

  const filteredCats = categories.filter(c => !form.type || c.type === form.type);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getCatName = (tx) => {
    const c = categories.find(c => c.id === (tx.category_id || tx.categoryId));
    return c ? c.name : (tx.cat_name || '—');
  };
  const getAcctName = (tx) => {
    const a = accounts.find(a => a.id === (tx.account_id || tx.accountId));
    return a ? a.name : (tx.account_name || '—');
  };

  return (
    <div className="page active">
      <h2 className="page-title">交易記錄</h2>

      {/* Filters */}
      <div className="filter-bar">
        <input type="text" className="filter-input" placeholder="搜尋備註..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
        <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
          <option value="">所有類型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="transfer">轉帳</option>
        </select>
        <select value={filters.accountId} onChange={e => setFilters(f => ({ ...f, accountId: e.target.value }))}>
          <option value="">所有帳戶</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filters.categoryId} onChange={e => setFilters(f => ({ ...f, categoryId: e.target.value }))}>
          <option value="">所有分類</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}</option>)}
        </select>
        <input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} title="開始日期" />
        <input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} title="結束日期" />
        <button className="btn btn-ghost btn-sm" onClick={() => setFilters({ type: '', accountId: '', categoryId: '', dateFrom: '', dateTo: '', q: '' })}>
          <i className="fas fa-xmark" /> 清除
        </button>
      </div>

      <div className="tx-actions">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增交易</button>
        {selected.size > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}>
            <i className="fas fa-trash" /> 刪除選取 ({selected.size})
          </button>
        )}
        <span className="tx-count">共 {total} 筆</span>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}

      {!loading && txs.length === 0 && <p className="empty-hint">尚無符合條件的交易記錄</p>}

      {!loading && txs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={e => {
                  if (e.target.checked) setSelected(new Set(txs.map(t => t.id)));
                  else setSelected(new Set());
                }} checked={selected.size === txs.length && txs.length > 0} /></th>
                <th>日期</th><th>類型</th><th>分類</th><th>帳戶</th><th>備註</th><th>金額</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {txs.map(tx => (
                <tr key={tx.id} className={selected.has(tx.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(tx.id)} onChange={e => {
                    const next = new Set(selected);
                    if (e.target.checked) next.add(tx.id); else next.delete(tx.id);
                    setSelected(next);
                  }} /></td>
                  <td>{tx.date}</td>
                  <td><span className={`badge badge-${tx.type}`}>{tx.type === 'income' ? '收入' : tx.type === 'expense' ? '支出' : '轉帳'}</span></td>
                  <td>{getCatName(tx)}</td>
                  <td>{getAcctName(tx)}</td>
                  <td>{tx.note || '—'}</td>
                  <td className={tx.type === 'income' ? 'amount-income' : tx.type === 'expense' ? 'amount-expense' : ''}>
                    {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}{fmt(tx.amount)}
                  </td>
                  <td>
                    <button className="btn-icon" title="編輯" onClick={() => openEdit(tx)}><i className="fas fa-pencil" /></button>
                    <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(tx.id)}><i className="fas fa-trash" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹ 上一頁</button>
          <span className="page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一頁 ›</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯交易' : '新增交易'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>日期 *</label>
                <input type="date" required value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>類型</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, categoryId: '' }))}>
                  <option value="income">收入</option>
                  <option value="expense">支出</option>
                  <option value="transfer">轉帳</option>
                </select>
              </div>
              <div className="form-row">
                <label>金額 *</label>
                <input type="number" required min="0.01" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              {form.type !== 'transfer' && (
                <div className="form-row">
                  <label>分類</label>
                  <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                    <option value="">未分類</option>
                    {filteredCats.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}</option>)}
                  </select>
                </div>
              )}
              <div className="form-row">
                <label>帳戶</label>
                <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">未指定</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>備註</label>
                <input type="text" maxLength={200} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
              <div className="form-row form-row-checkbox">
                <label>
                  <input type="checkbox" checked={form.excludeFromStats} onChange={e => setForm(f => ({ ...f, excludeFromStats: e.target.checked }))} />
                  {' '}不計入統計
                </label>
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
            <div className="modal-header">
              <h3>確認刪除</h3>
              <button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>確定要刪除這筆交易記錄嗎？此操作無法復原。</p>
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
