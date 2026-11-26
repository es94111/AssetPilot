import { randomBytes, randomUUID } from 'node:crypto';
import { decryptSecret, encryptSecret } from './apiTokenCore';
import { getDB, queryOne } from './db';
import { getAppDeviceIdFromHeaders } from './loginHelpers';
import { hashToken, isLoginSessionFresh } from './sessionHelpers';
import { isActiveUserFlag } from './userActive';
import { GEMINI_NOTIFICATION_ENDPOINT, GEMINI_NOTIFICATION_MODEL, normalizeNotificationEndpoint } from './notificationRecognitionProvider';

export class NotificationSettingsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export function readNotificationSettings() {
  const row = queryOne('SELECT * FROM notification_ai_settings WHERE id = 1');
  return {
    endpoint: String(row?.endpoint ?? GEMINI_NOTIFICATION_ENDPOINT),
    model: String(row?.model ?? GEMINI_NOTIFICATION_MODEL),
    enabled: row?.enabled === 1,
    revision: String(row?.revision ?? ''),
    version: Number(row?.version ?? 0),
    encryptedKey: String(row?.key_encrypted ?? ''),
  };
}

function storageKey() {
  const key = (process.env.NOTIFICATION_AI_SETTINGS_KEY ?? '').trim();
  return /^[a-f\d]{64}$/iu.test(key) ? key.toLowerCase() : null;
}

export function adminNotificationSettings(settings = readNotificationSettings()) {
  return {
    endpoint: settings.endpoint,
    model: settings.model,
    enabled: settings.enabled,
    version: settings.version,
    hasApiKey: Boolean(settings.encryptedKey),
    canStoreKey: Boolean(storageKey()),
  };
}

export function getConfiguredNotificationProvider(settings = readNotificationSettings()) {
  const secret = storageKey();
  if (!secret || !settings.encryptedKey) return null;
  try {
    return { endpoint: settings.endpoint, model: settings.model, apiKey: decryptSecret(settings.encryptedKey, secret) };
  } catch {
    return null;
  }
}

export function saveNotificationSettings(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new NotificationSettingsError('設定格式無效。');
  const before = readNotificationSettings();
  const { endpoint, model, enabled, apiKey, version } = body as Record<string, unknown>;
  if (version !== before.version) throw new NotificationSettingsError('設定已被更新，請重新載入後再儲存。', 409);
  if (typeof model !== 'string' || !model.trim() || model.trim().length > 200 || /[\s\u0000-\u001f]/u.test(model.trim())
      || typeof enabled !== 'boolean'
      || (apiKey !== undefined && apiKey !== null && (typeof apiKey !== 'string' || !/^[\x21-\x7e]{1,1024}$/u.test(apiKey)))) {
    throw new NotificationSettingsError('請提供有效的模型名稱、啟用狀態及 API Key。');
  }

  let url: string;
  try { url = normalizeNotificationEndpoint(endpoint); }
  catch (error) { throw new NotificationSettingsError((error as Error).message); }

  let encryptedKey = before.encryptedKey;
  const secret = storageKey();
  if (typeof apiKey === 'string') {
    if (!secret) throw new NotificationSettingsError('請先在伺服器設定 NOTIFICATION_AI_SETTINGS_KEY。', 503);
    encryptedKey = encryptSecret(apiKey, secret);
  } else if (apiKey === null) {
    encryptedKey = '';
  } else if (url !== before.endpoint && encryptedKey) {
    throw new NotificationSettingsError('更換 API 網址時，請重新輸入 API Key。');
  }

  const cleanModel = model.trim();
  const sameDestination = url === before.endpoint && cleanModel === before.model;
  const proposed = {
    endpoint: url, model: cleanModel, enabled, encryptedKey,
    revision: sameDestination && before.revision ? before.revision : randomUUID(),
    version: before.version + 1,
  };
  if (enabled && !getConfiguredNotificationProvider(proposed)) {
    throw new NotificationSettingsError('啟用前請設定可使用的 API Key。');
  }
  const db = getDB();
  db.run(`INSERT INTO notification_ai_settings (id, endpoint, model, key_encrypted, enabled, revision, version)
          VALUES (1, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET endpoint = EXCLUDED.endpoint,
          model = EXCLUDED.model, key_encrypted = EXCLUDED.key_encrypted, enabled = EXCLUDED.enabled,
          revision = EXCLUDED.revision, version = EXCLUDED.version WHERE notification_ai_settings.version = ?`,
    [url, cleanModel, encryptedKey, enabled ? 1 : 0, proposed.revision, proposed.version, before.version]);
  if (!db.getRowsModified()) throw new NotificationSettingsError('設定已被更新，請重新載入後再儲存。', 409);
  return adminNotificationSettings(proposed);
}

export function issueCaptureToken(
  session: { userId: string; sessionId: string; tokenVersion: number },
  headers: Headers,
  revision: string,
): string | null {
  const deviceId = getAppDeviceIdFromHeaders(headers);
  if (!deviceId) return null;

  const token = `ap_notice_${randomBytes(32).toString('base64url')}`;
  const db = getDB();
  // Grant the same authenticated login epoch. A concurrent session revocation
  // or token-version change must never promote an old login to the new epoch.
  db.run(`INSERT INTO notification_capture_grants (session_id, token_hash, token_version, revision)
    SELECT l.id, ?, ?, ? FROM login_sessions l JOIN users u ON l.user_id = u.id
    WHERE l.id = ? AND l.user_id = ? AND l.device_id = ? AND l.revoked_at = 0
      AND u.is_active = 1 AND COALESCE(u.token_version, 0) = ?
    ON CONFLICT (session_id) DO UPDATE SET token_hash = EXCLUDED.token_hash,
    token_version = EXCLUDED.token_version, revision = EXCLUDED.revision`,
  [hashToken(token), session.tokenVersion, revision, session.sessionId, session.userId, deviceId, session.tokenVersion]);
  return db.getRowsModified() === 1 ? token : null;
}

export function revokeCaptureToken(sessionId: string) {
  getDB().run('DELETE FROM notification_capture_grants WHERE session_id = ?', [sessionId]);
}

export function authorizeNotificationCapture(header: string | null) {
  const token = /^Bearer (ap_notice_[\w-]{43})$/u.exec(header ?? '')?.[1];
  if (!token) return null;
  const row = queryOne(`SELECT c.revision, c.token_version AS grant_version, l.expires_at, l.last_seen_at,
    u.id AS user_id, u.is_active, u.timezone, u.token_version FROM notification_capture_grants c
    JOIN login_sessions l ON l.id = c.session_id JOIN users u ON l.user_id = u.id
    WHERE c.token_hash = ? AND l.revoked_at = 0`, [hashToken(token)]);
  if (!row || !isActiveUserFlag(row.is_active) || !isLoginSessionFresh(row)
      || Number(row.grant_version) !== (Number(row.token_version) || 0)) return null;
  return { userId: String(row.user_id), revision: String(row.revision), timezone: String(row.timezone || 'Asia/Taipei') };
}
