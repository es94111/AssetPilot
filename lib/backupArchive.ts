import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scrypt } from 'node:crypto';
import { BACKUP_ARCHIVE_PREFIX } from './backupPassphrase';

const MAGIC = Buffer.from(`${BACKUP_ARCHIVE_PREFIX}1`);
const PREFIX = Buffer.from(BACKUP_ARCHIVE_PREFIX);
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const NONCE_OFFSET = MAGIC.length + SALT_BYTES;
const HEADER_BYTES = NONCE_OFFSET + NONCE_BYTES;
export const BACKUP_ARCHIVE_OVERHEAD = HEADER_BYTES + TAG_BYTES;

export class BackupArchiveError extends Error {
  constructor(readonly code: 'invalid_file' | 'unsupported_version' | 'decryption_failed') {
    super(code);
  }
}

export function isBackupArchive(file: Buffer): boolean {
  return file.subarray(0, PREFIX.length).equals(PREFIX);
}

export function makeBackupArchiveFilename(prefix: string): string {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  return `${prefix}-${timestamp}-${randomUUID()}.apb`;
}

function assertArchiveHeader(file: Buffer): void {
  if (file.length <= BACKUP_ARCHIVE_OVERHEAD || !isBackupArchive(file)) {
    throw new BackupArchiveError('invalid_file');
  }
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new BackupArchiveError('unsupported_version');
  }
}

function backupKey(passphrase: string, salt: Buffer): Promise<Buffer> {
  // These parameters belong to APB1 and must remain stable for restores.
  return new Promise((resolve, reject) => {
    scrypt(passphrase, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

function openWithKey(file: Buffer, key: Buffer): string {
  const header = file.subarray(0, HEADER_BYTES);
  const nonce = header.subarray(NONCE_OFFSET);
  const tag = file.subarray(HEADER_BYTES, BACKUP_ARCHIVE_OVERHEAD);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
    decipher.setAAD(header);
    decipher.setAuthTag(tag);
    const plaintext = decipher.update(file.subarray(BACKUP_ARCHIVE_OVERHEAD));
    try {
      // GCM has no padding. final() verifies the authentication tag before decoding.
      decipher.final();
      return new TextDecoder('utf-8', { fatal: true }).decode(plaintext);
    } finally {
      plaintext.fill(0);
    }
  } catch {
    throw new BackupArchiveError('decryption_failed');
  }
}

export async function decryptBackupArchive(file: Buffer, passphrase: string): Promise<string> {
  assertArchiveHeader(file);
  const key = await backupKey(passphrase, file.subarray(MAGIC.length, NONCE_OFFSET));
  try {
    return openWithKey(file, key);
  } finally {
    key.fill(0);
  }
}

interface NewBackupArchive {
  encrypt(sql: string): Buffer<ArrayBuffer>;
  decrypt(file: Buffer): string;
}

/** Derive the snapshot key before reading the database so restore and rollback can apply synchronously. */
export async function withNewBackupArchive<T>(
  passphrase: string,
  run: (archive: NewBackupArchive) => T,
): Promise<T> {
  const salt = randomBytes(SALT_BYTES);
  const key = await backupKey(passphrase, salt);
  try {
    return await run({
      encrypt(sql) {
        const nonce = randomBytes(NONCE_BYTES);
        const header = Buffer.concat([MAGIC, salt, nonce]);
        const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: TAG_BYTES });
        cipher.setAAD(header);
        const ciphertext = cipher.update(sql, 'utf8');
        const final = cipher.final();
        return Buffer.concat([header, cipher.getAuthTag(), ciphertext, final]);
      },
      decrypt(file) {
        assertArchiveHeader(file);
        return openWithKey(file, key);
      },
    });
  } finally {
    key.fill(0);
  }
}
