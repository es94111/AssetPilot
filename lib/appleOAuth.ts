import crypto from 'crypto';

export const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || '';
export const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || '';
export const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
// 簽給 Apple 的 .p8 私鑰（單行 PEM）。只存在伺服器端環境變數，
// 絕不可放進 App 或版控。
export const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || '').replace(
  /\\n/g,
  '\n',
);

// Apple 的 JWKS 端點。正常情況固定為官方網址；測試時可改指向本機
// 伺服器，讓路由層也能在沒有真實 Apple 帳號的情況下驗證簽章路徑。
const APPLE_JWKS_URL =
  process.env.APPLE_JWKS_URL || 'https://appleid.apple.com/auth/keys';
const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;

type AppleJwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type AppleJwks = { keys?: AppleJwk[] };

export type AppleIdentityClaims = {
  /** Apple 提供的穩定使用者識別碼（sub）。 */
  sub: string;
  email?: string;
  emailVerified?: boolean | string;
  /** 隱藏電子郵件時為 true。 */
  isPrivateEmail?: boolean;
  /** 僅在首次授權時提供。 */
  name?: string;
  nonce?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
};

// JWKS 快取：Apple 會定期輪替金鑰，因此保留舊金鑰直到 TTL 結束。
let jwksCache: { keys: AppleJwk[]; fetchedAt: number } | null = null;
const JWKS_TTL_MS = 60 * 60 * 1000;

async function fetchAppleJwks(jwksUrl: string = APPLE_JWKS_URL): Promise<AppleJwk[]> {
  const now = Date.now();
  if (jwksUrl === APPLE_JWKS_URL && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const res = await fetch(jwksUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Apple JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as AppleJwks;
  const keys = Array.isArray(data.keys) ? data.keys : [];
  if (jwksUrl === APPLE_JWKS_URL) jwksCache = { keys, fetchedAt: now };
  return keys;
}

/** base64url 解碼為 Buffer。 */
function base64UrlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

/** 把 JWK 轉成 Node 可用的 public key。 */
function publicKeyFromJwk(jwk: AppleJwk): crypto.KeyObject {
  if (!jwk.n || !jwk.e) throw new Error('Apple JWK missing modulus/exponent');
  return crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e,
    },
    format: 'jwk',
  });
}

/**
 * 驗證 Apple 身分令牌（identity token）。
 *
 * 檢查項目：
 * - 簽章（RS256，使用 Apple 公開金鑰）
 * - iss 必須為 https://appleid.apple.com
 * - aud 必須等於本 App 的 Service ID（APPLE_CLIENT_ID）
 * - exp / iat 時效
 * - nonce 必須與發起流程時發給用戶端並記錄的值一致
 *
 * 回傳 claims；驗證失敗時回傳 `{ ok: false, error }`。
 */
export async function verifyAppleIdentityToken(
  identityToken: string,
  options: { expectedNonce?: string; clientId?: string; jwksUrl?: string } = {},
): Promise<
  | { ok: true; claims: AppleIdentityClaims }
  | { ok: false; error: string }
> {
  const clientId = options.clientId || APPLE_CLIENT_ID;
  if (!clientId) return { ok: false, error: 'Apple 登入未設定（缺少 APPLE_CLIENT_ID）' };

  const parts = identityToken.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Apple 身分令牌格式錯誤' };

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString('utf8'));
  } catch {
    return { ok: false, error: 'Apple 身分令牌內容無法解析' };
  }

  // 僅接受 RS256，避免演算法混淆（alg=none / HS256 換簽）。
  if (header.alg !== 'RS256') {
    return { ok: false, error: `不支援的 Apple 簽章演算法：${header.alg || 'unknown'}` };
  }
  if (!header.kid) return { ok: false, error: 'Apple 身分令牌缺少 kid' };

  let keys: AppleJwk[];
  try {
    keys = await fetchAppleJwks(options.jwksUrl);
  } catch (e) {
    return {
      ok: false,
      error: `無法取得 Apple 公開金鑰：${e instanceof Error ? e.message : '未知錯誤'}`,
    };
  }
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { ok: false, error: '找不到對應的 Apple 簽署金鑰' };

  let verified = false;
  try {
    const publicKey = publicKeyFromJwk(jwk);
    verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      publicKey,
      base64UrlDecode(signatureB64),
    );
  } catch (e) {
    return {
      ok: false,
      error: `Apple 身分令牌簽章驗證失敗：${e instanceof Error ? e.message : '未知錯誤'}`,
    };
  }
  if (!verified) return { ok: false, error: 'Apple 身分令牌簽章無效' };

  const claims = payload as unknown as AppleIdentityClaims;

  if (claims.iss !== APPLE_ISSUER) {
    return { ok: false, error: 'Apple 身分令牌簽發者無效' };
  }
  const aud = Array.isArray(claims.aud) ? claims.aud[0] : claims.aud;
  if (aud !== clientId) {
    return { ok: false, error: 'Apple 身分令牌受眾與本 App 不符' };
  }
  const now = Date.now();
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) {
    return { ok: false, error: 'Apple 身分令牌已過期' };
  }
  if (typeof claims.iat === 'number') {
    const issuedAt = claims.iat * 1000;
    if (issuedAt > now + 60_000) {
      return { ok: false, error: 'Apple 身分令牌簽發時間無效' };
    }
    if (now - issuedAt > APPLE_TOKEN_MAX_AGE_MS) {
      return { ok: false, error: 'Apple 身分令牌已過期' };
    }
  }
  if (options.expectedNonce) {
    if (!claims.nonce || claims.nonce !== options.expectedNonce) {
      return { ok: false, error: 'Apple 身分令牌 nonce 不符' };
    }
  }
  if (!claims.sub) return { ok: false, error: 'Apple 身分令牌缺少使用者識別碼' };

  return { ok: true, claims };
}

/** 由 Apple 提供的 claims 取出可用的電子郵件（未隱藏時）。 */
export function appleEmail(claims: AppleIdentityClaims): string {
  const email = String(claims.email || '').trim().toLowerCase();
  if (!email) return '';
  // emailVerified 為字串 "true" / "false" 或 boolean；未驗證的電子郵件不應作為
  // 帳號合併依據。
  const verified = claims.emailVerified;
  const isVerified =
    verified === true || String(verified).toLowerCase() === 'true';
  return isVerified ? email : '';
}
