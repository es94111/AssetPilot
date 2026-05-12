'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit3, RefreshCw } from 'lucide-react';

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

const EMPTY_FORM = { stockId: '', date: '', cashDividend: '', stockDividendShares: '', accountId: '', note: '' };

type QueryParams = { get(name: string): string | null };

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get('page')) || 1);
}

export default function DividendsClient(_props: { user?: any } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [divs, setDivs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => readPageParam(searchParams));
  const [pageSize] = useState(20);
  const [stocks, setStocks] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStockId, setFilterStockId] = useState(() => searchParams.get('stockId') || '');
  const [filterDateFrom, setFilterDateFrom] = useState(() => searchParams.get('dateFrom') || '');
  const [filterDateTo, setFilterDateTo] = useState(() => searchParams.get('dateTo') || '');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [syncModal, setSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; skipped: number; errors: string[] } | null>(null);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filterStockId) params.set('stockId', filterStockId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      const result = await apiGet(`/api/stock-dividends?${params}`);
      setDivs(result.data || result.dividends || []);
      setTotal(result.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filterStockId, filterDateFrom, filterDateTo]);

  const loadMeta = useCallback(async () => {
    const [stockResp, acctResp] = await Promise.all([
      apiGet('/api/stocks').catch(() => []),
      apiGet('/api/accounts').catch(() => []),
    ]);
    setStocks(Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []));
    setAccounts(Array.isArray(acctResp) ? acctResp : []);
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const nextPage = readPageParam(searchParams);
    const nextStockId = searchParams.get('stockId') || '';
    const nextDateFrom = searchParams.get('dateFrom') || '';
    const nextDateTo = searchParams.get('dateTo') || '';
    if (nextPage !== page) setPage(nextPage);
    if (nextStockId !== filterStockId) setFilterStockId(nextStockId);
    if (nextDateFrom !== filterDateFrom) setFilterDateFrom(nextDateFrom);
    if (nextDateTo !== filterDateTo) setFilterDateTo(nextDateTo);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (filterStockId) params.set('stockId', filterStockId);
    if (filterDateFrom) params.set('dateFrom', filterDateFrom);
    if (filterDateTo) params.set('dateTo', filterDateTo);
    const nextQuery = params.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [currentQuery, filterStockId, filterDateFrom, filterDateTo, page, pageSize, pathname, router]);

  function updateFilter(setter: (value: string) => void, value: string) {
    setPage(1);
    setter(value);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.stockId) { setFormError('請選擇股票'); return; }
    if (!form.cashDividend && !form.stockDividendShares) { setFormError('請輸入現金股利或股票股利'); return; }
    setSaving(true);
    setFormError('');
    const body = {
      stockId: form.stockId,
      date: form.date,
      cashDividend: Number(form.cashDividend) || 0,
      stockDividendShares: Number(form.stockDividendShares) || 0,
      accountId: form.accountId || null,
      note: form.note,
    };
    try {
      if (editId) { await apiPut(`/api/stock-dividends/${editId}`, body); }
      else { await apiPost('/api/stock-dividends', body); }
      setDialogOpen(false);
      setPage(1);
      await load(1);
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stock-dividends/${deleteId}`); setDeleteId(null); await load(page); } catch (e: any) { alert(e.message); }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiPost('/api/stock-dividends/sync', {});
      setSyncResult({ synced: res.synced ?? 0, skipped: res.skipped ?? 0, errors: res.errors ?? [] });
      await load(1);
    } catch (e: any) { alert(e.message); }
    setSyncing(false);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">股利紀錄</h2>
      <StocksTabNav />

      <div className="flex gap-2 items-center p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={filterStockId} onChange={e => updateFilter(setFilterStockId, e.target.value)} label="股票" className="w-48" />
        <Input type="date" value={filterDateFrom} onChange={e => updateFilter(setFilterDateFrom, e.target.value)} label="起始" />
        <Input type="date" value={filterDateTo} onChange={e => updateFilter(setFilterDateTo, e.target.value)} label="結束" />
        <Button variant="outline" onClick={() => { setPage(1); setFilterStockId(''); setFilterDateFrom(''); setFilterDateTo(''); }}>清除</Button>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button onClick={() => { setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10), stockId: stocks[0]?.id || '' }); setEditId(null); setFormError(''); setDialogOpen(true); }}><Plus size={16} className="mr-2" /> 新增股利</Button>
          <Button variant="outline" onClick={() => { setSyncResult(null); setSyncModal(true); }}><RefreshCw size={16} className="mr-2" /> 同步除權息</Button>
        </div>
        <span className="text-sm text-slate-500">共 {total} 筆</span>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯股利' : '新增股利'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select label="股票 *" options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={form.stockId} onChange={e => setForm(f => ({ ...f, stockId: e.target.value }))} />
            <Input label="日期" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Input label="現金股利 (NT$)" type="number" value={form.cashDividend} onChange={e => setForm(f => ({ ...f, cashDividend: e.target.value }))} />
            <Input label="股票股利 (股)" type="number" value={form.stockDividendShares} onChange={e => setForm(f => ({ ...f, stockDividendShares: e.target.value }))} />
            <Select label="入款帳戶" options={[{ label: '— 不入帳（純股票股利）—', value: '' }, ...accounts.map(a => ({ label: a.name, value: a.id }))]} value={form.accountId} onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))} />
            <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={saving}>儲存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={syncModal} onOpenChange={setSyncModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>同步除權息</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">依照您的持股紀錄，從台灣證交所自動同步歷年除權息資料。</p>
            {syncResult && (
              <div className="text-sm p-3 rounded bg-green-50 text-green-800">
                <p>新增 {syncResult.synced} 筆，跳過 {syncResult.skipped} 筆{syncResult.errors.length > 0 ? `，${syncResult.errors.length} 筆失敗` : ''}。</p>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSyncModal(false)}>關閉</Button>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? '同步中...' : '開始同步'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead><TableHead>股票</TableHead><TableHead>現金股利</TableHead><TableHead>股票股利</TableHead><TableHead>備註</TableHead><TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divs.map(d => (
              <TableRow key={d.id}>
                <TableCell>{d.date}</TableCell>
                <TableCell>{d.symbol} {d.stock_name}</TableCell>
                <TableCell className="text-green-600">{fmt(d.cash_dividend ?? d.cashDividend)}</TableCell>
                <TableCell>{d.stock_dividend_shares ?? d.stockDividendShares ?? '—'}</TableCell>
                <TableCell>{d.note || '—'}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => { setForm({ stockId: d.stockId || d.stock_id, date: d.date, cashDividend: d.cashDividend ?? d.cash_dividend, stockDividendShares: d.stockDividendShares ?? d.stock_dividend_shares, accountId: d.accountId || d.account_id || '', note: d.note || '' }); setEditId(d.id); setFormError(''); setDialogOpen(true); }}><Edit3 size={16} /></Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(d.id)}><Trash2 size={16} /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {totalPages > 1 && (
        <div className="flex gap-2 justify-center mt-4">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一頁</Button>
          <span className="self-center">{page} / {totalPages}</span>
          <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>下一頁</Button>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="mb-4">確定要刪除此股利記錄嗎？</p>
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
