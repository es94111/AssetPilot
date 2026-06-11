import fs from 'fs';
import path from 'path';
import { getDB, queryAll, queryOne, saveDB } from './db';
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

// 解析 root 底下的目標路徑，並確保結果仍位於 root 內，避免 userId/transactionId/local_path
// 含 ../ 逃逸出儲存根目錄（path traversal）。
function resolveWithin(root: string, ...segments: string[]): string {
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- 下方立即用 path.relative 驗證結果仍在 root 內
  const target = path.resolve(root, ...segments);
  const rel = path.relative(root, target);
  if (rel === '' || rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error('路徑超出允許範圍');
  }
  return target;
}

function maxPhotoBytes() {
  const dbRow = queryOne('SELECT transaction_photo_max_bytes FROM system_settings WHERE id = 1');
  const dbVal = Number(dbRow?.transaction_photo_max_bytes);
  if (Number.isFinite(dbVal) && dbVal > 0) return dbVal;
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
  const dbRow = queryOne('SELECT transaction_photo_storage FROM system_settings WHERE id = 1');
  const dbStorage = String(dbRow?.transaction_photo_storage || '').trim();
  const source = (dbStorage === 'local' || dbStorage === 's3') ? dbStorage
    : String(process.env.TRANSACTION_PHOTO_DEFAULT_STORAGE || 'local').trim().toLowerCase();
  if (source === 's3') {
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
  const targetName = `${id}-${safeName(filename)}`;
  const dir = resolveWithin(root, userId, transactionId);
  const target = resolveWithin(root, userId, transactionId, targetName);
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

// 從完整備份還原單張交易憑證：把圖片位元組寫入目前預設儲存（local / S3），
// 並插入 transaction_attachments 列，保留原 attachment id、remap user_id。
// 供 lib/userDataBundle.ts 的合併式還原使用。
export async function restoreAttachmentFromBundle(userId: string, row: TransactionAttachmentRow, body: Buffer): Promise<void> {
  const id = String(row.id || '');
  if (!id) throw new Error('附件缺少 id');
  const transactionId = String(row.transaction_id || '');
  const filename = String(row.filename || 'photo.jpg');
  const mimeType = String(row.mime_type || 'application/octet-stream');
  const createdAt = Number(row.created_at) || Date.now();
  const byteSize = body.length;
  const storage = getDefaultTransactionPhotoStorage();
  const db = getDB();

  if (storage === 's3') {
    const uploaded = await saveS3Photo(userId, transactionId, id, filename, mimeType, body);
    db.run(
      'INSERT INTO transaction_attachments (id,user_id,transaction_id,storage,local_path,object_key,bucket,endpoint,filename,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, transactionId, 's3', '', uploaded.key, uploaded.bucket, uploaded.endpoint, filename, mimeType, byteSize, createdAt]
    );
  } else {
    const localPath = await saveLocalPhoto(userId, transactionId, id, filename, body);
    db.run(
      'INSERT INTO transaction_attachments (id,user_id,transaction_id,storage,local_path,object_key,bucket,endpoint,filename,mime_type,byte_size,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, userId, transactionId, 'local', localPath, '', '', '', filename, mimeType, byteSize, createdAt]
    );
  }
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

// 與網頁／App 客戶端壓縮一致：最長邊 1600px、JPEG 品質 82。
const PHOTO_COMPRESS_MAX_EDGE = 1600;
const PHOTO_COMPRESS_JPEG_QUALITY = 82;

export interface CompressExistingPhotosResult {
  scanned: number;
  recompressed: number;
  skipped: number;
  failed: number;
  bytesBefore: number;
  bytesAfter: number;
  errors: Array<{ id: string; error: string }>;
}

// 用 sharp 依 EXIF 轉正、縮到最長邊 1600、重新編碼為 JPEG 82。
// 只有體積真的變小才回傳結果（代表原檔尚未壓縮）；否則回 null 視為已壓縮、略過。
// sharp 以動態 import 延遲載入，讓一般上傳路徑不必相依此原生套件。
async function recompressPhoto(body: Buffer): Promise<Buffer | null> {
  const sharp = (await import('sharp')).default;
  const out = await sharp(body)
    .rotate()
    .resize(PHOTO_COMPRESS_MAX_EDGE, PHOTO_COMPRESS_MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: PHOTO_COMPRESS_JPEG_QUALITY })
    .toBuffer();
  return out.length < body.length ? out : null;
}

// 掃描 S3 上既有的交易憑證照片，將尚未壓縮者重新編碼並「原地覆寫」原檔，
// 同步更新 DB 的 byte_size 與 mime_type。回傳處理彙總。
export async function compressExistingS3Photos(): Promise<CompressExistingPhotosResult> {
  const result: CompressExistingPhotosResult = {
    scanned: 0, recompressed: 0, skipped: 0, failed: 0, bytesBefore: 0, bytesAfter: 0, errors: [],
  };
  const rows = queryAll(
    "SELECT * FROM transaction_attachments WHERE storage = 's3' ORDER BY created_at ASC"
  ) as unknown as TransactionAttachmentRow[];
  if (rows.length === 0) return result;

  const config = getPhotoS3Config();
  const db = getDB();
  let dirty = false;

  for (const row of rows) {
    result.scanned++;
    const key = row.object_key || '';
    if (!key || !String(row.mime_type || '').startsWith('image/')) {
      result.skipped++;
      continue;
    }
    try {
      const response = await getS3Object(config, key);
      const original = Buffer.from(await response.arrayBuffer());
      const compressed = await recompressPhoto(original);
      if (!compressed) {
        result.skipped++;
        continue;
      }
      await putS3Object(config, key, compressed, 'image/jpeg');
      db.run(
        'UPDATE transaction_attachments SET byte_size = ?, mime_type = ? WHERE id = ?',
        [compressed.length, 'image/jpeg', row.id]
      );
      dirty = true;
      result.recompressed++;
      result.bytesBefore += original.length;
      result.bytesAfter += compressed.length;
    } catch (e) {
      result.failed++;
      result.errors.push({ id: String(row.id), error: String((e as Error)?.message || e).slice(0, 200) });
    }
  }

  if (dirty) saveDB();
  return result;
}

export async function readTransactionAttachment(row: TransactionAttachmentRow): Promise<{ body: Buffer; mimeType: string; filename: string }> {
  if (row.storage === 'local') {
    const root = uploadsRoot();
    const target = resolveWithin(root, row.local_path || '');
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

export async function deleteTransactionAttachment(userId: string, transactionId: string, attachmentId: string): Promise<boolean> {
  const row = queryOne(
    'SELECT * FROM transaction_attachments WHERE id = ? AND transaction_id = ? AND user_id = ?',
    [attachmentId, transactionId, userId]
  ) as unknown as TransactionAttachmentRow | null;
  if (!row) return false;
  const root = uploadsRoot();
  try {
    if (row.storage === 'local' && row.local_path) {
      const target = resolveWithin(root, row.local_path);
      await fs.promises.unlink(target).catch(() => {});
    } else if (row.storage === 's3' && row.object_key) {
      const s3Config = getPhotoS3Config();
      await deleteS3Object(s3Config, row.object_key);
    }
  } catch {
    // Delete DB row even if physical file removal fails
  }
  getDB().run('DELETE FROM transaction_attachments WHERE id = ? AND user_id = ?', [attachmentId, userId]);
  return true;
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
        const target = resolveWithin(root, row.local_path);
        await fs.promises.unlink(target).catch(() => {});
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
