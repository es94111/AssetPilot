import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = requireAuth(request);
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

  updates.forEach(u => {
    const stockId = u.stockId || u.id;
    if (!stockId) return;
    if (typeof u.delisted === 'boolean') {
      db.run(
        'UPDATE stocks SET current_price = ?, delisted = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [Number(u.currentPrice) || 0, u.delisted ? 1 : 0, nowIso, stockId, auth.userId]
      );
    } else {
      db.run(
        'UPDATE stocks SET current_price = ?, updated_at = ? WHERE id = ? AND user_id = ?',
        [Number(u.currentPrice) || 0, nowIso, stockId, auth.userId]
      );
    }
    updated += db.getRowsModified();
  });
  saveDB();

  return NextResponse.json({ ok: true, updated });
}
