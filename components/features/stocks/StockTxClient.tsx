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
import { Plus, Trash2, Edit3, X } from 'lucide-react';

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

const EMPTY_FORM = { stockId: '', type: 'buy', date: '', shares: '', price: '', fee: '', tax: '', note: '' };
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

type QueryParams = { get(name: string): string | null };

function readPageParam(searchParams: QueryParams) {
  return Math.max(1, Number(searchParams.get('page')) || 1);
}

function readPageSizeParam(searchParams: QueryParams) {
  const value = Number(searchParams.get('pageSize')) || 20;
  return PAGE_SIZE_OPTIONS.includes(value) ? value : 20;
}

export default function StockTxClient(_props: { user?: any } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [txs, setTxs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(() => readPageParam(searchParams));
  const [pageSize, setPageSize] = useState(() => readPageSizeParam(searchParams));
  const [stocks, setStocks] = useState<any[]>([]);
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

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(pageSize) });
      if (filterStockId) params.set('stockId', filterStockId);
      if (filterDateFrom) params.set('dateFrom', filterDateFrom);
      if (filterDateTo) params.set('dateTo', filterDateTo);
      const result = await apiGet(`/api/stock-transactions?${params}`);
      setTxs(result.data || result.transactions || []);
      setTotal(result.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filterStockId, filterDateFrom, filterDateTo]);

  const loadMeta = useCallback(async () => {
    const stockResp = await apiGet('/api/stocks').catch(() => []);
    setStocks(Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []));
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { load(page); }, [page, load]);

  useEffect(() => {
    const nextPage = readPageParam(searchParams);
    const nextPageSize = readPageSizeParam(searchParams);
    const nextStockId = searchParams.get('stockId') || '';
    const nextDateFrom = searchParams.get('dateFrom') || '';
    const nextDateTo = searchParams.get('dateTo') || '';
    if (nextPage !== page) setPage(nextPage);
    if (nextPageSize !== pageSize) setPageSize(nextPageSize);
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
    if (!form.shares || Number(form.shares) <= 0) { setFormError('請輸入有效股數'); return; }
    if (!form.price || Number(form.price) <= 0) { setFormError('請輸入有效價格'); return; }
    setSaving(true);
    setFormError('');
    const body: Record<string, unknown> = {
      stockId: form.stockId,
      type: form.type,
      date: form.date,
      shares: Number(form.shares),
      price: Number(form.price),
      note: form.note,
    };
    const feeText = String(form.fee ?? '').trim();
    const taxText = String(form.tax ?? '').trim();
    if (feeText !== '') body.fee = Number(feeText);
    if (form.type === 'sell' && taxText !== '') body.tax = Number(taxText);
    try {
      if (editId) { await apiPut(`/api/stock-transactions/${editId}`, body); }
      else { await apiPost('/api/stock-transactions', body); }
      setPage(1);
      await load(1);
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stock-transactions/${deleteId}`); setDeleteId(null); await load(page); } catch (e: any) { alert(e.message); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">股票交易紀錄</h2>
      <StocksTabNav />

      <div className="flex gap-2 items-center p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={filterStockId} onChange={e => updateFilter(setFilterStockId, e.target.value)} label="股票" className="w-48" />
        <Input type="date" value={filterDateFrom} onChange={e => updateFilter(setFilterDateFrom, e.target.value)} label="起始" />
        <Input type="date" value={filterDateTo} onChange={e => updateFilter(setFilterDateTo, e.target.value)} label="結束" />
        <Button variant="outline" onClick={() => { setPage(1); setFilterStockId(''); setFilterDateFrom(''); setFilterDateTo(''); }}>清除</Button>
      </div>

      <div className="flex justify-between items-center">
        <Button onClick={() => { setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10), stockId: stocks[0]?.id || '' }); setEditId(null); setFormError(''); setDialogOpen(true); }}><Plus size={16} className="mr-2" /> 新增交易</Button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">共 {total} 筆</span>
          <label className="flex items-center gap-2 text-sm text-slate-500">
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯交易' : '新增交易'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <Select label="股票 *" options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={form.stockId} onChange={e => setForm(f => ({ ...f, stockId: e.target.value }))} />
            <Select label="類型" options={[{label: '買進', value: 'buy'}, {label: '賣出', value: 'sell'}]} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
            <Input label="日期 *" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <Input label="股數 *" type="number" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} />
            <Input label="單價 *" type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
            <Input label="手續費" type="number" placeholder="自動計算" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
            {form.type === 'sell' && <Input label="交易稅" type="number" placeholder="自動計算" value={form.tax} onChange={e => setForm(f => ({ ...f, tax: e.target.value }))} />}
            <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={saving}>儲存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead><TableHead>類型</TableHead><TableHead>股票</TableHead><TableHead>股數</TableHead><TableHead>價格</TableHead><TableHead>合計</TableHead><TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {txs.map(t => {
              const isBuy = t.type === 'buy';
              const total = isBuy ? (Number(t.shares) * Number(t.price) + Number(t.fee || 0)) : (Number(t.shares) * Number(t.price) - Number(t.fee || 0) - Number(t.tax || 0));
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.date}</TableCell>
                  <TableCell><span className={`px-2 py-1 rounded text-xs ${isBuy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{isBuy ? '買進' : '賣出'}</span></TableCell>
                  <TableCell>{t.symbol} {t.stock_name}</TableCell>
                  <TableCell>{Number(t.shares).toLocaleString()}</TableCell>
                  <TableCell>${Number(t.price).toLocaleString()}</TableCell>
                  <TableCell className={isBuy ? 'text-red-600' : 'text-green-600'}>{fmt(Math.round(total))}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ stockId: t.stockId || t.stock_id, type: t.type, date: t.date, shares: String(t.shares ?? ''), price: String(t.price ?? ''), fee: t.fee != null ? String(t.fee) : '', tax: t.tax != null ? String(t.tax) : '', note: t.note || '' }); setEditId(t.id); setFormError(''); setDialogOpen(true); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteId(t.id)}><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
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
            <p className="mb-4">確定要刪除此交易記錄嗎？</p>
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
