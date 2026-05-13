import fs from 'fs';
import path from 'path';
import { getDB, queryAll } from './db';
import { uid } from './userDefaults';
import { deleteS3Object, getS3Config, getS3ConfigStatus, getS3Object, joinS3Key, putS3Object } from './s3Storage';

export type AttachmentStorage = 'local' | 's3';

export interface TransactionAttachmentRow {
  id: string;
  user_id: string;
  transaction_id: string;
  storage: AttachmentStorage | string;
  local_path: string | null;
  object_key: string | null;
  bucket: string | null;
  endpoint: string | null;
  filename: string;
  mime_type: string;
  byte_size: number;
  created_at: number;
}

export interface AttachmentUploadResult {
  id: string;
  storage: AttachmentStorage;
  filename: string;
  mimeType: string;
  byteSize: number;
}

export interface TransactionPhotoInput {
  filename: string;
  mimeType: string;
  body: Buffer;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function uploadsRoot() {
  return path.resolve(process.env.TRANSACTION_PHOTO_LOCAL_DIR || path.join(process.cwd(), 'uploads', 'transaction-photos'));
}

function safeName(name: string) {
  const ext = path.extname(name || '').toLowerCase().replace(/[^a-z0-9.]/g, '');
  const base = path.basename(name || 'photo', ext).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80) || 'photo';
  return `${base}${ext || '.jpg'}`;
}

