import crypto from 'crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

export interface S3ConfigStatus {
  configured: boolean;
  missing: string[];
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
}

export interface S3StorageConfig {
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  region: string;
  bucket: string;
  prefix: string;
}

export interface S3ObjectResult {
  bucket: string;
  key: string;
  endpoint: string;
  region: string;
  etag: string;
  byteSize: number;
}

const SERVICE = 's3';
const EMPTY_HASH = crypto.createHash('sha256').update('').digest('hex');

function normalizeEndpoint(raw: string) {
  const endpoint = String(raw || '').trim();
  if (!endpoint) return '';
  return endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint.replace(/\/+$/, '')
    : `https://${endpoint.replace(/\/+$/, '')}`;
}

function normalizePrefix(raw: string, fallback = '') {
  return String(raw || fallback).trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

export function getS3ConfigStatus(envPrefix = 'S3', defaults: Partial<Pick<S3StorageConfig, 'endpoint' | 'region' | 'bucket' | 'prefix'>> = {}): S3ConfigStatus {
  const accessKeyId = process.env[`${envPrefix}_ACCESS_KEY_ID`] || '';
  const secretAccessKey = process.env[`${envPrefix}_SECRET_ACCESS_KEY`] || '';
  const bucket = (process.env[`${envPrefix}_BUCKET`] || defaults.bucket || '').trim();
  const region = (process.env[`${envPrefix}_REGION`] || defaults.region || 'us-east-1').trim();
  const endpoint = normalizeEndpoint(process.env[`${envPrefix}_ENDPOINT`] || defaults.endpoint || '');
  const prefix = normalizePrefix(process.env[`${envPrefix}_PREFIX`] || defaults.prefix || '');
  const required: Array<[string, string]> = [
    [`${envPrefix}_ACCESS_KEY_ID`, accessKeyId],
    [`${envPrefix}_SECRET_ACCESS_KEY`, secretAccessKey],
    [`${envPrefix}_BUCKET`, bucket],
    [`${envPrefix}_ENDPOINT`, endpoint],
  ];
  const missing = required.filter(([, value]) => !String(value || '').trim()).map(([key]) => key);

  return {
    configured: missing.length === 0,
    missing,
    endpoint,
    region,
    bucket,
    prefix,
  };
}

export function getS3Config(envPrefix = 'S3', defaults: Partial<Pick<S3StorageConfig, 'endpoint' | 'region' | 'bucket' | 'prefix'>> = {}): S3StorageConfig {
  const status = getS3ConfigStatus(envPrefix, defaults);
  if (!status.configured) throw new Error(`S3 相容物件儲存尚未設定：${status.missing.join(', ')}`);
  return {
    accessKeyId: String(process.env[`${envPrefix}_ACCESS_KEY_ID`] || '').trim(),
    secretAccessKey: String(process.env[`${envPrefix}_SECRET_ACCESS_KEY`] || '').trim(),
    endpoint: status.endpoint,
    region: status.region,
    bucket: status.bucket,
    prefix: status.prefix,
  };
}

function hmac(key: crypto.BinaryLike | crypto.KeyObject, value: string) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest();
}

