'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useT } from '@/components/i18n/I18nProvider';

type UserLike = { isAdmin?: boolean };

type CsvImportResult = {
  imported?: number;
  skipped?: number;
  errors?: Array<{ row?: number; reason?: string }>;
  warnings?: Array<{ row?: number; reason?: string; type?: string }>;
  created?: { categories?: string[]; accounts?: string[] };
  message?: string;
  beforeRestorePath?: string;
};

type MegaS4Status = {
  configured: boolean;
  missing: string[];
  region: string;
  endpoint: string;
  bucket: string;
  prefix: string;
};

const CSV_MODULES = [
  {
    key: 'accounts',
    labelKey: 'features.dataTransfer.modules.accounts',
    exportUrl: '/api/accounts/export',
    importUrl: '/api/accounts/import',
    columns: ['name', 'category', 'accountType', 'initialBalance', 'currency', 'icon', 'excludeFromTotal', 'linkedBankName', 'overseasFeeRate', 'note'],
  },
  {
    key: 'transactions',
    labelKey: 'features.dataTransfer.modules.transactions',
    exportUrl: '/api/transactions/export',
    importUrl: '/api/transactions/import',
    columns: ['date', 'type', 'category', 'amount', 'currency', 'originalAmount', 'fxRate', 'twdAmount', 'fxFee', 'account', 'transferToAccount', 'excludeFromStats', 'tags', 'note'],
  },
  {
    key: 'categories',
    labelKey: 'features.dataTransfer.modules.categories',
    exportUrl: '/api/categories/export',
    importUrl: '/api/categories/import',
    columns: ['type', 'name', 'parent', 'color'],
  },
  {
    key: 'stockTransactions',
    labelKey: 'features.dataTransfer.modules.stockTransactions',
    exportUrl: '/api/stock-transactions/export',
    importUrl: '/api/stock-transactions/import',
    columns: ['date', 'symbol', 'name', 'type', 'shares', 'price', 'fee', 'tax', 'accountName', 'note'],
  },
  {
    key: 'stockDividends',
    labelKey: 'features.dataTransfer.modules.stockDividends',
    exportUrl: '/api/stock-dividends/export',
    importUrl: '/api/stock-dividends/import',
    columns: ['date', 'symbol', 'name', 'cashDividend', 'stockDividend', 'accountName', 'note'],
  },
] as const;

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text: string) {
  const normalized = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
        current += char;
      }
      continue;
    }
    if (char === '\n' && !inQuotes) {
      if (current.trim()) rows.push(parseCsvLine(current));
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim()) rows.push(parseCsvLine(current));
  if (rows.length === 0) return [];

  const headers = rows[0];
  return rows.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

