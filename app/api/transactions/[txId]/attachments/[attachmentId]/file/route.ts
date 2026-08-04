import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../../../lib/db';
import { readTransactionAttachment, type TransactionAttachmentRow } from '../../../../../../../lib/transactionAttachments';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ txId: string; attachmentId: string }> };

// 僅允許可安全 inline 顯示的點陣圖 MIME；其餘（SVG、未知類型等）一律以 attachment +
// application/octet-stream 下載，避免瀏覽器於本站 origin 執行 SVG 內嵌 script。
const INLINE_SAFE_IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/heic', 'image/tiff',
]);

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId, attachmentId } = await params;
  const row = queryOne(
    'SELECT * FROM transaction_attachments WHERE id = ? AND transaction_id = ? AND user_id = ?',
    [attachmentId, txId, auth.userId]
  ) as unknown as TransactionAttachmentRow | null;
  if (!row) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  try {
    const file = await readTransactionAttachment(row);
    const mimeType = file.mimeType || 'application/octet-stream';
    const inlineSafe = INLINE_SAFE_IMAGE_TYPES.has(mimeType.toLowerCase());
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'Content-Type': inlineSafe ? mimeType : 'application/octet-stream',
        'Content-Disposition': `${inlineSafe ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.filename)}"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || '照片讀取失敗' }, { status: 500 });
  }
}
