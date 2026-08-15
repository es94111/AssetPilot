'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPost, apiPut, apiDelete, notifyDataChanged } from '../../../lib/clientApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import { ArrowLeftRight, CalendarDays, Image, Images, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Tags, Trash2, Undo2 } from 'lucide-react';
import { TRANSACTION_NOTE_MAX_LENGTH } from '@/lib/transactionEditRules';

const EMPTY_FORM = { date: '', type: 'expense', amount: '', categoryId: '', accountId: '', note: '', excludeFromStats: false, currency: 'TWD', fxRate: '', fxFee: '' };
const EMPTY_TRANSFER_FORM = { date: '', amount: '', fromAccountId: '', toAccountId: '', note: '' };
const EMPTY_FILTERS = { type: '', accountId: '', categoryId: '', dateFrom: '', dateTo: '', keyword: '', excludeTransfer: '' };
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

// Client-side compression: cap the longest edge at 1600px with JPEG quality 0.8
// to reduce upload bandwidth and storage usage. Browser Canvas only; no new deps.
const PHOTO_MAX_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 0.8;

async function compressPhoto(file: File): Promise<File> {
  // Keep non-reencodable images and unsupported browsers on the original file.
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
    if (!blob || blob.size >= file.size) return file; // Use the original if compression did not help.
    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified });
  } catch {
    return file; // Fall back to the original so upload is never blocked by compression.
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
  // Excluding transfers wins over a transfer type filter so the pair can never
  // contradict each other, even from a hand-written URL.
  const excludeTransfer = searchParams.get('excludeTransfer') === '1' ? '1' : '';
  const type = searchParams.get('type') || '';
  return {
    type: excludeTransfer && type === 'transfer' ? '' : type,
    accountId: searchParams.get('accountId') || '',
    categoryId: searchParams.get('categoryId') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    keyword: searchParams.get('keyword') || '',
    excludeTransfer,
  };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n: number | string, locale: string) {
  return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString(localeTag(locale));
}

function labelForType(type: string, t: (path: string) => string) {
  if (type === 'income') return t('features.transactions.typeLabels.income');
  if (type === 'expense') return t('features.transactions.typeLabels.expense');
  if (type === 'transfer_in') return t('features.transactions.typeLabels.transfer_in');
  if (type === 'transfer_out') return t('features.transactions.typeLabels.transfer_out');
  return type;
}

