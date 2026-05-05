'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '../../../lib/clientApi';

const FREQ_LABELS = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' };
const EMPTY_FORM = { type: 'expense', amount: '', currency: 'TWD', fxRate: '1', categoryId: '', accountId: '', frequency: 'monthly', startDate: '', note: '' };

function today() { return new Date().toISOString().slice(0, 10); }
function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function RecurringClient() {
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const todayStr = today();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cats, accts] = await Promise.all([
        apiGet('/api/recurring'),
        apiGet('/api/categories').catch(() => []),
        apiGet('/api/accounts').catch(() => []),
      ]);
      setRecs(data || []);
      setCategories(cats);
      setAccounts(accts);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_FORM, startDate: todayStr });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(r) {
    setForm({
      type: r.type || 'expense',
      amount: r.amount ?? '',
      currency: r.currency || 'TWD',
      fxRate: r.fxRate || r.fx_rate || '1',
      categoryId: r.categoryId || r.category_id || '',
      accountId: r.accountId || r.account_id || '',
      frequency: r.frequency || 'monthly',
      startDate: r.startDate || r.start_date || '',
      note: r.note || '',
    });
    setEditId(r.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError('請輸入有效金額'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      type: form.type,
      amount: Number(form.amount),
      currency: form.currency || 'TWD',
      fxRate: Number(form.fxRate) || 1,
      categoryId: form.categoryId || null,
      accountId: form.accountId || null,
      frequency: form.frequency,
      startDate: form.startDate,
      note: form.note,
    };
    try {
      if (editId) { await apiPut(`/api/recurring/${editId}`, body); }
      else { await apiPost('/api/recurring', body); }
      setModal(false);
      await load();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/recurring/${deleteId}`); setDeleteId(null); await load(); } catch (e) { alert(e.message); }
  }

  async function handleToggle(id) {
    try { await apiPatch(`/api/recurring/${id}/toggle`); await load(); } catch (e) { alert(e.message); }
  }

  const getCatName = (id) => {
    const c = categories.find(c => c.id === id);
    return c ? c.name : id ? '（分類已刪除）' : '未分類';
  };
  const getAcctName = (id) => {
    const a = accounts.find(a => a.id === id);
    return a ? a.name : id ? '（帳戶已刪除）' : '未指定';
  };

  const filteredCats = categories.filter(c => !form.type || c.type === form.type);

  function getCardClass(r) {
    if (!r.isActive) return 'recurring-item recurring-card--inactive';
    if (r.needsAttention) return 'recurring-item recurring-card--attention';
    const nextGen = r.nextDate || r.startDate || '';
    if (nextGen && nextGen <= todayStr) return 'recurring-item recurring-card--pending';
    return 'recurring-item recurring-card--normal';
  }

  return (
    <div className="page active">
      <h2 className="page-title">固定收支</h2>

      <div className="section-header">
        <h3>固定收支</h3>
        <button className="btn btn-sm" onClick={openAdd}><i className="fas fa-plus" /> 新增</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && recs.length === 0 && <p className="empty-hint">尚無固定收支</p>}

      <div id="recurringList">
        {recs.map(r => {
          const catId = r.categoryId || r.category_id;
          const acctId = r.accountId || r.account_id;
          const startDate = r.startDate || r.start_date || '';
          const lastGen = r.lastGenerated || r.last_generated || '';
          const nextGen = r.nextDate || '';
          const isOverdue = r.isActive && nextGen && nextGen <= todayStr && !r.needsAttention;
          const currency = r.currency || 'TWD';
          const fxRate = Number(r.fxRate || r.fx_rate || 1);

          return (
            <div key={r.id} className={getCardClass(r)}>
              {r.needsAttention && (
                <div className="recurring-attention-text">⚠ 需處理：原分類／帳戶已刪除，請重新指定</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="recurring-info">
                  <span className={`badge badge-${r.type}`}>{r.type === 'income' ? '收入' : '支出'}</span>
                  <span style={{ fontWeight: 600 }}>
                    {currency !== 'TWD' && fxRate > 1
                      ? `${currency} ${(r.amount / fxRate).toLocaleString('zh-TW')} ≈ ${fmt(r.amount)}`
                      : fmt(r.amount)}
                  </span>
                  <span>{getCatName(catId)}</span>
                  <span>{getAcctName(acctId)}</span>
                  <span>{FREQ_LABELS[r.frequency] || r.frequency}</span>
                  <span className={`recurring-status ${r.isActive ? 'active' : 'paused'}`}>
                    {r.isActive ? '啟用' : '暫停'}
                  </span>
                </div>
                <div className="recurring-detail recurring-dates">
                  <span><i className="fas fa-play-circle" /> 起始：{startDate || '—'}</span>
                  <span><i className="fas fa-clock-rotate-left" /> 上次產生：{lastGen || '尚未產生'}</span>
                  <span className={isOverdue ? 'recurring-pending-tag' : ''}>
                    <i className="fas fa-calendar-day" /> 下次產生：{nextGen || '—'}{isOverdue ? '（待執行）' : ''}
                  </span>
                  {r.note && <span className="recurring-note"><i className="fas fa-sticky-note" /> {r.note}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn-icon" title={r.isActive ? '暫停' : '啟用'} onClick={() => handleToggle(r.id)}>
                  <i className={`fas ${r.isActive ? 'fa-pause' : 'fa-play'}`} />
                </button>
                <button className="btn-icon" title="編輯" onClick={() => openEdit(r)}><i className="fas fa-pen" /></button>
                <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(r.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯固定收支' : '新增固定收支'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>類型</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, categoryId: '' }))}>
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </div>
              <div className="form-row">
                <label>金額 *</label>
                <input type="number" required min="1" step="1" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-row">
                <label>幣別</label>
                <input type="text" maxLength={10} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="TWD" />
              </div>
              {form.currency !== 'TWD' && (
                <div className="form-row">
                  <label>匯率（1 {form.currency} = ? TWD）</label>
                  <input type="number" min="0.0001" step="0.0001" value={form.fxRate} onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))} />
                </div>
              )}
              <div className="form-row">
                <label>分類</label>
                <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">未分類</option>
                  {filteredCats.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>帳戶</label>
                <select value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}>
                  <option value="">未指定</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>頻率</label>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
                  <option value="daily">每日</option>
                  <option value="weekly">每週</option>
                  <option value="monthly">每月</option>
                  <option value="yearly">每年</option>
                </select>
              </div>
              <div className="form-row">
                <label>起始日期</label>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
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
              <p>確定要刪除此固定收支設定嗎？已產生的交易不受影響。</p>
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