function hashHex(value: Buffer | string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function amzDates(date = new Date()) {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function encodePathSegment(segment: string) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalUri(bucket: string, key: string) {
  return `/${encodePathSegment(bucket)}/${key.split('/').map(encodePathSegment).join('/')}`;
}

function credentialScope(dateStamp: string, region: string) {
  return `${dateStamp}/${region}/${SERVICE}/aws4_request`;
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

function signedHeadersFor(method: string, config: S3StorageConfig, key: string, body: Buffer | null, contentType?: string) {
  const { amzDate, dateStamp } = amzDates();
  const payloadHash = body ? hashHex(body) : EMPTY_HASH;
  const endpointUrl = new URL(config.endpoint);
  const host = endpointUrl.host;
  const uri = canonicalUri(config.bucket, key);
  const headerRows = [
    contentType ? [`content-type`, contentType] : null,
    [`host`, host],
    [`x-amz-content-sha256`, payloadHash],
    [`x-amz-date`, amzDate],
  ].filter(Boolean) as Array<[string, string]>;
  const signedHeaders = headerRows.map(([name]) => name).join(';');
  const canonicalHeaders = headerRows.map(([name, value]) => `${name}:${value}`).join('\n') + '\n';
  const scope = credentialScope(dateStamp, config.region);
  const canonicalRequest = [method, uri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, hashHex(canonicalRequest)].join('\n');
  const signature = crypto.createHmac('sha256', signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign, 'utf8')
    .digest('hex');

  return {
    url: `${endpointUrl.origin}${uri}`,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  };
}

function decodeXmlText(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlTagValue(xml: string, tag: string) {
  // tag 僅來自內部固定字串（Code/Message/RequestId），仍過濾為純英數，杜絕注入特殊字元造成 ReDoS。
  const safeTag = tag.replace(/[^A-Za-z0-9]/g, '');
  if (!safeTag) return '';
  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- safeTag 已限制為純英數常數，無 ReDoS 風險
  const match = xml.match(new RegExp(`<${safeTag}>([\\s\\S]*?)<\\/${safeTag}>`, 'i'));
  return match ? decodeXmlText(match[1].trim()) : '';
}

function formatS3Error(action: string, status: number, statusText: string, details: string) {
  const code = xmlTagValue(details, 'Code');
  const message = xmlTagValue(details, 'Message');
  const requestId = xmlTagValue(details, 'RequestId');
  const requestLabel = requestId ? `（RequestId: ${requestId}）` : '';

  if (code === 'InvalidAccessKeyId') {
    return `${action}失敗（HTTP ${status}）：Access Key ID 無效或格式不正確，請確認環境變數中的 Access Key ID 是從 S3 相容物件儲存服務建立的 Access Key ID，不是帳號、bucket 名稱或 Secret Access Key。${message ? `服務回覆：${message}` : ''}${requestLabel}`;
  }

  if (code || message) {
    return `${action}失敗（HTTP ${status}）：${[code, message].filter(Boolean).join(' - ')}${requestLabel}`;
  }

  return `${action}失敗（HTTP ${status}）：${details.slice(0, 300) || statusText}`;
}

// ── SSRF hardening for the admin-configurable S3 endpoint ──────────────────
// The endpoint (host/port/scheme) is admin-supplied config, not a fixed trusted
// origin, so every real request re-validates it: HTTPS only, and the resolved
// address must not fall inside a private/loopback/link-local/multicast/reserved
// range (this also blocks the common 169.254.169.254 cloud metadata target).
// Redirects are disabled and responses are read with a byte cap and timeout.
//
// Known residual risk: between the DNS lookup here and the actual `fetch()`
// connect, a malicious/compromised DNS name could in principle re-resolve to a
// different (internal) address ("DNS rebinding"). Fully pinning the validated
// IP for the TLS connection would require a custom dispatcher/agent (e.g. the
// `undici` package), which is not a dependency of this project; the short
// validate-then-fetch window plus the address-range check and https+redirect
// restrictions are the practical mitigation given this route is already
// gated behind super-admin authentication.
const S3_REQUEST_TIMEOUT_MS = 20_000;
const S3_MAX_RESPONSE_BYTES = 1024 * 1024 * 1024; // 1GB safety cap (backups/photos)

function isDisallowedIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // RFC1918
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
  if (a === 192 && b === 0 && parts[2] === 0) return true; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast (224-239) + reserved/broadcast (240-255)
  return false;
}

function isDisallowedIPv6(rawIp: string): boolean {
  const ip = rawIp.toLowerCase();
  if (ip === '::1' || ip === '::') return true; // loopback / unspecified
  if (ip.startsWith('::ffff:')) {
    const mapped = ip.slice('::ffff:'.length);
    return net.isIP(mapped) === 4 ? isDisallowedIPv4(mapped) : true;
  }
  // fe80::/10 link-local
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return true;
  // fc00::/7 unique local
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  // ff00::/8 multicast
  if (ip.startsWith('ff')) return true;
  // 64:ff9b::/96 NAT64 well-known prefix (can reach internal IPv4 space)
  if (ip.startsWith('64:ff9b:')) return true;
  return false;
}

function isDisallowedIp(ip: string): boolean {
  if (!ip) return true;
  return net.isIP(ip) === 4 ? isDisallowedIPv4(ip) : isDisallowedIPv6(ip);
}

/** Validates an S3-compatible endpoint is HTTPS and does not resolve to a private/reserved address. Throws on failure. */
export async function assertSafeS3Endpoint(rawEndpoint: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawEndpoint);
  } catch {
    throw new Error('S3 endpoint 網址格式錯誤');
  }
  if (url.protocol !== 'https:') {
    throw new Error('S3 endpoint 必須使用 HTTPS');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) {
      throw new Error('S3 endpoint 不可指向內部或保留位址');
    }
    return;
  }

  let addresses: string[];
  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new Error('S3 endpoint 主機名稱無法解析');
  }
  if (addresses.length === 0 || addresses.some(isDisallowedIp)) {
    throw new Error('S3 endpoint 解析為內部或保留位址，已拒絕');
  }
}

