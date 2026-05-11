// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

export async function PATCH(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const r = queryOne('SELECT is_active FROM stock_recurring WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!r) return NextResponse.json({ error: '定期定額不存在' }, { status: 404 });

  getDB().run('UPDATE stock_recurring SET is_active = ? WHERE id = ? AND user_id = ?', [r.is_active ? 0 : 1, id, auth.userId]);
  saveDB();
  return NextResponse.json({ isActive: !r.is_active });
}
