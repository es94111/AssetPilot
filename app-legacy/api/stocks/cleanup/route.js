import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const stocks = queryAll('SELECT * FROM stocks WHERE user_id = ?', [auth.userId]);
  const db = getDB();
  let deleted = 0;

  stocks.forEach(s => {
    const hasTx = queryOne(
      'SELECT id FROM stock_transactions WHERE stock_id = ? AND user_id = ? LIMIT 1',
      [s.id, auth.userId]
    );
    const hasDiv = queryOne(
      'SELECT id FROM stock_dividends WHERE stock_id = ? AND user_id = ? LIMIT 1',
      [s.id, auth.userId]
    );
    if (!hasTx && !hasDiv) {
      db.run('DELETE FROM stocks WHERE id = ? AND user_id = ?', [s.id, auth.userId]);
      deleted++;
    }
  });

  if (deleted > 0) saveDB();

  return NextResponse.json({ deleted });
}
