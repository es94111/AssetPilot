// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getUserExchangeRateMap, getExchangeRateSettings } from '../../../../lib/accountHelpers';
import { syncExchangeRatesFromGlobalAPI } from '../../../../lib/exchangeRateHelpers';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const requestedCurrencies = Array.isArray(body?.currencies) ? body.currencies : [];
    const result = await syncExchangeRatesFromGlobalAPI(auth.userId, requestedCurrencies);
    const map = getUserExchangeRateMap(auth.userId);
    const rates = Object.keys(map).sort().map(currency => ({ currency, rateToTwd: map[currency] }));
    const settings = getExchangeRateSettings(auth.userId);
    let message = `已更新 ${result.updatedRates.length} 筆匯率`;
    if (result.unsupportedCurrencies.length > 0) {
      message += `；${result.unsupportedCurrencies.join('、')} 因不被全球 API 支援而無法自動更新，可手動輸入匯率`;
    }
    return NextResponse.json({ rates, settings, updatedAt: result.updatedAt, message });
  } catch (e) {
    return NextResponse.json({ error: e.message || '更新即時匯率失敗' }, { status: 500 });
  }
}
