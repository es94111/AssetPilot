import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiHelpers';
import { writeOperationAudit } from '@/lib/auditHelpers';
import { getRequestIpFromHeaders } from '@/lib/loginHelpers';
import { compressExistingS3Photos } from '@/lib/transactionAttachments';

export const runtime = 'nodejs';
export const maxDuration = 300;

function requestMeta(request: NextRequest) {
  return {
    ipAddress: getRequestIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') || '',
  };
}

// 重新壓縮 S3 上既有、尚未壓縮的交易憑證照片（原地覆寫）。僅管理員可用。
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await compressExistingS3Photos();
    writeOperationAudit({
      userId: auth.userId,
      role: 'admin',
      action: 'compress_transaction_photos',
      result: 'success',
      isAdminOperation: true,
      ...requestMeta(request),
      metadata: {
        // 受 auditHelpers 白名單限制，對映至允許的鍵：rows=已壓縮張數、
        // skipped=略過、errors=失敗、byteSize=壓縮後總位元組。
        rows: result.recompressed,
        skipped: result.skipped,
        errors: result.failed,
        byteSize: result.bytesAfter,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    writeOperationAudit({
      userId: auth.userId,
      role: 'admin',
      action: 'compress_transaction_photos',
      result: 'failed',
      isAdminOperation: true,
      ...requestMeta(request),
      metadata: { failure_reason: String((e as Error)?.message || e).slice(0, 200) },
    });
    return NextResponse.json({ error: (e as Error)?.message || '照片壓縮失敗' }, { status: 500 });
  }
}
