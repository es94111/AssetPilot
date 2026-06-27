'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';
import { Plus, Edit3, Trash2 } from 'lucide-react';

const EMPTY_FORM = { name: '', type: 'expense', color: '#94a3b8', parentId: '', icon: '' };

export default function CategoriesClient(_props: { user?: any } = {}) {
  const { t } = useT();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverScope, setDragOverScope] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { const data = await apiGet('/api/categories'); setCategories(data); } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError(t('features.categories.messages.nameRequired')); return; }
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
    setDeleteError('');
    try {
      await apiDelete(`/api/categories/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e: any) {
      setDeleteError(e.message || t('features.categories.messages.deleteFailed'));
    }
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, type: activeTab });
    setEditId(null);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(category: any) {
    setForm({
      name: category.name,
      type: category.type,
      color: category.color,
      parentId: category.parentId || '',
      icon: category.icon || '',
    });
    setEditId(category.id);
    setFormError('');
    setDialogOpen(true);
  }

  async function handleReorder(scope: string, orderedIds: string[]) {
    if (orderedIds.length <= 1) return;
    await apiPost('/api/categories/reorder', {
      scope,
      items: orderedIds.map((id, index) => ({ id, sortOrder: index + 1 })),
    });
    await load();
  }

  async function handleDrop(targetId: string, scope: string) {
    if (!draggingId || draggingId === targetId || dragOverScope !== scope) {
      setDraggingId(null);
      setDragOverScope(null);
      setDragOverId(null);
      return;
    }

    const isParentScope = scope.startsWith('parents:');
    const scopedItems = isParentScope
      ? parents
      : children(scope.slice('children:'.length));
    const orderedIds = scopedItems.map(item => item.id);
    const fromIndex = orderedIds.indexOf(draggingId);
    const toIndex = orderedIds.indexOf(targetId);
    if (fromIndex === -1 || toIndex === -1) {
      setDraggingId(null);
      setDragOverScope(null);
      setDragOverId(null);
      return;
    }

    const nextIds = [...orderedIds];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);

    setDraggingId(null);
    setDragOverScope(null);
    setDragOverId(null);

    try {
      await handleReorder(scope, nextIds);
    } catch (e: any) {
      alert(e.message);
    }
  }

  const filtered = categories.filter(c => c.type === activeTab);
  const parents = filtered.filter(c => !c.parentId);
  const children = (parentId: string) => filtered.filter(c => c.parentId === parentId);
  const parentCats = categories.filter(c => c.type === form.type && !c.parentId && c.id !== editId);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('features.categories.title')}</h2>
      <div className="flex gap-2 border-b">
        {(['expense', 'income'] as const).map(tab => (
          <button key={tab} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab(tab)}>
            {tab === 'expense' ? t('features.categories.expenseTab') : t('features.categories.incomeTab')}
          </button>
        ))}
      </div>

      <Button onClick={openCreate}><Plus size={16} className="mr-2" /> {t('features.categories.addCategory')}</Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t('features.categories.editCategory') : t('features.categories.newCategory')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label={t('features.categories.nameLabel')} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Select label={t('features.categories.typeLabel')} options={[{label: t('features.categories.expense'), value: 'expense'}, {label: t('features.categories.income'), value: 'income'}]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value, parentId: '' }))} />
            <Select label={t('features.categories.parentLabel')} options={[{label: t('features.common.topLevelCategory'), value: ''}, ...parentCats.map(c => ({ label: c.name, value: c.id }))]} value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))} />
            <Input label={t('features.categories.colorLabel')} type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-10" />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <div className="space-y-4">
          {parents.map(parent => (
            <div key={parent.id} className="bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
              <div
                className={`flex items-center gap-3 p-3 font-semibold border-b ${draggingId === parent.id ? 'opacity-50' : ''} ${dragOverScope === `parents:${activeTab}` && dragOverId === parent.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                draggable
                onDragStart={() => { setDraggingId(parent.id); setDragOverScope(`parents:${activeTab}`); }}
                onDragEnd={() => { setDraggingId(null); setDragOverScope(null); setDragOverId(null); }}
                onDragOver={(e) => {
                  if (dragOverScope === `parents:${activeTab}`) {
                    e.preventDefault();
                    setDragOverId(parent.id);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleDrop(parent.id, `parents:${activeTab}`);
                }}
              >
                <span className="w-3 h-3 rounded-full" style={{ background: parent.color || '#94a3b8' }} />
                <span className="flex-1">{parent.name}</span>
                <Button variant="ghost" size="icon" onClick={() => openEdit(parent)}><Edit3 size={16} /></Button>
                <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { setDeleteError(''); setDeleteId(parent.id); }}><Trash2 size={16} /></Button>
              </div>
              {children(parent.id).map(child => (
                <div
                  key={child.id}
                  className={`flex items-center gap-3 p-3 pl-8 text-sm ${draggingId === child.id ? 'opacity-50' : ''} ${dragOverScope === `children:${parent.id}` && dragOverId === child.id ? 'bg-blue-50 dark:bg-blue-950/40' : ''}`}
                  draggable
                  onDragStart={() => { setDraggingId(child.id); setDragOverScope(`children:${parent.id}`); }}
                  onDragEnd={() => { setDraggingId(null); setDragOverScope(null); setDragOverId(null); }}
                  onDragOver={(e) => {
                    if (dragOverScope === `children:${parent.id}`) {
                      e.preventDefault();
                      setDragOverId(child.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    void handleDrop(child.id, `children:${parent.id}`);
                  }}
                >
                  <span className="w-3 h-3 rounded-full" style={{ background: child.color || parent.color || '#94a3b8' }} />
                  <span className="flex-1">{child.name}</span>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(child)}><Edit3 size={16} /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => { setDeleteError(''); setDeleteId(child.id); }}><Trash2 size={16} /></Button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold mb-4">{t('common.confirmDelete')}</h3>
            <p className="mb-4">{t('features.categories.deleteMessage')}</p>
            {deleteError && <p className="mb-4 text-sm text-red-500">{deleteError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDeleteId(null); setDeleteError(''); }}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={handleDelete}>{t('common.confirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
