'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, RefreshCw, Trash2, Edit3 } from 'lucide-react';

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
  const [symbolLooking, setSymbolLooking] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [priceModal, setPriceModal] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [priceResult, setPriceResult] = useState<{ updated: number; failed: number } | null>(null);

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

  async function handleSymbolBlur() {
    const sym = form.symbol.trim().toUpperCase();
    if (!sym || editId) return;
    setSymbolLooking(true);
    try {
      const data = await apiGet(`/api/stocks/quote?symbol=${sym}`);
      if (data?.name) setForm(f => ({ ...f, name: f.name || data.name }));
      const t = /^00\d|^006/.test(sym) ? 'etf' : sym.length >= 7 ? 'warrant' : 'stock';
      setForm(f => ({ ...f, stockType: t }));
    } catch (_) {}
    setSymbolLooking(false);
  }

  async function handleBatchFetchPrices() {
    setUpdatingPrices(true);
    setPriceResult(null);
    try {
      const fetchRes = await apiPost('/api/stocks/batch-fetch', {});
      const results: any[] = fetchRes.results || [];
      const successful = results.filter((r: any) => r.status === 'ok');
      const failed = results.length - successful.length;
      if (successful.length > 0) {
        const updates = successful.map((r: any) => ({ stockId: r.stockId, currentPrice: r.currentPrice }));
        await apiPost('/api/stocks/batch-price', { updates });
      }
      setPriceResult({ updated: successful.length, failed });
      await load();
    } catch (e: any) { alert(e.message); }
    setUpdatingPrices(false);
  }

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
          <div key={i} className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className={`text-xl font-semibold ${item.color || 'text-slate-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setFormError(''); setAddDialogOpen(true); }}><Plus size={16} className="mr-2" /> 新增股票</Button>
        <Button variant="outline" onClick={() => { setPriceResult(null); setPriceModal(true); }}><RefreshCw size={16} className="mr-2" /> 更新股價</Button>
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? '編輯股票' : '新增股票'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="relative">
              <Input label="股票代碼 *" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value }))} onBlur={handleSymbolBlur} />
              {symbolLooking && <p className="text-xs text-slate-400 mt-1">查詢中...</p>}
            </div>
            <Input label="股票名稱" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <Select label="類型" options={STOCK_TYPES} value={form.stockType} onChange={e => setForm(f => ({ ...f, stockType: e.target.value }))} />
            <Input label="備註" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            {formError && <p className="text-red-500 text-sm">{formError}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={saving}>儲存</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={priceModal} onOpenChange={setPriceModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>更新股價</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-500">從台灣證交所批次查詢最新股價，並更新所有持股。</p>
            {priceResult && (
              <p className="text-sm text-green-700 bg-green-50 p-3 rounded">
                更新完成：{priceResult.updated} 支成功{priceResult.failed > 0 ? `，${priceResult.failed} 支失敗` : ''}。
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPriceModal(false)}>關閉</Button>
              <Button onClick={handleBatchFetchPrices} disabled={updatingPrices}>
                {updatingPrices ? '更新中...' : '批次自動更新'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeStocks.map(s => {
            const ep = Number(s.estimatedProfit) || 0;
            const rr = Number(s.returnRate) || 0;
            return (
              <div key={s.id} className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-lg">{s.symbol} <span className="text-sm font-normal text-slate-500">{s.name}</span></h3>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ symbol: s.symbol, name: s.name, stockType: s.stockType, note: s.note }); setEditId(s.id); setFormError(''); setAddDialogOpen(true); }}><Edit3 size={16} /></Button>
                    <Button variant="ghost" size="icon" className="text-red-500" onClick={() => setDeleteId(s.id)}><Trash2 size={16} /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 text-sm">
                  <p>持有股數: {Number(s.totalShares).toLocaleString()}</p>
                  <p>目前股價: {s.currentPrice > 0 ? `$${Number(s.currentPrice).toLocaleString()}` : '—'}</p>
                  <p>成本均價: ${Number(s.avgCost || 0).toLocaleString()}</p>
                  <p>市值: {fmt(s.marketValue)}</p>
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
