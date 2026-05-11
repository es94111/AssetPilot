// @ts-nocheck
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth, normalizeThemeMode } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { isValidIanaTimezone, toIsoUtc } from '../../../../../lib/userTime';
import { getRequestIpFromHeaders } from '../../../../../lib/loginHelpers';

export async function PATCH(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { timezone, source } = body;

  if (!isValidIanaTimezone(timezone)) {
    return NextResponse.json(
      { error: '時區格式無效', code: 'ValidationError', field: 'timezone' },
      { status: 400 }
    );
  }

  const u = queryOne(
    'SELECT id, email, display_name, google_id, has_password, avatar_url, theme_mode, is_admin, is_active, created_at, timezone FROM users WHERE id = ?',
    [auth.userId]
  );
  if (!u) return NextResponse.json({ error: 'User not found', code: 'NotFound' }, { status: 404 });

  const prev = u.timezone || 'Asia/Taipei';

  if (prev !== timezone) {
    const db = getDB();
    const src = (source === 'manual' || source === 'auto-detect') ? source : 'manual';
    const now = new Date();

    db.run('UPDATE users SET timezone = ? WHERE id = ?', [timezone, auth.userId]);
    db.run(
      'INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [
        crypto.randomUUID().replace(/-/g, ''),
        auth.userId,
        'user',
        'user.timezone.update',
        getRequestIpFromHeaders(request.headers) || '',
        request.headers.get('user-agent') || '',
        now.toISOString(),
        'success',
        0,
        JSON.stringify({ from: prev, to: timezone, source: src }),
      ]
    );
    saveDB();
    u.timezone = timezone;
  }

  return NextResponse.json({
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    timezone: u.timezone,
    has_password: !!u.has_password,
    google_id: u.google_id || '',
    avatar_url: u.avatar_url || '',
    theme_mode: normalizeThemeMode(u.theme_mode),
    is_admin: !!u.is_admin,
    is_active: u.is_active == null ? true : !!u.is_active,
    created_at: toIsoUtc(u.created_at || new Date(0)),
    updated_at: toIsoUtc(new Date()),
  });
}
