// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../lib/db';
import { getUserExchangeRateMap, getExchangeRateSettings, parseCurrencyCode } from '../../../lib/accountHelpers';
import { isValidCurrency } from '../../../lib/iso4217';
import { FX_AUTO_SYNC_MIN_INTERVAL_MS, syncExchangeRatesFromGlobalAPI } from '../../../lib/exchangeRateHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const settings = getExchangeRateSettings(auth.userId);
  const shouldAutoSync = settings.autoUpdate
    && (!settings.lastSyncedAt || (Date.now() - settings.lastSyncedAt) >= FX_AUTO_SYNC_MIN_INTERVAL_MS);

  if (shouldAutoSync) {
    try {
      await syncExchangeRatesFromGlobalAPI(auth.userId, []);
    } catch (e) {
      console.warn('[匯率] 自動更新失敗:', e.message);
    }
  }

  const map = getUserExchangeRateMap(auth.userId);
  const rates = Object.keys(map).sort().map(currency => ({ currency, rateToTwd: map[currency] }));
  const freshSettings = getExchangeRateSettings(auth.userId);
  return NextResponse.json({ rates, settings: freshSettings });
}

export async function PUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const rates = Array.isArray(body?.rates) ? body.rates : null;
  if (!rates || rates.length === 0) return NextResponse.json({ error: '請提供匯率資料' }, { status: 400 });

  const upserts = [{ currency: 'TWD', rateToTwd: 1 }];
  const seen = new Set(['TWD']);

  for (const r of rates) {
    const currency = parseCurrencyCode(r.currency);
    if (!currency) return NextResponse.json({ error: '幣別格式不正確（需為 3 碼英文字母）' }, { status: 400 });
    if (!isValidCurrency(currency)) return NextResponse.json({ error: '不是有效的 ISO 4217 幣別代碼', currency }, { status: 400 });
    const rate = Number(r.rateToTwd);
    if (seen.has(currency)) return NextResponse.json({ error: `幣別重複：${currency}` }, { status: 400 });
    seen.add(currency);
    if (currency !== 'TWD' && !(rate > 0 && rate < 1000000)) {
      return NextResponse.json({ error: `${currency} 匯率格式不正確` }, { status: 400 });
    }
    upserts.push({ currency, rateToTwd: currency === 'TWD' ? 1 : rate });
  }

  const now = Date.now();
  const db = getDB();
  upserts.forEach(item => {
    db.run(
      `INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, updated_at = excluded.updated_at, is_manual = 1`,
      [auth.userId, item.currency, item.rateToTwd, now]
    );
  });
  const keepCurrencies = upserts.map(item => item.currency);
  const placeholders = keepCurrencies.map(() => '?').join(', ');
  db.run(`DELETE FROM exchange_rates WHERE user_id = ? AND currency NOT IN (${placeholders})`, [auth.userId, ...keepCurrencies]);
  saveDB();

  const map = getUserExchangeRateMap(auth.userId);
  const updatedRates = Object.keys(map).sort().map(currency => ({ currency, rateToTwd: map[currency] }));
  const settings = getExchangeRateSettings(auth.userId);
  return NextResponse.json({ rates: updatedRates, settings });
}
