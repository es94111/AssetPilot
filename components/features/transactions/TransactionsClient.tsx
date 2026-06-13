'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPost, apiPut, apiDelete, notifyDataChanged } from '../../../lib/clientApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const EMPTY_FORM = { date: '', type: 'expense', amount: '', categoryId: '', accountId: '', note: '', excludeFromStats: false, currency: 'TWD', fxRate: '', fxFee: '' };
const EMPTY_TRANSFER_FORM = { date: '', amount: '', fromAccountId: '', toAccountId: '', note: '' };
const EMPTY_FILTERS = { type: '', accountId: '', categoryId: '', dateFrom: '', dateTo: '', keyword: '' };
const DEFAULT_CURRENCIES = ['TWD', 'USD', 'JPY', 'EUR', 'CNY', 'HKD', 'GBP', 'AUD', 'CAD', 'SGD'];
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type PhotoStorageStatus = {
  local?: { configured: boolean; directory: string };
  s3?: { configured: boolean; missing: string[]; endpoint: string; bucket: string; prefix: string };
  maxBytes?: number;
};

type AttachmentItem = {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  url: string;
};

// 前端壓縮：縮到最長邊 1600px、JPEG quality 0.8，省上傳頻寬與 S3 空間。
// 純瀏覽器 Canvas，無新套件；createImageBitmap 的 imageOrientation 處理 iPhone EXIF 旋轉。
const PHOTO_MAX_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 0.8;

async function compressPhoto(file: File): Promise<File> {
  // 非可重新編碼的圖（GIF 動畫、SVG）或瀏覽器不支援 API 時，維持原檔。
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', PHOTO_JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file; // 沒變小（如已壓縮的小圖）就用原圖
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file; // 任何解碼/繪製失敗都回退原圖，確保上傳不被壓縮中斷
  }
}

type QueryParams = { get(name: string): string | null };

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get('page')) || 1);
}

