// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const updates = Array.isArray(body.updates)
    ? body.updates
    : Array.isArray(body.prices)
      ? body.prices.map(p => ({ stockId: p.stockId || p.id, currentPrice: p.currentPrice }))
      : null;

  if (!updates) return NextResponse.json({ error: '無效資料' }, { status: 400 });

  const db = getDB();
  let updated = 0;
  const nowIso = new Date().toISOString();

  for (const u of updates) {
    const stockId = u.stockId || u.id;
    if (!stockId) continue;
    const existing = queryOne('SELECT id, current_price FROM stocks WHERE id = ? AND user_id = ?', [stockId, auth.userId]);
    if (!existing) continue;
    const currentPrice = Number.isFinite(Number(u.currentPrice))
      ? Number(u.currentPrice)
      : Number(existing.current_price || 0);
    if (typeof u.delisted === 'boolean') {
      db.run(
        'UPDATE stocks SET current_price = ?, delisted = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [currentPrice, u.delisted ? 1 : 0, nowIso, stockId, auth.userId]
      );
    } else {
      db.run(
        'UPDATE stocks SET current_price = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [currentPrice, nowIso, stockId, auth.userId]
      );
    }
    updated += 1;
  }
  saveDB();

  return NextResponse.json({ ok: true, updated });
}
