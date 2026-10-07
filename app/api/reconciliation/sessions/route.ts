import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { listReconciliationSessions } from '../../../../lib/reconciliationStore';
import { queryOne } from '../../../../lib/db';

/** GET /api/reconciliation/sessions — 目前帳本的對帳歷史（最新在前）。 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ledgerId = String((auth as { ledgerId?: string }).ledgerId || '');
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') || 20);

  const userRow = queryOne("SELECT language FROM user_settings WHERE user_id = ?", [auth.userId]);
  void userRow;

  const sessions = listReconciliationSessions(auth.userId, ledgerId, limit).map((row) => ({
    id: row.id,
    sourceKind: row.source_kind,
    sourceFormat: row.source_format,
    filename: row.filename,
    currency: row.currency,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    statementTotal: Number(row.statement_total) || 0,
    ledgerTotal: Number(row.ledger_total) || 0,
    matchedCount: Number(row.matched_count) || 0,
    counts: {
      ledger_only: Number(row.ledger_only_count) || 0,
      statement_only: Number(row.statement_only_count) || 0,
      amount_mismatch: Number(row.amount_mismatch_count) || 0,
    },
    createdAt: Number(row.created_at) || 0,
  }));

  return NextResponse.json({ sessions });
}
