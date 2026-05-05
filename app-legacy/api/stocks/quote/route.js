import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import {
  fetchTwseRealtime,
  fetchTwseStockDay,
  fetchTpexStockDay,
  fetchTwseStockAll,
} from '../../../../lib/twseFetchNext';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const symbol = String(searchParams.get('symbol') || '').trim();

  if (!/^[0-9A-Za-z]{1,8}$/.test(symbol)) {
    return NextResponse.json({ status: 'invalid', error: '股票代號格式不正確' }, { status: 400 });
  }

  try {
    const today = new Date();
    const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;

    let info = await fetchTwseRealtime(symbol);
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTwseStockDay(symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTpexStockDay(symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      try {
        const all = await fetchTwseStockAll();
        const stock = all.find(s => s.Code === symbol);
        if (stock) {
          info = {
            found: true, symbol: stock.Code, name: stock.Name,
            closingPrice: parseFloat(stock.ClosingPrice) || 0,
            isRealtime: false,
            priceType: stock._source === 'tpex' ? '收盤價（櫃買）' : '收盤價',
            priceSource: 'close',
          };
        }
      } catch (_) { /* fall through */ }
    }

    if (info && info.found && info.closingPrice > 0) {
      return NextResponse.json({
        status: 'ok',
        symbol: info.symbol || symbol,
        name: info.name || symbol,
        currentPrice: info.closingPrice,
        priceSource: info.priceSource || (info.isRealtime ? 'realtime' : 'close'),
        priceType: info.priceType || '',
        dataDate: info.dataDate || '',
        dataTime: info.dataTime || '',
      });
    }

    return NextResponse.json({ status: 'not_found', error: '找不到此股票代號' });
  } catch (e) {
    return NextResponse.json(
      { status: 'service_unavailable', error: '股價服務暫時無法回應：' + e.message },
      { status: 503 }
    );
  }
}
