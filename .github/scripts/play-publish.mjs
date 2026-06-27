// Publish a single .aab to multiple Google Play tracks in ONE edit.
//
// Why a custom script instead of r0adkll/upload-google-play: that action only
// updates one track per invocation and commits the edit, so a second run with
// the same .aab fails with "Version code N has already been used." Google Play
// uploads a bundle once and then *assigns* its versionCode to tracks. This
// script does exactly that — upload once, assign to every TRACKS entry inside a
// single edit, then commit (which sends closed/open tracks for review).
//
// Implementation note: this talks to the Android Publisher REST API directly via
// Node's built-in fetch (undici) + crypto-signed service-account JWT, with NO
// external dependency. The previous `googleapis` library pulled an older auth
// stack backed by `node-fetch`, which on Node 22 deterministically throws
// `ERR_STREAM_PREMATURE_CLOSE` while ungzipping the OAuth token response
// (a node-fetch bug, not a real network problem). undici handles gzip correctly.
//
// Required env:
//   PACKAGE_NAME   com.assetpilot.assetpilot
//   AAB_PATH       absolute path to app-release.aab
//   SA_JSON_PATH   path to the service-account JSON key file
//   TRACKS         comma-separated track ids, e.g. "internal,alpha"
//   WHATSNEW_DIR   dir holding whatsnew-<locale> files (optional release notes)

import { setDefaultResultOrder } from 'node:dns';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createSign } from 'node:crypto';

// 部分 runner 連 googleapis 的 IPv6 路徑不穩，強制 DNS 先回 IPv4（與工作流程的
// NODE_OPTIONS=--dns-result-order=ipv4first 互為備援）。
try {
  setDefaultResultOrder('ipv4first');
} catch (_) {
  // 舊版 Node 可能不支援；交由 NODE_OPTIONS 處理。
}

const PUBLISHER_BASE = 'https://androidpublisher.googleapis.com';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

const packageName = requireEnv('PACKAGE_NAME');
const aabPath = requireEnv('AAB_PATH');
const saPath = requireEnv('SA_JSON_PATH');
const tracks = requireEnv('TRACKS')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const whatsNewDir = process.env.WHATSNEW_DIR || '';

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing required env: ${name}`);
    process.exit(1);
  }
  return v;
}

// Play release-notes locales must match Play-supported codes (zh-TW, en-US).
function loadReleaseNotes() {
  if (!whatsNewDir) return [];
  const notes = [];
  for (const language of ['zh-TW', 'en-US']) {
    const file = join(whatsNewDir, `whatsnew-${language}`);
    if (existsSync(file)) {
      // Google Play rejects release notes longer than 500 chars per language;
      // trim() also drops the trailing newline that would otherwise count.
      let text = readFileSync(file, 'utf8').trim();
      if (text.length > 500) text = `${text.slice(0, 499)}…`;
      if (text) notes.push({ language, text });
    }
  }
  return notes;
}

// 短暫網路錯誤（連線被重置／逾時／DNS 暫時失敗）才重試；真正的 HTTP 4xx/5xx
// （權限、設定、版本碼重複等）直接拋出，不浪費重試。undici 的網路錯誤通常是
// `TypeError: fetch failed`，真正原因在 err.cause。
function isTransientError(err) {
  const code = String(err?.code || err?.cause?.code || '');
  const msg = String(err?.message || '') + ' ' + String(err?.cause?.message || '');
  return (
    code === 'ERR_STREAM_PREMATURE_CLOSE' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'UND_ERR_SOCKET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    /fetch failed|premature close|socket hang ?up|terminated|other side closed|ECONNRESET|ETIMEDOUT|network|timeout/i.test(
      msg,
    )
  );
}

async function withRetry(fn, { attempts = 4, baseDelayMs = 3000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === attempts || !isTransientError(err)) throw err;
      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `Play API attempt ${attempt}/${attempts} failed with transient network error ` +
          `(${err?.code || err?.cause?.code || err?.message}); retrying in ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

// 以服務帳號私鑰簽出 RS256 JWT，向 token 端點換取 OAuth access token。
async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 }),
  );
  const unsigned = `${header}.${claim}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(sa.private_key).toString('base64url');
  const assertion = `${unsigned}.${signature}`;

  const res = await fetchOk(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`No access_token in token response: ${JSON.stringify(json)}`);
  return json.access_token;
}

// fetch 包裝：對短暫網路錯誤重試；非 2xx 回應讀出內文後拋出（不重試）。
async function fetchOk(url, options) {
  return withRetry(async () => {
    const res = await fetch(url, options);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}\n${text.slice(0, 800)}`);
    }
    return res;
  });
}

async function main() {
  const sa = JSON.parse(readFileSync(saPath, 'utf8'));
  const accessToken = await getAccessToken(sa);
  const authHeader = { Authorization: `Bearer ${accessToken}` };
  const appBase = `${PUBLISHER_BASE}/androidpublisher/v3/applications/${encodeURIComponent(packageName)}`;

  // 1) 建立 edit
  const editRes = await fetchOk(`${appBase}/edits`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: '{}',
  });
  const editId = (await editRes.json()).id;
  if (!editId) throw new Error('edits.insert 未回傳 edit id');

  // 2) 上傳 AAB（uploadType=media，直接傳檔案位元組）
  const aab = readFileSync(aabPath);
  const uploadRes = await fetchOk(
    `${PUBLISHER_BASE}/upload/androidpublisher/v3/applications/${encodeURIComponent(packageName)}/edits/${editId}/bundles?uploadType=media`,
    {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/octet-stream' },
      body: aab,
    },
  );
  const versionCode = (await uploadRes.json()).versionCode;
  console.log(`Uploaded bundle: versionCode=${versionCode}`);

  // 3) 將 versionCode 指派到每個 track（同一個 edit 內）
  const releaseNotes = loadReleaseNotes();
  for (const track of tracks) {
    await fetchOk(`${appBase}/edits/${editId}/tracks/${encodeURIComponent(track)}`, {
      method: 'PUT',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        releases: [{ versionCodes: [String(versionCode)], status: 'completed', releaseNotes }],
      }),
    });
    console.log(`Assigned versionCode=${versionCode} → track=${track}`);
  }

  // 4) commit（預設 changesNotSentForReview=false → closed/open track 送審；
  //    internal 測試立即發佈）
  await fetchOk(`${appBase}/edits/${editId}:commit`, {
    method: 'POST',
    headers: { ...authHeader, 'Content-Type': 'application/json' },
    body: '{}',
  });
  console.log(`Committed edit ${editId} (sent for review).`);
}

main().catch((err) => {
  console.error('Play publish failed:', err?.stack || err);
  process.exit(1);
});
