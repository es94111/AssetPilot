import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { amount } = body;

  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: '預算金額必須為正整數', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }
  const existing = queryOne('SELECT id FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!existing) return NextResponse.json({ error: '預算不存在或無權限', code: 'NotFound' }, { status: 404 });

  getDB().run('UPDATE budgets SET amount = ?, updated_at = ? WHERE id = ? AND user_id = ?', [amount, Date.now(), id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  getDB().run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}
