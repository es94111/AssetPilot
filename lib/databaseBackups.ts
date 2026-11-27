import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { makeBackupArchiveFilename, withNewBackupArchive } from './backupArchive';
import { BackupInputError } from './backupRequests';
import { assertRestorableBackupSql, createPostgresBackupSnapshot, RestoreLimitError } from './postgresBackup';
import { isPostgresResultTooLarge } from './postgresRuntime';

const BEFORE_RESTORE_BACKUP_RE = /^before-restore-\d{14}(?:\.sql|-[a-f\d-]{36}\.apb)$/;
const BACKUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
export const DATABASE_RESTORE_LOCK = 'assetpilot:database-restore';

export function createRestorableDatabaseBackup() {
  try {
    const backup = createPostgresBackupSnapshot();
    assertRestorableBackupSql(backup.sql);
    return backup;
  } catch (error) {
    if (isPostgresResultTooLarge(error)) throw new BackupInputError('database_result_too_large');
    if (error instanceof RestoreLimitError) throw new BackupInputError('database_too_large');
    throw error;
  }
}

export function createEncryptedDatabaseBackup(passphrase: string) {
  return withNewBackupArchive(passphrase, (archive) => archive.encrypt(createRestorableDatabaseBackup().sql));
}

export async function withDatabaseRestoreLock<T>(run: () => T): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  // The lock has its own connection so it spans the restore and any rollback transaction.
  client.on('error', () => console.error('[database-backup] restore_lock_connection_failed'));
  await client.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS locked',
      [DATABASE_RESTORE_LOCK],
    );
    if (!result.rows[0]?.locked) throw new BackupInputError('restore_in_progress');
    return await run();
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end().catch(() => undefined);
  }
}

function syncBackupDirectory(directory: string): void {
  // Windows does not expose directory handles through Node's fs.openSync.
  if (process.platform === 'win32') return;
  const descriptor = fs.openSync(directory, 'r');
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function writeRestoreSnapshot(archive: Buffer) {
  const dataDirectory = path.dirname(path.resolve(process.env.ENV_PATH || '.env'));
  const relativePath = path.join('backups', makeBackupArchiveFilename('before-restore'));
  const destination = path.join(dataDirectory, relativePath);
  const directory = path.dirname(destination);
  const firstCreated = fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const lastDirectoryToSync = firstCreated ? path.dirname(firstCreated) : directory;

  const temporary = `${destination}.tmp`;
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    try {
      fs.writeFileSync(fd, archive);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, destination);
    // Sync the new filename and any newly created directory entries before restoring.
    for (let current = directory; ; current = path.dirname(current)) {
      syncBackupDirectory(current);
      if (current === lastDirectoryToSync) break;
    }
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { /* best-effort cleanup */ }
    throw error;
  }
  return { path: destination, relativePath };
}

export function pruneRestoreSnapshots(currentPath: string): void {
  try {
    const directory = path.dirname(currentPath);
    const files = fs.readdirSync(directory).filter((name) => BEFORE_RESTORE_BACKUP_RE.test(name))
      .flatMap((name) => {
        const filePath = path.join(directory, name);
        try {
          const stat = fs.lstatSync(filePath);
          return stat.isFile() ? [{ path: filePath, modifiedAt: stat.mtimeMs }] : [];
        } catch {
          return [];
        }
      });
    const previous = files.filter((file) => file.path !== currentPath)
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
    const cutoff = Date.now() - BACKUP_RETENTION_MS;
    for (const [index, file] of previous.entries()) {
      if (index < 4 && file.modifiedAt >= cutoff) continue;
      try { fs.unlinkSync(file.path); } catch { /* best-effort retention */ }
    }
  } catch {
    // Retention errors have no effect on the completed restore.
  }
}
