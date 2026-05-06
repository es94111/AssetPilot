'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';

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

const CSV_MODULES = [
  {
    key: 'transactions',
    label: '交易記錄',
    exportUrl: '/api/transactions/export',
    importUrl: '/api/transactions/import',
    columns: ['date', 'type', 'category', 'amount', 'account', 'note'],
  },
  {
    key: 'categories',
    label: '分類',
    exportUrl: '/api/categories/export',
    importUrl: '/api/categories/import',
    columns: ['type', 'name', 'parent', 'color'],
  },
  {
    key: 'stockTransactions',
    label: '股票交易',
    exportUrl: '/api/stock-transactions/export',
    importUrl: '/api/stock-transactions/import',
    columns: ['date', 'symbol', 'name', 'type', 'shares', 'price', 'fee', 'tax', 'accountName', 'note'],
  },
  {
    key: 'stockDividends',
    label: '股利紀錄',
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
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [importResults, setImportResults] = useState<Record<string, CsvImportResult | null>>({});
  const [status, setStatus] = useState('');
  const [dbStatus, setDbStatus] = useState('');

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    return params.toString() ? `?${params.toString()}` : '';
  }, [dateFrom, dateTo]);

  async function handleCsvExport(url: string, key: string) {
    setBusyKey(key);
    setStatus('');
    try {
      await downloadFromUrl(url + exportQuery);
      setStatus('匯出成功');
    } catch (e: any) {
      setStatus(e.message || '匯出失敗');
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
      if (rows.length === 0) throw new Error('CSV 沒有可匯入資料');
      const res = await fetch(importUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, autoCreate: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setImportResults((prev) => ({ ...prev, [moduleKey]: data }));
      setStatus(`${file.name} 匯入完成`);
    } catch (e: any) {
      setImportResults((prev) => ({ ...prev, [moduleKey]: { message: e.message || '匯入失敗' } }));
      setStatus(e.message || '匯入失敗');
    }
    setBusyKey('');
  }

  async function handleDbExport() {
    setBusyKey('db-export');
    setDbStatus('');
    try {
      await downloadFromUrl('/api/database/export');
      setDbStatus('資料庫備份下載完成');
    } catch (e: any) {
      setDbStatus(e.message || '資料庫備份失敗');
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
      setDbStatus(data.message || '資料庫還原成功');
    } catch (e: any) {
      setDbStatus(e.message || '資料庫還原失敗');
    }
    setBusyKey('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">資料匯出匯入</h1>
        <p className="text-slate-600">新版前端已接回 CSV 匯出匯入與整檔備份/還原。先把資料治理核心能力補回來。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <Input label="匯出起始日" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input label="匯出結束日" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      {status && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{status}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {CSV_MODULES.map((module) => {
          const result = importResults[module.key];
          return (
            <section key={module.key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{module.label}</h2>
                <p className="text-sm text-slate-500 mt-1">支援 CSV 匯出與匯入。欄位：{module.columns.join(', ')}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => handleCsvExport(module.exportUrl, `${module.key}-export`)} disabled={busyKey === `${module.key}-export`}>
                  {busyKey === `${module.key}-export` ? '匯出中...' : '匯出 CSV'}
                </Button>
                <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
                  <span>{busyKey === module.key ? '匯入中...' : '選擇 CSV 匯入'}</span>
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
                  {result.imported != null && <p>匯入成功：{result.imported} 筆</p>}
                  {result.skipped != null && <p>略過：{result.skipped} 筆</p>}
                  {!!result.created?.categories?.length && <p>自動建立分類：{result.created.categories.join('、')}</p>}
                  {!!result.created?.accounts?.length && <p>自動建立帳戶：{result.created.accounts.join('、')}</p>}
                  {!!result.warnings?.length && (
                    <div>
                      <p className="font-medium">警告</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {result.warnings.slice(0, 5).map((warning, index) => (
                          <li key={`${warning.row}-${index}`}>第 {warning.row || '?'} 列：{warning.reason || warning.type || '警告'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!!result.errors?.length && (
                    <div>
                      <p className="font-medium text-red-600">錯誤</p>
                      <ul className="list-disc pl-5 space-y-1 text-red-600">
                        {result.errors.slice(0, 5).map((error, index) => (
                          <li key={`${error.row}-${index}`}>第 {error.row || '?'} 列：{error.reason || '匯入錯誤'}</li>
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

      {user?.isAdmin && (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">整檔備份 / 還原</h2>
            <p className="text-sm text-slate-500 mt-1">僅管理員可操作。下載完整 SQLite 備份，或上傳未加密 `.db` 檔進行還原。</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handleDbExport} disabled={busyKey === 'db-export'}>
              {busyKey === 'db-export' ? '下載中...' : '下載資料庫備份'}
            </Button>
            <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-slate-50">
              <span>{busyKey === 'db-import' ? '還原中...' : '選擇 .db 還原'}</span>
              <input
                type="file"
                accept=".db,application/octet-stream,application/x-sqlite3"
                className="hidden"
                onChange={(e) => handleDbImport(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {dbStatus && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{dbStatus}</div>}
        </section>
      )}
    </div>
  );
}
