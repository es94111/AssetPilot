import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import jwt from 'jsonwebtoken';
import { ensureEnvSecrets } from './envSecrets';
import { getActiveKey, getKeyById, getLegacyKey, isKeyringEnabled } from './keyring';

ensureEnvSecrets();

const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
// App 端（Flutter，帶 X-AssetPilot-Device-Id）Token 存於裝置端加密儲存，非瀏覽器 Cookie，
// 用較長效期避免使用者頻繁被登出；瀏覽器登入維持 JWT_EXPIRES 原有效期。
const APP_JWT_EXPIRES = process.env.APP_JWT_EXPIRES || '90d';
type TokenVerifyOptions = NonNullable<Parameters<typeof jwt.verify>[2]>;

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
  const active = getActiveKey('jwt');
  if (!active) {
    return jwt.sign({ userId, tokenVersion, ...(sessionId ? { sessionId } : {}) }, JWT_SECRET, {
      expiresIn,
      algorithm: 'HS256',
    });
  }
  try {
    return jwt.sign({ userId, tokenVersion, ...(sessionId ? { sessionId } : {}) }, active.key, {
      expiresIn,
      algorithm: 'HS256',
      keyid: active.kid,
    });
  } finally {
    active.key.fill(0);
  }
}

export function verifyToken(token: string, options?: TokenVerifyOptions) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded === 'string' || decoded.header.alg !== 'HS256') {
    throw new jwt.JsonWebTokenError('invalid token algorithm');
  }
  const hasKid = Object.prototype.hasOwnProperty.call(decoded.header, 'kid');
  const kid = decoded.header.kid;
  if (hasKid && (typeof kid !== 'string' || kid.length === 0)) {
    throw new jwt.JsonWebTokenError('invalid token key id');
  }
  if (typeof kid === 'string') {
    const key = getKeyById('jwt', kid);
    try {
      return jwt.verify(token, key.key, { ...options, algorithms: ['HS256'] });
    } finally {
      key.key.fill(0);
    }
  }
  if (isKeyringEnabled()) {
    const legacy = getLegacyKey('jwt');
    if (!legacy) throw new jwt.JsonWebTokenError('legacy token key unavailable');
    try {
      return jwt.verify(token, legacy.key, { ...options, algorithms: ['HS256'] });
    } finally {
      legacy.key.fill(0);
    }
  }
  return jwt.verify(token, JWT_SECRET, { ...options, algorithms: ['HS256'] });
}

export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
};
