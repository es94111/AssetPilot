// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { fetchTwseStockAll } from '../../../../lib/twseFetchNext';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = String(searchParams.get('q') || '').trim();
  if (!q) return NextResponse.json([]);
  if (q.length > 20) return NextResponse.json({ error: '查詢字串過長' }, { status: 400 });

  try {
    const allStocks = await fetchTwseStockAll();
    const results = allStocks
      .filter(s => s.Code.includes(q) || s.Name.includes(q))
      .slice(0, 10)
      .map(s => ({ symbol: s.Code, name: s.Name, closingPrice: parseFloat(s.ClosingPrice) || 0 }));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: '搜尋失敗：' + e.message }, { status: 500 });
  }
}