function maxPhotoBytes() {
  const configured = Number(process.env.TRANSACTION_PHOTO_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_BYTES;
}

function photoS3Defaults() {
  if (process.env.TRANSACTION_PHOTO_S3_ENDPOINT || process.env.S3_ENDPOINT) {
    return { prefix: process.env.TRANSACTION_PHOTO_S3_PREFIX || 'assetpilot/transaction-photos' };
  }
  const megaRegion = process.env.MEGA_S4_REGION || 'eu-central-1';
  return {
    endpoint: process.env.MEGA_S4_ENDPOINT || `https://s3.${megaRegion}.s4.mega.io`,
    region: megaRegion,
    bucket: process.env.MEGA_S4_BUCKET,
    prefix: process.env.MEGA_S4_PREFIX ? `${process.env.MEGA_S4_PREFIX}/transaction-photos` : 'assetpilot/transaction-photos',
  };
}

function photoS3EnvPrefix() {
  return process.env.TRANSACTION_PHOTO_S3_ENDPOINT || process.env.S3_ENDPOINT ? 'TRANSACTION_PHOTO_S3' : 'MEGA_S4';
}

export function getTransactionPhotoStorageStatus() {
  const s3 = getS3ConfigStatus(photoS3EnvPrefix(), photoS3Defaults());
  return {
    local: {
      configured: true,
      directory: uploadsRoot(),
    },
    s3,
    maxBytes: maxPhotoBytes(),
  };
}

export function getDefaultTransactionPhotoStorage(): AttachmentStorage {
  const requested = String(process.env.TRANSACTION_PHOTO_DEFAULT_STORAGE || 'local').trim().toLowerCase();
  if (requested === 's3') {
    return getTransactionPhotoStorageStatus().s3.configured ? 's3' : 'local';
  }
  return 'local';
}

function getPhotoS3Config() {
  return getS3Config(photoS3EnvPrefix(), photoS3Defaults());
}

export function listTransactionAttachments(userId: string, transactionId: string): TransactionAttachmentRow[] {
  return queryAll(
    'SELECT * FROM transaction_attachments WHERE user_id = ? AND transaction_id = ? ORDER BY created_at ASC',
    [userId, transactionId]
  ) as unknown as TransactionAttachmentRow[];
}

export function assertImageUpload(input: { size: number; type?: string; mimeType?: string }) {
  if (!input || input.size <= 0) throw new Error('照片檔案無效');
  if (input.size > maxPhotoBytes()) throw new Error(`照片不可超過 ${Math.round(maxPhotoBytes() / 1024 / 1024)} MB`);
  if (!String(input.type || input.mimeType || '').startsWith('image/')) throw new Error('只支援圖片檔案');
}

async function saveLocalPhoto(userId: string, transactionId: string, id: string, filename: string, body: Buffer) {
  const root = uploadsRoot();
  const dir = path.resolve(root, userId, transactionId);
  const targetName = `${id}-${safeName(filename)}`;
  const target = path.resolve(dir, targetName);
  if (!target.startsWith(root + path.sep)) throw new Error('照片儲存路徑無效');
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(target, body);
  return path.relative(root, target).replace(/\\/g, '/');
}

async function saveS3Photo(userId: string, transactionId: string, id: string, filename: string, mimeType: string, body: Buffer) {
  const config = getPhotoS3Config();
  const key = joinS3Key(config.prefix, `${userId}/${transactionId}/${id}-${safeName(filename)}`);
  const uploaded = await putS3Object(config, key, body, mimeType || 'application/octet-stream');
  return uploaded;
}

export async function saveTransactionPhotoBuffer(userId: string, transactionId: string, storage: AttachmentStorage, input: TransactionPhotoInput): Promise<AttachmentUploadResult> {
  const filename = input.filename || 'photo.jpg';
  const mimeType = input.mimeType || 'application/octet-stream';
  assertImageUpload({ size: input.body.length, mimeType });
  const id = uid();
  const now = Date.now();
  const db = getDB();

  if (storage === 'local') {
    const localPath = await saveLocalPhoto(userId, transactionId, id, filename, input.body);
    db.run(
      'INSERT INTO transaction_attachments (id,user_id,transaction_id,storage,local_path,object_key,bucket,endpoint,filename,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, transactionId, 'local', localPath, '', '', '', filename, mimeType, input.body.length, now]
    );
  } else if (storage === 's3') {
    const uploaded = await saveS3Photo(userId, transactionId, id, filename, mimeType, input.body);
    db.run(
      'INSERT INTO transaction_attachments (id,user_id,transaction_id,storage,local_path,object_key,bucket,endpoint,filename,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, transactionId, 's3', '', uploaded.key, uploaded.bucket, uploaded.endpoint, filename, mimeType, input.body.length, now]
    );
  } else {
    throw new Error('照片儲存位置無效');
  }

  return { id, storage, filename, mimeType, byteSize: input.body.length };
}

export async function saveTransactionPhoto(userId: string, transactionId: string, storage: AttachmentStorage, file: File): Promise<AttachmentUploadResult> {
  assertImageUpload(file);
  const body = Buffer.from(await file.arrayBuffer());
  return saveTransactionPhotoBuffer(userId, transactionId, storage, {
    filename: file.name || 'photo',
    mimeType: file.type || 'application/octet-stream',
    body,
  });
}

export async function readTransactionAttachment(row: TransactionAttachmentRow): Promise<{ body: Buffer; mimeType: string; filename: string }> {
  if (row.storage === 'local') {
    const root = uploadsRoot();
    const target = path.resolve(root, row.local_path || '');
    if (!target.startsWith(root + path.sep)) throw new Error('照片路徑無效');
    return {
      body: await fs.promises.readFile(target),
      mimeType: row.mime_type || 'application/octet-stream',
      filename: row.filename || 'photo',
    };
  }

  if (row.storage === 's3') {
    const config = getPhotoS3Config();
    const response = await getS3Object(config, row.object_key || '');
    return {
      body: Buffer.from(await response.arrayBuffer()),
      mimeType: row.mime_type || response.headers.get('content-type') || 'application/octet-stream',
      filename: row.filename || 'photo',
    };
  }

  throw new Error('照片儲存位置無效');
}

export async function deleteTransactionAttachments(userId: string, transactionIds: string[]) {
  if (transactionIds.length === 0) return;
  const placeholders = transactionIds.map(() => '?').join(',');
  const rows = queryAll(
    `SELECT * FROM transaction_attachments WHERE user_id = ? AND transaction_id IN (${placeholders})`,
    [userId, ...transactionIds]
  ) as unknown as TransactionAttachmentRow[];
  const root = uploadsRoot();
  let s3Config = null as ReturnType<typeof getPhotoS3Config> | null;

  for (const row of rows) {
    try {
      if (row.storage === 'local' && row.local_path) {
        const target = path.resolve(root, row.local_path);
        if (target.startsWith(root + path.sep)) await fs.promises.unlink(target).catch(() => {});
      } else if (row.storage === 's3' && row.object_key) {
        s3Config = s3Config || getPhotoS3Config();
        await deleteS3Object(s3Config, row.object_key);
      }
    } catch {
      // Keep deleting database rows even if external cleanup fails.
    }
  }

  getDB().run(`DELETE FROM transaction_attachments WHERE user_id = ? AND transaction_id IN (${placeholders})`, [userId, ...transactionIds]);
}
