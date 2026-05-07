import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryAll, saveDB } from '../../../../lib/db';
import { fetchIpCountry } from '../../../../lib/loginHelpers';

async function enrichAndPersistCountry(rows, tableName) {
  const db = getDB();
  const needsCountry = rows.filter(r => !r.country);
  await Promise.all(needsCountry.map(async (r) => {
    const ip = r.ip_address;
    if (!ip || ip === 'unknown') return;
    try {
      const country = await fetchIpCountry(ip);
      if (country && country !== '-') {
        r.country = country;
        const rid = Number(r._rid);
        if (rid > 0) {
          db.run(`UPDATE ${tableName} SET country = ? WHERE rowid = ?`, [country, rid]);
        } else if (r.id) {
          db.run(`UPDATE ${tableName} SET country = ? WHERE id = ?`, [country, r.id]);
        }
      }
    } catch (_) {}
  }));
  if (needsCountry.length > 0) {
    try { saveDB(); } catch (_) {}
  }
  return rows;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const scope = String(searchParams.get('scope') || '').toLowerCase();

  if (scope === 'admin-self' || scope === 'admin_self') {
    const adminLogs = queryAll(
      `SELECT id, rowid AS _rid, login_at, ip_address, country, login_method
       FROM login_audit_logs
       WHERE user_id = ? AND is_admin_login = 1
       ORDER BY login_at DESC
       LIMIT 200`,
      [auth.userId]
    );
    const enriched = await enrichAndPersistCountry(adminLogs, 'login_audit_logs');
    return NextResponse.json({
      scope: 'admin-self',
      logs: enriched.map(l => ({
        id: l.id || (Number(l._rid) > 0 ? `rid:${Number(l._rid)}` : `ts:${Number(l.login_at) || 0}`),
        loginAt: Number(l.login_at) || 0,
        ipAddress: l.ip_address || 'unknown',
        country: l.country || '-',
        loginMethod: l.login_method || 'password',
      })),
    });
  }

  // default: scope = 'all'
  const allUserLogs = queryAll(
    `SELECT l.id, l.rowid AS _rid, l.user_id, l.email, l.login_at, l.ip_address, l.country, l.login_method, l.is_admin_login, l.is_success, l.failure_reason, u.display_name
     FROM login_attempt_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ORDER BY l.login_at DESC
     LIMIT 500`
  );
  const enriched = await enrichAndPersistCountry(allUserLogs, 'login_attempt_logs');
  return NextResponse.json({
    scope: 'all',
    logs: enriched.map(l => ({
      id: l.id || (Number(l._rid) > 0 ? `rid:${Number(l._rid)}` : `ts:${Number(l.login_at) || 0}`),
      userId: l.user_id,
      email: l.email || '',
      displayName: l.display_name || '',
      loginAt: Number(l.login_at) || 0,
      ipAddress: l.ip_address || 'unknown',
      country: l.country || '-',
      loginMethod: l.login_method || 'password',
      isAdminLogin: !!l.is_admin_login,
      isSuccess: !!l.is_success,
      failureReason: l.failure_reason || '',
    })),
  });
}
