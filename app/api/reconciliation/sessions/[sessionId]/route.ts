import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import {
  findReconciliationSession,
  listReconciliationItems,
} from '../../../../../lib/reconciliationStore';

/**
 * GET /api/reconciliation/sessions/[sessionId] — 單次對帳結果（含三類差異明細）。
 *
 * 授權：以 `user_id` 與 `ledger_id` 雙重比對；跨帳本或跨使用者一律回 404，
 * 不透露該 session 是否存在。
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> },
) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { sessionId } = await context.params;
  const ledgerId = String((auth as { ledgerId?: string }).ledgerId || '');
  const session = findReconciliationSession(auth.userId, String(sessionId || ''), ledgerId);
  if (!session) return NextResponse.json({ error: '找不到對帳結果' }, { status: 404 });

  let skippedTypes: Record<string, number> = {};
  try {
    skippedTypes = JSON.parse(session.skipped_types || '{}');
  } catch {
    skippedTypes = {};
  }

  const items = listReconciliationItems(auth.userId, session.id).map((row) => ({
    id: row.id,
    kind: row.kind,
    confidence: row.confidence,
    ledgerId: row.ledger_id,
    statementLine: Number(row.statement_line) || 0,
    date: row.date,
    direction: row.direction,
    ledgerAmount: Number(row.ledger_amount) || 0,
    statementAmount: Number(row.statement_amount) || 0,
    difference: Number(row.difference) || 0,
    ledgerDescription: row.ledger_description,
    statementDescription: row.statement_description,
  }));

  return NextResponse.json({
    session: {
      id: session.id,
      sourceKind: session.source_kind,
      sourceFormat: session.source_format,
      filename: session.filename,
      accountId: session.account_id,
      currency: session.currency,
      periodStart: session.period_start,
      periodEnd: session.period_end,
      statementTotal: Number(session.statement_total) || 0,
      ledgerTotal: Number(session.ledger_total) || 0,
      matchedCount: Number(session.matched_count) || 0,
      counts: {
        ledger_only: Number(session.ledger_only_count) || 0,
        statement_only: Number(session.statement_only_count) || 0,
        amount_mismatch: Number(session.amount_mismatch_count) || 0,
      },
      skippedTypes,
      createdAt: Number(session.created_at) || 0,
    },
    items,
  });
}
