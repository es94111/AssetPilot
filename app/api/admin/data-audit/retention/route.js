import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db.js';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const row = queryOne('SELECT audit_log_retention_days FROM system_settings WHERE id = 1');
  return NextResponse.json({ retention_days: row?.audit_log_retention_days || '90' });
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const value = String(body?.retention_days || '');
  if (!['30', '90', '180', '365', 'forever'].includes(value)) {
    return NextResponse.json({ error: 'retention_days 必須為 30 / 90 / 180 / 365 / forever 之一' }, { status: 400 });
  }

  const db = getDB();
  db.run(
    'UPDATE system_settings SET audit_log_retention_days = ?, updated_at = ?, updated_by = ? WHERE id = 1',
    [value, Date.now(), auth.userId]
  );
  saveDB();

  return NextResponse.json({ ok: true, retention_days: value });
}
