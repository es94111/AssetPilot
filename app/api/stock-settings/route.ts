// @ts-nocheck
import { withLedgerWriteAudit } from "../../../lib/ledgerContext";
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../lib/db';
import { getStockSettings, normalizeStockSettingsInput } from '../../../lib/stockHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const settings = getStockSettings(auth.userId);
  return NextResponse.json(settings);
}

async function handlePUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));

  try {
    const current = getStockSettings(auth.userId);
    const normalized = normalizeStockSettingsInput(body, current);
    const db = getDB();
    db.run(
      `INSERT INTO stock_settings
       (user_id, fee_rate, fee_discount, fee_min_lot, fee_min_odd, sell_tax_rate_stock,
        sell_tax_rate_etf, sell_tax_rate_warrant, sell_tax_min, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
        fee_rate = excluded.fee_rate, fee_discount = excluded.fee_discount,
        fee_min_lot = excluded.fee_min_lot, fee_min_odd = excluded.fee_min_odd,
        sell_tax_rate_stock = excluded.sell_tax_rate_stock,
        sell_tax_rate_etf = excluded.sell_tax_rate_etf,
        sell_tax_rate_warrant = excluded.sell_tax_rate_warrant,
        sell_tax_min = excluded.sell_tax_min, updated_at = excluded.updated_at`,
      [
        auth.userId,
        normalized.feeRate,
        normalized.feeDiscount,
        normalized.feeMinLot,
        normalized.feeMinOdd,
        normalized.sellTaxRateStock,
        normalized.sellTaxRateEtf,
        normalized.sellTaxRateWarrant,
        normalized.sellTaxMin,
        Date.now(),
      ]
    );
    saveDB();
    return NextResponse.json(normalized);
  } catch (e) {
    return NextResponse.json({ error: e.message || '股票設定更新失敗' }, { status: 400 });
  }
}

export const PUT = withLedgerWriteAudit(handlePUT);
