import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { ownsResource, assertOptimisticLock, lockErrorResponse } from '../../../../../lib/resourceHelpers';
import { getDB, saveDB } from '../../../../../lib/db';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';

type RouteContext = { params: Promise<{ txId: string }> };

interface TransactionRow {
  id: string;
  note: string | null;
  note_ai_modified: number | null;
  pre_ai_note: string | null;
  updated_at: string | number | null;
}

interface RestoreAiNoteRequest {
  expectedUpdatedAt?: number | string | null;
}

function getOwnedTransaction(txId: string, userId: string): TransactionRow | null {
  return ownsResource('transactions', 'id', txId, userId) as TransactionRow | null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const row = getOwnedTransaction(txId, auth.userId);
  if (!row) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  const restorable = Number(row.note_ai_modified) === 1;
  return NextResponse.json({
    ok: true,
    restorable,
    preAiNote: restorable ? (row.pre_ai_note || '') : null,
    currentNote: row.note || '',
    updatedAt: Number(row.updated_at) || 0,
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const existing = getOwnedTransaction(txId, auth.userId);
  if (!existing) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({})) as RestoreAiNoteRequest;
  try {
    assertOptimisticLock('transactions', 'id', txId, body.expectedUpdatedAt);
  } catch (e) {
    const err = e as { status?: number };
    if (err.status === 409) {
      return NextResponse.json(
        { error: '目前備註已是最新狀態，請重新查看該筆交易後再判斷是否還原', code: 'NoteChanged' },
        { status: 409 }
      );
    }
    return lockErrorResponse(e);
  }

  if (Number(existing.note_ai_modified) !== 1) {
    return NextResponse.json(
      { error: '此交易目前沒有可還原的備註修改紀錄', code: 'NotRestorable' },
      { status: 409 }
    );
  }

  const nowMs = Date.now();
  const restoredNote = existing.pre_ai_note || '';
  getDB().run(
    "UPDATE transactions SET note = ?, note_ai_modified = 0, pre_ai_note = '', updated_at = ? WHERE id = ? AND user_id = ?",
    [restoredNote, nowMs, txId, auth.userId]
  );
  saveDB();

  auditSensitiveAction(request, { userId: auth.userId }, {
    action: 'restore_ai_modified_note',
    metadata: { transaction_id: txId },
  });

  return NextResponse.json({ ok: true, note: restoredNote, updatedAt: nowMs });
}
