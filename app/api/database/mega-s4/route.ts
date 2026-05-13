// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB } from '../../../../lib/db';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getMegaS4ConfigStatus, makeMegaS4BackupFilename, uploadMegaS4Backup } from '../../../../lib/megaS4';

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

  return NextResponse.json(getMegaS4ConfigStatus());
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const status = getMegaS4ConfigStatus();
    if (!status.configured) {
      return NextResponse.json({ error: 'MEGA S4 尚未設定', missing: status.missing }, { status: 400 });
    }

    const data = getDB().export();
    const plain = Buffer.from(data);
    const filename = makeMegaS4BackupFilename();
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
