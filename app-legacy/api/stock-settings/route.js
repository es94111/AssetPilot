import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../lib/db';
import { getStockSettings, normalizeStockSettingsInput } from '../../../lib/stockHelpers';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const settings = getStockSettings(auth.userId);
  return NextResponse.json(settings);
}

export async function PUT(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));

  try {
    const current = getStockSettings(auth.userId);
    const normalized = normalizeStockSettingsInput(body, current);
    const db = getDB();
    db.run(
      `UPDATE stock_settings
      SET fee_rate = ?, fee_discount = ?, fee_min_lot = ?, fee_min_odd = ?,
          sell_tax_rate_stock = ?, sell_tax_rate_etf = ?, sell_tax_rate_warrant = ?, sell_tax_min = ?, updated_at = ?
      WHERE user_id = ?`,
      [
        normalized.feeRate,
        normalized.feeDiscount,
        normalized.feeMinLot,
        normalized.feeMinOdd,
        normalized.sellTaxRateStock,
        normalized.sellTaxRateEtf,
        normalized.sellTaxRateWarrant,
        normalized.sellTaxMin,
        Date.now(),
        auth.userId,
      ]
    );
    saveDB();
    return NextResponse.json(normalized);
  } catch (e) {
    return NextResponse.json({ error: e.message || '股票設定更新失敗' }, { status: 400 });
  }
}
