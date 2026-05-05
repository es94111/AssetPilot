'use strict';
// lib/serverAuth.js — Next.js App Router 伺服器端認證輔助

const { cookies } = require('next/headers');
const { redirect } = require('next/navigation');
const { verifyToken } = require('./auth');
const { queryOne } = require('./db');

/**
 * 驗證 authToken cookie，失敗時 redirect 至 /login
 * 成功時回傳 formattedUser { id, email, displayName, isAdmin, themeMode }
 */
async function requireServerAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  let userId;
  try { const d = verifyToken(token); userId = d.userId; } catch (_) { redirect('/login'); }
  const user = queryOne(
    'SELECT id, email, display_name, is_admin, theme_mode FROM users WHERE id = ?',
    [userId]
  );
  if (!user) redirect('/login');
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    isAdmin: !!user.is_admin,
    themeMode: user.theme_mode || 'system',
  };
}

/**
 * 驗證管理員，非管理員 redirect 至 /dashboard
 */
async function requireServerAdmin() {
  const user = await requireServerAuth();
  if (!user.isAdmin) redirect('/dashboard');
  return user;
}

module.exports = { requireServerAuth, requireServerAdmin };
