import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { ensureEnvSecrets } from './envSecrets';

ensureEnvSecrets();

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
// App 端（Flutter，帶 X-AssetPilot-Device-Id）Token 存於裝置端加密儲存，非瀏覽器 Cookie，
// 用較長效期避免使用者頻繁被登出；瀏覽器登入維持 JWT_EXPIRES 原有效期。
const APP_JWT_EXPIRES = process.env.APP_JWT_EXPIRES || '90d';

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('authToken'); // 修正為 authToken

  if (!session) {
    return null;
  }

  return session.value;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}

export function signToken(userId: string, tokenVersion: number, sessionId?: string, isAppLogin?: boolean) {
  const expiresIn = isAppLogin ? APP_JWT_EXPIRES : JWT_EXPIRES;
  return jwt.sign({ userId, tokenVersion, ...(sessionId ? { sessionId } : {}) }, JWT_SECRET, { expiresIn });
}

export function verifyToken(token: string, options?: any) {
  return jwt.verify(token, JWT_SECRET, options);
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
