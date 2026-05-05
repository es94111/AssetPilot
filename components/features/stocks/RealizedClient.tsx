'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '@/lib/clientApi';
import StocksTabNav from './StocksTabNav';
import { Select } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';

function fmt(n: number | string) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }
function fmtPL(n: number | string) {
  const num = Math.round(Number(n) || 0);
  return `${num > 0 ? '+' : ''}NT$ ${num.toLocaleString('zh-TW')}`;
}
function plClass(n: number | string) {
  const num = Number(n) || 0;
  return num > 0 ? 'text-green-600' : num < 0 ? 'text-red-600' : '';
}

export default function RealizedClient() {
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [stocks, setStocks] = useState<any[]>([]);
  const [filterStockId, setFilterStockId] = useState('');
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
      <h2 className="text-2xl font-bold">實現損益</h2>
      <StocksTabNav />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '總實現損益', value: fmtPL(totalPL), color: plClass(totalPL) },
          { label: '整體報酬率', value: overallRate !== null ? `${overallRate >= 0 ? '+' : ''}${overallRate}%` : '—', color: plClass(overallRate || 0) },
          { label: '今年實現損益', value: fmtPL(yearPL), color: plClass(yearPL) },
          { label: '已實現筆數', value: `${filtered.length} 筆` },
        ].map((item, i) => (
          <div key={i} className="p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className={`text-xl font-semibold ${item.color || 'text-slate-900'}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 p-4 bg-white border border-slate-200 rounded-lg shadow-sm">
        <Select options={stocks.map(s => ({ label: `${s.symbol} ${s.name}`, value: s.id }))} value={filterStockId} onChange={e => setFilterStockId(e.target.value)} label="股票" className="w-48" />
        {filterStockId && <Button variant="outline" onClick={() => setFilterStockId('')}>清除</Button>}
      </div>

      {loading ? <p className="text-slate-500">載入中...</p> : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日期</TableHead><TableHead>股票</TableHead><TableHead>股數</TableHead><TableHead>賣出均價</TableHead><TableHead>成本均價</TableHead><TableHead>手續費+稅</TableHead><TableHead>實現損益</TableHead><TableHead>報酬率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r, i) => (
              <TableRow key={r.id || i}>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.symbol} {r.name}</TableCell>
                <TableCell>{Number(r.shares).toLocaleString()}</TableCell>
                <TableCell>${Number(r.sellPrice).toLocaleString()}</TableCell>
                <TableCell>${Number(r.costPerShare || 0).toLocaleString()}</TableCell>
                <TableCell>{fmt(r.feeAndTax ?? ((r.fee || 0) + (r.tax || 0)))}</TableCell>
                <TableCell className={plClass(r.realizedPL)}>{fmtPL(r.realizedPL)}</TableCell>
                <TableCell className={plClass(r.returnRate)}>{r.returnRate >= 0 ? '+' : ''}{Number(r.returnRate || 0).toFixed(2)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