export default function TransactionsClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => readPageParam(searchParams));
  const [pageSize, setPageSize] = useState(() => readPageSizeParam(searchParams));
  const [loading, setLoading] = useState(true);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [quickCreateHandled, setQuickCreateHandled] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currencyOptions, setCurrencyOptions] = useState<string[]>(DEFAULT_CURRENCIES);
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [filters, setFilters] = useState(() => readFilters(searchParams));
  const [searchDraft, setSearchDraft] = useState(() => searchParams.get('keyword') || '');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modal, setModal] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const [restoreCreatedId, setRestoreCreatedId] = useState<string | null>(null);
  const [restoreNoteId, setRestoreNoteId] = useState<string | null>(null);
  const [restoreNotePreview, setRestoreNotePreview] = useState<{ restorable: boolean; preAiNote: string | null; currentNote: string; updatedAt: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fxLoading, setFxLoading] = useState(false);
  const [attachmentPickerTxId, setAttachmentPickerTxId] = useState<string | null>(null);
  const [attachmentPickerItems, setAttachmentPickerItems] = useState<AttachmentItem[]>([]);
  const [attachmentPickerLoading, setAttachmentPickerLoading] = useState(false);
  const [editAttachments, setEditAttachments] = useState<AttachmentItem[]>([]);
  const [editAttachmentsLoading, setEditAttachmentsLoading] = useState(false);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const latestLoadId = useRef(0);

  const load = useCallback(async (p = page) => {
    const loadId = ++latestLoadId.current;
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
        ...(filters.excludeTransfer ? { excludeTransfer: '1' } : {}),
      });
      const data = await apiGet(`/api/transactions?${params}`);
      if (loadId === latestLoadId.current) {
        setTxs(data.items || data.data || []);
        setTotal(data.total || 0);
      }
    } catch (_) {}
    if (loadId === latestLoadId.current) setLoading(false);
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
    setMetaLoaded(true);
  }, []);

  const updateFilters = useCallback((patch: Partial<typeof EMPTY_FILTERS>) => {
    setPage(1);
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  // "Exclude transfers" and the transfer type filter contradict each other, so
  // turning the toggle on falls back to all types.
  const toggleExcludeTransfer = useCallback((checked: boolean) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      excludeTransfer: checked ? '1' : '',
      type: checked && current.type === 'transfer' ? '' : current.type,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setFilters(EMPTY_FILTERS);
    setSearchDraft('');
  }, []);

  useEffect(() => {
    if (searchDraft === filters.keyword) return;
    const timer = window.setTimeout(() => updateFilters({ keyword: searchDraft }), 300);
    return () => window.clearTimeout(timer);
  }, [filters.keyword, searchDraft, updateFilters]);

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
    if (nextFilters.keyword !== filters.keyword && searchDraft === filters.keyword) setSearchDraft(nextFilters.keyword);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(pageSize));
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const requestedAction = searchParams.get('action');
    if (requestedAction) params.set('action', requestedAction);
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
    setAdvancedOpen(false);
    setModal(true);
  }

  useEffect(() => {
    if (!metaLoaded || quickCreateHandled || searchParams.get('action') !== 'add') return;
    setQuickCreateHandled(true);
    openAdd();
    const params = new URLSearchParams(searchParams);
    params.delete('action');
    router.replace(params.size ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  }, [currentQuery, metaLoaded, pathname, quickCreateHandled, router, searchParams]);

  const fetchFxRate = useCallback(async (currency: string) => {
    const normalizedCurrency = String(currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency) || normalizedCurrency === 'TWD') {
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
      setFormError(t('features.transactions.messages.editTransferBlocked'));
      return;
    }
    if (tx.isFxFee) {
      setFormError(t('features.transactions.messages.editFxFeeBlocked'));
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
    setAdvancedOpen(true);
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
    if (!res.ok) throw new Error(payload.error || `${t('features.transactions.messages.photoUploadFailed')} (HTTP ${res.status})`);
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
    if (!form.date) { setAdvancedOpen(true); setFormError(t('features.transactions.messages.dateRequired')); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError(t('features.transactions.messages.amountRequired')); return; }
    if (!/^[A-Z]{3}$/.test(form.currency)) { setAdvancedOpen(true); setFormError(t('features.accounts.messages.currencyInvalid')); return; }
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
      // Foreign-currency credit cards: only send a manually overridden fee.
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
            const message = uploadError.message || t('features.transactions.messages.photoUploadFailed');
            setPhotoUploadWarning(message);
            setFormError(t('features.transactions.updatedWithWarning', { message }));
          }
        }
      } else {
        saved = await apiPost('/api/transactions', body);
        try {
          await uploadPhotos(saved.id);
        } catch (uploadError: any) {
          const message = uploadError.message || t('features.transactions.messages.photoUploadFailed');
          setPhotoUploadWarning(message);
          setFormError(t('features.transactions.createdWithWarning', { message }));
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
      setFormError(t('features.transactions.messages.transferAccountsRequired'));
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setFormError(t('features.transactions.messages.transferSameAccount'));
      return;
    }
    if (!transferForm.amount || Number(transferForm.amount) <= 0) {
      setFormError(t('features.transactions.messages.amountRequired'));
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

  async function handleRestoreCreated() {
    if (!restoreCreatedId) return;
    try {
      await apiPost(`/api/transactions/${restoreCreatedId}/restore-ai-created`);
      setRestoreCreatedId(null);
      await load(page);
      notifyDataChanged('transactions');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function openRestoreNote(tx: any) {
    setRestoreNoteId(tx.id);
    try {
      const preview = await apiGet(`/api/transactions/${tx.id}/restore-ai-note`);
      setRestoreNotePreview(preview);
    } catch (e: any) {
      alert(e.message);
      setRestoreNoteId(null);
    }
  }

  async function handleRestoreNote() {
    if (!restoreNoteId) return;
    try {
      await apiPost(`/api/transactions/${restoreNoteId}/restore-ai-note`, { expectedUpdatedAt: restoreNotePreview?.updatedAt });
      setRestoreNoteId(null);
      setRestoreNotePreview(null);
      await load(page);
      notifyDataChanged('transactions');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleBatchDelete() {
    if (selected.size === 0) return;
    if (!confirm(t('features.transactions.batchDeleteConfirm', { count: selected.size }))) return;
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
  const pageTotals = txs.reduce(
    (acc, tx) => {
      const amount = Math.abs(Number(tx.amount) || 0);
      if (tx.type === 'income') acc.income += amount;
      if (tx.type === 'expense') acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const pageNet = pageTotals.income - pageTotals.expense;

  const getCatName = (tx: any) => {
    const cat = categories.find((c: any) => c.id === (tx.category_id || tx.categoryId));
    if (!cat) return tx.cat_name || t('features.common.notRecorded');
    const parent = cat.parentId ? categories.find((c: any) => c.id === cat.parentId) : null;
    return parent ? `${parent.name} › ${cat.name}` : cat.name;
  };

  const getAcctName = (tx: any) => {
    const account = accounts.find((item: any) => item.id === (tx.account_id || tx.accountId));
    return account ? account.name : (tx.account_name || t('features.common.notRecorded'));
  };

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

  // Auto-fill the fee until the user edits it manually; clear it when not applicable.
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

  const activeFilterCount = Object.entries(filters)
    .filter(([key, value]) => key !== 'keyword' && Boolean(value)).length;
  const filterControlClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
  const renderFilterFields = (scope: string) => (
    <>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500" htmlFor={`${scope}-type`}>
        {t('features.common.type')}
        <select id={`${scope}-type`} className={filterControlClass} value={filters.type} onChange={(e) => updateFilters({ type: e.target.value })}>
          <option value="">{t('features.transactions.allTypes')}</option>
          <option value="income">{t('features.common.income')}</option>
          <option value="expense">{t('features.common.expense')}</option>
          <option value="transfer" disabled={filters.excludeTransfer === '1'}>{t('features.transactions.transfer')}</option>
          <option value="future">{t('features.transactions.future')}</option>
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500" htmlFor={`${scope}-account`}>
        {t('features.common.account')}
        <select id={`${scope}-account`} className={filterControlClass} value={filters.accountId} onChange={(e) => updateFilters({ accountId: e.target.value })}>
          <option value="">{t('features.transactions.allAccounts')}</option>
          {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500" htmlFor={`${scope}-category`}>
        {t('features.recurring.category')}
        <select id={`${scope}-category`} className={filterControlClass} value={filters.categoryId} onChange={(e) => updateFilters({ categoryId: e.target.value })}>
          <option value="">{t('features.transactions.allCategories')}</option>
          <option value="__uncategorized__">{t('features.common.uncategorized')}</option>
          {allStandalone.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          {allParents.map((parent: any) => (
            <optgroup key={parent.id} label={parent.name}>
              <option value={parent.id}>{t('features.transactions.parentAll', { name: parent.name })}</option>
              {allChildren.filter((c: any) => c.parentId === parent.id).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500" htmlFor={`${scope}-date-from`}>
        {t('features.transactions.startDateTitle')}
        <input id={`${scope}-date-from`} type="date" className={filterControlClass} value={filters.dateFrom} onChange={(e) => updateFilters({ dateFrom: e.target.value })} />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-slate-500" htmlFor={`${scope}-date-to`}>
        {t('features.transactions.endDateTitle')}
        <input id={`${scope}-date-to`} type="date" className={filterControlClass} value={filters.dateTo} onChange={(e) => updateFilters({ dateTo: e.target.value })} />
      </label>
      <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300" htmlFor={`${scope}-exclude-transfer`}>
        <input
          id={`${scope}-exclude-transfer`}
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
          checked={filters.excludeTransfer === '1'}
          onChange={(e) => toggleExcludeTransfer(e.target.checked)}
        />
        {t('features.transactions.excludeTransfer')}
      </label>
    </>
  );

  return (
    <div className="page active space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="page-title">{t('features.transactions.title')}</h2>
        {formError && <div className="text-sm text-red-500">{formError}</div>}
      </div>

      <div className="flex items-center gap-2">
        <label className="relative min-w-0 flex-1" htmlFor="transaction-search">
          <span className="sr-only">{t('features.transactions.searchPlaceholder')}</span>
          <Search size={18} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input id="transaction-search" type="search" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pe-3 ps-10 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" placeholder={t('features.transactions.searchPlaceholder')} value={searchDraft} onChange={(e) => setSearchDraft(e.target.value)} />
        </label>
        <Button type="button" variant="outline" className="min-h-11 gap-2 md:hidden" aria-expanded={filtersOpen} aria-controls="mobile-transaction-filters" onClick={() => setFiltersOpen((current) => !current)}>
          <SlidersHorizontal size={18} aria-hidden="true" />
          {t('mobileLegacy.filter')}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </Button>
        <Button type="button" className="hidden min-h-11 gap-2 md:inline-flex" onClick={openAdd}>
          <Plus size={18} aria-hidden="true" /> {t('features.transactions.add')}
        </Button>
      </div>

      <div id="mobile-transaction-filters" className={`${filtersOpen ? 'grid' : 'hidden'} gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60 md:hidden`}>
        {renderFilterFields('mobile-filter')}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={clearFilters}>{t('common.clear')}</Button>
          <Button type="button" className="min-h-11 flex-1" onClick={() => setFiltersOpen(false)}>{t('common.close')}</Button>
        </div>
      </div>

      <div className="hidden gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900/60 md:grid md:grid-cols-2 md:items-end lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto_auto]">
        {renderFilterFields('desktop-filter')}
        <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={clearFilters}>{t('common.clear')}</Button>
      </div>

      <div className="tx-actions flex flex-wrap gap-2 items-center">
        <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={openTransfer}><ArrowLeftRight size={17} aria-hidden="true" /> {t('features.transactions.accountTransfer')}</Button>
        {selected.size > 0 && (
          <>
            <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => setBatchModal('category')}><Tags size={17} aria-hidden="true" /> {t('features.transactions.batchCategory')}</Button>
            <Button type="button" variant="outline" className="min-h-11 gap-2" onClick={() => setBatchModal('date')}><CalendarDays size={17} aria-hidden="true" /> {t('features.transactions.batchDate')}</Button>
            <Button type="button" variant="destructive" className="min-h-11 gap-2" onClick={handleBatchDelete}><Trash2 size={17} aria-hidden="true" /> {t('features.transactions.deleteSelected', { count: selected.size })}</Button>
          </>
        )}
        <span className="tx-count" aria-live="polite">{t('common.totalRecords', { count: total })}</span>
        <label className="ms-auto flex items-center gap-2 text-sm text-slate-500">
          {t('common.perPage')}
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="min-h-11 rounded-xl border border-slate-300 bg-white px-2 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{t('common.recordsUnit', { count: size })}</option>)}
          </select>
        </label>
      </div>

      <div className="tx-page-summary" aria-label={t('features.transactions.pageSummaryAria')}>
        <div className="tx-page-summary-item tx-page-summary-income">
          <span className="tx-page-summary-label">{t('features.transactions.pageIncome')}</span>
          <strong className="tx-page-summary-value amount-income">{fmt(pageTotals.income, locale)}</strong>
        </div>
        <div className="tx-page-summary-item tx-page-summary-expense">
          <span className="tx-page-summary-label">{t('features.transactions.pageExpense')}</span>
          <strong className="tx-page-summary-value amount-expense">{fmt(pageTotals.expense, locale)}</strong>
        </div>
        <div className="tx-page-summary-item tx-page-summary-net">
          <span className="tx-page-summary-label">{t('features.transactions.pageTotal')}</span>
          <strong className={`tx-page-summary-value ${pageNet >= 0 ? 'amount-income' : 'amount-expense'}`}>
            {pageNet >= 0 ? '+' : '-'}{fmt(Math.abs(pageNet), locale)}
          </strong>
        </div>
      </div>

      {loading && <p className="empty-hint" role="status">{t('common.loading')}</p>}
      {!loading && txs.length === 0 && <p className="empty-hint">{t('features.transactions.empty')}</p>}

      {!loading && txs.length > 0 && (
        <>
        <ul className="space-y-3 md:hidden" aria-busy={loading}>
          {txs.map((tx) => {
            const isTransfer = tx.type === 'transfer_in' || tx.type === 'transfer_out';
            const isFuture = tx.date > today();
            const isIncome = tx.type === 'income' || tx.type === 'transfer_in';
            const transactionLabel = `${labelForType(tx.type, t)} · ${isTransfer ? t('features.common.notRecorded') : getCatName(tx)} · ${tx.date} · ${fmt(tx.amount, locale)}`;
            return (
              <li key={tx.id} className={`rounded-2xl border p-4 shadow-sm ${selected.has(tx.id) ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'}`}>
                <div className="flex items-start gap-3">
                  <label className="-m-2 flex h-11 w-11 shrink-0 cursor-pointer items-start justify-center p-2" aria-label={`${t('features.common.actions')}: ${transactionLabel}`}>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-primary"
                      checked={selected.has(tx.id)}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(tx.id); else next.delete(tx.id);
                        setSelected(next);
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className={`badge badge-${tx.type}`}>{labelForType(tx.type, t)}</span>
                        <h3 className="mt-2 truncate text-base font-semibold text-slate-900 dark:text-slate-100">
                          {isTransfer ? t('features.common.notRecorded') : getCatName(tx)}
                        </h3>
                      </div>
                      <div className={`max-w-[54%] shrink-0 break-words text-end text-sm font-bold tabular-nums ${isIncome ? 'amount-income' : 'amount-expense'}`}>
                        {isIncome ? '+' : '−'}{fmt(tx.amount, locale)}
                        {tx.currency && tx.currency !== 'TWD' && (
                          <div className="mt-1 text-xs font-normal text-slate-500">{tx.currency} {Math.abs(Number(tx.originalAmount || tx.amount)).toLocaleString(localeTag(locale))}</div>
                        )}
                      </div>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs text-slate-500">
                      <div><dt className="sr-only">{t('features.common.date')}</dt><dd>{tx.date}{isFuture ? ` · ${t('features.transactions.future')}` : ''}</dd></div>
                      <div className="text-right"><dt className="sr-only">{t('features.common.account')}</dt><dd className="truncate">{getAcctName(tx)}{tx.toAccountId ? ` → ${accounts.find((account: any) => account.id === tx.toAccountId)?.name || t('features.common.notRecorded')}` : ''}</dd></div>
                    </dl>
                    {(tx.note || tx.isFxFee || tx.sourceRecurringName || tx.excludeFromStats || tx.aiCreated || tx.noteAiModified) && (
                      <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                        {tx.note && <p className="break-words text-slate-700 dark:text-slate-300">{tx.note}</p>}
                        {tx.isFxFee && <p className="text-amber-600">{t('features.transactions.fxFee')}</p>}
                        {tx.aiCreated && <p className="text-emerald-600">{t('features.transactions.aiCreated')}</p>}
                        {tx.noteAiModified && <p className="text-sky-600">{t('features.transactions.noteAiModified')}</p>}
                        {tx.sourceRecurringName && <p>{t('features.transactions.source', { name: tx.sourceRecurringName })}</p>}
                        {tx.excludeFromStats && <p>{t('features.common.excludeFromStats')}</p>}
                      </div>
                    )}
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                      <div className="min-w-0 flex-1">
                        {tx.attachmentCount > 0 && tx.firstAttachmentId && (
                          tx.attachmentCount === 1 ? (
                            <a className="inline-flex min-h-11 items-center gap-2 px-2 text-xs font-medium text-sky-600" href={`/api/transactions/${tx.id}/attachments/${tx.firstAttachmentId}/file`} target="_blank" rel="noreferrer">
                              <Image size={17} aria-hidden="true" /> {t('features.transactions.photoOne')}
                            </a>
                          ) : (
                            <button type="button" className="inline-flex min-h-11 items-center gap-2 px-2 text-xs font-medium text-sky-600" onClick={() => openAttachmentPicker(tx.id)}>
                              <Images size={17} aria-hidden="true" /> {t('features.transactions.photoCount', { count: tx.attachmentCount })}
                            </button>
                          )
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {!isTransfer && !tx.isFxFee && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`${t('common.edit')}: ${transactionLabel}`} onClick={() => openEdit(tx)}><Pencil size={18} aria-hidden="true" /></Button>
                        )}
                        {tx.aiCreated && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`${t('features.transactions.restoreCreated')}: ${transactionLabel}`} title={t('features.transactions.restoreCreated')} onClick={() => setRestoreCreatedId(tx.id)}><Undo2 size={18} aria-hidden="true" /></Button>
                        )}
                        {tx.noteAiModified && (
                          <Button type="button" variant="ghost" size="icon" aria-label={`${t('features.transactions.restoreNote')}: ${transactionLabel}`} title={t('features.transactions.restoreNote')} onClick={() => openRestoreNote(tx)}><RotateCcw size={18} aria-hidden="true" /></Button>
                        )}
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" aria-label={`${t('common.delete')}: ${transactionLabel}`} onClick={() => setDeleteId(tx.id)}><Trash2 size={18} aria-hidden="true" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th><input type="checkbox" aria-label={t('features.transactions.title')} onChange={(e) => setSelected(e.target.checked ? new Set(txs.map((tx) => tx.id)) : new Set())} checked={selected.size === txs.length && txs.length > 0} /></th>
                <th>{t('features.common.date')}</th>
                <th>{t('features.common.type')}</th>
                <th>{t('features.recurring.category')}</th>
                <th>{t('features.common.account')}</th>
                <th>{t('features.common.note')}</th>
                <th>{t('features.common.amount')}</th>
                <th>{t('features.common.actions')}</th>
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
                          aria-label={`${t('features.common.actions')}: ${labelForType(tx.type, t)} · ${getCatName(tx)} · ${tx.date}`}
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
                      {isFuture && <div className="text-xs text-amber-600">{t('features.transactions.future')}</div>}
                    </td>
                    <td><span className={`badge badge-${tx.type}`}>{labelForType(tx.type, t)}</span></td>
                    <td>{isTransfer ? t('features.common.notRecorded') : getCatName(tx)}</td>
                    <td>{getAcctName(tx)}{tx.toAccountId ? ` -> ${accounts.find((account: any) => account.id === tx.toAccountId)?.name || t('features.common.notRecorded')}` : ''}</td>
                    <td>
                      <div>{tx.note || t('features.common.notRecorded')}</div>
                      {tx.isFxFee && <div className="text-xs text-amber-600">{t('features.transactions.fxFee')}</div>}
                      {tx.aiCreated && <div className="text-xs text-emerald-600">{t('features.transactions.aiCreated')}</div>}
                      {tx.noteAiModified && <div className="text-xs text-sky-600">{t('features.transactions.noteAiModified')}</div>}
                      {tx.sourceRecurringName && <div className="text-xs text-slate-500">{t('features.transactions.source', { name: tx.sourceRecurringName })}</div>}
                      {tx.excludeFromStats && <div className="text-xs text-slate-500">{t('features.common.excludeFromStats')}</div>}
                      {tx.attachmentCount > 0 && tx.firstAttachmentId && (
                        tx.attachmentCount === 1 ? (
                          <a
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                            href={`/api/transactions/${tx.id}/attachments/${tx.firstAttachmentId}/file`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i className="fas fa-image" />
                            {t('features.transactions.photoOne')}
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
                            onClick={() => openAttachmentPicker(tx.id)}
                          >
                            <i className="fas fa-images" />
                            {t('features.transactions.photoCount', { count: tx.attachmentCount })}
                          </button>
                        )
                      )}
                    </td>
                    <td className={tx.type === 'income' || tx.type === 'transfer_in' ? 'amount-income' : 'amount-expense'}>
                      {tx.type === 'income' || tx.type === 'transfer_in' ? '+' : '-'}{fmt(tx.amount, locale)}
                      {tx.currency && tx.currency !== 'TWD' && (
                        <div className="text-xs text-slate-500">{tx.currency} {Math.abs(Number(tx.originalAmount || tx.amount)).toLocaleString(localeTag(locale))}</div>
                      )}
                    </td>
                    <td>
                      {!isTransfer && !tx.isFxFee && <button className="btn-icon" title={t('common.edit')} aria-label={`${t('common.edit')}: ${getCatName(tx)} · ${tx.date}`} onClick={() => openEdit(tx)}><i className="fas fa-pencil" /></button>}
                      {tx.aiCreated && <button className="btn-icon" title={t('features.transactions.restoreCreated')} aria-label={`${t('features.transactions.restoreCreated')}: ${getCatName(tx)} · ${tx.date}`} onClick={() => setRestoreCreatedId(tx.id)}><i className="fas fa-rotate-left" /></button>}
                      {tx.noteAiModified && <button className="btn-icon" title={t('features.transactions.restoreNote')} aria-label={`${t('features.transactions.restoreNote')}: ${getCatName(tx)} · ${tx.date}`} onClick={() => openRestoreNote(tx)}><i className="fas fa-undo" /></button>}
                      <button className="btn-icon danger" title={t('common.delete')} aria-label={`${t('common.delete')}: ${getCatName(tx)} · ${tx.date}`} onClick={() => setDeleteId(tx.id)}><i className="fas fa-trash" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>‹ {t('common.previousPage')}</Button>
          <span className="page-info">{page} / {totalPages}</span>
          <Button type="button" variant="outline" className="min-h-11" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>{t('common.nextPage')} ›</Button>
        </div>
      )}

      {selected.size === 0 && (
        <Button type="button" className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] end-4 z-30 min-h-12 rounded-full px-5 shadow-lg md:hidden" onClick={openAdd}>
          <Plus size={19} aria-hidden="true" /> {t('features.transactions.add')}
        </Button>
      )}
      {selected.size > 0 && (
        <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] inset-x-3 z-30 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-xl backdrop-blur md:hidden dark:border-slate-700 dark:bg-slate-900/95">
          <Button type="button" variant="outline" className="min-h-11 gap-2" aria-label={t('features.transactions.batchCategory')} onClick={() => setBatchModal('category')}><Tags size={18} aria-hidden="true" /><span className="sr-only">{t('features.transactions.batchCategory')}</span></Button>
          <Button type="button" variant="outline" className="min-h-11 gap-2" aria-label={t('features.transactions.batchDate')} onClick={() => setBatchModal('date')}><CalendarDays size={18} aria-hidden="true" /><span className="sr-only">{t('features.transactions.batchDate')}</span></Button>
          <Button type="button" variant="destructive" className="min-h-11 gap-2" aria-label={t('features.transactions.deleteSelected', { count: selected.size })} onClick={handleBatchDelete}><Trash2 size={18} aria-hidden="true" /><span className="text-xs tabular-nums">{selected.size}</span></Button>
        </div>
      )}

      <Dialog open={modal} onOpenChange={setModal}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t('features.transactions.edit') : t('features.transactions.create')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.common.type')}</span>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label={t('features.common.type')}>
                {(['expense', 'income'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={form.type === type}
                    className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${form.type === type ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'}`}
                    onClick={() => setForm((current) => ({ ...current, type, categoryId: '' }))}
                  >
                    {type === 'income' ? t('features.common.income') : t('features.common.expense')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="transaction-amount" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.transactions.amountRequiredLabel')}</label>
              <input id="transaction-amount" type="number" required min="0.01" step="any" inputMode="decimal" autoFocus={!editId} placeholder="0" className="min-h-12 w-full rounded-xl border border-gray-300 px-3 text-lg font-semibold shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.amount} onChange={(e) => setForm((current) => ({ ...current, amount: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="transaction-category" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.recurring.category')}</label>
              <select id="transaction-category" className="min-h-11 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.categoryId} onChange={(e) => setForm((current) => ({ ...current, categoryId: e.target.value }))}>
                <option value="">{t('features.common.uncategorized')}</option>
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
              <label htmlFor="transaction-account" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.common.account')}</label>
              <select id="transaction-account" className="min-h-11 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.accountId} onChange={(e) => {
                const acct = accounts.find((a: any) => a.id === e.target.value);
                const nextCurrency = String(acct?.currency || 'TWD').toUpperCase();
                setForm((current) => ({ ...current, accountId: e.target.value, currency: nextCurrency, fxRate: '' }));
              }}>
                <option value="">{t('features.common.unspecified')}</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}{account.currency && account.currency !== 'TWD' ? ` (${account.currency})` : ''}</option>)}
              </select>
            </div>
            <details className="rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
              <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-semibold text-slate-700 dark:text-slate-200"><span>{t('mobileLegacy.more')}</span><span className="text-xs font-normal text-slate-500">{form.date}</span></summary>
              <div className="space-y-3 border-t border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-col gap-1">
              <label htmlFor="transaction-date" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.transactions.dateRequiredLabel')}</label>
              <input id="transaction-date" type="date" required className="min-h-11 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.date} onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="transaction-currency" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.common.currency')}</label>
              <input
                id="transaction-currency"
                type="text"
                list="transaction-currency-options"
                maxLength={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                value={form.currency}
                onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase(), fxRate: '' }))}
              />
              <datalist id="transaction-currency-options">
                {currencyOptions.map((currency) => <option key={currency} value={currency} />)}
              </datalist>
            </div>
            {form.currency && form.currency !== 'TWD' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="transaction-fx-rate" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.transactions.fxRateLabel', { currency: form.currency })}</label>
                <input id="transaction-fx-rate" type="number" min="0.0001" step="any" placeholder={t('features.transactions.fxRatePlaceholder')} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.fxRate} onChange={(e) => setForm((current) => ({ ...current, fxRate: e.target.value }))} />
                {fxLoading && <p className="text-xs text-slate-500">{t('features.transactions.latestRateLoading')}</p>}
              </div>
            )}
            {overseasApplies && (
              <div className="flex flex-col gap-1">
                <label htmlFor="transaction-fx-fee" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.recurring.fxFeeLabel')}</label>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input
                    id="transaction-fx-fee" type="number" min="0" step="1" placeholder={t('features.transactions.fxFeePlaceholder')}
                    className="min-h-11 min-w-0 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900"
                    value={form.fxFee}
                    onChange={(e) => { setFxFeeEdited(true); setForm((current) => ({ ...current, fxFee: e.target.value })); }}
                  />
                  <button
                    type="button"
                    className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                    onClick={() => { setFxFeeEdited(false); setForm((current) => ({ ...current, fxFee: autoFxFee > 0 ? String(autoFxFee) : '' })); }}
                  >
                    {t('features.common.autoCalculate')}
                  </button>
                </div>
                <p className="text-xs text-slate-500">{t('features.transactions.fxFeeHint', {
                  rate: overseasFeeRate,
                  suggestion: autoFxFee > 0 ? t('features.transactions.fxFeeSuggestion', { amount: autoFxFee.toLocaleString(localeTag(locale)) }) : '',
                })}</p>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label htmlFor="transaction-note" className="text-sm font-medium text-gray-700 dark:text-slate-200">{t('features.common.note')}</label>
              <input id="transaction-note" type="text" maxLength={TRANSACTION_NOTE_MAX_LENGTH} className="min-h-11 w-full rounded-xl border border-gray-300 px-3 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900" value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={form.excludeFromStats} onChange={(e) => setForm((current) => ({ ...current, excludeFromStats: e.target.checked }))} /> {t('features.common.excludeFromStats')}
            </label>
              </div>
            </details>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">{t('features.transactions.photos')}</label>
                {editId && editAttachmentsLoading && (
                  <p className="text-xs text-slate-500">{t('features.transactions.loadingPhotos')}</p>
                )}
                {editId && !editAttachmentsLoading && editAttachments.filter(a => !pendingDeleteIds.has(a.id)).length > 0 && (
                  <ul className="space-y-1 rounded-md border border-slate-200 bg-white px-3 py-2">
                    {editAttachments.filter(a => !pendingDeleteIds.has(a.id)).map(a => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                        <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 truncate text-sky-600 hover:text-sky-700">{a.filename || t('features.transactions.photos')}</a>
                        <button
                          type="button"
                          className="shrink-0 font-medium text-slate-500 hover:text-red-600"
                          onClick={() => setPendingDeleteIds(prev => new Set([...prev, a.id]))}
                        >
                          {t('common.delete')}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {editAttachments.filter(a => !pendingDeleteIds.has(a.id)).length + photoFiles.length < 5 && (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                      <i className="fas fa-camera" />
                      {t('features.transactions.takePhoto')}
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
                    <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">
                      <i className="fas fa-image" />
                      {t('features.transactions.chooseImage')}
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
                <p className="text-xs text-slate-500">{t('features.transactions.photoHelp', { maxMb: Math.round((photoStorageStatus?.maxBytes || 10 * 1024 * 1024) / 1024 / 1024) })}</p>
              </div>
              {photoFiles.length > 0 && (
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-slate-600">{t('features.transactions.newPhotos', { count: photoFiles.length })}</p>
                      <button type="button" className="text-xs font-medium text-slate-500 hover:text-slate-700" onClick={() => setPhotoFiles([])}>{t('common.clear')}</button>
                    </div>
                    <ul className="space-y-1">
                      {photoFiles.map((file, index) => (
                        <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                          <span className="min-w-0 truncate">{file.name || t('features.transactions.photoCount', { count: index + 1 })}</span>
                          <button
                            type="button"
                            className="shrink-0 font-medium text-slate-500 hover:text-red-600"
                            onClick={() => setPhotoFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                          >
                            {t('features.transactions.remove')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
            {photoUploadWarning && <p className="text-sm text-amber-600">{photoUploadWarning}</p>}
            {formError && <p className="text-sm text-destructive" role="alert" aria-live="assertive">{formError}</p>}
            <DialogFooter className="sticky bottom-0 z-10 -mx-1 flex-row justify-end border-t border-slate-200 bg-white/95 px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? t('common.saving') : t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferModal} onOpenChange={setTransferModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('features.transactions.accountTransfer')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleTransferSave} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('features.transactions.dateRequiredLabel')}</label>
              <input type="date" required className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.date} onChange={(e) => setTransferForm((current) => ({ ...current, date: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('features.transactions.transferOut')}</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.fromAccountId} onChange={(e) => setTransferForm((current) => ({ ...current, fromAccountId: e.target.value }))}>
                <option value="">{t('features.transactions.selectPlaceholder')}</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('features.transactions.transferIn')}</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.toAccountId} onChange={(e) => setTransferForm((current) => ({ ...current, toAccountId: e.target.value }))}>
                <option value="">{t('features.transactions.selectPlaceholder')}</option>
                {accounts.map((account: any) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('features.transactions.amountRequiredLabel')}</label>
              <input type="number" required min="0.01" step="any" className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.amount} onChange={(e) => setTransferForm((current) => ({ ...current, amount: e.target.value }))} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">{t('features.common.note')}</label>
              <input type="text" maxLength={TRANSACTION_NOTE_MAX_LENGTH} className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary" value={transferForm.note} onChange={(e) => setTransferForm((current) => ({ ...current, note: e.target.value }))} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('common.cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={saving}>{saving ? t('features.transactions.creating') : t('features.transactions.confirmTransfer')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!attachmentPickerTxId} onOpenChange={(open) => { if (!open) setAttachmentPickerTxId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('features.transactions.choosePhoto')}</DialogTitle>
          </DialogHeader>
          {attachmentPickerLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">{t('common.loading')}</p>
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
                      alt={item.filename || t('features.transactions.photoCount', { count: index + 1 })}
                      className="h-12 w-12 flex-none rounded object-cover"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-700">{item.filename || t('features.transactions.photoCount', { count: index + 1 })}</span>
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
              <h3>{batchModal === 'category' ? t('features.transactions.batchCategoryTitle') : t('features.transactions.batchDateTitle')}</h3>
              <button className="btn-icon" onClick={() => setBatchModal(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              {batchModal === 'category' ? (
                <div className="form-row">
                  <label>{t('features.transactions.newCategory')}</label>
                  <select value={batchCategoryId} onChange={(e) => setBatchCategoryId(e.target.value)}>
                    <option value="">{t('features.common.uncategorized')}</option>
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
                  <label>{t('features.transactions.newDate')}</label>
                  <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setBatchModal(null)}>{t('common.cancel')}</button>
                <button className="btn btn-primary" onClick={handleBatchUpdate}>{t('features.transactions.applyTo', { count: selected.size })}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="modal-overlay active" onClick={() => setDeleteId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('common.confirmDelete')}</h3>
              <button className="btn-icon" onClick={() => setDeleteId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>{t('features.transactions.deleteMessage')}</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>{t('common.cancel')}</button>
                <button className="btn btn-danger" onClick={handleDelete}>{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoreCreatedId && (
        <div className="modal-overlay active" onClick={() => setRestoreCreatedId(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('features.transactions.restoreCreatedTitle')}</h3>
              <button className="btn-icon" onClick={() => setRestoreCreatedId(null)}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>{t('features.transactions.restoreCreatedMessage')}</p>
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => setRestoreCreatedId(null)}>{t('common.cancel')}</button>
                <button className="btn btn-danger" onClick={handleRestoreCreated}>{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {restoreNoteId && (
        <div className="modal-overlay active" onClick={() => { setRestoreNoteId(null); setRestoreNotePreview(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('features.transactions.restoreNoteTitle')}</h3>
              <button className="btn-icon" onClick={() => { setRestoreNoteId(null); setRestoreNotePreview(null); }}><i className="fas fa-xmark" /></button>
            </div>
            <div className="modal-body">
              <p>{t('features.transactions.restoreNoteConfirmMessage')}</p>
              {restoreNotePreview && (
                <div className="mt-3 space-y-2 rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
                  <div>
                    <div className="text-xs font-medium text-slate-500">{t('features.transactions.restoreNoteCurrentLabel')}</div>
                    <div className="break-words text-slate-700 dark:text-slate-300">{restoreNotePreview.currentNote || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500">{t('features.transactions.restoreNotePreviewLabel')}</div>
                    <div className="break-words text-slate-700 dark:text-slate-300">{restoreNotePreview.preAiNote || '—'}</div>
                  </div>
                </div>
              )}
              <div className="modal-footer">
                <button className="btn btn-ghost" onClick={() => { setRestoreNoteId(null); setRestoreNotePreview(null); }}>{t('common.cancel')}</button>
                <button className="btn btn-danger" onClick={handleRestoreNote}>{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
