// proxy.ts — Next.js Proxy：JWT 驗證 + in-memory 速率限制
import { NextResponse, NextRequest } from 'next/server';
import { getClientIpFromHeaders } from './lib/requestIp';
import { checkRateLimit as checkRateLimitSafe } from './lib/rateLimit';

// ── 公開端點（不需驗證）──
const PUBLIC_PATHS = new Set([
  '/login',
  '/mcp',
  '/privacy',
  '/terms',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/google/state',
  '/api/auth/line',
  '/api/auth/line/authorize',
  '/api/auth/line/state',
  '/api/app/auth-ticket/exchange',
  '/api/line/webhook',
  '/api/config',
  '/api/i18n/locale',
  '/api/mcp',
]);

// passkey / MCP OAuth 端點前綴
const PUBLIC_PREFIXES = ['/api/auth/passkey/', '/api/oauth/'];

// Next.js 內部路由 + 靜態資源
const SKIP_PREFIXES = ['/_next/', '/favicon.', '/logo.'];

// ── in-memory 速率限制（Edge runtime 可用）──
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 分鐘
const RATE_LIMIT_MAX = 600; // 全域 API：每 IP 每窗口最多 600 次
const AUTH_RATE_LIMIT_MAX = 20; // 認證端點：每 IP 每窗口最多 20 次
const OAUTH_RATE_LIMIT_MAX = 100; // OAuth authorize/token/revoke：每 IP 每窗口最多 100 次
const OAUTH_AUTHORIZE_PAGE_RATE_LIMIT_MAX = 30; // 授權頁可能需要擷取 CIMD，限制匿名 outbound metadata 查詢
const OAUTH_REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const OAUTH_REGISTRATION_RATE_LIMIT_MAX = 20; // DCR：每 IP 每小時最多 20 次

const AUTH_RATE_LIMITED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/line',
  '/api/auth/line/authorize',
  '/api/auth/passkey/challenge',
  '/api/auth/passkey/login',
]);
const OAUTH_RATE_LIMITED_PATHS = new Set([
  '/api/oauth/authorize',
  '/api/oauth/token',
  '/api/oauth/revoke',
]);
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Map<ip, { count: number, resetAt: number }> */
const globalRateLimitMap = new Map<string, RateLimitEntry>();
const authRateLimitMap = new Map<string, RateLimitEntry>();
const oauthRateLimitMap = new Map<string, RateLimitEntry>();
const oauthAuthorizePageRateLimitMap = new Map<string, RateLimitEntry>();
const oauthRegistrationRateLimitMap = new Map<string, RateLimitEntry>();

// 委派給 lib/rateLimit.ts（含 Map 容量上限保護）與 lib/requestIp.ts
// （信任代理策略見該檔頭註解；預設取 XFF 最後一段，需搭配會覆寫 XFF 的反向
// 代理才能防止客戶端偽造來源 IP 繞過下方速率限制 — 見安全報告 AUTH-VULN-06）。
function checkRateLimit(
  map: Map<string, RateLimitEntry>,
  ip: string,
  max: number,
  windowMs = RATE_LIMIT_WINDOW_MS
): boolean {
  return checkRateLimitSafe(map, ip, max, windowMs);
}

function getClientIp(request: NextRequest): string {
  return getClientIpFromHeaders(request.headers);
}

function getRequestOriginCandidates(request: NextRequest): Set<string> {
  const candidates = new Set<string>([request.nextUrl.origin]);
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  if (host) {
    const proto = request.headers.get('x-forwarded-proto') || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    candidates.add(`${proto}://${host}`);
  }
  return candidates;
}

function normalizeOrigin(originValue: string): string {
  const u = new URL(originValue);
  return `${u.protocol}//${u.host}`;
}

function isOriginAllowed(originValue: string, request: NextRequest): boolean {
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

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.has(pathname) || PUBLIC_PREFIXES.some(p => pathname.startsWith(p));

  // 略過 Next.js 內部路由與靜態資源
  if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const ip = getClientIp(request);

  // 認證端點速率限制（較嚴格）
  if (AUTH_RATE_LIMITED_PATHS.has(pathname)) {
    if (!checkRateLimit(authRateLimitMap, ip, AUTH_RATE_LIMIT_MAX)) {
      return NextResponse.json(
        { error: '登入嘗試次數過多，請 15 分鐘後再試' },
        { status: 429 }
      );
    }
  }

  if (OAUTH_RATE_LIMITED_PATHS.has(pathname)) {
    if (!checkRateLimit(oauthRateLimitMap, ip, OAUTH_RATE_LIMIT_MAX)) {
      return NextResponse.json(
        { error: 'too_many_requests', error_description: 'OAuth 請求過於頻繁，請稍後再試' },
        { status: 429 }
      );
    }
  }

  if (pathname === '/oauth/authorize') {
    if (!checkRateLimit(oauthAuthorizePageRateLimitMap, ip, OAUTH_AUTHORIZE_PAGE_RATE_LIMIT_MAX)) {
      return NextResponse.json(
        { error: 'too_many_requests', error_description: 'OAuth 授權請求過於頻繁，請稍後再試' },
        { status: 429 }
      );
    }
  }

  if (pathname === '/api/oauth/register') {
    if (!checkRateLimit(
      oauthRegistrationRateLimitMap,
      ip,
      OAUTH_REGISTRATION_RATE_LIMIT_MAX,
      OAUTH_REGISTRATION_WINDOW_MS
    )) {
      return NextResponse.json(
        { error: 'too_many_requests', error_description: 'MCP client 註冊請求過於頻繁，請稍後再試' },
        { status: 429 }
      );
    }
  }

  // 全域 API 速率限制
  if (pathname.startsWith('/api/')) {
    if (!checkRateLimit(globalRateLimitMap, ip, RATE_LIMIT_MAX)) {
      return NextResponse.json(
        { error: '請求過於頻繁，請稍後再試' },
        { status: 429 }
      );
    }

    const method = request.method.toUpperCase();
    const authHeader = request.headers.get('authorization') || '';
    const usesCookieAuth = !authHeader.startsWith('Bearer ') && !!request.cookies.get('authToken')?.value;
    if (!isPublicPath && usesCookieAuth && !CSRF_SAFE_METHODS.has(method)) {
      const origin = request.headers.get('origin') || request.headers.get('referer') || '';
      if (!isOriginAllowed(origin, request)) {
        return NextResponse.json({ error: '請求來源不被允許（CSRF 防護）' }, { status: 403 });
      }
    }
  }

  // 公開端點不需 JWT 驗證
  if (isPublicPath) return NextResponse.next();

  // 不需保護的非 API 路徑（靜態頁面等）——只保護已知的 app 路徑 + API
  const PROTECTED_PREFIXES = [
    '/dashboard', '/accounts', '/transactions', '/categories',
    '/budgets', '/reports', '/stocks', '/settings', '/admin',
    '/api/',
  ];
  const needsAuth = PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  // 讀取 authToken Cookie
  const token = request.cookies.get('authToken')?.value;
  if (!token) {
    // API 路由返回 401；頁面路由 redirect 至 /login
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: '請先登入' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Edge runtime 無法用 jsonwebtoken（Node.js only）；
  // 僅做基本存在性檢查，完整驗證由各 API Route Handler 的 authMiddleware 負責。
  // proxy 主要職責：防止未帶 cookie 的裸請求直達受保護頁面。
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
