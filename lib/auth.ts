import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { ensureEnvSecrets } from './envSecrets';

ensureEnvSecrets();

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

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

export function signToken(userId: string, tokenVersion: number) {
  return jwt.sign({ userId, tokenVersion }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
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
