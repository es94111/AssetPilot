// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll } from '../../../lib/db';
import { calcFifoLots } from '../../../lib/moneyDecimal';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const stocks = queryAll('SELECT * FROM stocks WHERE user_id = ?', [auth.userId]);
  const entries = [];

  stocks.forEach(s => {
    const txs = queryAll(
      'SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at',
      [s.id, auth.userId]
    );
    const fifo = calcFifoLots(txs);
    fifo.sellEntries.forEach(entry => {
      const t = entry.tx;
      entries.push({
        transactionId: t.id, sellDate: t.date, stockId: s.id, symbol: s.symbol, name: s.name,
        shares: Number(t.shares), sellPrice: Number(t.price),
        costPrice: Math.round(entry.costPerShare.toNumber() * 100) / 100,
        feeAndTax: Math.round(Number(t.fee || 0) + Number(t.tax || 0)),
        sellRevenue: Math.round(entry.sellRevenue.toNumber()),
        totalCost: Math.round(entry.totalCost.toNumber()),
        realizedPL: Math.round(entry.realizedPL.toNumber()),
        returnRate: Math.round(entry.returnRate.toNumber() * 100) / 100,
      });
    });
  });

  entries.sort((a, b) => b.sellDate.localeCompare(a.sellDate));
  const totalRealizedPL = entries.reduce((s, e) => s + e.realizedPL, 0);
  const totalCostSum = entries.reduce((s, e) => s + e.totalCost, 0);
  const overallReturnRate = totalCostSum > 0 ? Math.round(totalRealizedPL / totalCostSum * 10000) / 100 : null;
  const thisYear = String(new Date().getFullYear());
  const ytdRealizedPL = entries.filter(e => e.sellDate.startsWith(thisYear)).reduce((s, e) => s + e.realizedPL, 0);

  return NextResponse.json({ entries, summary: { totalRealizedPL, overallReturnRate, ytdRealizedPL, count: entries.length } });
}
