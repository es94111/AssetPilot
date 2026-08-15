import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { ownsResource } from '../../../../../lib/resourceHelpers';
import { deleteTransactionCascade } from '../../../../../lib/transactionWriteCore';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';

type RouteContext = { params: Promise<{ txId: string }> };

interface TransactionRow {
  id: string;
  ai_created: number | null;
  linked_id: string | null;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const row = ownsResource('transactions', 'id', txId, auth.userId) as TransactionRow | null;
  if (!row) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  if (Number(row.ai_created) !== 1) {
    return NextResponse.json(
      { error: '此交易並非 AI／MCP 建立，無法以此方式還原', code: 'NotRestorable' },
      { status: 409 }
    );
  }

  const removedIds = await deleteTransactionCascade(auth.userId, txId, row.linked_id || '');

  auditSensitiveAction(request, { userId: auth.userId }, {
    action: 'restore_ai_created_transaction',
    metadata: { transaction_id: txId, linked_transaction_id: row.linked_id || '' },
  });

  return NextResponse.json({ ok: true, removedIds });
}
