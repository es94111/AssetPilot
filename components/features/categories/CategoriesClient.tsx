'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, Edit3, Trash2 } from 'lucide-react';

const EMPTY_FORM = { name: '', type: 'expense', color: '#94a3b8', parentId: '', icon: '' };

export default function CategoriesClient(_props: { user?: any } = {}) {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const data = await apiGet('/api/categories'); setCategories(data); } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('請輸入分類名稱'); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = { name: form.name.trim(), type: form.type, color: form.color, parentId: form.parentId || null, icon: form.icon || null };
      if (editId) { await apiPut(`/api/categories/${editId}`, body); }
      else { await apiPost('/api/categories', body); }
      await load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/categories/${deleteId}`); setDeleteId(null); await load(); } catch (e: any) { alert(e.message); }
  }

  const filtered = categories.filter(c => c.type === activeTab);
  const parents = filtered.filter(c => !c.parent_id);
  const children = (parentId: string) => filtered.filter(c => c.parent_id === parentId);
  const parentCats = categories.filter(c => c.type === form.type && !c.parent_id && c.id !== editId);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">分類管理</h2>
      <div className="flex gap-2 border-b">
        {(['expense', 'income'] as const).map(tab => (
          <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'expense' ? '支出分類' : '收入分類'}
          </button>
        ))}
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={() => { setForm({ ...EMPTY_FORM, type: activeTab }); setEditId(null); setFormError(''); }}><Plus size={16} className="mr-2" /> 新增分類</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯分類' : '新增分類'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="名稱 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Select label="類型" options={[{label: '支出', value: 'expense'}, {label: '收入', value: 'income'}]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, parentId: '' }))} />
            <Select label="父分類" options={[{label: '— 頂層分類 —', value: ''}, ...parentCats.map(c => ({ label: c.name, value: c.id }))]} value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} />
            <Input label="顏色" type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-10" />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="space-y-4">
          {parents.map(parent => (
            <div key={parent.id} className="bg-white border border-slate-200 rounded-lg shadow-sm">
              <div className="flex items-center gap-3 p-3 font-semibold border-b">
                <span className="w-3 h-3 rounded-full" style={{ background: parent.color || '#94a3b8' }} />
                <span className="flex-1">{parent.name}</span>
                <Button variant="ghost" size="icon" onClick={() => { setForm({ name: parent.name, type: parent.type, color: parent.color, parentId: parent.parent_id || '', icon: parent.icon || '' }); setEditId(parent.id); }}><Edit3 size={16} /></Button>
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(parent.id)}><Trash2 size={16} /></Button>
              </div>
              {children(parent.id).map(child => (
                <div key={child.id} className="flex items-center gap-3 p-3 pl-8 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ background: child.color || parent.color || '#94a3b8' }} />
                  <span className="flex-1">{child.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => { setForm({ name: child.name, type: child.type, color: child.color, parentId: child.parent_id || '', icon: child.icon || '' }); setEditId(child.id); }}><Edit3 size={16} /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(child.id)}><Trash2 size={16} /></Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此分類嗎？其子分類也將一併刪除。</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDelete}>確認刪除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
