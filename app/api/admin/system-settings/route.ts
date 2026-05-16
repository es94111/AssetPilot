// @ts-nocheck
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
  const lineLoginEnabled = !!body?.lineLoginEnabled;
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

  let transactionPhotoStorage = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'transactionPhotoStorage')) {
    const candidate = String(body.transactionPhotoStorage || '').trim();
    if (!['', 'local', 's3'].includes(candidate)) {
      return NextResponse.json({ error: 'transactionPhotoStorage 必須為 local、s3 或空字串' }, { status: 400 });
    }
    transactionPhotoStorage = candidate;
  }

  let transactionPhotoMaxBytes: number | null = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'transactionPhotoMaxBytes')) {
    const candidate = Number(body.transactionPhotoMaxBytes);
    if (!Number.isFinite(candidate) || candidate < 0) {
      return NextResponse.json({ error: 'transactionPhotoMaxBytes 必須為非負整數（0 表示使用環境變數預設值）' }, { status: 400 });
    }
    transactionPhotoMaxBytes = Math.floor(candidate);
  }

  const db = getDB();
  const fields = [
    'public_registration = ?', 'line_login_enabled = ?', 'allowed_registration_emails = ?',
    'admin_ip_allowlist = ?',
  ];
  const values: (string | number | null)[] = [
    publicRegistration ? 1 : 0, lineLoginEnabled ? 1 : 0,
    allowedRegistrationEmails.join('\n'), adminIpAllowlist.join('\n'),
  ];
  if (routeAuditMode !== null) { fields.push('route_audit_mode = ?'); values.push(routeAuditMode); }
  if (transactionPhotoStorage !== null) { fields.push('transaction_photo_storage = ?'); values.push(transactionPhotoStorage); }
  if (transactionPhotoMaxBytes !== null) { fields.push('transaction_photo_max_bytes = ?'); values.push(transactionPhotoMaxBytes); }
  fields.push('updated_at = ?', 'updated_by = ?');
  values.push(Date.now(), auth.userId);

  db.run(`UPDATE system_settings SET ${fields.join(', ')} WHERE id = 1`, values);
  saveDB();

  const currentSettings = getSystemSettings();
  return NextResponse.json({
    success: true,
    publicRegistration,
    lineLoginEnabled,
    allowedRegistrationEmails,
    adminIpAllowlist,
    routeAuditMode: routeAuditMode ?? currentSettings.routeAuditMode,
    transactionPhotoStorage: transactionPhotoStorage ?? currentSettings.transactionPhotoStorage,
    transactionPhotoMaxBytes: transactionPhotoMaxBytes ?? currentSettings.transactionPhotoMaxBytes,
  });
}
