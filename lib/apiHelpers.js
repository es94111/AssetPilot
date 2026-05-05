'use strict';
// lib/apiHelpers.js — Next.js App Router API Route 共用工具

const { NextResponse } = require('next/server');
const { verifyToken, JWT_EXPIRES_MS, AUTH_COOKIE_OPTIONS } = require('./auth');
const { getDB, queryOne, queryAll, saveDB } = require('./db');

// ── 回應工具 ──

function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

function err(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ── Cookie 工具 ──

function setAuthCookie(response, token) {
  response.cookies.set('authToken', token, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: Math.floor(JWT_EXPIRES_MS / 1000),
  });
  return response;
}

function clearAuthCookie(response) {
  response.cookies.set('authToken', '', {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: 0,
  });
  return response;
}

// ── 認證中介層 ──

/**
 * 驗證 JWT，失敗時返回 401 Response（可用 instanceof NextResponse 判斷）
 * 成功時返回 { userId, userTimezone }
 */
function requireAuth(request) {
  const token = request.cookies.get('authToken')?.value
    || (() => {
      const auth = request.headers.get('authorization') || '';
      return auth.startsWith('Bearer ') ? auth.slice(7) : null;
    })();

  if (!token) return err('請先登入', 401);

  try {
    const decoded = verifyToken(token);
    const db = getDB();
    const user = queryOne('SELECT token_version, timezone FROM users WHERE id = ?', [decoded.userId]);
    if (!user) return err('使用者不存在', 401);
    const dbVersion = Number(user.token_version) || 0;
    const tokenVersion = Number(decoded.tokenVersion) || 0;
    if (tokenVersion !== dbVersion) return err('登入已失效，請重新登入', 401);
    return { userId: decoded.userId, userTimezone: user.timezone || 'Asia/Taipei' };
  } catch (e) {
    const msg = e?.name === 'TokenExpiredError' ? '登入已過期，請重新登入' : '登入已失效，請重新登入';
    return err(msg, 401);
  }
}

/** 驗證是否為管理員；回傳 { userId, userTimezone } 或 NextResponse */
function requireAdmin(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const user = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
  if (!user?.is_admin) return err('需要管理員權限', 403);
  return auth;
}

// ── 共用業務邏輯 ──

function normalizeThemeMode(mode) {
  const v = String(mode || '').trim().toLowerCase();
  if (v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    googleLinked: !!user.google_id,
    hasPassword: !!user.has_password,
    avatarUrl: user.avatar_url || '',
    themeMode: normalizeThemeMode(user.theme_mode),
    isAdmin: !!user.is_admin,
  };
}

module.exports = {
  json,
  err,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  requireAdmin,
  normalizeThemeMode,
  formatUser,
  getDB,
  queryOne,
  queryAll,
  saveDB,
};
