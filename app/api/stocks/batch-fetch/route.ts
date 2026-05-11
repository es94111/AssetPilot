// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll } from '../../../../lib/db';
import {
  fetchTwseRealtime,
  fetchTwseStockDay,
  fetchTpexStockDay,
  fetchAllWithLimit,
} from '../../../../lib/twseFetchNext';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const stocks = queryAll(
    "SELECT id, symbol, name FROM stocks WHERE user_id = ? AND COALESCE(delisted, 0) = 0",
    [auth.userId]
  );
  if (stocks.length === 0) return NextResponse.json({ results: [] });

  const today = new Date();
  const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

  const fetcher = async (s) => {
    let info = await fetchTwseRealtime(s.symbol);
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTwseStockDay(s.symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTpexStockDay(s.symbol, todayYmd);
    }
    if (info && info.found && info.closingPrice > 0) {
      return {
        stockId: s.id, symbol: s.symbol, status: 'ok',
        currentPrice: info.closingPrice,
        priceSource: info.priceSource || (info.isRealtime ? 'realtime' : 'close'),
        priceType: info.priceType || '',
        fetchedAt: new Date().toISOString(),
      };
    }
    return { stockId: s.id, symbol: s.symbol, status: 'failed', error: '查詢失敗' };
  };

  try {
    const settled = await fetchAllWithLimit(stocks, fetcher);
    const results = settled.map(r =>
      r.ok ? r.value : { stockId: r.item.id, symbol: r.item.symbol, status: 'failed', error: r.error }
    );
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: '批次查價失敗：' + e.message }, { status: 500 });
  }
}
