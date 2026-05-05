'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, Trash2, Edit3, Landmark, PiggyBank, Briefcase, DollarSign, CreditCard, Wallet, CircleDot } from 'lucide-react';

const ACCOUNT_TYPES = [
  { value: 'checking', label: '活期帳戶', icon: Landmark },
  { value: 'savings', label: '儲蓄帳戶', icon: PiggyBank },
  { value: 'investment', label: '投資帳戶', icon: Briefcase },
  { value: 'cash', label: '現金', icon: DollarSign },
  { value: 'credit', label: '信用卡', icon: CreditCard },
  { value: 'ewallet', label: '電子錢包', icon: Wallet },
  { value: 'other', label: '其他', icon: CircleDot },
];

const EMPTY_FORM = { name: '', type: 'checking', currency: 'TWD', balance: '', color: '#4f6ef7', notes: '', exclude_from_total: false };

function fmt(n: number | string, currency = 'TWD') {
  const num = Math.round(Number(n) || 0);
  return (currency === 'TWD' ? 'NT$ ' : '') + num.toLocaleString('zh-TW') + (currency !== 'TWD' ? ' ' + currency : '');
}

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet('/api/accounts');
      setAccounts(data);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
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
      await load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/api/accounts/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  const totalAssets = accounts
    .filter(a => !a.exclude_from_total)
    .reduce((s, a) => s + (Number(a.twdAccumulated) ?? Number(a.balance) ?? 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">帳戶管理</h2>

      <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
        <p className="text-sm text-slate-500">總資產</p>
        <p className="text-2xl font-semibold text-blue-600">NT$ {Math.round(totalAssets).toLocaleString('zh-TW')}</p>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setFormError(''); }}><Plus size={16} className="mr-2" /> 新增帳戶</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯帳戶' : '新增帳戶'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Input label="帳戶名稱 *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Select label="類型" options={ACCOUNT_TYPES.map(t => ({ label: t.label, value: t.value }))} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
            <Input label="幣別" value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} />
            <Input label={editId ? '目前餘額' : '初始餘額'} type="number" step="0.01" value={form.balance} onChange={e => setForm(f => ({ ...f, balance: e.target.value }))} />
            <Input label="顏色" type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} className="h-10" />
            <Input label="備註" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.exclude_from_total} onChange={e => setForm(f => ({ ...f, exclude_from_total: e.target.checked }))} className="w-4 h-4" />
              不計入總資產
            </label>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(a => {
            const typeInfo = ACCOUNT_TYPES.find(t => t.value === a.type) || ACCOUNT_TYPES[6];
            const Icon = typeInfo.icon;
            return (
              <div key={a.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm border-t-4" style={{ borderTopColor: a.color || '#4f6ef7' }}>
                <div className="flex justify-between items-start mb-2">
                  <Icon size={24} style={{ color: a.color || '#4f6ef7' }} />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ name: a.name, type: a.type, currency: a.currency, balance: a.balance, color: a.color, notes: a.notes, exclude_from_total: !!a.exclude_from_total }); setEditId(a.id); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(a.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <h3 className="font-semibold text-lg">{a.name}</h3>
                <p className="text-sm text-slate-500">{typeInfo.label}</p>
                <p className="font-bold text-lg mt-2">{fmt(a.balance, a.currency)}</p>
                {a.exclude_from_total && <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">不計入總資產</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此帳戶嗎？</p>
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
