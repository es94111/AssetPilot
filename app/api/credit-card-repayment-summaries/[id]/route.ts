import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import { toIsoUtc } from '../../../../lib/userTime';
import { evaluateRepaymentSummary } from '../../../../lib/creditCardRepayment';

type RouteContext = { params: Promise<{ id: string }> };

interface SummaryRow {
  id: string;
  user_id: string;
  date: string;
  from_account_id: string;
  from_account_name: string;
  from_currency: string;
  total_amount: number;
  input_mode: string;
  allocations: string;
  created_at: number;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const summary = asRow<SummaryRow>(queryOne(
    'SELECT id, user_id, date, from_account_id, from_account_name, from_currency, total_amount, input_mode, allocations, created_at FROM credit_card_repayment_summaries WHERE id = ? AND user_id = ?',
    [id, auth.userId]
  ));
  if (!summary) return NextResponse.json({ error: 'NotFound', code: 'NotFound' }, { status: 404 });

  // 讀取時比對各卡 status（FR-020b）：比對邏輯只有一份實作（lib/creditCardRepayment.ts）。
  const { allocations, stale } = evaluateRepaymentSummary(auth.userId, summary);

  // fromAccount.name／.currency 一律取自摘要快照欄位，不即時 JOIN accounts（FR-020a）
  return NextResponse.json({
    id: summary.id,
    date: summary.date,
    fromAccount: {
      id: summary.from_account_id,
      name: summary.from_account_name,
      currency: summary.from_currency,
    },
    totalAmount: summary.total_amount,
    inputMode: summary.input_mode,
    createdAt: toIsoUtc(summary.created_at),
    stale,
    allocations,
  });
}