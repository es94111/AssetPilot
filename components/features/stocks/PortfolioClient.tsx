'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Plus, RefreshCw, Trash2, Edit3, X } from 'lucide-react';

const STOCK_TYPES = [
  { value: 'stock', label: '股票' },
  { value: 'etf', label: 'ETF' },
  { value: 'warrant', label: '權證' },
];

const EMPTY_FORM = { symbol: '', name: '', stockType: 'stock', note: '' };

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
function fmtPL(n: number | string) {
  const num = Math.round(Number(n) || 0);
  return `${num > 0 ? '+' : ''}NT$ ${num.toLocaleString('zh-TW')}`;
}
function plClass(n: number | string) {
  const num = Number(n) || 0;
  return num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : '';
}

export default function PortfolioClient(_props: { user?: any } = {}) {
  const [stocks, setStocks] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [priceModal, setPriceModal] = useState(false);
  const [priceUpdates, setPriceUpdates] = useState<Record<string, string>>({});
  const [updatingPrices, setUpdatingPrices] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiGet('/api/stocks');
      if (Array.isArray(resp)) {
        setStocks(resp);
        setSummary(null);
      } else if (resp?.stocks) {
        setStocks(resp.stocks);
        setSummary(resp.portfolioSummary || null);
      }
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.symbol.trim()) { setFormError('請輸入股票代碼'); return; }
    setSaving(true);
    setFormError('');
    const body = { symbol: form.symbol.trim().toUpperCase(), name: form.name.trim(), stockType: form.stockType, note: form.note };
    try {
      if (editId) { await apiPut(`/api/stocks/${editId}`, body); }
      else { await apiPost('/api/stocks', body); }
      await load();
    } catch (e: any) { setFormError(e.message); }
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteId) return;
    try { await apiDelete(`/api/stocks/${deleteId}`); setDeleteId(null); await load(); } catch (e: any) { alert(e.message); }
  }

  const totalDiv = stocks.reduce((s, st) => s + (Number(st.totalDividend) || 0), 0);
  const totalMV = summary?.totalMarketValue ?? stocks.reduce((s, st) => s + (Number(st.marketValue) || 0), 0);
  const totalCost = summary?.totalCost ?? stocks.reduce((s, st) => s + (Number(st.totalCost) || 0), 0);
  const totalPL = summary?.totalPL ?? stocks.reduce((s, st) => s + (Number(st.estimatedProfit) || 0), 0);
  const overallRate = summary?.totalReturnRate ?? (totalCost > 0 ? Math.round(totalPL / totalCost * 10000) / 100 : null);
  const activeStocks = stocks.filter(s => (s.totalShares || 0) > 0 || (s.totalCost || 0) > 0 || (s.marketValue || 0) > 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">持股總覽</h2>
      <StocksTabNav />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: '股票總市值', value: fmt(totalMV), color: 'text-blue-600' },
          { label: '總投入成本', value: fmt(totalCost) },
          { label: '預估損益', value: fmtPL(totalPL), color: plClass(totalPL) },
          { label: '累計股利', value: fmt(totalDiv), color: 'text-orange-500' },
          { label: '整體報酬率', value: overallRate !== null ? `${overallRate >= 0 ? '+' : ''}${overallRate}%` : '—', color: plClass(overallRate || 0) },
        ].map((item, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className={`text-xl font-semibold ${item.color || 'text-slate-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button onClick={() => { setForm(EMPTY_FORM); setEditId(null); }}><Plus size={16} className="mr-2" /> 新增股票</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editId ? '編輯股票' : '新增股票'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <Input label="股票代碼 *" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} />
              <Input label="股票名稱" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Select label="類型" options={STOCK_TYPES} value={form.stockType} onChange={e => setForm(f => ({ ...f, stockType: e.target.value }))} />
              <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              {formError && <p className="text-red-500 text-sm">{formError}</p>}
              <DialogClose asChild><Button type="submit" disabled={saving}>儲存</Button></DialogClose>
            </form>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={() => setPriceModal(true)}><RefreshCw size={16} className="mr-2" /> 更新股價</Button>
      </div>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeStocks.map(s => {
            const ep = Number(s.estimatedProfit) || 0;
            const rr = Number(s.returnRate) || 0;
            const rl = Number(s.realizedPL) || 0;
            return (
              <div key={s.id} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{s.symbol} <span className="text-sm font-normal text-slate-500">{s.name}</span></h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ symbol: s.symbol, name: s.name, stockType: s.stockType, note: s.note }); setEditId(s.id); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(s.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 text-sm">
                  <p>持有股數: {Number(s.totalShares).toLocaleString()}</p>
                  <p>成本均價: ${Number(s.avgCost || 0).toLocaleString()}</p>
                  <p>預估損益: <span className={plClass(ep)}>{fmtPL(ep)} ({rr.toFixed(2)}%)</span></p>
                  <p>累計股利: <span className="text-orange-500">{fmt(s.totalDividend)}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
