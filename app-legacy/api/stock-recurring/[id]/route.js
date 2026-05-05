import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

function normalizeDate(dateStr) {
  const s = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function PUT(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const current = queryOne('SELECT id FROM stock_recurring WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!current) return NextResponse.json({ error: '定期定額不存在' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { stockId, amount, frequency, startDate: rawStartDate, accountId, note } = body;
  const startDate = normalizeDate(rawStartDate);
  const nAmount = Number(amount);
  const validFreq = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!stockId || !(nAmount > 0) || !startDate || !validFreq.includes(frequency)) {
    return NextResponse.json({ error: '欄位格式不正確' }, { status: 400 });
  }
  const stock = queryOne('SELECT id FROM stocks WHERE id = ? AND user_id = ?', [stockId, auth.userId]);
  if (!stock) return NextResponse.json({ error: '股票不存在' }, { status: 400 });

  getDB().run(
    'UPDATE stock_recurring SET stock_id = ?, amount = ?, frequency = ?, start_date = ?, account_id = ?, note = ? WHERE id = ? AND user_id = ?',
    [stockId, nAmount, frequency, startDate, accountId || '', note || '', id, auth.userId]
  );
  saveDB();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  getDB().run('DELETE FROM stock_recurring WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}
