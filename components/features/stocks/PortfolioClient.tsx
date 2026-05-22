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

function parseQuoteNumber(value: unknown) {
  return Number(String(value || '').replace(/,/g, '')) || 0;
}

async function fetchUserSideStockPrices(stocks: any[]) {
  const activeStocks = stocks.filter(s => !s.delisted && s.id && s.symbol);
  if (activeStocks.length === 0) return { updates: [], failed: 0 };

  const [twseSettled, tpexSettled] = await Promise.allSettled([
    fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', { cache: 'no-store' }),
    fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes', { cache: 'no-store' }),
  ]);

  const quoteMap = new Map<string, number>();

  if (twseSettled.status === 'fulfilled' && twseSettled.value.ok) {
    const twseRows = await twseSettled.value.json().catch(() => []);
    if (Array.isArray(twseRows)) {
      twseRows.forEach((row: any) => {
        const code = String(row.Code || '').trim();
        const price = parseQuoteNumber(row.ClosingPrice);
        if (code && price > 0) quoteMap.set(code, price);
      });
    }
  }

  if (tpexSettled.status === 'fulfilled' && tpexSettled.value.ok) {
    const tpexRows = await tpexSettled.value.json().catch(() => []);
    if (Array.isArray(tpexRows)) {
      tpexRows.forEach((row: any) => {
        const code = String(row.SecuritiesCompanyCode || '').trim();
        const price = parseQuoteNumber(row.Close);
        if (code && price > 0) quoteMap.set(code, price);
      });
    }
  }

  if (quoteMap.size === 0) {
    throw new Error('瀏覽器端無法取得台灣證交所行情資料');
  }

  const updates = activeStocks
    .map(s => ({ stockId: s.id, currentPrice: quoteMap.get(String(s.symbol).trim()) || 0 }))
    .filter(u => u.currentPrice > 0);

  return { updates, failed: activeStocks.length - updates.length };
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
      const { updates, failed } = await fetchUserSideStockPrices(stocks);
      if (updates.length > 0) {
        await apiPost('/api/stocks/batch-price', { updates });
      }
      setPriceResult({ updated: updates.length, failed });
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
          { label: '股票總市值', value: fmt(totalMV), color: 'text-[var(--primary)]' },
          { label: '總投入成本', value: fmt(totalCost), color: 'text-[var(--text)]' },
          { label: '預估損益', value: fmtPL(totalPL), color: plClass(totalPL) },
          { label: '累計股利', value: fmt(totalDiv), color: 'text-[var(--today)]' },
          { label: '整體報酬率', value: overallRate !== null ? `${overallRate >= 0 ? '+' : ''}${overallRate}%` : '—', color: plClass(overallRate || 0) },
        ].map((item, i) => (
          <div key={i} className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color || 'text-[var(--text)]'}`}>{item.value}</p>
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
            <p className="text-sm text-slate-500">由瀏覽器端向台灣證交所公開 API 查詢最新股價，並更新所有持股。</p>
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-2">
                <div className="h-5 w-12 rounded-full bg-[var(--border)]" />
                <div className="h-6 w-20 rounded bg-[var(--border)]" />
              </div>
              <div className="border-t border-[var(--border)] pt-3 grid grid-cols-2 gap-y-2 gap-x-4">
                {[1,2,3,4].map(j => <div key={j} className="h-4 rounded bg-[var(--border)]" />)}
              </div>
              <div className="h-16 rounded-lg bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeStocks.map(s => {
            const ep = Number(s.estimatedProfit) || 0;
            const rr = Number(s.returnRate) || 0;
            const typeBadge = {
              etf:     { label: 'ETF',  cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
              warrant: { label: '權證', cls: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
              stock:   { label: '股票', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
            }[s.stockType as 'etf' | 'warrant' | 'stock'] ?? { label: s.stockType, cls: 'bg-slate-100 text-slate-600' };
            const plBg = ep > 0 ? 'bg-[var(--success-bg)]' : ep < 0 ? 'bg-[var(--danger-bg)]' : 'bg-[var(--border)]/30';
            return (
              <div
                key={s.id}
                className="card group p-5 space-y-3 cursor-default transition-[box-shadow,transform] duration-[250ms] ease-[cubic-bezier(.4,0,.2,1)] hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${typeBadge.cls}`}>
                      {typeBadge.label}
                    </span>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text)] truncate">{s.symbol}</h3>
                    <span className="text-sm text-[var(--text-secondary)] truncate">{s.name}</span>
                  </div>
                  <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <Button variant="ghost" size="icon" onClick={() => { setForm({ symbol: s.symbol, name: s.name, stockType: s.stockType, note: s.note }); setEditId(s.id); setFormError(''); setAddDialogOpen(true); }}>
                      <Edit3 size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-[var(--danger)]" onClick={() => setDeleteId(s.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>

                {/* Metrics grid */}
                <div className="border-t border-[var(--border)] pt-3 grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                  <div>
                    <span className="text-[var(--text-muted)]">持有股數</span>
                    <p className="font-medium text-[var(--text)]">{Number(s.totalShares).toLocaleString()} 股</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">目前股價</span>
                    <p className="font-medium text-[var(--text)]">{s.currentPrice > 0 ? `$${Number(s.currentPrice).toLocaleString()}` : '—'}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">成本均價</span>
                    <p className="font-medium text-[var(--text)]">${Number(s.avgCost || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)]">市值</span>
                    <p className="font-medium text-[var(--text)]">{fmt(s.marketValue)}</p>
                  </div>
                </div>

                {/* P&L block */}
                <div className={`${plBg} rounded-lg p-3 flex items-center justify-between gap-2`}>
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">預估損益</p>
                    <p className={`text-base font-bold ${plClass(ep)}`}>
                      {fmtPL(ep)}
                      <span className="ml-1.5 text-sm font-semibold">{ep !== 0 ? `(${rr >= 0 ? '+' : ''}${rr.toFixed(2)}%)` : ''}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-[var(--text-muted)] mb-0.5">累計股利</p>
                    <p className="text-sm font-semibold text-[var(--today)]">{fmt(s.totalDividend)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
