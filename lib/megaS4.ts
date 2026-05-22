import { getS3ConfigStatus, joinS3Key, putS3Object } from './s3Storage';

export const MEGA_S4_REGIONS = [
  'eu-central-1',
  'eu-central-2',
  'ca-central-1',
  'ca-west-1',
] as const;

type MegaS4Region = (typeof MEGA_S4_REGIONS)[number];

export interface MegaS4ConfigStatus {
  configured: boolean;
  missing: string[];
  region: string;
  endpoint: string;
  bucket: string;
  prefix: string;
}

export interface MegaS4UploadResult {
  bucket: string;
  key: string;
  endpoint: string;
  region: string;
  etag: string;
  byteSize: number;
}

interface MegaS4Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: MegaS4Region;
  endpoint: string;
  prefix: string;
}

function normalizeEndpoint(raw: string, region: string) {
  const endpoint = (raw || `https://s3.${region}.s4.mega.io`).trim();
  return endpoint.startsWith('http://') || endpoint.startsWith('https://')
    ? endpoint.replace(/\/+$/, '')
    : `https://${endpoint.replace(/\/+$/, '')}`;
}

function normalizePrefix(raw: string) {
  return String(raw || 'assetpilot').trim().replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/');
}

function isMegaS4Region(value: string): value is MegaS4Region {
  return MEGA_S4_REGIONS.includes(value as MegaS4Region);
}

export function getMegaS4ConfigStatus(): MegaS4ConfigStatus {
  const region = (process.env.MEGA_S4_REGION || 'eu-central-1').trim();
  const bucket = (process.env.MEGA_S4_BUCKET || '').trim();
  const status = getS3ConfigStatus('MEGA_S4', {
    region,
    endpoint: normalizeEndpoint(process.env.MEGA_S4_ENDPOINT || '', region),
    bucket,
    prefix: normalizePrefix(process.env.MEGA_S4_PREFIX || 'assetpilot'),
  });
  const missing = [...status.missing];

  if (!isMegaS4Region(region)) missing.push('MEGA_S4_REGION');

  return {
    configured: missing.length === 0,
    missing,
    region,
    endpoint: status.endpoint,
    bucket,
    prefix: status.prefix,
  };
}

function getMegaS4Config(): MegaS4Config {
  const status = getMegaS4ConfigStatus();
  if (!status.configured) {
    throw new Error(`MEGA S4 尚未設定：${status.missing.join(', ')}`);
  }
  return {
    accessKeyId: String(process.env.MEGA_S4_ACCESS_KEY_ID || '').trim(),
    secretAccessKey: String(process.env.MEGA_S4_SECRET_ACCESS_KEY || '').trim(),
    bucket: status.bucket,
    region: status.region as MegaS4Region,
    endpoint: status.endpoint,
    prefix: status.prefix,
  };
}

function makeObjectKey(prefix: string, filename: string) {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, '-');
  return joinS3Key(prefix, safeName);
}

export function makeMegaS4BackupFilename(date = new Date()) {
  const ts = date.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `assetpilot-backup-${ts}.db`;
}

export async function uploadMegaS4Backup(body: Buffer, filename: string, contentType = 'application/sql; charset=utf-8'): Promise<MegaS4UploadResult> {
  const config = getMegaS4Config();
  const key = makeObjectKey(config.prefix, filename);
  return putS3Object(config, key, body, contentType);
}
