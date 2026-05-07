import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { getSystemSettings, parseAllowedRegistrationEmails, parseIpAllowlist } from '../../../../lib/loginHelpers';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const settings = getSystemSettings();
  return NextResponse.json(settings);
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const publicRegistration = !!body?.publicRegistration;
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(body?.allowedRegistrationEmails);
  const adminIpAllowlist = parseIpAllowlist(body?.adminIpAllowlist);

  let routeAuditMode = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'routeAuditMode')) {
    const candidate = String(body.routeAuditMode || '');
    if (!['security', 'extended', 'minimal'].includes(candidate)) {
      return NextResponse.json({ error: 'routeAuditMode 必須為 security、extended 或 minimal' }, { status: 400 });
    }
    routeAuditMode = candidate;
  }

  const db = getDB();
  if (routeAuditMode) {
    db.run(
      'UPDATE system_settings SET public_registration = ?, allowed_registration_emails = ?, admin_ip_allowlist = ?, route_audit_mode = ?, updated_at = ?, updated_by = ? WHERE id = 1',
      [publicRegistration ? 1 : 0, allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'), routeAuditMode, Date.now(), auth.userId]
    );
  } else {
    db.run(
      'UPDATE system_settings SET public_registration = ?, allowed_registration_emails = ?, admin_ip_allowlist = ?, updated_at = ?, updated_by = ? WHERE id = 1',
      [publicRegistration ? 1 : 0, allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'), Date.now(), auth.userId]
    );
  }
  saveDB();

  const currentSettings = getSystemSettings();
  return NextResponse.json({
    success: true,
    publicRegistration,
    allowedRegistrationEmails,
    adminIpAllowlist,
    routeAuditMode: routeAuditMode || currentSettings.routeAuditMode,
  });
}
