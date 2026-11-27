export const BACKUP_ARCHIVE_PREFIX = 'APB';
export const MIN_BACKUP_PASSPHRASE_CHARACTERS = 16;
export const MAX_BACKUP_PASSPHRASE_BYTES = 1024;

export function isValidBackupPassphrase(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && !/[\r\n\uD800-\uDFFF]/u.test(value)
    && new TextEncoder().encode(value).length <= MAX_BACKUP_PASSPHRASE_BYTES
    && Array.from(value).length >= MIN_BACKUP_PASSPHRASE_CHARACTERS;
}
