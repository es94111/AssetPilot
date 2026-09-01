import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../../lib/apiHelpers';
import { queryOne, saveDB } from '../../../../../../lib/db';
import { writeOperationAudit } from '../../../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../../../lib/loginHelpers';
import { deleteTransactionAttachment } from '../../../../../../lib/transactionAttachments';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ txId: string; attachmentId: string }> };

function requestMeta(request: NextRequest) {
  return {
    ipAddress: getRequestIpFromHeaders(request.headers),
    userAgent: request.headers.get('user-agent') || '',
  };
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId, attachmentId } = await params;
  if (!queryOne('SELECT id FROM transactions WHERE id = ? AND user_id = ?', [txId, auth.userId])) {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }
  const deleted = await deleteTransactionAttachment(auth.userId, txId, attachmentId);
  if (!deleted) return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  saveDB();
  writeOperationAudit({
    userId: auth.userId,
    role: auth.isAdmin ? 'admin' : 'user',
    action: 'delete_transaction_photo',
    result: 'success',
    isAdminOperation: false,
    ...requestMeta(request),
    metadata: { transaction_id: txId, attachment_id: attachmentId },
  });
  return NextResponse.json({ ok: true });
}
