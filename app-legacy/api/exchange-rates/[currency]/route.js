import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getUserExchangeRateMap } from '../../../../lib/accountHelpers';
import { isValidCurrency } from '../../../../lib/iso4217';
import { fxCache } from '../../../../lib/exchangeRateHelpers';

export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { currency: rawCurrency } = await params;
  const currency = String(rawCurrency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json({ error: 'ValidationError', field: 'currency', message: '幣別需為 3 碼大寫英文' }, { status: 400 });
  }
  if (!isValidCurrency(currency)) {
    return NextResponse.json({ error: '不是有效的 ISO 4217 幣別代碼', currency }, { status: 400 });
  }
  if (currency === 'TWD') {
    return NextResponse.json({ currency: 'TWD', rateToTwd: '1', fetchedAt: Date.now(), source: 'literal', cached: true });
  }

  try {
    const result = await fxCache.getRate(currency);
    return NextResponse.json({
      currency,
      rateToTwd: result.rate,
      fetchedAt: result.fetchedAt || Date.now(),
      source: result.source || 'exchangerate-api',
      cached: !!result.cached,
    });
  } catch (e) {
    const map = getUserExchangeRateMap(auth.userId);
    const fallback = map[currency];
    if (fallback) {
      return NextResponse.json({ currency, rateToTwd: String(fallback), fetchedAt: Date.now(), source: 'user-db', cached: true });
    }
    return NextResponse.json({ error: 'RateUnavailable', message: '匯率暫不可用，請手動輸入' }, { status: 503 });
  }
}
