import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import {
  getStockSettings,
  calcStockTax,
} from '../../../../lib/stockHelpers';

export async function PUT(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, currentPrice, stockType } = body;

  const s = queryOne('SELECT * FROM stocks WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!s) return NextResponse.json({ error: '?∠巨銝??? }, { status: 404 });

  const validTypes = ['stock', 'etf', 'warrant'];
  const type = validTypes.includes(stockType) ? stockType : (s.stock_type || 'stock');
  const typeChanged = type !== s.stock_type;

  const db = getDB();
  db.run(
    'UPDATE stocks SET name = ?, current_price = ?, stock_type = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [name || s.name, currentPrice != null ? currentPrice : s.current_price, type, new Date().toISOString(), id, auth.userId]
  );

  let recalculated = 0;
  if (typeChanged) {
    const settings = getStockSettings(auth.userId);
    const historicalSells = queryAll(
      "SELECT id, shares, price FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'sell' AND COALESCE(tax_auto_calculated, 1) = 1",
      [auth.userId, id]
    );
    historicalSells.forEach(t => {
      const amount = Number(t.shares) * Number(t.price);
      const newTax = calcStockTax(amount, type, settings);
      db.run('UPDATE stock_transactions SET tax = ? WHERE id = ?', [newTax, t.id]);
      recalculated += 1;
    });
  }
  saveDB();

  return NextResponse.json({ ok: true, recalculated });
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const s = queryOne('SELECT id FROM stocks WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!s) return NextResponse.json({ error: '?∠巨銝??? }, { status: 404 });

  const db = getDB();
  db.run('DELETE FROM stock_transactions WHERE stock_id = ? AND user_id = ?', [id, auth.userId]);
  db.run('DELETE FROM stock_dividends WHERE stock_id = ? AND user_id = ?', [id, auth.userId]);
  db.run('DELETE FROM stocks WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}
