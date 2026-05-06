import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll } from '../../../lib/db';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const stockId = searchParams.get('stockId') || '';

  let stocks = queryAll('SELECT * FROM stocks WHERE user_id = ?', [auth.userId]);
  if (stockId) stocks = stocks.filter(s => s.id === stockId);

  const realized = [];
  stocks.forEach(s => {
    const txs = queryAll(
      'SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at',
      [s.id, auth.userId]
    );
    const lots = [];
    txs.forEach(t => {
      if (t.type === 'buy') {
        lots.push({ shares: t.shares, price: t.price, fee: t.fee || 0 });
      } else {
        let remaining = t.shares, totalCost = 0;
        while (remaining > 0 && lots.length > 0) {
          const lot = lots[0];
          const used = Math.min(remaining, lot.shares);
          totalCost += used * lot.price + (lot.fee * used / lot.shares);
          lot.shares -= used;
          lot.fee = lot.fee * (lot.shares / (lot.shares + used));
          remaining -= used;
          if (lot.shares <= 0) lots.shift();
        }
        const sellRevenue = t.shares * t.price - (t.fee || 0) - (t.tax || 0);
        const realizedPL = sellRevenue - totalCost;
        const costPerShare = t.shares > 0 ? totalCost / t.shares : 0;
        const returnRate = totalCost > 0 ? (realizedPL / totalCost * 100) : 0;
        realized.push({
          id: t.id, date: t.date, stockId: s.id, symbol: s.symbol, name: s.name,
          shares: t.shares, sellPrice: t.price, fee: t.fee || 0, tax: t.tax || 0,
          sellRevenue: Math.round(sellRevenue), costPerShare: Math.round(costPerShare * 100) / 100,
          totalCost: Math.round(totalCost), realizedPL: Math.round(realizedPL),
          returnRate: Math.round(returnRate * 100) / 100,
        });
      }
    });
  });

  realized.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json(realized);
}
