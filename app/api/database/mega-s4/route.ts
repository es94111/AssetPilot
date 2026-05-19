// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, isPostgresRuntime } from '../../../../lib/db';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getMegaS4ConfigStatus, makeMegaS4BackupFilename, uploadMegaS4Backup } from '../../../../lib/megaS4';
import { writeEnvVars } from '../../../../lib/envSecrets';
import { createPostgresBackupSql } from '../../../../lib/postgresBackup';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function auditBase(request, auth) {
  return {
    userId: auth.userId,
    role: 'admin',
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
    userAgent: request.headers.get('user-agent') || '',
    isAdminOperation: true,
  };
}

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
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const status = getMegaS4ConfigStatus();
    if (!status.configured) {
      return NextResponse.json({ error: 'MEGA S4 尚未設定', missing: status.missing }, { status: 400 });
    }

    const postgresRuntime = isPostgresRuntime();
    const plain = postgresRuntime
      ? Buffer.from(createPostgresBackupSql(), 'utf8')
      : Buffer.from(getDB().export());
    const filename = postgresRuntime
      ? makeMegaS4BackupFilename().replace(/\.db$/u, '.sql')
      : makeMegaS4BackupFilename();
    const result = await uploadMegaS4Backup(plain, filename);

    writeOperationAudit({
      ...auditBase(request, auth),
      action: 'mega_s4_backup',
      result: 'success',
      metadata: {
        byteSize: result.byteSize,
        filename,
        bucket: result.bucket,
        object_key: result.key,
        endpoint: result.endpoint,
        region: result.region,
        runtime: postgresRuntime ? 'postgres' : 'sqlite',
      },
    });

    return NextResponse.json({ ok: true, filename, ...result });
  } catch (e) {
    console.error('MEGA S4 備份失敗:', e);
    writeOperationAudit({
      ...auditBase(request, auth),
      action: 'mega_s4_backup',
      result: 'failed',
      metadata: { failure_reason: String(e?.message || e).slice(0, 200) },
    });
    return NextResponse.json({ error: e?.message || 'MEGA S4 備份失敗' }, { status: 500 });
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

  writeEnvVars(updates);

  writeOperationAudit({
    ...auditBase(request, auth),
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
