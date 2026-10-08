'use client';

// components/features/settings/InvoiceCarrierSettingsClient.tsx — 雲端發票載具設定頁（issue #253）
//
// 驗收條件：設定頁可綁定／解除手機條碼載具；可手動同步發票並轉為交易草稿，
// 使用者確認後才建立交易。
//
// 安全：驗證碼只在綁定時以 POST body 送出一次，回應與列表皆不回傳；
// 畫面只顯示遮罩後的載具條碼。同步失敗時按鈕依 `retryAfterSeconds` 停用，
// 對應後端的退避（不自動重試風暴）。
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiGetPersonal, apiPost, apiPatch, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

interface CarrierSummary {
  id: string;
  carrierBarcode: string;
  verifyCodeSet: boolean;
  status: string;
  autoSync: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  lastError: string;
  consecutiveFailures: number;
  retryAfterSeconds: number;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceDraft {
  id: string;
  carrierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime: string;
  sellerName: string;
  amount: number;
  status: 'draft' | 'imported' | 'dismissed';
  transactionId: string;
  createdAt: string;
  updatedAt: string;
}

interface AccountOption {
  id: string;
  name: string;
}

interface CategoryOption {
  id: string;
  name: string;
  parentId: string | null;
}

const CARD_CLASS =
  'rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';

function statusBadgeClass(status: string): string {
  if (status === 'imported') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'dismissed') return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
}

