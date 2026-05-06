'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Edit3 } from 'lucide-react';

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

const EMPTY_FORM = { stockId: '', date: '', cashDividend: '', stockDividendShares: '', note: '' };

export default function DividendsClient(_props: { user?: any } = {}) {
  const [divs, setDivs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [stocks, setStocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStockId, setFilterStockId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
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
      const result = await apiGet(`/api/stock-dividends?${params}`);
      setDivs(result.data || result.dividends || []);
      setTotal(result.total || 0);
    } catch (_) {}
    setLoading(false);
  }, [page, pageSize, filterStockId, filterDateFrom, filterDateTo]);

  const loadMeta = useCallback(async () => {
    const stockResp = await apiGet('/api/stocks').catch(() => []);
    setStocks(Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []));
  }, []);

  useEffect(() => { loadMeta(); }, [loadMeta]);
  useEffect(() => { setPage(1); load(1); }, [filterStockId, filterDateFrom, filterDateTo]);
  useEffect(() => { load(page); }, [page]);

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
      note: form.note,
    };
    try {
      if (editId) { await apiPut(`/api/stock-dividends/${editId}`, body); }
      else { await apiPost('/api/stock-dividends', body); }
      await load(1);
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stock-dividends/${deleteId}`); setDeleteId(null); await load(page); } catch (e: any) { alert(e.message); }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">股利紀錄</h2>
      <StocksTabNav />

      <div className="flex gap-2 items-center p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
        <Select options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={filterStockId} onChange={e => setFilterStockId(e.target.value)} label="股票" className="w-48" />
        <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} label="起始" />
        <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} label="結束" />
        <Button variant="outline" onClick={() => { setFilterStockId(''); setFilterDateFrom(''); setFilterDateTo(''); }}>清除</Button>
      </div>

      <div className="flex justify-between items-center">
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => { setForm({ ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10), stockId: stocks[0]?.id || '' }); setEditId(null); }}><Plus size={16} className="mr-2" /> 新增股利</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? '編輯股利' : '新增股利'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <Select label="股票 *" options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={form.stockId} onChange={e => setForm(f => ({ ...f, stockId: e.target.value }))} />
              <Input label="日期" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
              <Input label="現金股利 (NT$)" type="number" value={form.cashDividend} onChange={e => setForm(f => ({ ...f, cashDividend: e.target.value }))} />
              <Input label="股票股利 (股)" type="number" value={form.stockDividendShares} onChange={e => setForm(f => ({ ...f, stockDividendShares: e.target.value }))} />
              <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
            </form>
          </DialogContent>
        </Dialog>
        <span className="text-sm text-slate-500">共 {total} 筆</span>
      </div>

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
                  <Button variant="ghost" size="icon" onClick={() => { setForm({ stockId: d.stockId || d.stock_id, date: d.date, cashDividend: d.cashDividend || d.cash_dividend, stockDividendShares: d.stockDividendShares || d.stock_dividend_shares, note: d.note }); setEditId(d.id); }}><Edit3 size={16} /></Button>
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
    </div>
  );
}
