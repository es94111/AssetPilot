import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/apiHelpers';
import { writeOperationAudit } from '@/lib/auditHelpers';
import { encryptExistingPhotos } from '@/lib/transactionAttachments';

export const runtime = 'nodejs';
export const maxDuration = 300;

function requestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
    userAgent: request.headers.get('user-agent') || '',
  };
}

// 批次將既有明文交易憑證照片就地加密（本機與 S3）。需先設定 PHOTO_MASTER_KEY。僅管理員可用。
export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await encryptExistingPhotos();
    if (!result.enabled) {
      return NextResponse.json(
        { error: '尚未設定 PHOTO_MASTER_KEY，無法加密照片', ...result },
        { status: 400 }
      );
    }
    writeOperationAudit({
      userId: auth.userId,
      role: 'admin',
      action: 'encrypt_transaction_photos',
      result: 'success',
      isAdminOperation: true,
      ...requestMeta(request),
      metadata: {
        // 對映稽核白名單鍵：rows=本次加密張數、skipped=已加密+略過、errors=失敗。
        rows: result.encrypted,
        skipped: result.alreadyEncrypted + result.skipped,
        errors: result.failed,
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    writeOperationAudit({
      userId: auth.userId,
      role: 'admin',
      action: 'encrypt_transaction_photos',
      result: 'failed',
      isAdminOperation: true,
      ...requestMeta(request),
      metadata: { failure_reason: String((e as Error)?.message || e).slice(0, 200) },
    });
    return NextResponse.json({ error: (e as Error)?.message || '照片加密失敗' }, { status: 500 });
  }
}
