import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAuth as getAuth } from './auth';
import { verifyToken } from './auth';
import { queryOne } from './db';
import logger from '@/lib/logger';

type ApiAuthResult = {
  userId: string;
  userTimezone: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  themeMode: string;
};

export function requireAuth(request: any): ApiAuthResult | NextResponse;
export function requireAuth(): Promise<string>;
export function requireAuth(request?: any) {
  if (request) {
    const token = request.cookies?.get('authToken')?.value;
    if (!token) {
      return NextResponse.json({ error: '未登入' }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = verifyToken(token) as { userId?: string };
      userId = String(decoded?.userId || '');
    } catch {
      return NextResponse.json({ error: '登入已失效' }, { status: 401 });
    }

    const user = queryOne(
      'SELECT id, email, display_name, is_admin, theme_mode, timezone FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return NextResponse.json({ error: '使用者不存在' }, { status: 401 });
    }

    return {
      userId: user.id,
      userTimezone: user.timezone || 'Asia/Taipei',
      email: user.email || '',
      displayName: user.display_name || '',
      isAdmin: !!user.is_admin,
      themeMode: user.theme_mode || 'system',
    };
  }

  return getAuth();
}

export async function fetchFromExpressApi(endpoint: string) {
  const session = await requireAuth();
  const url = `http://localhost:3000${endpoint}`;
  
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
  };
}

export async function setAuthCookie(response: Response, token: string) {
  const cookieStore = await cookies();
  cookieStore.set('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('authToken');
}

export function requireAdmin(request: any): ApiAuthResult | NextResponse;
export function requireAdmin(): Promise<string>;
export function requireAdmin(request?: any) {
  if (request) {
    const auth = requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    if (!auth.isAdmin) {
      return NextResponse.json({ error: '需要管理員權限' }, { status: 403 });
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
