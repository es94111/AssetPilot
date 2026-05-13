import crypto from 'crypto';

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

export function joinS3Key(prefix: string, key: string) {
  return [normalizePrefix(prefix), normalizePrefix(key)].filter(Boolean).join('/');
}

export async function putS3Object(config: S3StorageConfig, key: string, body: Buffer, contentType: string): Promise<S3ObjectResult> {
  const signed = signedHeadersFor('PUT', config, key, body, contentType);
  const response = await fetch(signed.url, {
    method: 'PUT',
    headers: {
      ...signed.headers,
      'Content-Length': String(body.length),
    },
    body: new Uint8Array(body),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`S3 上傳失敗（HTTP ${response.status}）：${details.slice(0, 300) || response.statusText}`);
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
  const signed = signedHeadersFor('GET', config, key, null);
  const response = await fetch(signed.url, { method: 'GET', headers: signed.headers });
  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`S3 讀取失敗（HTTP ${response.status}）：${details.slice(0, 300) || response.statusText}`);
  }
  return response;
}

export async function deleteS3Object(config: S3StorageConfig, key: string): Promise<void> {
  const signed = signedHeadersFor('DELETE', config, key, null);
  const response = await fetch(signed.url, { method: 'DELETE', headers: signed.headers });
  if (!response.ok && response.status !== 404) {
    const details = await response.text().catch(() => '');
    throw new Error(`S3 刪除失敗（HTTP ${response.status}）：${details.slice(0, 300) || response.statusText}`);
  }
}
