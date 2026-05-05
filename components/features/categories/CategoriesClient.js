'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/clientApi';

const EMPTY_FORM = { name: '', type: 'expense', color: '#94a3b8', parentId: '', icon: '' };

export default function CategoriesClient() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('expense');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    try { const data = await apiGet('/api/categories'); setCategories(data); } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd(type = activeTab) {
    setForm({ ...EMPTY_FORM, type });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

  function openEdit(cat) {
    setForm({ name: cat.name || '', type: cat.type || 'expense', color: cat.color || '#94a3b8', parentId: cat.parent_id || '', icon: cat.icon || '' });
    setEditId(cat.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('請輸入分類名稱'); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = { name: form.name.trim(), type: form.type, color: form.color, parentId: form.parentId || null, icon: form.icon || null };
      if (editId) { await apiPut(`/api/categories/${editId}`, body); }
      else { await apiPost('/api/categories', body); }
      setModal(false);
      await load();
    } catch (e) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/categories/${deleteId}`); setDeleteId(null); await load(); } catch (e) { alert(e.message); }
  }

  const filtered = categories.filter(c => c.type === activeTab);
  const parents = filtered.filter(c => !c.parent_id);
  const children = (parentId) => filtered.filter(c => c.parent_id === parentId);
  const parentCats = categories.filter(c => c.type === form.type && !c.parent_id && c.id !== editId);

  return (
    <div className="page active">
      <h2 className="page-title">分類管理</h2>

      <div className="tab-bar">
        <button className={`tab ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>支出分類</button>
        <button className={`tab ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>收入分類</button>
      </div>

      <div className="category-actions">
        <button className="btn" onClick={() => openAdd()}><i className="fas fa-plus" /> 新增{activeTab === 'expense' ? '支出' : '收入'}分類</button>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && filtered.length === 0 && <p className="empty-hint">尚無{activeTab === 'expense' ? '支出' : '收入'}分類</p>}

      <div className="category-list">
        {parents.map(parent => (
          <div key={parent.id} className="category-group">
            <div className="category-item category-parent">
              <span className="cat-dot" style={{ background: parent.color || '#94a3b8' }} />
              <span className="cat-name">{parent.name}</span>
              <div className="cat-actions">
                <button className="btn-icon" title="編輯" onClick={() => openEdit(parent)}><i className="fas fa-pencil" /></button>
                <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(parent.id)}><i className="fas fa-trash" /></button>
              </div>
            </div>
            {children(parent.id).map(child => (
              <div key={child.id} className="category-item category-child">
                <span className="cat-dot" style={{ background: child.color || parent.color || '#94a3b8' }} />
                <span className="cat-name">{child.name}</span>
                <div className="cat-actions">
                  <button className="btn-icon" title="編輯" onClick={() => openEdit(child)}><i className="fas fa-pencil" /></button>
                  <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(child.id)}><i className="fas fa-trash" /></button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editId ? '編輯分類' : '新增分類'}</h3>
              <button className="btn-icon" onClick={() => setModal(false)}><i className="fas fa-xmark" /></button>
            </div>
            <form onSubmit={handleSave} className="modal-body">
              <div className="form-row">
                <label>名稱 *</label>
                <input type="text" required maxLength={30} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-row">
                <label>類型</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, parentId: '' }))} disabled={!!editId}>
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                </select>
              </div>
              <div className="form-row">
                <label>父分類（可選）</label>
                <select value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                  <option value="">— 頂層分類 —</option>
                  {parentCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>顏色</label>
                <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
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
              <p>確定要刪除此分類嗎？其子分類也將一併刪除，已使用此分類的交易將設為未分類。</p>
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
