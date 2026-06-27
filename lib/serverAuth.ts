// lib/serverAuth.ts - Next.js App Router server-side auth helpers
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from './auth';
import { queryOne } from './db';
import { verifyLoginSession } from './sessionHelpers';

export interface ServerUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  themeMode: string;
}

interface TokenPayload {
  userId?: string;
  tokenVersion?: number;
  sessionId?: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  is_admin: number | null;
  admin_role: string | null;
  theme_mode: string | null;
  token_version: number | null;
}

function asUserRow(row: Record<string, string | number | null> | null): UserRow | null {
  return row as unknown as UserRow | null;
}

/**
 * Validate authToken cookie, redirecting to /login on failure.
 */
export async function requireServerAuth(): Promise<ServerUser> {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  let userId: string;
  let tokenVersion: number;
  let sessionId = '';
  try {
    const d = verifyToken(token) as TokenPayload;
    userId = String(d.userId || '');
    tokenVersion = Number(d.tokenVersion) || 0;
    sessionId = d.sessionId ? String(d.sessionId) : '';
  } catch {
    redirect('/login');
  }
  const user = asUserRow(queryOne(
    'SELECT id, email, display_name, is_admin, admin_role, theme_mode, token_version FROM users WHERE id = ?',
    [userId]
  ));
  if (!user) redirect('/login');
  if (tokenVersion !== (Number(user.token_version) || 0)) redirect('/login');
  if (!verifyLoginSession(userId, sessionId, token)) redirect('/login');
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin: !!user.is_admin,
    isSuperAdmin: !!user.is_admin && String(user.admin_role || 'super').toLowerCase() !== 'readonly',
    themeMode: user.theme_mode || 'system',
  };
}

/**
 * Validate admin user, redirecting non-admins to /dashboard.
 */
export async function requireServerAdmin(): Promise<ServerUser> {
  const user = await requireServerAuth();
  if (!user.isAdmin) redirect('/dashboard');
  return user;
}
