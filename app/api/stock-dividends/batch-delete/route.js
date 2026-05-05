import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { ids } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '請選擇要刪除的紀錄' }, { status: 400 });
  }

  const db = getDB();
  let deleted = 0;
  let linkedDeleted = 0;

  ids.forEach(id => {
    const old = queryOne('SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?', [id, auth.userId]);
    if (!old) return;

    if (Number(old.stock_dividend_shares) > 0) {
      const targetShares = Number(old.stock_dividend_shares);
      const synth = queryAll(
        "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '%股票股利配發%')",
        [auth.userId, old.stock_id, old.date]
      );
      synth.forEach(t => {
        if (Math.abs(Number(t.shares) - targetShares) < 0.001) {
          db.run('DELETE FROM stock_transactions WHERE id = ?', [t.id]);
          linkedDeleted += 1;
        }
      });
    }

    db.run('DELETE FROM stock_dividends WHERE id = ? AND user_id = ?', [id, auth.userId]);
    deleted += db.getRowsModified();
  });
  saveDB();

  return NextResponse.json({ deleted, linkedDeleted });
}
