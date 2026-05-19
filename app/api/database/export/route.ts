// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, isPostgresRuntime } from '../../../../lib/db';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { createPostgresBackupSql } from '../../../../lib/postgresBackup';

function makeBackupTimestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    if (isPostgresRuntime()) {
      const sql = createPostgresBackupSql();
      const body = Buffer.from(sql, 'utf8');
      const ts = makeBackupTimestamp();
      const filename = `assetpilot-postgres-backup-${ts}.sql`;

      writeOperationAudit({
        userId: auth.userId,
        role: 'admin',
        action: 'download_backup',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
        userAgent: request.headers.get('user-agent') || '',
        result: 'success',
        isAdminOperation: true,
        metadata: { byteSize: body.length, filename, runtime: 'postgres' },
      });

      return new NextResponse(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/sql; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': String(body.length),
        },
      });
    }

    const data = getDB().export();
    const plain = Buffer.from(data);
    const ts = makeBackupTimestamp();
    const filename = `assetpilot-backup-${ts}.db`;

    writeOperationAudit({
      userId: auth.userId,
      role: 'admin',
      action: 'download_backup',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: true,
      metadata: { byteSize: plain.length, filename },
    });

    return new NextResponse(plain, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-sqlite3',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(plain.length),
      },
    });
  } catch (e) {
    console.error('資料庫匯出失敗:', e);
    return NextResponse.json({ error: '資料庫匯出失敗' }, { status: 500 });
  }
}