function readPageSizeParam(searchParams: QueryParams) {
  const value = Number(searchParams.get('limit')) || 20;
  return PAGE_SIZE_OPTIONS.includes(value) ? value : 20;
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
  const [pageSize, setPageSize] = useState(() => readPageSizeParam(searchParams));
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
  const [fxFeeEdited, setFxFeeEdited] = useState(false);
  const [formError, setFormError] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoStorageStatus, setPhotoStorageStatus] = useState<PhotoStorageStatus | null>(null);
  const [photoUploadWarning, setPhotoUploadWarning] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fxLoading, setFxLoading] = useState(false);
  const [attachmentPickerTxId, setAttachmentPickerTxId] = useState<string | null>(null);
  const [attachmentPickerItems, setAttachmentPickerItems] = useState<AttachmentItem[]>([]);
  const [attachmentPickerLoading, setAttachmentPickerLoading] = useState(false);
  const [editAttachments, setEditAttachments] = useState<AttachmentItem[]>([]);
  const [editAttachmentsLoading, setEditAttachmentsLoading] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());

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
  useEffect(() => {
    apiGet('/api/transactions/attachments/storage')
      .then((data) => setPhotoStorageStatus(data))
      .catch(() => setPhotoStorageStatus(null));
  }, []);
  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const nextPage = readPageParam(searchParams);
    const nextPageSize = readPageSizeParam(searchParams);
    const nextFilters = readFilters(searchParams);
    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
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
    setFxFeeEdited(false);
    setFormError('');
    setPhotoUploadWarning('');
    setPhotoFiles([]);
    setEditAttachments([]);
    setEditAttachmentsLoading(false);
    setPendingDeleteIds(new Set());
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
    if (tx.isFxFee) {
      setFormError('國外刷卡手續費為自動產生，請編輯對應的國外交易（修改後手續費會自動同步）');
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
      fxFee: Number(tx.fxFee) > 0 ? String(Math.round(Number(tx.fxFee))) : '',
    });
    setEditId(tx.id);
    setFxFeeEdited(Number(tx.fxFee) > 0);
    setFormError('');
    setPhotoUploadWarning('');
    setPhotoFiles([]);
    setEditAttachments([]);
    setPendingDeleteIds(new Set());
    setEditAttachmentsLoading(tx.attachmentCount > 0);
    setModal(true);
    if (tx.attachmentCount > 0) {
      apiGet(`/api/transactions/${tx.id}/attachments`)
        .then((data: any) => setEditAttachments(data.attachments || []))
        .catch(() => {})
        .finally(() => setEditAttachmentsLoading(false));
    }
  }

  async function uploadPhotos(transactionId: string) {
    if (photoFiles.length === 0) return;
    const compressed = await Promise.all(photoFiles.map(compressPhoto));
    const data = new FormData();
    compressed.forEach((file) => data.append('photos', file));
    const res = await fetch(`/api/transactions/${transactionId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: data,
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `照片上傳失敗（HTTP ${res.status}）`);
  }

  async function openAttachmentPicker(txId: string) {
    setAttachmentPickerTxId(txId);
    setAttachmentPickerItems([]);
    setAttachmentPickerLoading(true);
    try {
      const data = await apiGet(`/api/transactions/${txId}/attachments`);
      setAttachmentPickerItems(data.attachments || []);
    } catch (_) {}
    setAttachmentPickerLoading(false);
  }

  function addPhotoFiles(files: FileList | null) {
    const incoming = Array.from(files || []).filter((file) => file.type.startsWith('image/'));
    if (incoming.length === 0) return;
    const keptExisting = editAttachments.filter(a => !pendingDeleteIds.has(a.id)).length;
    setPhotoFiles((current) => {
      const merged = [...current];
      incoming.forEach((file) => {
        const exists = merged.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified);
        if (!exists) merged.push(file);
      });
      return merged.slice(0, 5 - keptExisting);
    });
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
      // 外幣信用卡：手續費欄位有值才送（手動覆寫）；留空交由伺服器依卡片費率自動計算。
      ...(overseasApplies && form.fxFee !== '' ? { fxFee: Math.max(0, Number(form.fxFee) || 0) } : {}),
    };
    try {
      let saved: any = null;
      if (editId) {
        saved = await apiPut(`/api/transactions/${editId}`, body);
        for (const id of pendingDeleteIds) {
          await apiDelete(`/api/transactions/${editId}/attachments/${id}`).catch(() => {});
        }
        if (photoFiles.length > 0) {
          try {
            await uploadPhotos(editId);
          } catch (uploadError: any) {
            const message = uploadError.message || '照片上傳失敗';
            setPhotoUploadWarning(message);
            setFormError(`交易已更新，但${message}`);
          }
        }
      } else {
        saved = await apiPost('/api/transactions', body);
        try {
          await uploadPhotos(saved.id);
        } catch (uploadError: any) {
          const message = uploadError.message || '照片上傳失敗';
          setPhotoUploadWarning(message);
          setFormError(`交易已建立，但${message}`);
        }
      }
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

  // 國外刷卡手續費：所選帳戶為信用卡且有海外手續費率、且為外幣交易時適用。
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

  // 未手動編輯時，依當前金額/匯率自動帶入手續費；不適用時清空，交由系統處理。
  useEffect(() => {
    if (!modal) return;
    if (!overseasApplies) {
      setForm((current) => current.fxFee === '' ? current : { ...current, fxFee: '' });
      return;
    }
    if (fxFeeEdited) return;
    const next = autoFxFee > 0 ? String(autoFxFee) : '';
    setForm((current) => current.fxFee === next ? current : { ...current, fxFee: next });
  }, [modal, overseasApplies, autoFxFee, fxFeeEdited]);

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
        <label className="ml-auto flex items-center gap-2 text-sm text-slate-500">
          每頁
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} 筆</option>)}
          </select>
        </label>
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
                      {tx.isFxFee && <div className="text-xs text-amber-600">國外刷卡手續費</div>}
                      {tx.sourceRecurringName && <div className="text-xs text-slate-500">來源：{tx.sourceRecurringName}</div>}
                      {tx.excludeFromStats && <div className="text-xs text-slate-500">不計入統計</div>}
                      {tx.attachmentCount > 0 && tx.firstAttachmentId && (
                        tx.attachmentCount === 1 ? (
                          <a
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                            href={`/api/transactions/${tx.id}/attachments/${tx.firstAttachmentId}/file`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i className="fas fa-image" />
                            照片 1
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                            onClick={() => openAttachmentPicker(tx.id)}
                          >
                            <i className="fas fa-images" />
                            照片 {tx.attachmentCount}
                          </button>
                        )
                      )}
                    </td>
                    <td className={tx.type === 'income' || tx.type === 'transfer_in' ? 'amount-income' : 'amount-expense'}>
                      {tx.type === 'income' || tx.type === 'transfer_in' ? '+' : '-'}{fmt(tx.amount)}
                      {tx.currency && tx.currency !== 'TWD' && (
                        <div className="text-xs text-slate-500">{tx.currency} {Math.abs(Number(tx.originalAmount || tx.amount)).toLocaleString('zh-TW')}</div>
                      )}
                    </td>
                    <td>
                      {!isTransfer && !tx.isFxFee && <button className="btn-icon" title="編輯" onClick={() => openEdit(tx)}><i className="fas fa-pencil" /></button>}
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
              <input type="number" required min="0.01" step="any" placeholder="0" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
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
            {overseasApplies && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">海外手續費（TWD）</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min="0" step="1" placeholder="留空則由系統依卡片費率自動計算"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                    value={form.fxFee}
                    onChange={(e) => { setFxFeeEdited(true); setForm((current) => ({ ...current, fxFee: e.target.value })); }}
                  />
                  <button
                    type="button"
                    className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                    onClick={() => { setFxFeeEdited(false); setForm((current) => ({ ...current, fxFee: autoFxFee > 0 ? String(autoFxFee) : '' })); }}
                  >
                    自動計算
                  </button>
                </div>
                <p className="text-xs text-slate-500">卡片海外手續費率 {overseasFeeRate}%{autoFxFee > 0 ? `，建議值 NT$ ${autoFxFee.toLocaleString('zh-TW')}` : ''}</p>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">備註</label>
              <input type="text" maxLength={200} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.excludeFromStats} onChange={(e) => setForm((current) => ({ ...current, excludeFromStats: e.target.checked }))} /> 不計入統計
            </label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">照片</label>
                {editId && editAttachmentsLoading && (
                  <p className="text-xs text-slate-500">載入照片中...</p>
                )}
                {editId && !editAttachmentsLoading && editAttachments.filter(a => !pendingDeleteIds.has(a.id)).length > 0 && (
                  <ul className="space-y-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                    {editAttachments.filter(a => !pendingDeleteIds.has(a.id)).map(a => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sky-600 hover:text-sky-700">{a.filename || '照片'}</a>
                        <button
                          type="button"
                          className="shrink-0 font-medium text-slate-500 hover:text-red-600"
                          onClick={() => setPendingDeleteIds(prev => new Set([...prev, a.id]))}
                        >
                          刪除
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {editAttachments.filter(a => !pendingDeleteIds.has(a.id)).length + photoFiles.length < 5 && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                      <i className="fas fa-camera" />
                      拍照
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => {
                          addPhotoFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                      <i className="fas fa-image" />
                      選擇圖片
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          addPhotoFiles(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>
                )}
                <p className="text-xs text-slate-500">手機可直接拍照或從相簿選圖。最多 5 張，每張上限 {Math.round((photoStorageStatus?.maxBytes || 10 * 1024 * 1024) / 1024 / 1024)} MB。</p>
              </div>
              {photoFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-600">新增照片 {photoFiles.length}</p>
                      <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => setPhotoFiles([])}>清除</button>
                    </div>
                    <ul className="space-y-1">
                      {photoFiles.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                          <span className="min-w-0 truncate">{file.name || `照片 ${index + 1}`}</span>
                          <button
                            type="button"
                            className="shrink-0 font-medium text-slate-500 hover:text-red-600"
                            onClick={() => setPhotoFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            移除
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            {photoUploadWarning && <p className="text-sm text-amber-600">{photoUploadWarning}</p>}
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
              <input type="number" required min="0.01" step="any" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.amount} onChange={(e) => setTransferForm((current) => ({ ...current, amount: e.target.value }))} />
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

      <Dialog open={!!attachmentPickerTxId} onOpenChange={(open) => { if (!open) setAttachmentPickerTxId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>選擇照片</DialogTitle>
          </DialogHeader>
          {attachmentPickerLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">載入中...</p>
          ) : (
            <ul className="space-y-2">
              {attachmentPickerItems.map((item, index) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-md border border-slate-200 p-2 text-sm hover:bg-slate-50"
                    onClick={() => setAttachmentPickerTxId(null)}
                  >
                    <img
                      src={item.url}
                      alt={item.filename || `照片 ${index + 1}`}
                      className="h-12 w-12 flex-none rounded object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{item.filename || `照片 ${index + 1}`}</span>
                    <i className="fas fa-external-link-alt flex-none text-xs text-slate-400" />
                  </a>
                </li>
              ))}
            </ul>
          )}
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
