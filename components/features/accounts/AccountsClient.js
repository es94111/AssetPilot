'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';

const ACCOUNT_TYPES = [
  { value: 'checking', label: '活期帳戶', icon: 'fas fa-university' },
  { value: 'savings', label: '儲蓄帳戶', icon: 'fas fa-piggy-bank' },
  { value: 'investment', label: '投資帳戶', icon: 'fas fa-chart-line' },
  { value: 'cash', label: '現金', icon: 'fas fa-money-bill' },
  { value: 'credit', label: '信用卡', icon: 'fas fa-credit-card' },
  { value: 'ewallet', label: '電子錢包', icon: 'fas fa-wallet' },
  { value: 'other', label: '其他', icon: 'fas fa-circle-dot' },
];

const EMPTY_FORM = { name: '', type: 'checking', currency: 'TWD', balance: '', color: '#4f6ef7', notes: '', exclude_from_total: false };

function fmt(n, currency = 'TWD') {
  const num = Math.round(Number(n) || 0);
  return (currency === 'TWD' ? 'NT$ ' : '') + num.toLocaleString('zh-TW') + (currency !== 'TWD' ? ' ' + currency : '');
}

export default function AccountsClient() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await apiGet('/api/accounts');
      setAccounts(data);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setFormError('');
    setModal('edit');
  }

  function openEdit(acct) {
    setForm({
      name: acct.name || '',
      type: acct.type || 'checking',
      currency: acct.currency || 'TWD',
      balance: acct.balance ?? '',
      color: acct.color || '#4f6ef7',
      notes: acct.notes || '',
      exclude_from_total: !!acct.exclude_from_total,
    });
    setEditId(acct.id);
    setFormError('');
    setModal('edit');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('請輸入帳戶名稱'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editId) {
        await apiPut(`/api/accounts/${editId}`, form);
      } else {
        await apiPost('/api/accounts', form);
      }
      setModal(null);
      await load();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/api/accounts/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e) { alert(e.message); }
  }

  const totalAssets = accounts
    .filter(a => !a.exclude_from_total)
    .reduce((s, a) => s + (Number(a.twdAccumulated) ?? Number(a.balance) ?? 0), 0);

  return (
    <div className="page active">
      <h2 className="page-title">帳戶管理</h2>

      <div className="summary-cards">
        <div className="card summary-card net">
          <div className="card-icon"><i className="fas fa-landmark" /></div>
          <div className="card-info">
            <span className="card-label">總資產</span>
            <span className="card-value">NT$ {Math.round(totalAssets).toLocaleString('zh-TW')}</span>
          </div>
        </div>
      </div>

      <div className="account-actions">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增帳戶</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && error && <p className="empty-hint" style={{ color: 'var(--danger)' }}>{error}</p>}

      {!loading && !error && accounts.length === 0 && (
        <p className="empty-hint">尚無帳戶，點擊「新增帳戶」開始記帳</p>
      )}

      <div className="account-grid">
        {accounts.map(a => {
          const typeInfo = ACCOUNT_TYPES.find(t => t.value === a.type) || ACCOUNT_TYPES[6];
          return (
            <div key={a.id} className="card account-card" style={{ borderTop: `3px solid ${a.color || '#4f6ef7'}` }}>
              <div className="account-card-header">
                <div className="account-icon" style={{ color: a.color || '#4f6ef7' }}>
                  <i className={typeInfo.icon} />
                </div>
                <div className="account-card-actions">
                  <button className="btn-icon" title="編輯" onClick={() => openEdit(a)}><i className="fas fa-pencil" /></button>
                  <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(a.id)}><i className="fas fa-trash" /></button>
                </div>
              </div>
              <div className="account-name">{a.name}</div>
              <div className="account-type-label">{typeInfo.label}</div>
              <div className="account-balance">{fmt(a.balance, a.currency)}</div>
              {a.currency !== 'TWD' && a.twdAccumulated != null && (
                <div className="account-twd">≈ NT$ {Math.round(Number(a.twdAccumulated)).toLocaleString('zh-TW')}</div>
              )}
              {a.exclude_from_total && <div className="account-excluded-badge">不計入總資產</div>}
            </div>
          );
        })}
      </div>

      {/* Add/Edit Modal */}
      {modal === 'edit' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯帳戶' : '新增帳戶'}</h3>
              <button className="btn-icon" onClick={() => setModal(null)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>帳戶名稱 *</label>
                <input type="text" required maxLength={50} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="例：玉山銀行" />
              </div>
              <div className="form-row">
                <label>類型</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>幣別</label>
                <input type="text" maxLength={10} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} placeholder="TWD" />
              </div>
              <div className="form-row">
                <label>{editId ? '目前餘額' : '初始餘額'}</label>
                <input type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-row">
                <label>顏色</label>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>備註</label>
                <input type="text" maxLength={200} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="form-row form-row-checkbox">
                <label>
                  <input type="checkbox" checked={form.exclude_from_total} onChange={e => setForm(f => ({ ...f, exclude_from_total: e.target.checked }))} />
                  {' '}不計入總資產
                </label>
              </div>
              {formError && <div className="auth-error">{formError}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>取消</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div className="modal-backdrop" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>確認刪除</h3>
              <button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>確定要刪除此帳戶嗎？該帳戶的所有交易記錄也將一併刪除，此操作無法復原。</p>
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
