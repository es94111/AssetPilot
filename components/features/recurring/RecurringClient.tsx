'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import { Plus, Trash2, Edit3, Pause, Play, StickyNote, Repeat } from 'lucide-react';

const FREQUENCY_VALUES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
const EMPTY_FORM = { type: 'expense', amount: '', currency: 'TWD', fxRate: '', categoryId: '', accountId: '', frequency: 'monthly', startDate: '', note: '', excludeFromStats: false, fxFee: '' };
const DEFAULT_CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP', 'AUD', 'CAD', 'SGD'];

function fmt(n: number | string, locale: string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString(localeTag(locale)); }

// recurring 的 amount 存的是 TWD；外幣需先還原成原幣別金額才能編輯，否則每次儲存都會再次套用匯率換算。
function fmtAmountForEdit(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

export default function RecurringClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const [recs, setRecs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(DEFAULT_CURRENCIES);
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxFeeEdited, setFxFeeEdited] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, cats, accts, pinned] = await Promise.all([
        apiGet('/api/recurring').catch(() => []),
        apiGet('/api/categories').catch(() => []),
        apiGet('/api/accounts').catch(() => []),
        apiGet('/api/user/settings/pinned-currencies').catch(() => ({ pinnedCurrencies: ['TWD'] })),
      ]);
      setRecs(data || []);
      setCategories(cats);
      setAccounts(accts);
      const pinnedCurrencies = Array.isArray(pinned?.pinnedCurrencies) ? pinned.pinnedCurrencies : ['TWD'];
      const nextDefaultCurrency = String(pinned?.defaultCurrency || 'TWD').toUpperCase();
      setDefaultCurrency(nextDefaultCurrency);
      const accountCurrencies = (Array.isArray(accts) ? accts : []).map((account: any) => String(account.currency || 'TWD').toUpperCase());
      const mergedCurrencies = Array.from(new Set([nextDefaultCurrency, 'TWD', ...pinnedCurrencies, ...accountCurrencies, ...DEFAULT_CURRENCIES]));
      setCurrencyOptions(mergedCurrencies);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchFxRate = useCallback(async (currency: string) => {
    const normalizedCurrency = String(currency || '').toUpperCase();
    if (!normalizedCurrency || normalizedCurrency === 'TWD') {
      setFxLoading(false);
      setForm((current) => current.currency === 'TWD' ? { ...current, fxRate: '' } : current);
      return;
    }

    setFxLoading(true);
    try {
      const refresh = await apiPost('/api/exchange-rates/refresh', { currencies: [normalizedCurrency] });
      const matched = Array.isArray(refresh?.rates)
        ? refresh.rates.find((rate: any) => rate.currency === normalizedCurrency)
        : null;
      if (matched?.rateToTwd) {
        setForm((current) => current.currency === normalizedCurrency ? { ...current, fxRate: String(matched.rateToTwd) } : current);
      }
    } catch (_) {
      try {
        const existing = await apiGet('/api/exchange-rates');
        const matched = Array.isArray(existing?.rates)
          ? existing.rates.find((rate: any) => rate.currency === normalizedCurrency)
          : null;
        if (matched?.rateToTwd) {
          setForm((current) => current.currency === normalizedCurrency ? { ...current, fxRate: String(matched.rateToTwd) } : current);
        }
      } catch (_) {
        // Keep manual entry available when auto fetch fails.
      }
    } finally {
      setFxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dialogOpen) return;
    if (editId) return;
    if (!form.currency || form.currency === 'TWD') {
      setFxLoading(false);
      return;
    }
    void fetchFxRate(form.currency);
  }, [dialogOpen, editId, form.currency, fetchFxRate]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) { setFormError(t('features.recurring.messages.amountRequired')); return; }
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
      excludeFromStats: form.excludeFromStats,
      // Foreign-currency credit cards: only send a manually overridden fee.
      ...(overseasApplies && form.fxFee !== '' ? { fxFee: Math.max(0, Number(form.fxFee) || 0) } : {}),
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

  function openCreate() {
    const preferredAccount = accounts.find((account: any) => String(account.currency || 'TWD').toUpperCase() === defaultCurrency) || accounts[0];
    const defaultAccountId = preferredAccount?.id || '';
    const nextCurrency = String(preferredAccount?.currency || defaultCurrency || 'TWD').toUpperCase();
    setForm({ ...EMPTY_FORM, startDate: new Date().toISOString().slice(0, 10), accountId: defaultAccountId, currency: nextCurrency, fxRate: '' });
    setEditId(null);
    setFxFeeEdited(false);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(rec: any) {
    const currency = String(rec.currency || 'TWD').toUpperCase();
    const rate = Number(rec.fxRate || rec.fx_rate) || 1;
    const shownAmount = (currency === 'TWD' || !(rate > 0)) ? Number(rec.amount) || 0 : (Number(rec.amount) || 0) / rate;
    setForm({
      ...rec,
      categoryId: rec.category_id || rec.categoryId,
      accountId: rec.account_id || rec.accountId,
      startDate: rec.startDate || rec.start_date,
      currency,
      amount: fmtAmountForEdit(shownAmount),
      fxRate: String(rec.fxRate || rec.fx_rate || 1),
      excludeFromStats: !!rec.excludeFromStats,
      fxFee: Number(rec.fxFee) > 0 ? String(Math.round(Number(rec.fxFee))) : '',
    });
    setEditId(rec.id);
    setFxFeeEdited(Number(rec.fxFee) > 0);
    setFormError('');
    setDialogOpen(true);
  }

  // Overseas card fee applies only to foreign-currency credit-card expenses.
  const selectedAccount = accounts.find((account: any) => account.id === form.accountId) || null;
  const overseasFeeRate = selectedAccount && selectedAccount.category === 'credit_card'
    ? Number(selectedAccount.overseasFeeRate) || 0
    : 0;
  const overseasApplies = form.type === 'expense' && form.currency !== 'TWD' && overseasFeeRate > 0;
  const autoFxFee = (() => {
    if (!overseasApplies) return 0;
    const amt = Number(form.amount);
    const rate = Number(form.fxRate);
    if (!(amt > 0) || !(rate > 0)) return 0;
    return Math.max(0, Math.round(amt * rate * overseasFeeRate / 100));
  })();

  useEffect(() => {
    if (!dialogOpen) return;
    if (!overseasApplies) {
      setForm((current) => current.fxFee === '' ? current : { ...current, fxFee: '' });
      return;
    }
    if (fxFeeEdited) return;
    const next = autoFxFee > 0 ? String(autoFxFee) : '';
    setForm((current) => current.fxFee === next ? current : { ...current, fxFee: next });
  }, [dialogOpen, overseasApplies, autoFxFee, fxFeeEdited]);
  const frequencyOptions = FREQUENCY_VALUES.map(value => ({ label: t(`features.recurring.frequencyLabels.${value}`), value }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('features.recurring.title')}</h2>

      <Button onClick={openCreate}><Plus size={16} className="mr-2" /> {t('features.recurring.add')}</Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? t('features.recurring.edit') : t('features.recurring.create')}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select label={t('features.common.type')} options={[{label: t('features.common.expense'), value: 'expense'}, {label: t('features.common.income'), value: 'income'}]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
            <Input label={t('features.recurring.amountLabel')} type="number" step="any" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            <Select label={t('features.common.currency')} options={currencyOptions.map(currency => ({ label: currency, value: currency }))} value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value.toUpperCase(), fxRate: '' }))} />
            {form.currency !== 'TWD' && (
              <div className="space-y-1">
                <Input label={t('features.common.exchangeRate')} type="number" step="0.0001" value={form.fxRate} onChange={e => setForm(f => ({ ...f, fxRate: e.target.value }))} />
                {fxLoading && <p className="text-xs text-slate-500">{t('features.recurring.latestRateLoading')}</p>}
              </div>
            )}
            {overseasApplies && (
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-700">{t('features.recurring.fxFeeLabel')}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" step="1" placeholder={t('features.recurring.fxFeePlaceholder')}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={form.fxFee}
                    onChange={e => { setFxFeeEdited(true); setForm(f => ({ ...f, fxFee: e.target.value })); }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => { setFxFeeEdited(false); setForm(f => ({ ...f, fxFee: autoFxFee > 0 ? String(autoFxFee) : '' })); }}
                  >
                    {t('features.common.autoCalculate')}
                  </button>
                </div>
                <p className="text-xs text-slate-500">{t('features.recurring.fxFeeHint', {
                  rate: overseasFeeRate,
                  suggestion: autoFxFee > 0 ? t('features.recurring.fxFeeSuggestion', { amount: autoFxFee.toLocaleString(localeTag(locale)) }) : '',
                })}</p>
              </div>
            )}
            <Select label={t('features.recurring.category')} options={[{label: t('features.common.uncategorized'), value: ''}, ...categories.map(c => ({ label: c.name, value: c.id }))]} value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} />
            <Select label={t('features.common.account')} options={[{label: t('features.common.unspecified'), value: ''}, ...accounts.map(a => ({ label: a.name, value: a.id }))]} value={form.accountId} onChange={e => {
              const acct = accounts.find((account: any) => account.id === e.target.value);
              const nextCurrency = String(acct?.currency || 'TWD').toUpperCase();
              setForm(f => ({ ...f, accountId: e.target.value, currency: nextCurrency, fxRate: '' }));
            }} />
            <Select label={t('features.recurring.frequency')} options={frequencyOptions} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} />
            <Input label={t('features.recurring.startDate')} type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label={t('features.common.note')} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" className="w-4 h-4" checked={form.excludeFromStats} onChange={e => setForm(f => ({ ...f, excludeFromStats: e.target.checked }))} />
              {t('features.common.excludeFromStats')}
            </label>
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="ui-skeleton h-36 rounded-xl" />)}
        </div>
      ) : recs.length === 0 ? (
        <div className="empty-state rounded-xl border border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
          <div className="empty-state-icon"><Repeat size={22} aria-hidden="true" /></div>
          <p className="empty-state-title">{t('common.noData')}</p>
          <p className="empty-state-hint">{t('nav.recurring')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recs.map(r => {
            const catName = categories.find(c => c.id === (r.category_id || r.categoryId))?.name || t('features.common.uncategorized');
            const acctName = accounts.find(a => a.id === (r.account_id || r.accountId))?.name || t('features.common.unspecified');
            return (
              <div key={r.id} className={`p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm ${!r.isActive ? 'opacity-70' : ''}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs ${r.type === 'income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{r.type === 'income' ? t('features.common.income') : t('features.common.expense')}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleToggle(r.id)}>{r.isActive ? <Pause size={16} /> : <Play size={16} />}</Button>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(r.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <h3 className="font-semibold text-lg">{fmt(r.amount, locale)} ({t(`features.recurring.frequencyLabels.${r.frequency}`)})</h3>
                <div className="text-sm text-slate-500 mt-2 space-y-1">
                  <p>{t('features.recurring.categoryLine', { name: catName })}</p>
                  <p>{t('features.recurring.accountLine', { name: acctName })}</p>
                  <p>{t('features.recurring.nextRun', { date: r.nextDate || t('features.common.notRecorded') })}</p>
                  {Number(r.fxFee) > 0 && <p>{t('features.recurring.fxFeeLine', { amount: Math.round(Number(r.fxFee)).toLocaleString(localeTag(locale)) })}</p>}
                  {r.excludeFromStats && <span className="inline-block text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded">{t('features.common.excludeFromStats')}</span>}
                </div>
                {r.note && <p className="text-xs text-slate-400 mt-3 italic flex items-center gap-1"><StickyNote size={12}/> {r.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold mb-4">{t('common.confirmDelete')}</h3>
            <p className="mb-4">{t('features.recurring.deleteMessage')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteId(null)}>{t('common.cancel')}</Button>
              <Button variant="destructive" onClick={handleDelete}>{t('common.confirm')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
