import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { ids } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '請選擇要刪除的紀錄' }, { status: 400 });
  }

  // Reject synthetic stock dividend transactions
  for (const id of ids) {
    const t = queryOne('SELECT note FROM stock_transactions WHERE id = ? AND user_id = ?', [id, auth.userId]);
    if (t && typeof t.note === 'string' && /^\[SYNTH\] 股票股利|股票股利配發/.test(t.note)) {
      return NextResponse.json(
        { error: '股票股利合成交易必須透過刪除對應股利紀錄連動處理，請至「股利紀錄」頁刪除' },
        { status: 400 }
      );
    }
  }

  const db = getDB();
  let deleted = 0;
  ids.forEach(id => {
    db.run('DELETE FROM stock_transactions WHERE id = ? AND user_id = ?', [id, auth.userId]);
    deleted += db.getRowsModified();
  });
  saveDB();

  return NextResponse.json({ deleted });
}
