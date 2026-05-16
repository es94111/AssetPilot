// lib/loginHelpers.ts — 登入稽核、IP 查詢、系統設定等共用邏輯
import crypto from 'crypto';
import { getDB, queryOne, saveDB } from './db';

const IPINFO_TOKEN = process.env.IPINFO_TOKEN || '';
const IP_COUNTRY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時
const ipCountryCache = new Map<string, { country: string; at: number }>();

const ENV_ADMIN_IP_ALLOWLIST = parseIpAllowlist(process.env.ADMIN_IP_ALLOWLIST || '');

export interface SystemSettings {
  publicRegistration: boolean;
  allowedRegistrationEmails: string[];
  adminIpAllowlist: string[];
  routeAuditMode: 'security' | 'extended' | 'minimal';
  lineLoginEnabled: boolean;
  transactionPhotoStorage: 'local' | 's3' | null;
}

export interface LoginAuditResult {
  id: string;
  loginAt: number;
  ipAddress: string;
  loginMethod: string;
  isAdminLogin: boolean;
}

export interface LoginAttemptArgs {
  user?: { id?: string; email?: string; is_admin?: number } | null;
  email?: string;
  headers: Headers | Record<string, string | undefined>;
  method?: string;
  isSuccess?: boolean;
  failureReason?: string;
}

// ── 工具函式 ──

export function uid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

export function normalizeIp(ip: string | null | undefined): string {
  return String(ip || '').trim().toLowerCase().replace(/^::ffff:/, '');
}

function isPrivateOrLocalIp(ip: string): boolean {
  const v = String(ip || '').trim().toLowerCase();
  if (!v || v === 'unknown') return true;
  if (v === '::1' || v === 'localhost') return true;
  if (v.startsWith('127.') || v.startsWith('10.') || v.startsWith('192.168.') || v.startsWith('169.254.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80:')) return true;
  return false;
}

export function parseIpAllowlist(value: string | string[]): string[] {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return Array.from(new Set(
    source.split(/[\n,;\s]+/).map(v => normalizeIp(v)).filter(Boolean)
  ));
}

export function parseAllowedRegistrationEmails(value: string | string[]): string[] {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return Array.from(new Set(
    source.split(/[\n,;\s]+/).map(v => String(v || '').trim().toLowerCase()).filter(v => isValidEmail(v) || /^\*@[a-z0-9.-]+\.[a-z]{2,}$/.test(v))
  ));
}

export function matchAllowlist(email: string, rawList: string | string[]): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const list = Array.isArray(rawList) ? rawList : parseAllowedRegistrationEmails(rawList);
  for (const item of list) {
    if (!item) continue;
    if (item.startsWith('*@')) {
      if (normalized.endsWith(item.slice(1))) return true;
      continue;
    }
    if (item === normalized) return true;
  }
  return false;
}

export function isValidEmail(email: string | null | undefined): boolean {
  const s = normalizeEmail(email);
  if (!s || s.length > 254) return false;
  if (s.includes('..')) return false;
  const at = s.indexOf('@');
  if (at <= 0 || at !== s.lastIndexOf('@') || at >= s.length - 1) return false;
  const [, domain] = s.split('@');
  if (!domain || !domain.includes('.')) return false;
  return true;
}

// ── IP 工具 ──

type HeadersLike = Headers | Record<string, string | undefined>;

function getHeader(headers: HeadersLike, key: string): string {
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(key) || '';
  }
  return (headers as Record<string, string | undefined>)[key] || '';
}

/** NextRequest headers 版本 */
export function getRequestIpFromHeaders(headers: HeadersLike): string {
  const forwardedFor = String(getHeader(headers, 'x-forwarded-for')).split(',')[0].trim();
  const realIp = getHeader(headers, 'x-real-ip');
  const rawIp = forwardedFor || realIp || '';
  return rawIp ? normalizeIp(rawIp) : 'unknown';
}

export function getCountryFromHeaders(headers: HeadersLike): string | null {
  const cfCountry = String(getHeader(headers, 'cf-ipcountry')).trim().toUpperCase();
  if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') return cfCountry;
  return null;
}

