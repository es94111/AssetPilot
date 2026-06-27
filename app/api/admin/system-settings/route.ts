// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { getSystemSettings, parseAllowedRegistrationEmails, parseIpAllowlist } from '../../../../lib/loginHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';

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

  let stockAutoUpdateEnabled: number | null = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'stockAutoUpdateEnabled')) {
    stockAutoUpdateEnabled = body.stockAutoUpdateEnabled ? 1 : 0;
  }

  let stockAutoUpdateIntervalMin: number | null = null;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'stockAutoUpdateIntervalMin')) {
    const candidate = Number(body.stockAutoUpdateIntervalMin);
    if (!Number.isInteger(candidate) || candidate < 1 || candidate > 1440) {
      return NextResponse.json({ error: 'stockAutoUpdateIntervalMin 必須為 1 ~ 1440 的整數（分鐘）' }, { status: 400 });
    }
    stockAutoUpdateIntervalMin = candidate;
  }

  // 變更前快照，用於稽核「哪些設定被改動」。
  const before = getSystemSettings();

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
  if (stockAutoUpdateEnabled !== null) { fields.push('stock_auto_update_enabled = ?'); values.push(stockAutoUpdateEnabled); }
  if (stockAutoUpdateIntervalMin !== null) { fields.push('stock_auto_update_interval_min = ?'); values.push(stockAutoUpdateIntervalMin); }
  fields.push('updated_at = ?', 'updated_by = ?');
  values.push(Date.now(), auth.userId);

  db.run(`UPDATE system_settings SET ${fields.join(', ')} WHERE id = 1`, values);
  saveDB();

  const currentSettings = getSystemSettings();

  // 敏感操作：變更系統設定。詳記實際被改動的欄位（不含敏感值內容，僅欄位名稱）。
  const changed: string[] = [];
  if (before.publicRegistration !== publicRegistration) changed.push('publicRegistration');
  if (before.lineLoginEnabled !== lineLoginEnabled) changed.push('lineLoginEnabled');
  if (before.allowedRegistrationEmails.join('\n') !== allowedRegistrationEmails.join('\n')) changed.push('allowedRegistrationEmails');
  if (before.adminIpAllowlist.join('\n') !== adminIpAllowlist.join('\n')) changed.push('adminIpAllowlist');
  if (routeAuditMode !== null && before.routeAuditMode !== routeAuditMode) changed.push('routeAuditMode');
  if (transactionPhotoStorage !== null && before.transactionPhotoStorage !== (transactionPhotoStorage || null)) changed.push('transactionPhotoStorage');
  if (transactionPhotoMaxBytes !== null && before.transactionPhotoMaxBytes !== (transactionPhotoMaxBytes || null)) changed.push('transactionPhotoMaxBytes');
  if (stockAutoUpdateEnabled !== null && before.stockAutoUpdateEnabled !== !!stockAutoUpdateEnabled) changed.push('stockAutoUpdateEnabled');
  if (stockAutoUpdateIntervalMin !== null && before.stockAutoUpdateIntervalMin !== stockAutoUpdateIntervalMin) changed.push('stockAutoUpdateIntervalMin');
  if (changed.length > 0) {
    auditSensitiveAction(request, auth, {
      action: 'admin.system_settings.update',
      metadata: { changed_fields: changed.join(', ') },
    });
  }
  return NextResponse.json({
    success: true,
    publicRegistration,
    lineLoginEnabled,
    allowedRegistrationEmails,
    adminIpAllowlist,
    routeAuditMode: routeAuditMode ?? currentSettings.routeAuditMode,
    transactionPhotoStorage: transactionPhotoStorage ?? currentSettings.transactionPhotoStorage,
    transactionPhotoMaxBytes: transactionPhotoMaxBytes ?? currentSettings.transactionPhotoMaxBytes,
    stockAutoUpdateEnabled: currentSettings.stockAutoUpdateEnabled,
    stockAutoUpdateIntervalMin: currentSettings.stockAutoUpdateIntervalMin,
  });
}