async function downloadFromUrl(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  a.href = href;
  a.download = filenameMatch?.[1] || 'download.bin';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export default function DataTransferClient({ user }: { user: UserLike }) {
  const { t } = useT();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [importResults, setImportResults] = useState<Record<string, CsvImportResult | null>>({});
  const [status, setStatus] = useState('');
  const [dbStatus, setDbStatus] = useState('');
  const [bundleStatus, setBundleStatus] = useState('');
  const [bundleError, setBundleError] = useState(false);
  const [megaS4Status, setMegaS4Status] = useState<MegaS4Status | null>(null);
  const [megaS4Message, setMegaS4Message] = useState('');
  const [showMegaS4Form, setShowMegaS4Form] = useState(false);
  const [megaS4Saving, setMegaS4Saving] = useState(false);
  const [megaS4FormData, setMegaS4FormData] = useState({
    bucket: '', region: 'eu-central-1', endpoint: '',
    prefix: 'assetpilot', accessKeyId: '', secretAccessKey: '',
  });

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString() ? `?${params.toString()}` : '';
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let cancelled = false;
    fetch('/api/database/mega-s4', { credentials: 'include', cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setMegaS4Status(data);
      })
      .catch(() => {
        if (!cancelled) setMegaS4Status(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.isAdmin]);

  async function handleCsvExport(url: string, key: string) {
    setBusyKey(key);
    setStatus('');
    try {
      await downloadFromUrl(url + exportQuery);
      setStatus(t('features.dataTransfer.messages.exportSuccess'));
    } catch (e: any) {
      setStatus(e.message || t('features.dataTransfer.messages.exportFailed'));
    }
    setBusyKey('');
  }

  async function handleCsvImport(moduleKey: string, importUrl: string, file: File | null) {
    if (!file) return;
    setBusyKey(moduleKey);
    setStatus('');
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) throw new Error(t('features.dataTransfer.messages.emptyCsv'));
      const res = await fetch(importUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, autoCreate: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setImportResults((prev) => ({ ...prev, [moduleKey]: data }));
      setStatus(t('features.dataTransfer.messages.importComplete', { name: file.name }));
    } catch (e: any) {
      setImportResults((prev) => ({ ...prev, [moduleKey]: { message: e.message || t('features.dataTransfer.messages.importFailed') } }));
      setStatus(e.message || t('features.dataTransfer.messages.importFailed'));
    }
    setBusyKey('');
  }

  async function handleBundleExport() {
    setBusyKey('bundle-export');
    setBundleStatus('');
    setBundleError(false);
    try {
      await downloadFromUrl('/api/account/data-bundle');
      setBundleStatus(t('features.dataTransfer.messages.bundleExportDone'));
    } catch (e: any) {
      setBundleStatus(e.message || t('features.dataTransfer.messages.bundleExportFailed'));
      setBundleError(true);
    }
    setBusyKey('');
  }

  async function handleBundleRestore(file: File | null) {
    if (!file) return;
    setBusyKey('bundle-restore');
    setBundleStatus('');
    setBundleError(false);
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/account/data-bundle', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
      setBundleStatus(data.message || t('features.dataTransfer.messages.restoreDone'));
    } catch (e: any) {
      setBundleStatus(e.message || t('features.dataTransfer.messages.bundleRestoreFailed'));
      setBundleError(true);
    }
    setBusyKey('');
  }

  async function handleDbExport() {
    setBusyKey('db-export');
    setDbStatus('');
    try {
      await downloadFromUrl('/api/database/export');
      setDbStatus(t('features.dataTransfer.messages.dbExportDone'));
    } catch (e: any) {
      setDbStatus(e.message || t('features.dataTransfer.messages.dbExportFailed'));
    }
    setBusyKey('');
  }

  async function handleDbImport(file: File | null) {
    if (!file) return;
    setBusyKey('db-import');
    setDbStatus('');
    try {
      const buffer = await file.arrayBuffer();
      const res = await fetch('/api/database/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buffer,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}`);
      setDbStatus(data.message || t('features.dataTransfer.messages.dbRestoreDone'));
    } catch (e: any) {
      setDbStatus(e.message || t('features.dataTransfer.messages.dbRestoreFailed'));
    }
    setBusyKey('');
  }

  async function handleMegaS4Backup() {
    setBusyKey('mega-s4-backup');
    setMegaS4Message('');
    try {
      const res = await fetch('/api/database/mega-s4', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMegaS4Message(t('features.dataTransfer.messages.uploadedTo', { bucket: data.bucket, key: data.key }));
    } catch (e: any) {
      setMegaS4Message(e.message || t('features.dataTransfer.messages.megaBackupFailed'));
    }
    setBusyKey('');
  }

  async function handleMegaS4Configure(e: React.FormEvent) {
    e.preventDefault();
    setMegaS4Saving(true);
    setMegaS4Message('');
    try {
      const payload: Record<string, string> = {};
      if (megaS4FormData.bucket)          payload.bucket          = megaS4FormData.bucket;
      if (megaS4FormData.region)          payload.region          = megaS4FormData.region;
      if (megaS4FormData.endpoint)        payload.endpoint        = megaS4FormData.endpoint;
      if (megaS4FormData.prefix)          payload.prefix          = megaS4FormData.prefix;
      if (megaS4FormData.accessKeyId)     payload.accessKeyId     = megaS4FormData.accessKeyId;
      if (megaS4FormData.secretAccessKey) payload.secretAccessKey = megaS4FormData.secretAccessKey;
      if (Object.keys(payload).length === 0) { setMegaS4Message(t('features.dataTransfer.messages.requireOneField')); setMegaS4Saving(false); return; }
      const res = await fetch('/api/database/mega-s4', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMegaS4Status(data);
      setShowMegaS4Form(false);
      setMegaS4FormData(prev => ({ ...prev, accessKeyId: '', secretAccessKey: '' }));
      setMegaS4Message(t('features.dataTransfer.messages.saved'));
    } catch (e: any) {
      setMegaS4Message(e.message || t('features.dataTransfer.messages.saveFailed'));
    }
    setMegaS4Saving(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">{t('features.dataTransfer.title')}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <Input label={t('features.dataTransfer.exportStartDate')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label={t('features.dataTransfer.exportEndDate')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {status && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{status}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {CSV_MODULES.map((module) => {
          const result = importResults[module.key];
          return (
            <section key={module.key} className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{t(module.labelKey)}</h2>
                <p className="text-sm text-slate-500 mt-1">{t('features.dataTransfer.csvColumns', { columns: module.columns.join(', ') })}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleCsvExport(module.exportUrl, `${module.key}-export`)} disabled={busyKey === `${module.key}-export`}>
                  {busyKey === `${module.key}-export` ? t('features.dataTransfer.exporting') : t('features.dataTransfer.exportCsv')}
                </Button>
                <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                  <span>{busyKey === module.key ? t('features.dataTransfer.importing') : t('features.dataTransfer.chooseCsv')}</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => handleCsvImport(module.key, module.importUrl, e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              {result && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm space-y-2">
                  {result.message && <p className="text-slate-700">{result.message}</p>}
                  {result.imported != null && <p>{t('features.dataTransfer.imported', { count: result.imported })}</p>}
                  {result.skipped != null && <p>{t('features.dataTransfer.skipped', { count: result.skipped })}</p>}
                  {!!result.created?.categories?.length && <p>{t('features.dataTransfer.createdCategories', { items: result.created.categories.join(', ') })}</p>}
                  {!!result.created?.accounts?.length && <p>{t('features.dataTransfer.createdAccounts', { items: result.created.accounts.join(', ') })}</p>}
                  {!!result.warnings?.length && (
                    <div>
                      <p className="font-medium">{t('features.dataTransfer.warning')}</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {result.warnings.slice(0, 5).map((warning, index) => (
                          <li key={`${warning.row}-${index}`}>{t('features.dataTransfer.rowIssue', { row: warning.row || '?', reason: warning.reason || warning.type || t('features.dataTransfer.warning') })}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!result.errors?.length && (
                    <div>
                      <p className="font-medium text-red-600">{t('features.dataTransfer.error')}</p>
                      <ul className="list-disc pl-5 space-y-1 text-red-600">
                        {result.errors.slice(0, 5).map((error, index) => (
                          <li key={`${error.row}-${index}`}>{t('features.dataTransfer.rowIssue', { row: error.row || '?', reason: error.reason || t('features.dataTransfer.messages.importFailed') })}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('features.dataTransfer.bundle.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('features.dataTransfer.bundle.description1')}
            {t('features.dataTransfer.bundle.description2')}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('features.dataTransfer.bundle.restorePrefix')}<span className="font-medium text-slate-700 dark:text-slate-200">{t('features.dataTransfer.bundle.mergeMode')}</span>{t('features.dataTransfer.bundle.restoreMiddle')}
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('features.dataTransfer.bundle.noOverwrite')}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleBundleExport} disabled={busyKey === 'bundle-export'}>
            {busyKey === 'bundle-export' ? t('features.dataTransfer.bundle.downloading') : t('features.dataTransfer.bundle.download')}
          </Button>
          <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            <span>{busyKey === 'bundle-restore' ? t('features.dataTransfer.bundle.restoring') : t('features.dataTransfer.bundle.restore')}</span>
            <input
              type="file"
              accept=".zip,application/zip,application/octet-stream"
              className="hidden"
              disabled={busyKey === 'bundle-restore'}
              onChange={(e) => { handleBundleRestore(e.target.files?.[0] || null); e.target.value = ''; }}
            />
          </label>
        </div>

        {bundleStatus && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${bundleError ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300'}`}>
            {bundleStatus}
          </div>
        )}
      </section>

      {user?.isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('features.dataTransfer.database.title')}</h2>
            <p className="text-sm text-slate-500 mt-1">{t('features.dataTransfer.database.description')}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDbExport} disabled={busyKey === 'db-export'}>
              {busyKey === 'db-export' ? t('features.dataTransfer.database.downloading') : t('features.dataTransfer.database.download')}
            </Button>
            <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <span>{busyKey === 'db-import' ? t('features.dataTransfer.database.restoring') : t('features.dataTransfer.database.restore')}</span>
              <input
                type="file"
                accept=".db,.sql,application/octet-stream,application/x-sqlite3,application/sql,text/plain"
                className="hidden"
                onChange={(e) => handleDbImport(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {dbStatus && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{dbStatus}</div>}
        </section>
      )}

      {user?.isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800 p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t('features.dataTransfer.mega.title')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {t('features.dataTransfer.mega.description')}
            </p>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300 sm:grid-cols-2">
            <p><span className="font-medium">{t('features.dataTransfer.mega.state')}</span>{megaS4Status?.configured ? t('features.dataTransfer.mega.configured') : t('features.dataTransfer.mega.notConfigured')}</p>
            <p><span className="font-medium">Region：</span>{megaS4Status?.region || 'eu-central-1'}</p>
            <p><span className="font-medium">{t('features.dataTransfer.mega.bucket')}</span>{megaS4Status?.bucket || t('features.dataTransfer.mega.notConfigured')}</p>
            <p><span className="font-medium">Prefix：</span>{megaS4Status?.prefix || 'assetpilot'}</p>
            <p className="sm:col-span-2"><span className="font-medium">Endpoint：</span>{megaS4Status?.endpoint || 'https://s3.eu-central-1.s4.mega.io'}</p>
            {!!megaS4Status?.missing?.length && (
              <p className="sm:col-span-2 text-amber-700 dark:text-amber-300">
                {t('features.dataTransfer.mega.missing', { items: megaS4Status.missing.join(', ') })}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleMegaS4Backup} disabled={!megaS4Status?.configured || busyKey === 'mega-s4-backup'}>
              {busyKey === 'mega-s4-backup' ? t('features.dataTransfer.mega.uploading') : t('features.dataTransfer.mega.upload')}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!showMegaS4Form && megaS4Status) {
                  setMegaS4FormData(prev => ({
                    ...prev,
                    bucket: megaS4Status.bucket || '',
                    region: megaS4Status.region || 'eu-central-1',
                    endpoint: megaS4Status.endpoint?.match(/^https:\/\/s3\.\w[\w-]*\.s4\.mega\.io$/) ? '' : (megaS4Status.endpoint || ''),
                    prefix: megaS4Status.prefix || 'assetpilot',
                    accessKeyId: '',
                    secretAccessKey: '',
                  }));
                }
                setShowMegaS4Form(prev => !prev);
                setMegaS4Message('');
              }}
            >
              {showMegaS4Form ? t('features.dataTransfer.mega.cancelConfigure') : t('features.dataTransfer.mega.configure')}
            </Button>
          </div>

          {showMegaS4Form && (
            <form
              onSubmit={handleMegaS4Configure}
              className="rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/50 p-4 space-y-1"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 pb-2">
                {t('features.dataTransfer.mega.formHelp')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <Input label={t('features.dataTransfer.mega.bucketName')} value={megaS4FormData.bucket}
                  onChange={e => setMegaS4FormData(p => ({ ...p, bucket: e.target.value }))}
                  placeholder="my-bucket" autoComplete="off" />
                <Select label="Region" value={megaS4FormData.region}
                  onChange={e => setMegaS4FormData(p => ({ ...p, region: e.target.value }))}
                  options={['eu-central-1', 'eu-central-2', 'ca-central-1', 'ca-west-1']} />
                <Input label="Access Key ID" value={megaS4FormData.accessKeyId}
                  onChange={e => setMegaS4FormData(p => ({ ...p, accessKeyId: e.target.value }))}
                  placeholder="Access Key ID" autoComplete="off" spellCheck={false} />
                <Input label="Secret Access Key" type="password" value={megaS4FormData.secretAccessKey}
                  onChange={e => setMegaS4FormData(p => ({ ...p, secretAccessKey: e.target.value }))}
                  placeholder="Secret Access Key" autoComplete="new-password" />
                <Input label={t('features.dataTransfer.mega.prefix')} value={megaS4FormData.prefix}
                  onChange={e => setMegaS4FormData(p => ({ ...p, prefix: e.target.value }))}
                  placeholder="assetpilot" />
                <Input label={t('features.dataTransfer.mega.endpoint')} value={megaS4FormData.endpoint}
                  onChange={e => setMegaS4FormData(p => ({ ...p, endpoint: e.target.value }))}
                  placeholder={`https://s3.${megaS4FormData.region}.s4.mega.io`} />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="submit" disabled={megaS4Saving}>{megaS4Saving ? t('common.saving') : t('features.dataTransfer.mega.saveSettings')}</Button>
                <Button type="button" variant="outline" onClick={() => setShowMegaS4Form(false)} disabled={megaS4Saving}>{t('common.cancel')}</Button>
              </div>
            </form>
          )}

          {megaS4Message && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">{megaS4Message}</div>}
        </section>
      )}
    </div>
  );
}