export async function fetchIpCountry(ipAddress: string): Promise<string> {
  const ip = String(ipAddress || '').trim();
  if (!ip || ip === 'unknown') return '-';
  if (isPrivateOrLocalIp(ip)) return 'LOCAL';
  const cached = ipCountryCache.get(ip);
  const now = Date.now();
  if (cached && (now - cached.at) < IP_COUNTRY_CACHE_TTL_MS) return cached.country;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const tokenQuery = IPINFO_TOKEN ? `?token=${encodeURIComponent(IPINFO_TOKEN)}` : '';
    const r = await fetch(`https://ipinfo.io/${encodeURIComponent(ip)}/json${tokenQuery}`, { signal: controller.signal });
    if (!r.ok) { ipCountryCache.set(ip, { country: '-', at: now }); return '-'; }
    const data = await r.json();
    const country = String(data?.country || '').trim().toUpperCase() || '-';
    ipCountryCache.set(ip, { country, at: now });
    return country;
  } catch (_) {
    ipCountryCache.set(ip, { country: '-', at: now });
    return '-';
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── 系統設定 ──

export function getSystemSettings(): SystemSettings {
  const row = queryOne('SELECT public_registration, allowed_registration_emails, admin_ip_allowlist, route_audit_mode, line_login_enabled, transaction_photo_storage FROM system_settings WHERE id = 1') || {
    public_registration: 1,
    allowed_registration_emails: '',
    admin_ip_allowlist: '',
    route_audit_mode: 'security',
    line_login_enabled: 0,
    transaction_photo_storage: '',
  };
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(String(row.allowed_registration_emails || ''));
  const dbAdminIpAllowlist = parseIpAllowlist(String(row.admin_ip_allowlist || ''));
  const mergedAdminIpAllowlist = Array.from(new Set([...ENV_ADMIN_IP_ALLOWLIST, ...dbAdminIpAllowlist]));
  const rawMode = String(row.route_audit_mode || 'security');
  const routeAuditMode = (['security', 'extended', 'minimal'] as const).includes(rawMode as 'security')
    ? rawMode as SystemSettings['routeAuditMode'] : 'security';
  const rawStorage = String(row.transaction_photo_storage || '').trim();
  const transactionPhotoStorage = (rawStorage === 'local' || rawStorage === 's3') ? rawStorage : null;
  return {
    publicRegistration: !!row.public_registration,
    allowedRegistrationEmails,
    adminIpAllowlist: mergedAdminIpAllowlist,
    routeAuditMode,
    lineLoginEnabled: !!row.line_login_enabled,
    transactionPhotoStorage,
  };
}

export function getUserCount(): number {
  const row = queryOne('SELECT COUNT(1) AS count FROM users');
  return Number(row?.count || 0);
}

export function canSelfRegister(email: string): { ok: boolean; error?: string } {
  const emailLower = normalizeEmail(email);
  if (!emailLower) return { ok: false, error: '電子郵件格式不正確' };
  if (getUserCount() === 0) return { ok: true };
  const settings = getSystemSettings();
  const allowList = settings.allowedRegistrationEmails;
  if (allowList.length > 0) {
    if (matchAllowlist(emailLower, allowList)) return { ok: true };
    return { ok: false, error: '此 Email 未被管理員允許註冊' };
  }
  if (!settings.publicRegistration) return { ok: false, error: '目前已關閉公開註冊，請聯絡管理員建立帳號' };
  return { ok: true };
}

// ── 登入稽核 ──

export function recordLoginAudit(
  user: { id?: string; email?: string; is_admin?: number } | null | undefined,
  headers: HeadersLike,
  method = 'password'
): LoginAuditResult | null {
  if (!user?.id) return null;
  const loginId = uid();
  const loginAt = Date.now();
  const ipAddress = getRequestIpFromHeaders(headers);
  const loginMethod = String(method || 'password').trim().toLowerCase();
  const isAdminLogin = user.is_admin ? 1 : 0;
  const cfCountry = getCountryFromHeaders(headers);
  const db = getDB();
  db.run(
    `INSERT INTO login_audit_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, country) VALUES (?,?,?,?,?,?,?,?)`,
    [loginId, user.id, normalizeEmail(user.email), loginAt, ipAddress, loginMethod, isAdminLogin, cfCountry]
  );
  saveDB();
  if (!cfCountry) {
    fetchIpCountry(ipAddress).then(country => {
      if (country) {
        getDB().run('UPDATE login_audit_logs SET country = ? WHERE id = ?', [country, loginId]);
        saveDB();
      }
    }).catch(() => {});
  }
  return { id: loginId, loginAt, ipAddress, loginMethod, isAdminLogin: !!isAdminLogin };
}

export function recordLoginAttempt({ user = null, email = '', headers, method = 'password', isSuccess = false, failureReason = '' }: LoginAttemptArgs): void {
  const loginAt = Date.now();
  const safeHeaders = (headers || {}) as HeadersLike;
  const ipAddress = getRequestIpFromHeaders(safeHeaders);
  const loginMethod = String(method || 'password').trim().toLowerCase();
  const normalizedEmail = normalizeEmail(email || user?.email || '');
  const userId = user?.id ? String(user.id) : '';
  const isAdminLogin = user?.is_admin ? 1 : 0;
  const attemptId = uid();
  const cfCountry = getCountryFromHeaders(safeHeaders);
  const db = getDB();
  db.run(
    `INSERT INTO login_attempt_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, is_success, failure_reason, country) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [attemptId, userId, normalizedEmail, loginAt, ipAddress, loginMethod, isAdminLogin, isSuccess ? 1 : 0, isSuccess ? '' : String(failureReason || 'unknown').trim().toLowerCase(), cfCountry]
  );
  saveDB();
  if (!cfCountry) {
    fetchIpCountry(ipAddress).then(country => {
      if (country) {
        getDB().run('UPDATE login_attempt_logs SET country = ? WHERE id = ?', [country, attemptId]);
        saveDB();
      }
    }).catch(() => {});
  }
}
