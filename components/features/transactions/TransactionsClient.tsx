'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPost, apiPut, apiDelete, notifyDataChanged } from '../../../lib/clientApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const EMPTY_FORM = { date: '', type: 'expense', amount: '', categoryId: '', accountId: '', note: '', excludeFromStats: false, currency: 'TWD', fxRate: '' };
const EMPTY_TRANSFER_FORM = { date: '', amount: '', fromAccountId: '', toAccountId: '', note: '' };
const EMPTY_FILTERS = { type: '', accountId: '', categoryId: '', dateFrom: '', dateTo: '', keyword: '' };
const DEFAULT_CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP', 'AUD', 'CAD', 'SGD'];

type QueryParams = { get(name: string): string | null };

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get('page')) || 1);
}

function readFilters(searchParams: QueryParams) {
  return {
    type: searchParams.get('type') || '',
    accountId: searchParams.get('accountId') || '',
    categoryId: searchParams.get('categoryId') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    keyword: searchParams.get('keyword') || '',
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number | string) {
  return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW');
}

function labelForType(type: string) {
  if (type === 'income') return '收入';
  if (type === 'expense') return '支出';
  if (type === 'transfer_in') return '轉入';
  if (type === 'transfer_out') return '轉出';
  return type;
}

export default function TransactionsClient(_props: { user?: any } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => readPageParam(searchParams));
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(DEFAULT_CURRENCIES);
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [modal, setModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [batchModal, setBatchModal] = useState<'category' | 'date' | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, date: today() });
  const [transferForm, setTransferForm] = useState({ ...EMPTY_TRANSFER_FORM, date: today() });
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchDate, setBatchDate] = useState(today());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fxLoading, setFxLoading] = useState(false);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(pageSize),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.accountId ? { accountId: filters.accountId } : {}),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}),
        ...(filters.dateTo ? { dateTo: filters.dateTo } : {}),
        ...(filters.keyword ? { keyword: filters.keyword } : {}),
      });
      const data = await apiGet(`/api/transactions?${params}`);
      setTxs(data.items || data.data || []);
      setTotal(data.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filters]);

  const loadMeta = useCallback(async () => {
    const [accts, cats, pinned] = await Promise.all([
      apiGet('/api/accounts').catch(() => []),
      apiGet('/api/categories').catch(() => []),
      apiGet('/api/user/settings/pinned-currencies').catch(() => ({ pinnedCurrencies: ['TWD'] })),
    ]);
    setAccounts(accts);
    setCategories(cats);
    const pinnedCurrencies = Array.isArray(pinned?.pinnedCurrencies) ? pinned.pinnedCurrencies : ['TWD'];
    const nextDefaultCurrency = String(pinned?.defaultCurrency || 'TWD').toUpperCase();
    setDefaultCurrency(nextDefaultCurrency);
    const accountCurrencies = (Array.isArray(accts) ? accts : []).map((account: any) => String(account.currency || 'TWD').toUpperCase());
    const mergedCurrencies = Array.from(new Set([nextDefaultCurrency, 'TWD', ...pinnedCurrencies, ...accountCurrencies, ...DEFAULT_CURRENCIES]));
    setCurrencyOptions(mergedCurrencies);
  }, []);

  const updateFilters = useCallback((patch: Partial<typeof EMPTY_FILTERS>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setFilters(EMPTY_FILTERS);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const nextPage = readPageParam(searchParams);
    const nextFilters = readFilters(searchParams);
    if (nextPage !== page) setPage(nextPage);
    if (JSON.stringify(nextFilters) !== JSON.stringify(filters)) setFilters(nextFilters);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const nextQuery = params.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [currentQuery, filters, page, pageSize, pathname, router]);

  function openAdd() {
    const preferredAccount = accounts.find((account: any) => String(account.currency || 'TWD').toUpperCase() === defaultCurrency) || accounts[0];
    const defaultAccountId = preferredAccount?.id || '';
    const nextCurrency = String(preferredAccount?.currency || defaultCurrency || 'TWD').toUpperCase();
    setForm({ ...EMPTY_FORM, date: today(), accountId: defaultAccountId, currency: nextCurrency, fxRate: '' });
    setEditId(null);
    setFormError('');
    setModal(true);
  }

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
    if (!modal) return;
    if (editId) return;
    if (!form.currency || form.currency === 'TWD') {
      setFxLoading(false);
      return;
    }
    void fetchFxRate(form.currency);
  }, [modal, editId, form.currency, fetchFxRate]);

  function openTransfer() {
    setTransferForm({ ...EMPTY_TRANSFER_FORM, date: today(), fromAccountId: accounts[0]?.id || '', toAccountId: accounts[1]?.id || '' });
    setFormError('');
    setTransferModal(true);
  }

  function openEdit(tx: any) {
    if (tx.type === 'transfer_in' || tx.type === 'transfer_out') {
      setFormError('轉帳交易請改用刪除後重建');
      return;
    }
    setForm({
      date: tx.date || today(),
      type: tx.type || 'expense',
      amount: tx.originalAmount ?? tx.amount ?? '',
      categoryId: tx.category_id || tx.categoryId || '',
      accountId: tx.account_id || tx.accountId || '',
      note: tx.note || '',
      excludeFromStats: !!(tx.excludeFromStats ?? tx.exclude_from_stats),
      currency: tx.currency || 'TWD',
      fxRate: tx.fxRate ? String(tx.fxRate) : '',
    });
    setEditId(tx.id);
    setFormError('');
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date) { setFormError('請選擇日期'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError('請輸入有效金額'); return; }
    setSaving(true);
    setFormError('');
    const isForex = form.currency && form.currency !== 'TWD';
    const body = {
      date: form.date,
      type: form.type,
      amount: Number(form.amount),
      categoryId: form.categoryId || null,
      accountId: form.accountId || null,
      note: form.note,
      excludeFromStats: form.excludeFromStats,
      currency: form.currency || 'TWD',
      ...(isForex && { originalAmount: Number(form.amount) }),
      ...(isForex && form.fxRate ? { fxRate: Number(form.fxRate) } : {}),
    };
    try {
      if (editId) await apiPut(`/api/transactions/${editId}`, body);
      else await apiPost('/api/transactions', body);
      setModal(false);
      setPage(1);
      await load(1);
      notifyDataChanged('transactions');
    } catch (e: any) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function handleTransferSave(e: React.FormEvent) {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId) {
      setFormError('請選擇轉出與轉入帳戶');
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setFormError('轉出與轉入帳戶不可相同');
      return;
    }
    if (!transferForm.amount || Number(transferForm.amount) <= 0) {
      setFormError('請輸入有效金額');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await apiPost('/api/transactions/transfer', {
        date: transferForm.date,
        amount: Number(transferForm.amount),
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        note: transferForm.note,
      });
      setTransferModal(false);
      setPage(1);
      await load(1);
      notifyDataChanged('transactions');
    } catch (e: any) {
      setFormError(e.message);
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await apiDelete(`/api/transactions/${deleteId}`);
      setDeleteId(null);
      await load(page);
      notifyDataChanged('transactions');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(`確定要刪除選取的 ${selected.size} 筆交易嗎？`)) return;
    try {
      await apiPost('/api/transactions/batch-delete', { ids: [...selected] });
      setSelected(new Set());
      await load(page);
      notifyDataChanged('transactions');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleBatchUpdate() {
    const ids = [...selected];
    if (ids.length === 0 || !batchModal) return;
    const patch = batchModal === 'category'
      ? { categoryId: batchCategoryId || null }
      : { date: batchDate };
    try {
      await apiPost('/api/transactions/batch-update', { ids, patch });
      setBatchModal(null);
      setSelected(new Set());
      await load(page);
      notifyDataChanged('transactions');
    } catch (e: any) {
      alert(e.message);
    }
  }

  const parentIds = new Set(categories.filter((c: any) => c.parentId).map((c: any) => c.parentId));
  const filteredCats = categories.filter((c: any) => !form.type || c.type === form.type);
  const filteredStandalone = filteredCats.filter((c: any) => !c.parentId && !parentIds.has(c.id));
  const filteredParents = filteredCats.filter((c: any) => !c.parentId && parentIds.has(c.id));
  const filteredChildren = filteredCats.filter((c: any) => !!c.parentId);

  const allStandalone = categories.filter((c: any) => !c.parentId && !parentIds.has(c.id));
  const allParents = categories.filter((c: any) => !c.parentId && parentIds.has(c.id));
  const allChildren = categories.filter((c: any) => !!c.parentId);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const getCatName = (tx: any) => {
    const cat = categories.find((c: any) => c.id === (tx.category_id || tx.categoryId));
    if (!cat) return tx.cat_name || '—';
    const parent = cat.parentId ? categories.find((c: any) => c.id === cat.parentId) : null;
    return parent ? `${parent.name} › ${cat.name}` : cat.name;
  };

  const getAcctName = (tx: any) => {
    const account = accounts.find((item: any) => item.id === (tx.account_id || tx.accountId));
    return account ? account.name : (tx.account_name || '—');
  };

  return (
    <div className="page active space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">交易記錄</h2>
        {formError && <div className="text-sm text-red-500">{formError}</div>}
      </div>

      <div className="filter-bar">
        <input type="text" className="filter-input" placeholder="搜尋備註..." value={filters.keyword} onChange={(e) => updateFilters({ keyword: e.target.value })} />
        <select value={filters.type} onChange={(e) => updateFilters({ type: e.target.value })}>
          <option value="">所有類型</option>
          <option value="income">收入</option>
          <option value="expense">支出</option>
          <option value="transfer">轉帳</option>
          <option value="future">未來交易</option>
        </select>
        <select value={filters.accountId} onChange={(e) => updateFilters({ accountId: e.target.value })}>
          <option value="">所有帳戶</option>
          {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <select value={filters.categoryId} onChange={(e) => updateFilters({ categoryId: e.target.value })}>
          <option value="">所有分類</option>
          {allStandalone.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          {allParents.map((parent: any) => (
            <optgroup key={parent.id} label={parent.name}>
              {allChildren.filter((c: any) => c.parentId === parent.id).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <input type="date" value={filters.dateFrom} onChange={(e) => updateFilters({ dateFrom: e.target.value })} title="開始日期" />
        <input type="date" value={filters.dateTo} onChange={(e) => updateFilters({ dateTo: e.target.value })} title="結束日期" />
        <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
          <i className="fas fa-xmark" /> 清除
        </button>
      </div>

      <div className="tx-actions flex flex-wrap gap-2 items-center">
        <button className="btn" onClick={openAdd}><i className="fas fa-plus" /> 新增交易</button>
        <button className="btn btn-ghost btn-sm" onClick={openTransfer}><i className="fas fa-right-left" /> 帳戶轉帳</button>
        {selected.size > 0 && (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => setBatchModal('category')}><i className="fas fa-tags" /> 批次改分類</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setBatchModal('date')}><i className="fas fa-calendar" /> 批次改日期</button>
            <button className="btn btn-danger btn-sm" onClick={handleBatchDelete}><i className="fas fa-trash" /> 刪除選取 ({selected.size})</button>
          </>
        )}
        <span className="tx-count">共 {total} 筆</span>
      </div>

      {loading && <p className="empty-hint">載入中...</p>}
      {!loading && txs.length === 0 && <p className="empty-hint">尚無符合條件的交易記錄</p>}

      {!loading && txs.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(txs.map((tx) => tx.id)) : new Set())} checked={selected.size === txs.length && txs.length > 0} /></th>
                <th>日期</th>
                <th>類型</th>
                <th>分類</th>
                <th>帳戶</th>
                <th>備註</th>
                <th>金額</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {txs.map((tx) => {
                const isTransfer = tx.type === 'transfer_in' || tx.type === 'transfer_out';
                const isFuture = tx.date > today();
                return (
                  <tr key={tx.id} className={selected.has(tx.id) ? 'row-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(tx.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(tx.id); else next.delete(tx.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td>
                      <div>{tx.date}</div>
                      {isFuture && <div className="text-xs text-amber-600">未來交易</div>}
                    </td>
                    <td><span className={`badge badge-${tx.type}`}>{labelForType(tx.type)}</span></td>
                    <td>{isTransfer ? '—' : getCatName(tx)}</td>
                    <td>{getAcctName(tx)}{tx.toAccountId ? ` → ${accounts.find((account: any) => account.id === tx.toAccountId)?.name || '—'}` : ''}</td>
                    <td>
                      <div>{tx.note || '—'}</div>
                      {tx.sourceRecurringName && <div className="text-xs text-slate-500">來源：{tx.sourceRecurringName}</div>}
                      {tx.excludeFromStats && <div className="text-xs text-slate-500">不計入統計</div>}
                    </td>
                    <td className={tx.type === 'income' || tx.type === 'transfer_in' ? 'amount-income' : 'amount-expense'}>
                      {tx.type === 'income' || tx.type === 'transfer_in' ? '+' : '-'}{fmt(tx.amount)}
                      {tx.currency && tx.currency !== 'TWD' && (
                        <div className="text-xs text-slate-500">{tx.currency} {Math.abs(Number(tx.originalAmount || tx.amount)).toLocaleString('zh-TW')}</div>
                      )}
                    </td>
                    <td>
                      {!isTransfer && <button className="btn-icon" title="編輯" onClick={() => openEdit(tx)}><i className="fas fa-pencil" /></button>}
                      <button className="btn-icon danger" title="刪除" onClick={() => setDeleteId(tx.id)}><i className="fas fa-trash" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹ 上一頁</button>
          <span className="page-info">{page} / {totalPages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>下一頁 ›</button>
        </div>
      )}

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? '編輯交易' : '新增交易'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">日期 *</label>
              <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">類型</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.type} onChange={(e) => setForm((current) => ({ ...current, type: e.target.value, categoryId: '' }))}>
                <option value="income">收入</option>
                <option value="expense">支出</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">金額 *</label>
              <input type="number" required min="0.01" step="0.01" placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">分類</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.categoryId} onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}>
                <option value="">未分類</option>
                {filteredStandalone.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                {filteredParents.map((parent: any) => (
                  <optgroup key={parent.id} label={parent.name}>
                    {filteredChildren.filter((c: any) => c.parentId === parent.id).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">帳戶</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.accountId} onChange={(e) => {
                const acct = accounts.find((a: any) => a.id === e.target.value);
                const nextCurrency = String(acct?.currency || 'TWD').toUpperCase();
                setForm((current) => ({ ...current, accountId: e.target.value, currency: nextCurrency, fxRate: '' }));
              }}>
                <option value="">未指定</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}{account.currency && account.currency !== 'TWD' ? ` (${account.currency})` : ''}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">幣別</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.currency} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase(), fxRate: '' }))}>
                {currencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
              </select>
            </div>
            {form.currency && form.currency !== 'TWD' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">匯率（1 {form.currency} = ? TWD）</label>
                <input type="number" min="0.0001" step="any" placeholder="留空則使用系統匯率" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.fxRate} onChange={(e) => setForm((current) => ({ ...current, fxRate: e.target.value }))} />
                {fxLoading && <p className="text-xs text-slate-500">查詢最新匯率中...</p>}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">備註</label>
              <input type="text" maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.excludeFromStats} onChange={(e) => setForm((current) => ({ ...current, excludeFromStats: e.target.checked }))} /> 不計入統計
            </label>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter className="flex-row justify-end">
              <DialogClose asChild>
                <Button type="button" variant="outline">取消</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? '儲存中...' : '儲存'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>帳戶轉帳</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSave} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">日期 *</label>
              <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.date} onChange={(e) => setTransferForm((current) => ({ ...current, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">轉出帳戶 *</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.fromAccountId} onChange={(e) => setTransferForm((current) => ({ ...current, fromAccountId: e.target.value }))}>
                <option value="">請選擇</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">轉入帳戶 *</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.toAccountId} onChange={(e) => setTransferForm((current) => ({ ...current, toAccountId: e.target.value }))}>
                <option value="">請選擇</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">金額 *</label>
              <input type="number" required min="0.01" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.amount} onChange={(e) => setTransferForm((current) => ({ ...current, amount: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">備註</label>
              <input type="text" maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.note} onChange={(e) => setTransferForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">取消</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? '建立中...' : '確認轉帳'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {batchModal && (
        <div className="modal-overlay active" onClick={() => setBatchModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{batchModal === 'category' ? '批次變更分類' : '批次變更日期'}</h3>
              <button className="btn-icon" onClick={() => setBatchModal(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {batchModal === 'category' ? (
                <div className="form-row">
                  <label>新分類</label>
                  <select value={batchCategoryId} onChange={(e) => setBatchCategoryId(e.target.value)}>
                    <option value="">未分類</option>
                    {allStandalone.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    {allParents.map((parent: any) => (
                      <optgroup key={parent.id} label={parent.name}>
                        {allChildren.filter((c: any) => c.parentId === parent.id).map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="form-row">
                  <label>新日期</label>
                  <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setBatchModal(null)}>取消</button>
                <button className="btn btn-primary" onClick={handleBatchUpdate}>套用到 {selected.size} 筆</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay active" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>確認刪除</h3>
              <button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>確定要刪除這筆交易記錄嗎？此操作無法復原。</p>
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
