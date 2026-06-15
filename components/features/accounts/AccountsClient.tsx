'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Trash2, Edit3, Landmark, PiggyBank, Briefcase, DollarSign, CreditCard, Wallet, CircleDot } from 'lucide-react';

const ACCOUNT_TYPES = [
  { value: 'bank', label: '銀行帳戶', icon: Landmark },
  { value: 'credit_card', label: '信用卡', icon: CreditCard },
  { value: 'cash', label: '現金', icon: DollarSign },
  { value: 'virtual_wallet', label: '電子錢包', icon: Wallet },
  { value: 'other', label: '其他', icon: CircleDot },
];

const EMPTY_FORM = {
  name: '',
  category: 'bank',
  currency: 'TWD',
  initialBalance: '',
  icon: 'fa-wallet',
  excludeFromTotal: false,
  linkedBankId: '',
  overseasFeeRate: '',
  statementClosingDay: '',
};

const EMPTY_REPAYMENT = {
  fromAccountId: '',
  date: '',
  repayments: {} as Record<string, string>,
};

function fmt(n: number | string, currency = 'TWD') {
  const num = Math.round(Number(n) || 0);
  return (currency === 'TWD' ? 'NT$ ' : '') + num.toLocaleString('zh-TW') + (currency !== 'TWD' ? ` ${currency}` : '');
}

// 'YYYY-MM-DD' → 'M/D'，給帳單區間顯示用。
function mdLabel(dateStr: string) {
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  return m ? `${Number(m[1])}/${Number(m[2])}` : '';
}

function categoryLabel(category: string) {
  return ACCOUNT_TYPES.find((item) => item.value === category)?.label || category || '其他';
}

