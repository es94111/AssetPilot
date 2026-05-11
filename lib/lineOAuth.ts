export const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID || '';
export const LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || '';

const LINE_OAUTH_REDIRECT_URIS = (process.env.LINE_OAUTH_REDIRECT_URIS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const APP_HOST = process.env.APP_HOST || 'localhost';
const PORT = process.env.PORT || 3000;

function buildLineRedirectAllowlist() {
  if (LINE_OAUTH_REDIRECT_URIS.length > 0) return new Set(LINE_OAUTH_REDIRECT_URIS);
  return new Set([
    `https://${APP_HOST}/auth/line/callback`,
    `http://localhost:${PORT}/auth/line/callback`,
  ]);
}

const lineRedirectUriAllowlist = buildLineRedirectAllowlist();

export function isAllowedLineRedirectUri(uri: string) {
  if (!uri) return false;
  if (lineRedirectUriAllowlist.has(uri)) return true;
  const stripped = String(uri).replace(/\/$/, '');
  return lineRedirectUriAllowlist.has(stripped) || lineRedirectUriAllowlist.has(stripped + '/');
}

export async function exchangeLineCodeForToken(code: string, redirectUri: string) {
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET,
    }),
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  return { tokenRes, tokenData };
}

export async function verifyLineIdToken(idToken: string, nonce: string) {
  const verifyRes = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: LINE_CHANNEL_ID,
      nonce,
    }),
  });
  const payload = await verifyRes.json().catch(() => ({}));
  return { verifyRes, payload };
}
