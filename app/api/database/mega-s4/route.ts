// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin, requireSuperAdmin } from '../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../lib/auditHelpers';
import { makeBackupArchiveFilename } from '../../../../lib/backupArchive';
import { BACKUP_NO_STORE, BackupInputError, noStoreBackupResponse, readBackupPassphrase } from '../../../../lib/backupRequests';
import { createEncryptedDatabaseBackup } from '../../../../lib/databaseBackups';
import { getMegaS4ConfigStatus, uploadMegaS4Backup } from '../../../../lib/megaS4';
import { assertSafeS3Endpoint } from '../../../../lib/s3Storage';
import { writeEnvVars } from '../../../../lib/envSecrets';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(getMegaS4ConfigStatus(), {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export async function POST(request) {
  const auth = await requireSuperAdmin(request);
  if (auth instanceof NextResponse) return noStoreBackupResponse(auth);

  try {
    const passphrase = await readBackupPassphrase(request);
    const status = getMegaS4ConfigStatus();
    if (!status.configured) {
      return NextResponse.json(
        { error: 'MEGA S4 尚未設定', missing: status.missing },
        { status: 400, headers: BACKUP_NO_STORE },
      );
    }

    const archive = await createEncryptedDatabaseBackup(passphrase);
    const filename = makeBackupArchiveFilename('assetpilot-backup');
    const result = await uploadMegaS4Backup(archive, filename);

    auditSensitiveAction(request, auth, {
      action: 'mega_s4_backup',
      result: 'success',
      metadata: {
        byteSize: result.byteSize,
        filename,
        bucket: result.bucket,
        object_key: result.key,
        endpoint: result.endpoint,
        region: result.region,
        format: 'apb',
      },
    });

    return NextResponse.json({ ok: true, filename, ...result }, { headers: BACKUP_NO_STORE });
  } catch (error) {
    if (error instanceof BackupInputError) return error.toResponse();
    console.error('[database-backup] mega_s4_backup_failed');
    auditSensitiveAction(request, auth, {
      action: 'mega_s4_backup',
      result: 'failed',
      metadata: { failure_reason: 'mega_s4_backup_failed' },
    });
    return NextResponse.json(
      { error: '無法完成 MEGA S4 加密備份。', code: 'backup_failed' },
      { status: 500, headers: BACKUP_NO_STORE },
    );
  }
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const FIELD_MAP = {
    bucket: 'MEGA_S4_BUCKET',
    region: 'MEGA_S4_REGION',
    endpoint: 'MEGA_S4_ENDPOINT',
    prefix: 'MEGA_S4_PREFIX',
    accessKeyId: 'MEGA_S4_ACCESS_KEY_ID',
    secretAccessKey: 'MEGA_S4_SECRET_ACCESS_KEY',
  };

  const updates = {};
  for (const [field, envKey] of Object.entries(FIELD_MAP)) {
    if (body[field] !== undefined && body[field] !== null) {
      updates[envKey] = String(body[field]).trim();
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '未提供任何欄位' }, { status: 400 });
  }

  if (updates['MEGA_S4_ENDPOINT']) {
    const rawEndpoint = updates['MEGA_S4_ENDPOINT'];
    const normalizedEndpoint = /^https?:\/\//i.test(rawEndpoint)
      ? rawEndpoint
      : `https://${rawEndpoint}`;
    try {
      await assertSafeS3Endpoint(normalizedEndpoint);
    } catch (e) {
      return NextResponse.json({ error: e?.message || 'S3 endpoint 驗證失敗' }, { status: 400 });
    }
  }

  writeEnvVars(updates);

  auditSensitiveAction(request, auth, {
    action: 'mega_s4_config_update',
    result: 'success',
    metadata: {
      bucket: updates['MEGA_S4_BUCKET'],
      region: updates['MEGA_S4_REGION'],
      endpoint: updates['MEGA_S4_ENDPOINT'],
    },
  });

  return NextResponse.json(getMegaS4ConfigStatus(), {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
