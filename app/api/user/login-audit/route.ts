// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll } from '../../../../lib/db';
import { describeDevice } from '../../../../lib/loginHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const logs = queryAll(
    `SELECT login_at, ip_address, country, login_method, is_admin_login, user_agent, device_id
     FROM login_audit_logs
     WHERE user_id = ?
     ORDER BY login_at DESC
     LIMIT 100`,
    [auth.userId]
  );

  return NextResponse.json({
    logs: logs.map(l => ({
      loginAt: Number(l.login_at) || 0,
      ipAddress: l.ip_address || 'unknown',
      country: l.country || '-',
      loginMethod: l.login_method || 'password',
      device: describeDevice(l.user_agent),
      deviceId: l.device_id || '',
      isAdminLogin: !!l.is_admin_login,
    })),
  });
}
