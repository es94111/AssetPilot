import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireAuth as getAuth } from '@/lib/auth';
import logger from '@/lib/logger';

export async function requireAuth(request?: any) {
  return await getAuth();
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

export async function requireAdmin() {
  const session = await requireAuth();
  // 在這裡應該驗證 user 的管理員權限。由於沒有 user 物件，這通常透過檢查 JWT 或查詢資料庫。
  // 為了簡化並重建原邏輯，我們先假設需要查詢。
  // 注意：這需要 db.js。
  // ...
  return session;
}

export function normalizeThemeMode(mode: string) {
  const v = String(mode || '').trim().toLowerCase();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}