export default function InvoiceCarrierSettingsClient() {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ts = (key: string, vars?: Record<string, string | number>) => t(`settings.invoices.${key}`, vars);

  const [carriers, setCarriers] = useState<CarrierSummary[]>([]);
  const [carriersLoading, setCarriersLoading] = useState(true);
  const [carriersMsg, setCarriersMsg] = useState('');

  const [barcode, setBarcode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [binding, setBinding] = useState(false);
  const [bindError, setBindError] = useState('');
  const [formMsg, setFormMsg] = useState('');
  const [syncingId, setSyncingId] = useState('');

  const [invoices, setInvoices] = useState<InvoiceDraft[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesMsg, setInvoicesMsg] = useState('');
  const [statusFilter, setStatusFilter] = useState('draft');

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [confirmTarget, setConfirmTarget] = useState<InvoiceDraft | null>(null);
  const [confirmAccountId, setConfirmAccountId] = useState('');
  const [confirmCategoryId, setConfirmCategoryId] = useState('');
  const [confirmNote, setConfirmNote] = useState('');
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  // 切換篩選時可能有多個載入同時進行；以序號認領請求，只採用最後一次的回應，
  // 避免較慢的舊回應覆蓋新篩選結果（比照 ApiIntegrationSettingsClient 的做法）。
  const invoiceRequestSeq = useRef(0);

  const loadCarriers = useCallback(async (): Promise<CarrierSummary[]> => {
    setCarriersLoading(true);
    try {
      const res = await apiGet('/api/imports/invoice-carriers');
      const list: CarrierSummary[] = res.carriers || [];
      setCarriers(list);
      setCarriersMsg('');
      return list;
    } catch (e: any) {
      setCarriersMsg(e.message || ts('loadFailed'));
      return [];
    } finally {
      setCarriersLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInvoices = useCallback(async (status: string) => {
    invoiceRequestSeq.current += 1;
    const seq = invoiceRequestSeq.current;
    setInvoicesLoading(true);
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await apiGet(`/api/imports/invoices${query}`);
      if (seq !== invoiceRequestSeq.current) return;
      setInvoices(res.invoices || []);
      setInvoicesMsg('');
    } catch (e: any) {
      if (seq !== invoiceRequestSeq.current) return;
      setInvoicesMsg(e.message || ts('loadFailed'));
    } finally {
      if (seq === invoiceRequestSeq.current) setInvoicesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 帳戶與分類只在開啟確認視窗時才需要；載入失敗不阻擋其他區塊運作。
  const loadOptions = useCallback(async () => {
    try {
      const [accountRes, categoryRes] = await Promise.all([
        apiGetPersonal('/api/accounts'),
        apiGetPersonal('/api/categories'),
      ]);
      setAccounts((accountRes.accounts || accountRes || []).map((a: any) => ({ id: a.id, name: a.name })));
      const flat: CategoryOption[] = [];
      for (const category of (categoryRes.categories || categoryRes || [])) {
        if (category.parentId) {
          flat.push({ id: category.id, name: category.name, parentId: category.parentId });
        }
      }
      setCategories(flat);
    } catch {
      setAccounts([]);
      setCategories([]);
    }
  }, []);

  // 每秒遞減退避計數，讓「請於 N 秒後再試」的按鈕停用狀態自動恢復。
  useEffect(() => {
    const timer = setInterval(() => {
      setCarriers((prev) => prev.map((carrier) => (
        carrier.retryAfterSeconds > 0
          ? { ...carrier, retryAfterSeconds: Math.max(0, carrier.retryAfterSeconds - 1) }
          : carrier
      )));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { void loadCarriers(); }, [loadCarriers]);
  useEffect(() => { void loadInvoices(statusFilter); }, [loadInvoices, statusFilter]);
  useEffect(() => { void loadOptions(); }, [loadOptions]);

  async function handleBind(e: React.FormEvent) {
    e.preventDefault();
    setBindError('');
    setFormMsg('');
    const trimmedBarcode = barcode.trim();
    const trimmedVerify = verifyCode.trim();
    if (!trimmedBarcode) { setBindError(ts('barcodeHint')); return; }
    if (!trimmedVerify) { setBindError(ts('verifyCodeHint')); return; }

    setBinding(true);
    try {
      await apiPost('/api/imports/invoice-carriers', {
        carrierBarcode: trimmedBarcode,
        verifyCode: trimmedVerify,
      });
      // 綁定成功即清空輸入框，避免驗證碼留在畫面上。
      setBarcode('');
      setVerifyCode('');
      setFormMsg(ts('bindSuccess'));
      await loadCarriers();
    } catch (err: any) {
      setBindError(err.message || ts('bindFailed'));
    } finally {
      setBinding(false);
    }
  }

  async function handleUnbind(carrier: CarrierSummary) {
    if (!confirm(ts('unbindConfirm'))) return;
    setCarriersMsg('');
    setFormMsg('');
    try {
      await apiDelete(`/api/imports/invoice-carriers/${encodeURIComponent(carrier.id)}`);
      setFormMsg(ts('unbindSuccess'));
      await loadCarriers();
    } catch (e: any) {
      setCarriersMsg(e.message || ts('unbindFailed'));
    }
  }

  async function handleToggleAutoSync(carrier: CarrierSummary) {
    setCarriersMsg('');
    try {
      // 樂觀更新：先反映使用者操作，失敗時以伺服器回傳值覆蓋。
      setCarriers((prev) => prev.map((item) => (
        item.id === carrier.id ? { ...item, autoSync: !carrier.autoSync } : item
      )));
      const res = await apiPatch(`/api/imports/invoice-carriers/${encodeURIComponent(carrier.id)}`, {
        autoSync: !carrier.autoSync,
      });
      if (res.carrier) {
        setCarriers((prev) => prev.map((item) => (item.id === carrier.id ? res.carrier : item)));
      }
    } catch (e: any) {
      setCarriers((prev) => prev.map((item) => (
        item.id === carrier.id ? { ...item, autoSync: carrier.autoSync } : item
      )));
      setCarriersMsg(e.message || ts('autoSyncUpdateFailed'));
    }
  }

  async function handleSync(carrier: CarrierSummary) {
    setCarriersMsg('');
    setFormMsg('');
    setSyncingId(carrier.id);
    try {
      const res = await apiPost(`/api/imports/invoice-carriers/${encodeURIComponent(carrier.id)}`);
      if (res.status === 'skipped' && res.degraded) {
        setCarriersMsg(ts('syncDegraded'));
      } else if (res.status === 'skipped') {
        setCarriersMsg(res.error || ts('syncFailed'));
      } else if (res.status === 'failed') {
        setCarriersMsg(`${ts('syncFailed')}：${res.error || ''}`.trim());
      } else {
        setFormMsg(ts('syncSummary', {
          created: res.created || 0,
          duplicates: res.duplicates || 0,
          skipped: res.skipped || 0,
        }));
      }
      await loadCarriers();
      await loadInvoices(statusFilter);
    } catch (e: any) {
      setCarriersMsg(e.message || ts('syncFailed'));
    } finally {
      setSyncingId('');
    }
  }

  function openConfirm(invoice: InvoiceDraft) {
    setConfirmTarget(invoice);
    setConfirmAccountId('');
    setConfirmCategoryId('');
    setConfirmNote('');
    setConfirmError('');
    void loadOptions();
  }

  async function handleConfirmImport(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmTarget) return;
    setConfirmError('');
    setConfirmSubmitting(true);
    try {
      await apiPost(`/api/imports/invoices/${encodeURIComponent(confirmTarget.id)}`, {
        accountId: confirmAccountId,
        categoryId: confirmCategoryId,
        note: confirmNote,
      });
      setConfirmTarget(null);
      setFormMsg(ts('importSuccess'));
      await loadInvoices(statusFilter);
      await loadCarriers();
    } catch (err: any) {
      setConfirmError(err.message || ts('importFailed'));
    } finally {
      setConfirmSubmitting(false);
    }
  }

  async function handleDismiss(invoice: InvoiceDraft) {
    if (!confirm(ts('dismissConfirm'))) return;
    setInvoicesMsg('');
    setFormMsg('');
    try {
      await apiDelete(`/api/imports/invoices/${encodeURIComponent(invoice.id)}`);
      setFormMsg(ts('dismissSuccess'));
      await loadInvoices(statusFilter);
    } catch (e: any) {
      setInvoicesMsg(e.message || ts('dismissFailed'));
    }
  }

  function statusLabel(status: string): string {
    if (status === 'imported') return ts('statusImported');
    if (status === 'dismissed') return ts('statusDismissed');
    return ts('statusDraft');
  }

  const statusFilterOptions = [
    { label: ts('statusAll'), value: '' },
    { label: ts('statusDraft'), value: 'draft' },
    { label: ts('statusImported'), value: 'imported' },
    { label: ts('statusDismissed'), value: 'dismissed' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{ts('title')}</h2>
      <p className="text-sm text-slate-500">{ts('description')}</p>

      {/* 綁定載具 */}
      <section className={CARD_CLASS}>
        <h3 className="mb-2 text-lg font-semibold">{ts('carrierSectionTitle')}</h3>
        <p className="mb-4 text-sm text-slate-500">{ts('carrierSectionDescription')}</p>

        <form onSubmit={handleBind} className="max-w-md space-y-4">
          <Input
            label={ts('barcodeLabel')}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder={ts('barcodePlaceholder')}
            maxLength={8}
            autoComplete="off"
          />
          <p className="text-xs text-slate-500">{ts('barcodeHint')}</p>
          <Input
            label={ts('verifyCodeLabel')}
            type="password"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value)}
            placeholder={ts('verifyCodePlaceholder')}
            maxLength={20}
            autoComplete="new-password"
          />
          <p className="text-xs text-slate-500">{ts('verifyCodeHint')}</p>
          {bindError && <div role="alert" className="text-sm text-red-500">{bindError}</div>}
          <Button type="submit" disabled={binding}>
            {binding ? ts('binding') : ts('bindButton')}
          </Button>
        </form>
      </section>

      {/* 已綁定載具 */}
      <section className={CARD_CLASS}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{ts('carrierSectionTitle')}</h3>
          <Button variant="outline" onClick={() => void loadCarriers()}>{t('common.refresh')}</Button>
        </div>
        {carriersMsg && <p role="alert" className="mb-3 text-sm text-red-500">{carriersMsg}</p>}
        {formMsg && <p role="status" className="mb-3 text-sm text-green-600 dark:text-green-400">{formMsg}</p>}
        {carriersLoading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : carriers.length === 0 ? (
          <p className="text-sm text-slate-500">{ts('noCarriers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 text-left">{ts('barcodeLabel')}</th>
                  <th className="py-2 pr-4 text-left">{ts('colLastSync')}</th>
                  <th className="py-2 pr-4 text-left">{ts('autoSyncLabel')}</th>
                  <th className="py-2 pr-4 text-left">{ts('colStatus')}</th>
                  <th className="py-2 text-left">{ts('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {carriers.map((carrier) => {
                  const backedOff = carrier.retryAfterSeconds > 0;
                  return (
                    <tr key={carrier.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <code className="text-sm">{carrier.carrierBarcode}</code>
                      </td>
                      <td className="py-3 pr-4">
                        {carrier.lastSyncAt
                          ? new Date(carrier.lastSyncAt).toLocaleString(dateLocale)
                          : ts('neverSynced')}
                      </td>
                      <td className="py-3 pr-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={carrier.autoSync}
                            onChange={() => void handleToggleAutoSync(carrier)}
                          />
                          <span className="sr-only">{ts('autoSyncLabel')}</span>
                          <span className="text-xs text-slate-500">{ts('autoSyncLabel')}</span>
                        </label>
                      </td>
                      <td className="py-3 pr-4">
                        {carrier.lastSyncStatus === 'failed' ? (
                          <span className="text-red-500">
                            {backedOff
                              ? ts('retryAfter', { seconds: carrier.retryAfterSeconds })
                              : ts('syncFailed')}
                          </span>
                        ) : carrier.lastError ? (
                          <span className="text-amber-600 dark:text-amber-400">{carrier.lastError}</span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            disabled={syncingId === carrier.id || backedOff}
                            onClick={() => void handleSync(carrier)}
                          >
                            {syncingId === carrier.id ? ts('syncing') : ts('syncNow')}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => void handleUnbind(carrier)}
                          >
                            {ts('unbindButton')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 發票草稿 */}
      <section className={CARD_CLASS}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{ts('draftsTitle')}</h3>
          <div className="w-48">
            <Select
              label={ts('filterStatus')}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusFilterOptions}
            />
          </div>
        </div>
        <p className="mb-4 text-sm text-slate-500">{ts('draftsDescription')}</p>
        {invoicesMsg && <p role="alert" className="mb-3 text-sm text-red-500">{invoicesMsg}</p>}
        {invoicesLoading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-slate-500">{ts('noDrafts')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 text-left">{ts('colInvoiceNumber')}</th>
                  <th className="py-2 pr-4 text-left">{ts('colDate')}</th>
                  <th className="py-2 pr-4 text-left">{ts('colSeller')}</th>
                  <th className="py-2 pr-4 text-right">{ts('colAmount')}</th>
                  <th className="py-2 pr-4 text-left">{ts('colStatus')}</th>
                  <th className="py-2 text-left">{ts('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <code className="text-xs">{invoice.invoiceNumber}</code>
                    </td>
                    <td className="py-3 pr-4">
                      {invoice.invoiceDate}
                      {invoice.invoiceTime ? ` ${invoice.invoiceTime.slice(0, 5)}` : ''}
                    </td>
                    <td className="py-3 pr-4">{invoice.sellerName || '—'}</td>
                    <td className="py-3 pr-4 text-right">{invoice.amount.toLocaleString(dateLocale)}</td>
                    <td className="py-3 pr-4">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(invoice.status)}`}>
                        {statusLabel(invoice.status)}
                      </span>
                    </td>
                    <td className="py-3">
                      {invoice.status === 'draft' && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => openConfirm(invoice)}>
                            {ts('confirmButton')}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-slate-500"
                            onClick={() => void handleDismiss(invoice)}
                          >
                            {ts('dismissButton')}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!confirmTarget}
        onClose={() => setConfirmTarget(null)}
        title={ts('confirmTitle')}
      >
        <form onSubmit={handleConfirmImport} className="space-y-4">
          {confirmTarget && (
            <p className="text-sm text-slate-500">
              <code className="text-xs">{confirmTarget.invoiceNumber}</code>
              {' '}
              {confirmTarget.sellerName || '—'}
              {' '}
              {confirmTarget.amount.toLocaleString(dateLocale)}
            </p>
          )}
          <Select
            label={ts('accountLabel')}
            value={confirmAccountId}
            onChange={(e) => setConfirmAccountId(e.target.value)}
            options={[
              { label: ts('selectAccount'), value: '' },
              ...accounts.map((account) => ({ label: account.name, value: account.id })),
            ]}
          />
          <Select
            label={ts('categoryLabel')}
            value={confirmCategoryId}
            onChange={(e) => setConfirmCategoryId(e.target.value)}
            options={[
              { label: ts('selectCategory'), value: '' },
              ...categories.map((category) => ({ label: category.name, value: category.id })),
            ]}
          />
          <Input
            label={ts('noteLabel')}
            value={confirmNote}
            onChange={(e) => setConfirmNote(e.target.value)}
            maxLength={200}
          />
          {confirmError && <div role="alert" className="text-sm text-red-500">{confirmError}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={confirmSubmitting}>
              {confirmSubmitting ? ts('submitting') : ts('submit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
