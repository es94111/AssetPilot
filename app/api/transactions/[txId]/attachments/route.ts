import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { queryOne, saveDB } from '../../../../../lib/db';
import { writeOperationAudit } from '../../../../../lib/auditHelpers';
import { getDefaultTransactionPhotoStorage, listTransactionAttachments, saveTransactionPhoto } from '../../../../../lib/transactionAttachments';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ txId: string }> };

function ownsTransaction(txId: string, userId: string) {
  return queryOne('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]);
}

function requestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
    userAgent: request.headers.get('user-agent') || '',
  };
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  if (!ownsTransaction(txId, auth.userId)) {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

  const attachments = listTransactionAttachments(auth.userId, txId).map((item) => ({
    id: item.id,
    filename: item.filename,
    mimeType: item.mime_type,
    byteSize: Number(item.byte_size) || 0,
    storage: item.storage,
    createdAt: Number(item.created_at) || 0,
    url: `/api/transactions/${txId}/attachments/${item.id}/file`,
  }));
  return NextResponse.json({ attachments });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  if (!ownsTransaction(txId, auth.userId)) {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: '上傳內容格式無效' }, { status: 400 });

  const storage = getDefaultTransactionPhotoStorage();

  const files = formData.getAll('photos').filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) return NextResponse.json({ error: '請選擇照片' }, { status: 400 });
  if (files.length > 5) return NextResponse.json({ error: '單筆交易最多上傳 5 張照片' }, { status: 400 });

  try {
    const uploaded = [];
    for (const file of files) {
      uploaded.push(await saveTransactionPhoto(auth.userId, txId, storage, file));
    }
    saveDB();
    writeOperationAudit({
      userId: auth.userId,
      role: auth.isAdmin ? 'admin' : 'user',
      action: 'upload_transaction_photo',
      result: 'success',
      isAdminOperation: false,
      ...requestMeta(request),
      metadata: {
        transaction_id: txId,
        storage,
        rows: uploaded.length,
        byteSize: uploaded.reduce((sum, item) => sum + item.byteSize, 0),
      },
    });
    return NextResponse.json({ attachments: uploaded }, { status: 201 });
  } catch (e) {
    writeOperationAudit({
      userId: auth.userId,
      role: auth.isAdmin ? 'admin' : 'user',
      action: 'upload_transaction_photo',
      result: 'failed',
      isAdminOperation: false,
      ...requestMeta(request),
      metadata: {
        transaction_id: txId,
        storage,
        failure_reason: String((e as Error)?.message || e).slice(0, 200),
      },
    });
    return NextResponse.json({ error: (e as Error)?.message || '照片上傳失敗' }, { status: 500 });
  }
}