export default function AccountsClient() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [repaymentOpen, setRepaymentOpen] = useState(false);
  const [repaymentForm, setRepaymentForm] = useState({ ...EMPTY_REPAYMENT, date: new Date().toISOString().slice(0, 10) });
  const [fxRates, setFxRates] = useState<{ currency: string; rateToTwd: number }[]>([]);
  const [fxSettings, setFxSettings] = useState<{ autoUpdate: boolean; lastSyncedAt?: number }>({ autoUpdate: false });
  const [newFxCurrency, setNewFxCurrency] = useState('');
  const [newFxRate, setNewFxRate] = useState('');
  const [fxSaving, setFxSaving] = useState(false);
  const [fxMsg, setFxMsg] = useState('');
  const [fxSyncing, setFxSyncing] = useState(false);
  const [repaymentError, setRepaymentError] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');

  const loadFxRates = useCallback(async () => {
    try {
      const data = await apiGet('/api/exchange-rates');
      setFxRates(data.rates || []);
      setFxSettings(data.settings || { autoUpdate: false });
    } catch (_) {}
  }, []);

  const load = useCallback(async () => {
    try {
      const [data, settings] = await Promise.all([
        apiGet('/api/accounts'),
        apiGet('/api/user/settings/default-currency').catch(() => ({ defaultCurrency: 'TWD' })),
      ]);
      setAccounts(data || []);
      setDefaultCurrency(String(settings?.defaultCurrency || 'TWD').toUpperCase());
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); loadFxRates(); }, [load, loadFxRates]);

  const bankAccounts = useMemo(() => accounts.filter((account) => account.category === 'bank'), [accounts]);
  const creditAccounts = useMemo(() => accounts.filter((account) => account.category === 'credit_card'), [accounts]);
  const groupedBanks = useMemo(() => {
    const map = new Map<string, { bank: any; cards: any[] }>();
    bankAccounts.forEach((bank) => map.set(bank.id, { bank, cards: [] }));
    creditAccounts.forEach((card) => {
      if (card.linkedBankId && map.has(card.linkedBankId)) map.get(card.linkedBankId)?.cards.push(card);
    });
    return Array.from(map.values());
  }, [bankAccounts, creditAccounts]);

  const filteredRepaymentCards = useMemo(() =>
    creditAccounts.filter((c) => c.linkedBankId === repaymentForm.fromAccountId),
    [creditAccounts, repaymentForm.fromAccountId]
  );

  const ungroupedAccounts = useMemo(() => {
    const linkedCreditIds = new Set(creditAccounts.filter((card) => card.linkedBankId).map((card) => card.id));
    return accounts.filter((account) => {
      if (account.category === 'bank') return false;
      if (linkedCreditIds.has(account.id)) return false;
      return true;
    });
  }, [accounts, creditAccounts]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError('請輸入帳戶名稱'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      name: form.name,
      category: form.category,
      currency: form.currency,
      initialBalance: Number(form.initialBalance || 0),
      icon: form.icon,
      excludeFromTotal: form.excludeFromTotal,
      linkedBankId: form.category === 'credit_card' ? (form.linkedBankId || null) : null,
      overseasFeeRate: form.category === 'credit_card' && form.overseasFeeRate !== '' ? Number(form.overseasFeeRate) : null,
      statementClosingDay: form.category === 'credit_card' && form.statementClosingDay !== '' ? Number(form.statementClosingDay) : null,
    };
    try {
      if (editId) await apiPut(`/api/accounts/${editId}`, body);
      else await apiPost('/api/accounts', body);
      await load();
      setAccountDialogOpen(false);
      setEditId(null);
    } catch (e: any) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/api/accounts/${deleteId}`);
      setDeleteId(null);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleRepaymentSubmit(e: React.FormEvent) {
    e.preventDefault();
    const repayments = Object.entries(repaymentForm.repayments)
      .map(([cardId, amount]) => ({ cardId, amount: Number(amount || 0) }))
      .filter((item) => item.amount > 0);
    if (!repaymentForm.fromAccountId) {
      setRepaymentError('請選擇付款帳戶');
      return;
    }
    if (repayments.length === 0) {
      setRepaymentError('請至少輸入一張信用卡的還款金額');
      return;
    }
    setRepaymentError('');
    try {
      await apiPost('/api/accounts/credit-card-repayment', {
        fromAccountId: repaymentForm.fromAccountId,
        date: repaymentForm.date,
        repayments,
      });
      setRepaymentOpen(false);
      await load();
    } catch (e: any) {
      setRepaymentError(e.message);
    }
  }

  async function handleFxAdd(e: React.FormEvent) {
    e.preventDefault();
    const currency = newFxCurrency.trim().toUpperCase();
    const rate = Number(newFxRate);
    if (!currency || !/^[A-Z]{3}$/.test(currency)) { setFxMsg('幣別格式錯誤（需為 3 碼英文字母）'); return; }
    if (!(rate > 0)) { setFxMsg('請輸入有效匯率'); return; }
    setFxSaving(true);
    setFxMsg('');
    try {
      const existing = fxRates.filter((r) => r.currency !== currency && r.currency !== 'TWD');
      const data = await apiPut('/api/exchange-rates', { rates: [...existing, { currency, rateToTwd: rate }] });
      setFxRates(data.rates || []);
      setFxSettings(data.settings || fxSettings);
      setNewFxCurrency('');
      setNewFxRate('');
      setFxMsg('已儲存');
    } catch (e: any) { setFxMsg(e.message || '儲存失敗'); }
    setFxSaving(false);
  }

  async function handleFxDelete(currency: string) {
    setFxSaving(true);
    setFxMsg('');
    try {
      await apiDelete(`/api/exchange-rates/${currency}`);
      setFxRates((prev) => prev.filter((r) => r.currency !== currency));
    } catch (e: any) { setFxMsg(e.message || '刪除失敗'); }
    setFxSaving(false);
  }

  async function handleFxAutoUpdate(enabled: boolean) {
    try {
      await apiPut('/api/exchange-rates/settings', { autoUpdate: enabled });
      setFxSettings((s) => ({ ...s, autoUpdate: enabled }));
    } catch (_) {}
  }

  async function handleFxSync() {
    setFxSyncing(true);
    setFxMsg('');
    try {
      const data = await apiPost('/api/exchange-rates/refresh', { currencies: fxRates.filter((r) => r.currency !== 'TWD').map((r) => r.currency) });
      setFxRates(data.rates || []);
      setFxSettings(data.settings || fxSettings);
      setFxMsg(data.message || '匯率已更新');
    } catch (e: any) { setFxMsg(e.message || '同步失敗'); }
    setFxSyncing(false);
  }

  const totalAssets = accounts.filter((account) => !account.excludeFromTotal).reduce((sum, account) => sum + (Number(account.twdAccumulated) || 0), 0);
  const totalCreditOutstanding = creditAccounts.reduce((sum, account) => sum + Math.max(0, -(Number(account.twdAccumulated) || 0)), 0);

  function openAdd() {
    setForm({ ...EMPTY_FORM, currency: defaultCurrency });
    setEditId(null);
    setFormError('');
    setAccountDialogOpen(true);
  }

  function openEdit(account: any) {
    setForm({
      name: account.name,
      category: account.category || 'other',
      currency: account.currency || 'TWD',
      initialBalance: String(account.initialBalance ?? account.balance ?? ''),
      icon: account.icon || 'fa-wallet',
      excludeFromTotal: !!account.excludeFromTotal,
      linkedBankId: account.linkedBankId || '',
      overseasFeeRate: account.overseasFeeRate != null ? String(account.overseasFeeRate) : '',
      statementClosingDay: account.statementClosingDay != null ? String(account.statementClosingDay) : '',
    });
    setEditId(account.id);
    setFormError('');
    setAccountDialogOpen(true);
  }

  function renderAccountCard(account: any) {
    const Icon = ACCOUNT_TYPES.find((item) => item.value === account.category)?.icon || CircleDot;
    return (
      <div key={account.id} className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm border-t-4" style={{ borderTopColor: account.color || '#4f6ef7' }}>
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Icon size={22} style={{ color: account.color || '#4f6ef7' }} />
            <div className="min-w-0">
              <h3 className="font-semibold text-lg truncate">{account.name}</h3>
              <p className="text-sm text-slate-500">{categoryLabel(account.category)}</p>
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" onClick={() => openEdit(account)}><Edit3 size={16} /></Button>
            <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(account.id)}><Trash2 size={16} /></Button>
          </div>
        </div>
        <p className="font-bold text-lg mt-2">{fmt(account.balance, account.currency)}</p>
        {account.currency !== 'TWD' && <p className="text-sm text-slate-500 mt-1">折算總額：{fmt(account.twdAccumulated, 'TWD')}</p>}
        {account.linkedBankId && <p className="text-xs text-slate-500 mt-2">關聯銀行：{bankAccounts.find((item) => item.id === account.linkedBankId)?.name || '—'}</p>}
        {account.overseasFeeRate != null && <p className="text-xs text-slate-500 mt-1">海外手續費率：{account.overseasFeeRate}%</p>}
        {account.statementClosingDay != null && (
          <p className="text-xs text-slate-500 mt-2">每月結帳日：{account.statementClosingDay} 號</p>
        )}
        {account.statementClosingDay != null && account.cycleSpending != null && (
          <p className="text-sm font-medium text-rose-600 mt-1">
            本期消費：{fmt(account.cycleSpending, account.currency)}
            {account.cycleStart && account.cycleEnd && (
              <span className="text-xs font-normal text-slate-400 ml-1">（{mdLabel(account.cycleStart)}–{mdLabel(account.cycleEnd)}）</span>
            )}
          </p>
        )}
        {account.excludeFromTotal && <span className="inline-block text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded mt-2">不計入總資產</span>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">帳戶管理</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">總資產</p>
          <p className="text-2xl font-semibold text-blue-600">NT$ {Math.round(totalAssets).toLocaleString('zh-TW')}</p>
        </div>
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
          <p className="text-sm text-slate-500">信用卡待還總額</p>
          <p className="text-2xl font-semibold text-rose-600">NT$ {Math.round(totalCreditOutstanding).toLocaleString('zh-TW')}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <Button onClick={openAdd}><Plus size={16} className="mr-2" /> 新增帳戶</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? '編輯帳戶' : '新增帳戶'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="帳戶名稱 *" value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} />
              <Select label="類型" options={ACCOUNT_TYPES.map((item) => ({ label: item.label, value: item.value }))} value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} />
              <Input label="幣別" value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} />
              <Input label={editId ? '初始餘額 / 目前設定' : '初始餘額'} type="number" step="any" value={form.initialBalance} onChange={(e) => setForm((current) => ({ ...current, initialBalance: e.target.value }))} />
              {form.category === 'credit_card' && (
                <>
                  <Select label="所屬銀行" options={[{ label: '不分組', value: '' }, ...bankAccounts.map((bank) => ({ label: bank.name, value: bank.id }))]} value={form.linkedBankId} onChange={(e) => setForm((current) => ({ ...current, linkedBankId: e.target.value }))} />
                  <Input label="海外手續費率（%）" type="number" step="0.01" value={form.overseasFeeRate} onChange={(e) => setForm((current) => ({ ...current, overseasFeeRate: e.target.value }))} />
                  <Input label="結帳日（每月幾號，1~31）" type="number" min="1" max="31" step="1" placeholder="例如 15，留空則不統計本期消費" value={form.statementClosingDay} onChange={(e) => setForm((current) => ({ ...current, statementClosingDay: e.target.value }))} />
                </>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.excludeFromTotal} onChange={(e) => setForm((current) => ({ ...current, excludeFromTotal: e.target.checked }))} className="w-4 h-4" />
                不計入總資產
              </label>
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>取消</Button>
                <Button type="submit" disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {creditAccounts.length > 0 && (
          <Button variant="outline" onClick={() => {
            const firstBankId = bankAccounts[0]?.id || '';
            setRepaymentForm({
              ...EMPTY_REPAYMENT,
              date: new Date().toISOString().slice(0, 10),
              fromAccountId: firstBankId,
              repayments: Object.fromEntries(
                creditAccounts.filter((c) => c.linkedBankId === firstBankId).map((c) => [c.id, ''])
              ),
            });
            setRepaymentError('');
            setRepaymentOpen(true);
          }}>
            信用卡還款
          </Button>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="space-y-6">
          {groupedBanks.map((group) => (
            <section key={group.bank.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <Landmark size={18} className="text-slate-500" />
                <h3 className="text-lg font-semibold text-slate-900">{group.bank.name}</h3>
                <span className="text-sm text-slate-500">{fmt(group.bank.balance, group.bank.currency)}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {renderAccountCard(group.bank)}
                {group.cards.map(renderAccountCard)}
              </div>
            </section>
          ))}

          {ungroupedAccounts.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-900">其他帳戶</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {ungroupedAccounts.map(renderAccountCard)}
              </div>
            </section>
          )}
        </div>
      )}

      {repaymentOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100 w-full max-w-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">信用卡還款</h3>
              <Button variant="ghost" onClick={() => setRepaymentOpen(false)}>關閉</Button>
            </div>
            <form onSubmit={handleRepaymentSubmit} className="space-y-4">
              <Select label="付款帳戶" options={bankAccounts.map((bank) => ({ label: bank.name, value: bank.id }))} value={repaymentForm.fromAccountId} onChange={(e) => setRepaymentForm((current) => ({
                ...current,
                fromAccountId: e.target.value,
                repayments: Object.fromEntries(
                  creditAccounts.filter((c) => c.linkedBankId === e.target.value).map((c) => [c.id, ''])
                ),
              }))} />
              <Input label="還款日期" type="date" value={repaymentForm.date} onChange={(e) => setRepaymentForm((current) => ({ ...current, date: e.target.value }))} />
              <div className="space-y-3">
                {filteredRepaymentCards.length === 0 ? (
                  <p className="text-sm text-slate-500">此銀行沒有關聯的信用卡</p>
                ) : filteredRepaymentCards.map((account) => (
                  <div key={account.id} className="grid grid-cols-[1fr_160px] gap-3 items-center">
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-slate-500">目前餘額：{fmt(account.balance, account.currency)}</div>
                    </div>
                    <Input label="還款金額" type="number" step="0.01" value={repaymentForm.repayments[account.id] || ''} onChange={(e) => setRepaymentForm((current) => ({ ...current, repayments: { ...current.repayments, [account.id]: e.target.value } }))} />
                  </div>
                ))}
              </div>
              {repaymentError && <p className="text-red-500 text-sm">{repaymentError}</p>}
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setRepaymentOpen(false)}>取消</Button>
                <Button type="submit">確認還款</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此帳戶嗎？</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>取消</Button>
              <Button variant="destructive" onClick={handleDelete}>確認刪除</Button>
            </div>
          </div>
        </div>
      )}

      {/* 匯率管理 */}
      <section className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-lg font-semibold">匯率管理</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fxSettings.autoUpdate} onChange={(e) => handleFxAutoUpdate(e.target.checked)} className="w-4 h-4" />
              自動更新匯率
            </label>
            <Button variant="outline" size="sm" onClick={handleFxSync} disabled={fxSyncing}>
              {fxSyncing ? '同步中...' : '立即同步'}
            </Button>
          </div>
        </div>
        {fxSettings.lastSyncedAt && (
          <p className="text-xs text-slate-500">上次同步：{new Date(fxSettings.lastSyncedAt).toLocaleString('zh-TW')}</p>
        )}
        {fxRates.filter((r) => r.currency !== 'TWD').length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500 text-left">
                  <th className="pb-2 pr-6">幣別</th>
                  <th className="pb-2 pr-6">1 單位 = TWD</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {fxRates.filter((r) => r.currency !== 'TWD').map((r) => (
                  <tr key={r.currency} className="border-b last:border-0">
                    <td className="py-2 pr-6 font-medium">{r.currency}</td>
                    <td className="py-2 pr-6">{r.rateToTwd}</td>
                    <td className="py-2">
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 h-7 px-2" onClick={() => handleFxDelete(r.currency)} disabled={fxSaving}>刪除</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">尚未設定任何外幣匯率</p>
        )}
        <form onSubmit={handleFxAdd} className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">幣別（如 USD）</label>
            <input
              type="text" maxLength={3} placeholder="USD"
              className="w-24 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={newFxCurrency} onChange={(e) => setNewFxCurrency(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">對 TWD 匯率</label>
            <input
              type="number" min="0.0001" step="0.0001" placeholder="32.5"
              className="w-32 px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={newFxRate} onChange={(e) => setNewFxRate(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={fxSaving}>新增 / 更新</Button>
        </form>
        {fxMsg && <p className={`text-sm ${fxMsg.includes('失敗') || fxMsg.includes('錯誤') ? 'text-red-500' : 'text-green-600'}`}>{fxMsg}</p>}
      </section>
    </div>
  );
}
