import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '../../../../../../lib/apiHelpers.js';
import { getDB, queryOne, saveDB } from '../../../../../../lib/db.js';

function validateStrongPassword(password) {
  const p = String(password || '');
  if (p.length < 8) return '密碼長度至少 8 個字元';
  if (!/[A-Z]/.test(p)) return '密碼必須包含至少一個大寫字母';
  if (!/[a-z]/.test(p)) return '密碼必須包含至少一個小寫字母';
  if (!/[0-9]/.test(p)) return '密碼必須包含至少一個數字';
  if (!/[^A-Za-z0-9]/.test(p)) return '密碼必須包含至少一個特殊字元';
  return null;
}

export async function PUT(request, { params }) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const user = queryOne('SELECT id, password_hash FROM users WHERE id = ?', [id]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const newPassword = String(body?.newPassword || '');
  if (!newPassword) return NextResponse.json({ error: '缺少 newPassword' }, { status: 400 });

  const pwError = validateStrongPassword(newPassword);
  if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });

  const newHash = await bcrypt.hash(newPassword, 12);
  const db = getDB();
  db.run(
    'UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1, updated_at = ? WHERE id = ?',
    [newHash, Date.now(), id]
  );
  saveDB();

  return NextResponse.json({ ok: true });
}
