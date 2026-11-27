import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import { makeBackupArchiveFilename } from '../../../../lib/backupArchive';
import { BACKUP_NO_STORE, BackupInputError, noStoreBackupResponse, readBackupPassphrase } from '../../../../lib/backupRequests';
import { createEncryptedDatabaseBackup } from '../../../../lib/databaseBackups';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return noStoreBackupResponse(auth);

  try {
    const passphrase = await readBackupPassphrase(request);
    const body = await createEncryptedDatabaseBackup(passphrase);
    const filename = makeBackupArchiveFilename('assetpilot-postgres-backup');

    auditSensitiveAction(request, auth, {
      action: 'download_backup',
      result: 'success',
      metadata: { byteSize: body.length, filename, format: 'apb' },
    });

    return new NextResponse(body, {
      status: 200,
      headers: {
        ...BACKUP_NO_STORE,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(body.length),
      },
    });
  } catch (error) {
    if (error instanceof BackupInputError) return error.toResponse();
    console.error('[database-backup] download_failed');
    return NextResponse.json(
      { error: '無法建立加密資料庫備份。', code: 'backup_failed' },
      { status: 500, headers: BACKUP_NO_STORE },
    );
  }
}
