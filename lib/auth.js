'use strict';
// lib/auth.js — JWT 工具；從 server.js 提取，保留原始環境變數名稱

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function parseExpiresMs(str) {
  const match = String(str).match(/^(\d+)(s|m|h|d|w)$/i);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60 * 1000, h: 3600 * 1000, d: 86400 * 1000, w: 7 * 86400 * 1000 };
  return n * multipliers[unit];
}

const JWT_EXPIRES_MS = parseExpiresMs(JWT_EXPIRES);

/**
 * 產生 JWT（userId + tokenVersion）
 * @param {string} userId
 * @param {number} tokenVersion
 * @returns {string}
 */
function signToken(userId, tokenVersion) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET 未設定');
  return jwt.sign({ userId, tokenVersion: Number(tokenVersion) || 0 }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * 驗證並解碼 JWT；失敗拋出 jwt 原始錯誤
 * @param {string} token
 * @returns {{ userId: string, tokenVersion: number, iat: number, exp: number }}
 */
function verifyToken(token, options = {}) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET 未設定');
  return jwt.verify(token, JWT_SECRET, options);
}

/**
 * 從 Next.js Request 的 cookies 讀取 authToken
 * 相容 Web API Request（Edge/Node）——使用 request.cookies.get()
 * @param {Request} request  Next.js API Route / middleware 的 request 物件
 * @returns {string|null}
 */
function getTokenFromRequest(request) {
  // Next.js App Router：request.cookies 為 ReadonlyRequestCookies
  if (request?.cookies?.get) {
    return request.cookies.get('authToken')?.value ?? null;
  }
  // 降級相容（純 Node Request-like 物件）
  if (request?.cookies?.authToken) {
    return request.cookies.authToken;
  }
  // Authorization: Bearer <token>
  const auth = request?.headers?.get?.('authorization') ?? request?.headers?.authorization ?? '';
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice(7);
  }
  return null;
}

/** Cookie 設定（與 server.js AUTH_COOKIE_OPTIONS 一致） */
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

module.exports = {
  signToken,
  verifyToken,
  getTokenFromRequest,
  JWT_EXPIRES_MS,
  AUTH_COOKIE_OPTIONS,
};
