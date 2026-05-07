'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit3, ChevronLeft, ChevronRight } from 'lucide-react';

const EMPTY_FORM = { categoryId: '', amount: '', period: 'monthly' };

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

function pct(spent: number, budget: number) {
  if (!budget || budget <= 0) return 0;
  return Math.min(100, Math.round((spent / budget) * 100));
}

export default function BudgetClient(_props: { user?: any } = {}) {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet(`/api/budgets?yearMonth=${encodeURIComponent(month)}`);
      setBudgets(data.budgets || data || []);
    } catch (_) {}
    setLoading(false);
  }, [month]);

  const loadCats = useCallback(async () => {
    try { const data = await apiGet('/api/categories'); setCategories(data.filter((c: any) => c.type === 'expense')); } catch (_) {}
  }, []);

  useEffect(() => { loadCats(); }, [loadCats]);
  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError('請輸入有效預算金額'); return; }
    setSaving(true);
    setFormError('');
    try {
      const body = { categoryId: form.categoryId || null, amount: Number(form.amount), period: form.period, yearMonth: month };
      if (editId) { await apiPut(`/api/budgets/${editId}`, body); }
      else { await apiPost('/api/budgets', body); }
      await load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/budgets/${deleteId}`); setDeleteId(null); await load(); } catch (e: any) { alert(e.message); }
  }

  const changeMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const totalBudget = budgets.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (Number(b.used) || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">預算管理</h2>
      <div className="flex items-center gap-4 justify-center">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft /></Button>
        <span className="font-semibold">{month.replace('-', ' 年 ')} 月</span>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)}><ChevronRight /></Button>
      </div>

      {budgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">本月總預算</p>
            <p className="text-2xl font-semibold text-blue-600">{fmt(totalBudget)}</p>
          </div>
          <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">已使用</p>
            <p className="text-2xl font-semibold text-red-600">{fmt(totalSpent)}</p>
          </div>
        </div>
      )}

      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setFormError(''); }}><Plus size={16} className="mr-2" /> 新增預算</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯預算' : '新增預算'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select label="分類（留空為總預算）" options={[
              { label: '— 總預算 —', value: '' },
              ...categories
                .filter((c: any) => !c.parent_id || c.parent_id === '')
                .flatMap((p: any) => [
                  { label: p.name, value: p.id },
                  ...categories
                    .filter((c: any) => c.parent_id === p.id)
                    .map((c: any) => ({ label: `　${c.name}`, value: c.id })),
                ]),
            ]} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} />
            <Input label="預算金額 *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgets.map(b => {
            const used = pct(b.used, b.amount);
            const overBudget = Number(b.used) > Number(b.amount);
            const catName = b.category_id || b.categoryId ? (categories.find(c => c.id === (b.category_id || b.categoryId))?.name || '—') : '（總預算）';
            return (
              <div key={b.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">{catName}</h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ categoryId: b.category_id || b.categoryId || '', amount: b.amount, period: b.period }); setEditId(b.id); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(b.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <div className={`text-lg font-bold ${overBudget ? 'text-red-600' : 'text-slate-900'}`}>{fmt(b.used)} / {fmt(b.amount)}</div>
                <div className="w-full bg-slate-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full ${overBudget ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${used}%` }}></div>
                </div>
                <p className="text-sm text-slate-500">{used}% {overBudget ? '⚠ 超出預算' : ''}</p>
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此預算設定嗎？</p>
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
