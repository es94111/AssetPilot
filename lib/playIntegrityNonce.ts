import crypto from 'crypto';

// Play Integrity classic 請求需要一個由伺服器產生、一次性、限時的 nonce。
// App 取得 nonce 後綁入 integrity token，後端解碼時比對 requestDetails.nonce。
// 模式與 lib/googleOAuthState.ts 相同：單一程序內的 in-memory TTL Map。
const INTEGRITY_NONCE_TTL_MS = 10 * 60 * 1000;
const integrityNonces = new Map<string, number>();

function pruneIntegrityNonces() {
  const now = Date.now();
  for (const [nonce, issuedAt] of integrityNonces.entries()) {
    if ((now - issuedAt) > INTEGRITY_NONCE_TTL_MS) integrityNonces.delete(nonce);
  }
}

export function issueIntegrityNonce(): string {
  pruneIntegrityNonces();
  // Google 建議 nonce 至少 16 bytes；24 bytes base64url 約 32 字元。
  const nonce = crypto.randomBytes(24).toString('base64url');
  integrityNonces.set(nonce, Date.now());
  return nonce;
}

export function consumeIntegrityNonce(nonce: unknown): boolean {
  if (typeof nonce !== 'string' || nonce.length < 20 || nonce.length > 200) return false;
  pruneIntegrityNonces();
  const issuedAt = integrityNonces.get(nonce);
  if (!issuedAt) return false;
  integrityNonces.delete(nonce); // 一次性
  return (Date.now() - issuedAt) <= INTEGRITY_NONCE_TTL_MS;
}