async function safeS3Fetch(url: string, init: { method: string; headers: Record<string, string>; body?: Uint8Array }): Promise<Response> {
  const response = await fetch(url, {
    method: init.method,
    headers: init.headers,
    // Cast needed: some TypeScript/lib.dom combinations infer a Uint8Array
    // generic parameter that doesn't structurally match BodyInit, even though
    // a Uint8Array is a valid fetch() body at runtime.
    body: init.body as BodyInit | undefined,
    redirect: 'manual',
    signal: AbortSignal.timeout(S3_REQUEST_TIMEOUT_MS),
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`S3 請求被拒絕：不允許的重新導向（HTTP ${response.status}）`);
  }
  return response;
}

// Reads a response body into a Buffer while enforcing S3_MAX_RESPONSE_BYTES,
// returning a new same-shaped Response so callers keep using headers/status.
async function readBoundedResponse(response: Response): Promise<Response> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > S3_MAX_RESPONSE_BYTES) {
    throw new Error('S3 回應內容過大，已拒絕');
  }
  if (!response.body) {
    return new Response(null, { status: response.status, headers: response.headers });
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > S3_MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw new Error('S3 回應內容過大，已拒絕');
      }
      chunks.push(value);
    }
  }
  return new Response(Buffer.concat(chunks.map((c) => Buffer.from(c))), {
    status: response.status,
    headers: response.headers,
  });
}

export function joinS3Key(prefix: string, key: string) {
  return [normalizePrefix(prefix), normalizePrefix(key)].filter(Boolean).join('/');
}

export async function putS3Object(config: S3StorageConfig, key: string, body: Buffer, contentType: string): Promise<S3ObjectResult> {
  await assertSafeS3Endpoint(config.endpoint);
  const signed = signedHeadersFor('PUT', config, key, body, contentType);
  const response = await safeS3Fetch(signed.url, {
    method: 'PUT',
    headers: {
      ...signed.headers,
      'Content-Length': String(body.length),
    },
    body: new Uint8Array(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(formatS3Error('S3 上傳', response.status, response.statusText, details));
  }

  return {
    bucket: config.bucket,
    key,
    endpoint: config.endpoint,
    region: config.region,
    etag: response.headers.get('etag') || '',
    byteSize: body.length,
  };
}

export async function getS3Object(config: S3StorageConfig, key: string): Promise<Response> {
  await assertSafeS3Endpoint(config.endpoint);
  const signed = signedHeadersFor('GET', config, key, null);
  const response = await safeS3Fetch(signed.url, { method: 'GET', headers: signed.headers });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(formatS3Error('S3 讀取', response.status, response.statusText, details));
  }
  return readBoundedResponse(response);
}

export async function deleteS3Object(config: S3StorageConfig, key: string): Promise<void> {
  await assertSafeS3Endpoint(config.endpoint);
  const signed = signedHeadersFor('DELETE', config, key, null);
  const response = await safeS3Fetch(signed.url, { method: 'DELETE', headers: signed.headers });
  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => '');
    throw new Error(formatS3Error('S3 刪除', response.status, response.statusText, details));
  }
}
