'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/clientApi';
import StocksTabNav from '@/components/features/stocks/StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit3, Pause, Play, CalendarClock, DollarSign, StickyNote, Repeat } from 'lucide-react';

const FREQ_LABELS: Record<string, string> = { daily: '每日', weekly: '每週', monthly: '每月', yearly: '每年' };
const EMPTY_FORM = { type: 'expense', amount: '', currency: 'TWD', fxRate: '1', categoryId: '', accountId: '', frequency: 'monthly', startDate: '', note: '' };

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function RecurringClient() {
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cats, accts] = await Promise.all([
        apiGet('/api/recurring').catch(() => []),
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

  async function handleSave(e: React.FormEvent) {
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
      await load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/recurring/${deleteId}`); setDeleteId(null); await load(); } catch (e: any) { alert(e.message); }
  }

  async function handleToggle(id: string) {
    try { await apiPatch(`/api/recurring/${id}/toggle`); await load(); } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">固定收支</h2>

      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={() => { setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().slice(0, 10) }); setEditId(null); setFormError(''); }}><Plus size={16} className="mr-2" /> 新增固定收支</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯固定收支' : '新增固定收支'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select label="類型" options={[{label: '支出', value: 'expense'}, {label: '收入', value: 'income'}]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
            <Input label="金額 *" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <Input label="幣別" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            {form.currency !== 'TWD' && <Input label="匯率" type="number" step="0.0001" value={form.fxRate} onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))} />}
            <Select label="分類" options={[{label: '未分類', value: ''}, ...categories.map(c => ({ label: c.name, value: c.id }))]} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} />
            <Select label="帳戶" options={[{label: '未指定', value: ''}, ...accounts.map(a => ({ label: a.name, value: a.id }))]} value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} />
            <Select label="頻率" options={Object.entries(FREQ_LABELS).map(([v, l]) => ({ label: l, value: v }))} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} />
            <Input label="起始日期" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.map(r => {
            const catName = categories.find(c => c.id === (r.category_id || r.categoryId))?.name || '未分類';
            const acctName = accounts.find(a => a.id === (r.account_id || r.accountId))?.name || '未指定';
            return (
              <div key={r.id} className={`p-4 bg-white border border-slate-200 rounded-lg shadow-sm ${!r.isActive ? 'opacity-70' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs ${r.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.type === 'income' ? '收入' : '支出'}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(r.id)}>{r.isActive ? <Pause size={16} /> : <Play size={16} />}</Button>
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ ...r, categoryId: r.category_id || r.categoryId, accountId: r.account_id || r.accountId, startDate: r.startDate || r.start_date }); setEditId(r.id); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <h3 className="font-semibold text-lg">{fmt(r.amount)} ({FREQ_LABELS[r.frequency]})</h3>
                <div className="text-sm text-slate-500 mt-2 space-y-1">
                  <p>分類：{catName}</p>
                  <p>帳戶：{acctName}</p>
                  <p>下次執行：{r.nextDate || '—'}</p>
                </div>
                {r.note && <p className="text-xs text-slate-400 mt-3 italic flex items-center gap-1"><StickyNote size={12}/> {r.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此固定收支設定嗎？</p>
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
