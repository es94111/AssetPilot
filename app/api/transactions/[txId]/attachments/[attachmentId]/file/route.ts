import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../../../lib/db';
import { readTransactionAttachment, type TransactionAttachmentRow } from '../../../../../../../lib/transactionAttachments';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ txId: string; attachmentId: string }> };

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
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.filename)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message || '照片讀取失敗' }, { status: 500 });
  }
}
