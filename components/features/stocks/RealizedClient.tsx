'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { apiGet } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';

function localeTag(locale: string) { return locale === 'en' ? 'en-US' : 'zh-TW'; }
function fmt(n: number | string, locale: string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString(localeTag(locale)); }
function fmtPL(n: number | string, locale: string) {
  const num = Math.round(Number(n) || 0);
  return `${num > 0 ? '+' : ''}NT$ ${num.toLocaleString(localeTag(locale))}`;
}
function plClass(n: number | string) {
  const num = Number(n) || 0;
  return num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : '';
}

export default function RealizedClient(_props: { user?: any } = {}) {
  const { t, locale } = useT();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.toString();
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [filterStockId, setFilterStockId] = useState(() => searchParams.get('stockId') || '');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resp, stockResp] = await Promise.all([
        apiGet('/api/stock-realized-pl'),
        apiGet('/api/stocks').catch(() => []),
      ]);
      const stockList = Array.isArray(stockResp) ? stockResp : (stockResp?.stocks || []);
      setStocks(stockList);

      const allEntries = Array.isArray(resp?.entries) ? resp.entries : [];
      const normalized = allEntries.map((e: any) => ({
        id: e.transactionId,
        date: e.sellDate,
        stockId: e.stockId,
        symbol: e.symbol,
        name: e.name,
        shares: e.shares,
        sellPrice: e.sellPrice,
        feeAndTax: e.feeAndTax,
        costPerShare: e.costPrice,
        totalCost: e.totalCost,
        realizedPL: e.realizedPL,
        returnRate: e.returnRate,
      }));
      setRecords(normalized);
      setSummary(resp?.summary || null);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const nextStockId = searchParams.get('stockId') || '';
    if (nextStockId !== filterStockId) setFilterStockId(nextStockId);
  }, [currentQuery]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStockId) params.set('stockId', filterStockId);
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
    if (nextQuery !== currentQuery) router.replace(nextUrl, { scroll: false });
  }, [currentQuery, filterStockId, pathname, router]);

  const filtered = filterStockId ? records.filter(r => r.stockId === filterStockId) : records;

  const thisYear = new Date().getFullYear().toString();
  const totalPL = summary ? summary.totalRealizedPL : filtered.reduce((s, r) => s + (Number(r.realizedPL) || 0), 0);
  const totalCost = filtered.reduce((s, r) => s + (Number(r.totalCost) || 0), 0);
  const overallRate = (summary && !filterStockId) && summary.overallReturnRate !== null
    ? summary.overallReturnRate
    : (totalCost > 0 ? Math.round(totalPL / totalCost * 10000) / 100 : null);
  const yearPL = (summary && !filterStockId)
    ? summary.ytdRealizedPL
    : filtered.filter(r => (r.date || '').startsWith(thisYear)).reduce((s, r) => s + (Number(r.realizedPL) || 0), 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{t('features.stocks.realized.title')}</h2>
      <StocksTabNav />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('features.stocks.common.totalRealizedPL'), value: fmtPL(totalPL, locale), color: plClass(totalPL) },
          { label: t('features.stocks.common.overallReturnRate'), value: overallRate !== null ? `${overallRate >= 0 ? '+' : ''}${overallRate}%` : t('features.common.notRecorded'), color: plClass(overallRate || 0) },
          { label: t('features.stocks.common.yearRealizedPL'), value: fmtPL(yearPL, locale), color: plClass(yearPL) },
          { label: t('features.stocks.common.realizedCount'), value: t('features.stocks.common.recordsCount', { count: filtered.length }) },
        ].map((item, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className={`text-xl font-semibold ${item.color || 'text-slate-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 p-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-lg shadow-sm">
        <Select options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={filterStockId} onChange={e => setFilterStockId(e.target.value)} label={t('features.stocks.common.stockLabel')} className="w-48" />
        {filterStockId && <Button variant="outline" onClick={() => setFilterStockId('')}>{t('common.clear')}</Button>}
      </div>

      {loading ? <p className="text-slate-500">{t('common.loading')}</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('features.common.date')}</TableHead><TableHead>{t('features.common.stock')}</TableHead><TableHead>{t('features.stocks.common.shares')}</TableHead><TableHead>{t('features.stocks.common.sellAverage')}</TableHead><TableHead>{t('features.stocks.common.costAverage')}</TableHead><TableHead>{t('features.stocks.common.feeAndTax')}</TableHead><TableHead>{t('features.stocks.common.realizedPL')}</TableHead><TableHead>{t('features.stocks.common.returnRate')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={r.id || i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.symbol} {r.name}</TableCell>
                <TableCell>{Number(r.shares).toLocaleString(localeTag(locale))}</TableCell>
                <TableCell>${Number(r.sellPrice).toLocaleString(localeTag(locale))}</TableCell>
                <TableCell>${Number(r.costPerShare || 0).toLocaleString(localeTag(locale))}</TableCell>
                <TableCell>{fmt(r.feeAndTax ?? ((r.fee || 0) + (r.tax || 0)), locale)}</TableCell>
                <TableCell className={plClass(r.realizedPL)}>{fmtPL(r.realizedPL, locale)}</TableCell>
                <TableCell className={plClass(r.returnRate)}>{r.returnRate >= 0 ? '+' : ''}{Number(r.returnRate || 0).toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
