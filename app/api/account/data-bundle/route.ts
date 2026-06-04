import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import { writeOperationAudit } from '@/lib/auditHelpers';
import { getRequestIpFromHeaders } from '@/lib/loginHelpers';
import { exportUserBundle, restoreUserBundle, BundleError } from '@/lib/userDataBundle';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 上傳備份上限（合理上界，避免記憶體爆量）：200 MB
const MAX_BUNDLE_BYTES = 200 * 1024 * 1024;

// GET：下載目前使用者的完整資料備份（含圖片）ZIP
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { buffer, filename, counts } = await exportUserBundle(auth.userId);

    writeOperationAudit({
      userId: auth.userId,
      role: auth.isAdmin ? 'admin' : 'user',
      action: 'export_data_bundle',
      ipAddress: getRequestIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { byteSize: buffer.length, filename, rows: Object.values(counts).reduce((a, b) => a + b, 0) },
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.length),
      },
    });
  } catch (e) {
    console.error('export_data_bundle failed', e);
    return NextResponse.json({ error: '完整備份匯出失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

// POST：上傳完整備份 ZIP，合併式還原（已存在略過、缺少才補回，不刪除/不覆蓋既有資料）
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ip = getRequestIpFromHeaders(request.headers);
  const ua = request.headers.get('user-agent') || '';

  try {
    const arrayBuffer = await request.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      return NextResponse.json({ error: '請選擇要還原的備份檔' }, { status: 400 });
    }
    if (buffer.length > MAX_BUNDLE_BYTES) {
      return NextResponse.json({ error: `備份檔過大（上限 ${Math.round(MAX_BUNDLE_BYTES / 1024 / 1024)} MB）` }, { status: 400 });
    }

    const summary = await restoreUserBundle(auth.userId, buffer);
    const totalInserted = Object.values(summary.perTable).reduce((a, t) => a + t.inserted, 0);
    const totalSkipped = Object.values(summary.perTable).reduce((a, t) => a + t.skipped, 0);

    writeOperationAudit({
      userId: auth.userId,
      role: auth.isAdmin ? 'admin' : 'user',
      action: 'restore_data_bundle',
      ipAddress: ip,
      userAgent: ua,
      result: 'success',
      isAdminOperation: false,
      metadata: { byteSize: buffer.length, imported: totalInserted, skipped: totalSkipped },
    });

    return NextResponse.json({
      ok: true,
      message: `還原完成：新增 ${totalInserted} 筆、略過 ${totalSkipped} 筆已存在資料、還原圖片 ${summary.attachmentsRestored} 張`,
      ...summary,
    });
  } catch (e) {
    const isBundleError = e instanceof BundleError;
    writeOperationAudit({
      userId: auth.userId,
      role: auth.isAdmin ? 'admin' : 'user',
      action: 'restore_data_bundle',
      ipAddress: ip,
      userAgent: ua,
      result: 'failed',
      isAdminOperation: false,
      metadata: { failure_reason: String(e instanceof Error ? e.message : e).slice(0, 200) },
    });
    if (isBundleError) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
    console.error('restore_data_bundle failed', e);
    return NextResponse.json({ error: '備份還原失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
