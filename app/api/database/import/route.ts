import { NextResponse } from 'next/server';
import { readFileSync } from 'node:fs';
import { requireSuperAdmin } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import { BackupArchiveError, decryptBackupArchive, isBackupArchive, withNewBackupArchive } from '../../../../lib/backupArchive';
import { BACKUP_NO_STORE, BackupInputError, noStoreBackupResponse, readBackupRestore } from '../../../../lib/backupRequests';
import { createRestorableDatabaseBackup, pruneRestoreSnapshots, withDatabaseRestoreLock, writeRestoreSnapshot } from '../../../../lib/databaseBackups';
import { isAssetPilotPostgresBackup, MAX_RESTORE_SQL_BYTES, restorePostgresBackupSql, RestoreLimitError, RestoreTransactionError, RestoreValidationError } from '../../../../lib/postgresBackup';

export const runtime = 'nodejs';

function readLegacySql(file: Buffer): string {
  if (file.length > MAX_RESTORE_SQL_BYTES) throw new BackupInputError('too_large');
  let sql: string;
  try {
    sql = new TextDecoder('utf-8', { fatal: true }).decode(file);
  } catch {
    throw new BackupInputError('invalid_file');
  }
  if (!isAssetPilotPostgresBackup(sql)) throw new BackupInputError('invalid_file');
  return sql;
}

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return noStoreBackupResponse(auth);

  try {
    const { file, passphrase } = await readBackupRestore(request);
    const encrypted = isBackupArchive(file);
    const sql = encrypted ? await decryptBackupArchive(file, passphrase) : readLegacySql(file);

    return await withNewBackupArchive(passphrase, (archive) => withDatabaseRestoreLock(() => {
      let snapshot: ReturnType<typeof writeRestoreSnapshot> | undefined;
      let savingSnapshot = false;
      let introducedTables: string[] = [];
      try {
        restorePostgresBackupSql(sql, {
          beforeApply(createdTables) {
            savingSnapshot = true;
            const backup = createRestorableDatabaseBackup();
            const existingTables = new Set(backup.tables);
            introducedTables = createdTables.filter((table) => !existingTables.has(table));
            snapshot = writeRestoreSnapshot(archive.encrypt(backup.sql));
          },
        });
      } catch (error) {
        if (!snapshot) {
          if (!savingSnapshot && error instanceof RestoreValidationError) {
            if (error instanceof RestoreLimitError) {
              throw new BackupInputError(error.limit === 'bytes' ? 'too_large' : 'too_many_statements');
            }
            throw new BackupInputError('invalid_sql');
          }
          const snapshotError = error instanceof BackupInputError ? error : undefined;
          if (!snapshotError) console.error('[database-backup] snapshot_failed');
          auditSensitiveAction(request, auth, {
            action: 'restore_failed',
            result: 'failed',
            metadata: { failure_stage: 'before_restore_backup', failure_reason: snapshotError?.code ?? 'snapshot_failed' },
          });
          if (snapshotError) return snapshotError.toResponse();
          return NextResponse.json(
            { error: '無法建立還原前的加密副本，請檢查 backups/ 目錄與可用空間。', code: 'snapshot_failed' },
            { status: 500, headers: BACKUP_NO_STORE },
          );
        }

        const beforeRestorePath = snapshot.relativePath;
        try {
          // A confirmed native rollback preserves writes committed by other connections.
          if (!(error instanceof RestoreTransactionError && error.rolledBack)) {
            const recoverySql = archive.decrypt(readFileSync(snapshot.path));
            restorePostgresBackupSql(recoverySql, { dropIntroducedTables: introducedTables });
          }
        } catch {
          console.error('[database-backup] rollback_failed');
          auditSensitiveAction(request, auth, {
            action: 'restore_failed',
            result: 'failed',
            metadata: { failure_stage: 'rollback_postgres_sql', before_restore_path: beforeRestorePath },
          });
          return NextResponse.json(
            { error: 'RESTORE_FAILED_DB_UNKNOWN', message: '無法自動回復，請使用還原前的加密副本復原。', beforeRestorePath },
            { status: 500, headers: BACKUP_NO_STORE },
          );
        }

        pruneRestoreSnapshots(snapshot.path);
        auditSensitiveAction(request, auth, {
          action: 'restore_failed',
          result: 'rolled_back',
          metadata: { failure_stage: 'restore_postgres_sql', before_restore_path: beforeRestorePath },
        });
        return NextResponse.json(
          { error: 'RESTORE_FAILED_ROLLED_BACK', message: '資料庫還原失敗，已回復至還原前的狀態。', beforeRestorePath },
          { status: 422, headers: BACKUP_NO_STORE },
        );
      }

      // The restore helper only returns after calling beforeApply successfully.
      const beforeRestorePath = snapshot!.relativePath;
      pruneRestoreSnapshots(snapshot!.path);
      auditSensitiveAction(request, auth, {
        action: 'restore_backup',
        result: 'success',
        metadata: { format: encrypted ? 'apb' : 'sql', byteSize: file.length, before_restore_path: beforeRestorePath },
      });
      return NextResponse.json(
        { ok: true, message: 'PostgreSQL 資料庫還原成功，請重新登入。', beforeRestorePath },
        { headers: BACKUP_NO_STORE },
      );
    }));
  } catch (error) {
    const inputError = error instanceof BackupArchiveError ? new BackupInputError(error.code) : error;
    auditSensitiveAction(request, auth, {
      action: 'restore_failed',
      result: 'failed',
      metadata: {
        failure_stage: 'pre_validation',
        failure_reason: inputError instanceof BackupInputError ? inputError.code : 'restore_failed',
      },
    });
    if (inputError instanceof BackupInputError) return inputError.toResponse();
    console.error('[database-backup] restore_failed');
    return NextResponse.json(
      { error: '無法還原資料庫備份。', code: 'restore_failed' },
      { status: 500, headers: BACKUP_NO_STORE },
    );
  }
}
