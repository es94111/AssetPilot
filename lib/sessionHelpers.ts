import crypto from 'crypto';
import { signToken } from './auth';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { describeDevice, getAppDeviceIdFromHeaders, getRequestIpFromHeaders, getUserAgentFromHeaders, uid } from './loginHelpers';

type HeadersLike = Headers | Record<string, string | undefined>;

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function detectDeviceName(userAgent: string): string {
  const ua = String(userAgent || '');
  const platform = /iPad/i.test(ua) ? 'iPad'
    : /iPhone/i.test(ua) ? 'iPhone'
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Macintosh|Mac OS X/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux'
    : '未知裝置';
  const browser = /Edg\//i.test(ua) ? 'Edge'
    : /Chrome\//i.test(ua) && !/Chromium/i.test(ua) ? 'Chrome'
    : /Firefox\//i.test(ua) ? 'Firefox'
    : /Safari\//i.test(ua) && !/Chrome\//i.test(ua) ? 'Safari'
    : '';
  return browser ? `${platform} / ${browser}` : platform;
}

function getTokenExpiresAt(token: string): number {
  const payload = token.split('.')[1] || '';
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number(decoded?.exp || 0) * 1000 || 0;
  } catch {
    return 0;
  }
}

export function createLoginSession(userId: string, tokenVersion: number, headers: HeadersLike): { token: string; sessionId: string } {
  const sessionId = uid();
  const token = signToken(userId, tokenVersion, sessionId);
  const userAgent = getUserAgentFromHeaders(headers);
  const appDeviceId = getAppDeviceIdFromHeaders(headers);
  const now = Date.now();
  getDB().run(
    `INSERT INTO login_sessions (id, user_id, token_hash, device_name, ip_address, user_agent, device_id, login_at, last_seen_at, expires_at, revoked_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,0)`,
    [sessionId, userId, hashToken(token), describeDevice(userAgent) || detectDeviceName(userAgent), getRequestIpFromHeaders(headers), userAgent, appDeviceId, now, now, getTokenExpiresAt(token)]
  );
  saveDB();
  return { token, sessionId };
}

export function verifyLoginSession(userId: string, sessionId: string | undefined, token: string): boolean {
  if (!sessionId) return false;
  const row = queryOne('SELECT token_hash, expires_at FROM login_sessions WHERE id = ? AND user_id = ? AND revoked_at = 0', [sessionId, userId]);
  if (row?.expires_at && Number(row.expires_at) <= Date.now()) return false;
  return !!row && String(row.token_hash || '') === hashToken(token);
}

export function listLoginSessions(userId: string, currentSessionId?: string) {
  const rows = queryAll(
    `SELECT id, device_name, ip_address, login_at, device_id FROM login_sessions
     WHERE user_id = ? AND revoked_at = 0 AND (expires_at = 0 OR expires_at > ?)
     ORDER BY login_at DESC`,
    [userId, Date.now()]
  );
  return rows.map(row => ({
    id: String(row.id || ''),
    deviceName: String(row.device_name || '未知裝置'),
    loginAt: Number(row.login_at) || 0,
    ipAddress: String(row.ip_address || 'unknown'),
    deviceId: String(row.device_id || ''),
    isCurrent: String(row.id || '') === String(currentSessionId || ''),
  }));
}

export function revokeLoginSession(userId: string, sessionId: string): boolean {
  const existing = queryOne('SELECT id FROM login_sessions WHERE id = ? AND user_id = ? AND revoked_at = 0', [sessionId, userId]);
  if (!existing) return false;
  getDB().run('UPDATE login_sessions SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at = 0', [Date.now(), sessionId, userId]);
  saveDB();
  return true;
}

export function revokeAllLoginSessions(userId: string): void {
  getDB().run('UPDATE login_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0', [Date.now(), userId]);
  saveDB();
}
