'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

function pct(spent, budget) {
  if (!budget || budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export default function BudgetClient() {
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ categoryId: '', amount: '', period: 'monthly' });
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/budgets?month=${encodeURIComponent(month)}`);
      setBudgets(data.budgets || data || []);
    } catch (_) {}
    setLoading(false);
  }, [month]);

  const loadCats = useCallback(async () => {
    try { const data = await apiGet('/api/categories'); setCategories(data.filter(c => c.type === 'expense')); } catch (_) {}
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ categoryId: '', amount: '', period: 'monthly' });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(b) {
    setForm({ categoryId: b.category_id || b.categoryId || '', amount: b.amount ?? '', period: b.period || 'monthly' });
    setEditId(b.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError('請輸入有效預算金額'); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = { categoryId: form.categoryId || null, amount: Number(form.amount), period: form.period, month };
      if (editId) { await apiPut(`/api/budgets/${editId}`, body); }
      else { await apiPost('/api/budgets', body); }
      setModal(false);
      await load();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    try { await apiDelete(`/api/budgets/${deleteId}`); setDeleteId(null); await load(); } catch (e) { alert(e.message); }
  }

  const prevM = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextM = () => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const getCatName = (b) => {
    if (!b.category_id && !b.categoryId) return '（總預算）';
    const c = categories.find(c => c.id === (b.category_id || b.categoryId));
    return c ? c.name : b.cat_name || '—';
  };

  const totalBudget = budgets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (Number(b.spent) || 0), 0);

  return (
    <div className="page active">
      <h2 className="page-title">預算管理</h2>

      <div className="month-nav">
        <button type="button" className="month-nav__btn" onClick={prevM}>‹</button>
        <span className="month-nav__label">{month.replace('-', ' 年 ')} 月</span>
        <button type="button" className="month-nav__btn" onClick={nextM}>›</button>
      </div>

      {budgets.length > 0 && (
        <div className="summary-cards">
          <div className="card summary-card expense">
            <div className="card-icon"><i className="fas fa-wallet" /></div>
            <div className="card-info">
              <span className="card-label">本月總預算</span>
              <span className="card-value">{fmt(totalBudget)}</span>
            </div>
          </div>
          <div className="card summary-card income">
            <div className="card-icon"><i className="fas fa-receipt" /></div>
            <div className="card-info">
              <span className="card-label">已使用</span>
              <span className="card-value">{fmt(totalSpent)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="budget-actions">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增預算</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && budgets.length === 0 && <p className="empty-hint">本月尚未設定預算</p>}

      <div className="budget-list">
        {budgets.map(b => {
          const used = pct(b.spent, b.amount);
          const overBudget = Number(b.spent) > Number(b.amount);
          return (
            <div key={b.id} className="card budget-item">
              <div className="budget-item-header">
                <span className="budget-cat-name">{getCatName(b)}</span>
                <div className="budget-item-actions">
                  <button className="btn-icon" title="編輯" onClick={() => openEdit(b)}><i className="fas fa-pencil" /></button>
                  <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(b.id)}><i className="fas fa-trash" /></button>
                </div>
              </div>
              <div className="budget-amounts">
                <span className={overBudget ? 'amount-expense' : ''}>{fmt(b.spent)}</span>
                <span className="budget-sep"> / </span>
                <span>{fmt(b.amount)}</span>
              </div>
              <div className="budget-progress-bar">
                <div className={`budget-progress-fill ${overBudget ? 'over-budget' : ''}`} style={{ width: `${used}%` }} />
              </div>
              <div className="budget-pct">{used}%{overBudget ? ' ⚠ 超出預算' : ''}</div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯預算' : '新增預算'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>分類（留空為總預算）</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">— 總預算 —</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>預算金額 *</label>
                <input type="number" required min="1" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
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
              <p>確定要刪除此預算設定嗎？</p>
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
