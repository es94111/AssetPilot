import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { fetchTwseRealtime, fetchTwseStockDay, fetchTpexStockDay, fetchTwseStockAll } from '../../../../../lib/twseFetchNext';

function formatTwseDate(yyyymmdd) {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  return `${yyyymmdd.slice(0, 4)}/${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;
}

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { symbol: rawSymbol } = await params;
  const symbol = String(rawSymbol || '').trim();
  if (!symbol) return NextResponse.json({ error: '請輸入股票代號' }, { status: 400 });
  if (!/^[A-Z0-9]{2,10}$/i.test(symbol)) return NextResponse.json({ error: '股票代號格式不正確' }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const useRealtime = searchParams.get('realtime') === '1';
  const dateParam = String(searchParams.get('date') || '').replace(/\D/g, '');

  try {
    if (useRealtime) {
      const rt = await fetchTwseRealtime(symbol);
      if (rt && rt.found && rt.closingPrice > 0) return NextResponse.json(rt);
    }
    if (dateParam.length === 8) {
      const sd = await fetchTwseStockDay(symbol, dateParam);
      if (sd && sd.found && sd.closingPrice > 0) return NextResponse.json(sd);
      const tpex = await fetchTpexStockDay(symbol, dateParam);
      if (tpex && tpex.found && tpex.closingPrice > 0) return NextResponse.json(tpex);
    }
    const allStocks = await fetchTwseStockAll();
    const stock = allStocks.find(s => s.Code === symbol);
    if (!stock) return NextResponse.json({ found: false });
    const isTpex = stock._source === 'tpex';
    return NextResponse.json({
      found: true, symbol: stock.Code, name: stock.Name,
      closingPrice: parseFloat(stock.ClosingPrice) || 0,
      openingPrice: parseFloat(stock.OpeningPrice) || 0,
      highestPrice: parseFloat(stock.HighestPrice) || 0,
      lowestPrice: parseFloat(stock.LowestPrice) || 0,
      change: parseFloat(stock.Change) || 0,
      volume: parseInt(stock.TradeVolume) || 0,
      isRealtime: false,
      priceType: isTpex ? '收盤價（櫃買）' : '收盤價',
      dataDate: formatTwseDate(stock.Date || ''),
      dataTime: '',
    });
  } catch (e) {
    return NextResponse.json({ error: '查詢失敗：' + e.message }, { status: 500 });
  }
}
