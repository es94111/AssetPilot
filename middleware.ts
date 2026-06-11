// middleware.ts — Next.js Edge Middleware：JWT 驗證 + in-memory 速率限制
import { NextResponse, NextRequest } from 'next/server';

// ── 公開端點（不需驗證）──
const PUBLIC_PATHS = new Set([
  '/login',
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
]);

// passkey 端點前綴
const PUBLIC_PREFIXES = ['/api/auth/passkey/'];

// Next.js 內部路由 + 靜態資源
const SKIP_PREFIXES = ['/_next/', '/favicon.', '/logo.'];

// ── in-memory 速率限制（Edge runtime 可用）──
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 分鐘
const RATE_LIMIT_MAX = 600; // 全域 API：每 IP 每窗口最多 600 次
const AUTH_RATE_LIMIT_MAX = 20; // 認證端點：每 IP 每窗口最多 20 次

const AUTH_RATE_LIMITED_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/line',
  '/api/auth/line/authorize',
  '/api/auth/passkey/challenge',
  '/api/auth/passkey/login',
]);
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Map<ip, { count: number, resetAt: number }> */
const globalRateLimitMap = new Map<string, RateLimitEntry>();
const authRateLimitMap = new Map<string, RateLimitEntry>();

function checkRateLimit(map: Map<string, RateLimitEntry>, ip: string, max: number): boolean {
  const now = Date.now();
  let entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    map.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= max;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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

export function middleware(request: NextRequest): NextResponse {
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
  // middleware 主要職責：防止未帶 cookie 的裸請求直達受保護頁面。
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
};
