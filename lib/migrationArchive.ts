import crypto from 'node:crypto';
import zlib from 'node:zlib';

export const MIGRATION_ARCHIVE_MAGIC = Buffer.from('APM1');
export const MIGRATION_FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MIGRATION_ARCHIVE_MAGIC.length + IV_LENGTH + TAG_LENGTH;

export interface MigrationPhotoDek {
  user_id: string;
  dek: string;
  created_at: number;
}

export interface MigrationWebhookSecret {
  id: string;
  secret: string;
}

export interface MigrationSecrets {
  photoDeks: MigrationPhotoDek[];
  webhookSecrets: MigrationWebhookSecret[];
}

export interface MigrationManifest {
  formatVersion: number;
  createdAt: string;
  counts: { photoDeks: number; webhookSecrets: number };
  includesPhotoFiles: false;
  checksum: string;
}

export interface MigrationPayload {
  manifest: MigrationManifest;
  sql: string;
  secrets: MigrationSecrets;
}

export function parseMigrationKey(raw: string | undefined): Buffer {
  const text = (raw || '').trim();
  if (!text) throw new Error('缺少搬遷金鑰（ASSETPILOT_MIGRATION_KEY 或 --key-file）');
  const key = Buffer.from(text, 'base64');
  if (key.length !== 32) throw new Error('搬遷金鑰必須是 base64 編碼的 32 bytes');
  return key;
}

export function generateMigrationKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

function computeChecksum(sql: string, secrets: MigrationSecrets): string {
  return crypto
    .createHash('sha256')
    .update(sql)
    .update('\0')
    .update(JSON.stringify(secrets))
    .digest('hex');
}

export function buildMigrationPayload(sql: string, secrets: MigrationSecrets, now = new Date()): MigrationPayload {
  return {
    manifest: {
      formatVersion: MIGRATION_FORMAT_VERSION,
      createdAt: now.toISOString(),
      counts: {
        photoDeks: secrets.photoDeks.length,
        webhookSecrets: secrets.webhookSecrets.length,
      },
      includesPhotoFiles: false,
      checksum: computeChecksum(sql, secrets),
    },
    sql,
    secrets,
  };
}

export function packMigrationArchive(payload: MigrationPayload, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error('搬遷金鑰長度錯誤');
  const plain = zlib.gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MIGRATION_ARCHIVE_MAGIC);
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MIGRATION_ARCHIVE_MAGIC, iv, cipher.getAuthTag(), body]);
}

export function unpackMigrationArchive(archive: Buffer, key: Buffer): MigrationPayload {
  if (key.length !== 32) throw new Error('搬遷金鑰長度錯誤');
  if (archive.length <= HEADER_LENGTH || !archive.subarray(0, 4).equals(MIGRATION_ARCHIVE_MAGIC)) {
    throw new Error('不是有效的 AssetPilot 搬遷包');
  }
  const iv = archive.subarray(4, 4 + IV_LENGTH);
  const tag = archive.subarray(4 + IV_LENGTH, HEADER_LENGTH);
  const body = archive.subarray(HEADER_LENGTH);

  let json: string;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(MIGRATION_ARCHIVE_MAGIC);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(body), decipher.final()]);
    json = zlib.gunzipSync(plain).toString('utf8');
  } catch {
    throw new Error('搬遷包解密失敗：金鑰錯誤或檔案已遭竄改');
  }

  const payload = JSON.parse(json) as MigrationPayload;
  if (!payload?.manifest || typeof payload.sql !== 'string' || !payload.secrets) {
    throw new Error('搬遷包內容格式錯誤');
  }
  if (payload.manifest.formatVersion !== MIGRATION_FORMAT_VERSION) {
    throw new Error(`不支援的搬遷包版本：${payload.manifest.formatVersion}`);
  }
  if (computeChecksum(payload.sql, payload.secrets) !== payload.manifest.checksum) {
    throw new Error('搬遷包 checksum 驗證失敗');
  }
  if (
    payload.manifest.counts.photoDeks !== payload.secrets.photoDeks.length ||
    payload.manifest.counts.webhookSecrets !== payload.secrets.webhookSecrets.length
  ) {
    throw new Error('搬遷包資料筆數與 manifest 不符');
  }
  return payload;
}
