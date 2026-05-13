import { NextResponse } from 'next/server';
import { requireAuth as getAuth } from './auth';
import { verifyToken } from './auth';
import { queryOne } from './db';
import { verifyLoginSession } from './sessionHelpers';
import { processRecurringForUser } from './recurringHelpers';
import { todayInUserTz } from './userTime';
import { getRequestIpFromHeaders, getSystemSettings, normalizeIp } from './loginHelpers';
import logger from '@/lib/logger';

type ApiAuthResult = {
  userId: string;
  userTimezone: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  themeMode: string;
  sessionId?: string;
};

const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const recurringChecks = new Map<string, string>();

function processDueRecurringOncePerDay(userId: string, userTimezone: string) {
  const today = todayInUserTz(userTimezone || 'Asia/Taipei');
  const version = queryOne(
    'SELECT COALESCE(MAX(updated_at), 0) AS updated_at FROM recurring WHERE user_id = ?',
    [userId]
  );
  const cacheKey = `${today}:${version?.updated_at || 0}`;
  if (recurringChecks.get(userId) === cacheKey) return;
  recurringChecks.set(userId, cacheKey);

  try {
    processRecurringForUser(userId);
  } catch (e) {
    recurringChecks.delete(userId);
    logger.error({ err: e, userId }, 'Failed to process due recurring transactions');
  }
}

function getRequestOriginCandidates(request: any): Set<string> {
  const candidates = new Set<string>();
  try {
    if (request?.url) candidates.add(new URL(request.url).origin);
  } catch (_) {}

  const host = request?.headers?.get?.('x-forwarded-host') || request?.headers?.get?.('host') || '';
  if (host) {
    const proto = request?.headers?.get?.('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    candidates.add(`${proto}://${host}`);
  }
  return candidates;
}

function normalizeOrigin(originValue: string): string {
  const u = new URL(originValue);
  return `${u.protocol}//${u.host}`;
}

function isOriginAllowed(originValue: string, request?: any): boolean {
  if (!originValue) return false;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  try {
    const normalized = normalizeOrigin(originValue);
    if (allowedOrigins.length === 0) {
      return getRequestOriginCandidates(request).has(normalized);
    }
    return allowedOrigins.includes(normalized) || allowedOrigins.includes(originValue);
  } catch {
    return false;
  }
}

function isAdminIpAllowed(request: any): boolean {
  const allowlist = getSystemSettings().adminIpAllowlist;
  if (allowlist.length === 0) return true;
  const ip = normalizeIp(getRequestIpFromHeaders(request?.headers || {}));
  return allowlist.includes(ip);
}

function csrfErrorResponse(): NextResponse {
  return NextResponse.json({ error: '請求來源不被允許（CSRF 防護）' }, { status: 403 });
}

function authErrorResponse(message: string): NextResponse {
  const response = NextResponse.json({ error: message }, { status: 401 });
  response.cookies.delete('authToken');
  return response;
}

export function requireAuth(request: any): Promise<ApiAuthResult | NextResponse>;
export function requireAuth(): Promise<string>;
export async function requireAuth(request?: any): Promise<ApiAuthResult | NextResponse | string> {
  if (request) {
    const token = request.cookies?.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    const method = String(request.method || 'GET').toUpperCase();
    const authHeader = request.headers?.get?.('authorization') || '';
    const usesCookieAuth = !authHeader.startsWith('Bearer ');
    if (usesCookieAuth && !CSRF_SAFE_METHODS.has(method)) {
      const origin = request.headers?.get?.('origin') || request.headers?.get?.('referer') || '';
      if (!isOriginAllowed(origin, request)) return csrfErrorResponse();
    }

    let userId: string;
    let tokenVersion: number;
    let sessionId = '';
    try {
      const decoded = verifyToken(token) as { userId?: string; tokenVersion?: number; sessionId?: string };
      userId = String(decoded?.userId || '');
      tokenVersion = Number(decoded?.tokenVersion) || 0;
      sessionId = decoded?.sessionId ? String(decoded.sessionId) : '';
    } catch {
      return authErrorResponse('登入已失效');
    }

    const user = queryOne(
      'SELECT id, email, display_name, is_admin, theme_mode, timezone, token_version FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return authErrorResponse('使用者不存在');
    }

    const dbVersion = Number(user.token_version) || 0;
    if (tokenVersion !== dbVersion) {
      return authErrorResponse('登入已失效，請重新登入');
    }
    if (!verifyLoginSession(userId, sessionId, token)) {
      return authErrorResponse('登入已失效，請重新登入');
    }

    const authResult = {
      userId: user.id as string,
      userTimezone: (user.timezone as string) || 'Asia/Taipei',
      email: (user.email as string) || '',
      displayName: (user.display_name as string) || '',
      isAdmin: !!user.is_admin,
      themeMode: (user.theme_mode as string) || 'system',
      sessionId,
    };
    processDueRecurringOncePerDay(authResult.userId, authResult.userTimezone);
    return authResult;
  }

  return getAuth();
}

export async function fetchFromExpressApi(endpoint: string) {
  const session = await requireAuth();
  const url = `http://localhost:${process.env.PORT || 3000}${endpoint}`;
  
  const res = await fetch(url, {
    headers: {
      Cookie: `authToken=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ status: res.status, url }, 'Failed to fetch from Express API');
    throw new Error('Failed to fetch from API');
  }

  return res.json();
}

export function formatUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin: !!user.is_admin,
    themeMode: user.theme_mode,
    hasPassword: !!user.has_password,
    googleLinked: !!user.google_id,
    lineLinked: !!user.line_id,
    avatarUrl: user.avatar_url || '',
  };
}

export function setAuthCookie(response: any, token: string) {
  response.cookies.set('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

export function clearAuthCookie(response?: any) {
  if (response?.cookies) {
    response.cookies.delete('authToken');
    return response;
  }
}

export function requireAdmin(request: any): Promise<ApiAuthResult | NextResponse>;
export function requireAdmin(): Promise<string>;
export async function requireAdmin(request?: any): Promise<ApiAuthResult | NextResponse | string> {
  if (request) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
    }
    if (!isAdminIpAllowed(request)) {
      return NextResponse.json({ error: '此 IP 不允許存取管理員功能' }, { status: 403 });
    }
    return auth;
  }

  return getAuth();
}

export function normalizeThemeMode(mode: string) {
  const v = String(mode || '').trim().toLowerCase();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}
