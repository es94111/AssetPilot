import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import { toIsoUtc } from '../../../../lib/userTime';

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

interface AllocationSnapshot {
  cardId: string;
  cardName: string;
  cardCurrency: string;
  amount: number;
  amountInCardCurrency: number;
  debtAtWrite: number;
  transferOutId: string;
  transferInId: string;
}

interface TxRow {
  date: string;
  account_id: string;
  to_account_id: string | null;
  original_amount: number;
  amount: number;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

// 金額比對容差（research.md 第 8 節）：original_amount 為 REAL，需容許往返誤差
const AMOUNT_TOLERANCE = 0.005;

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const summary = asRow<SummaryRow>(queryOne(
    'SELECT id, user_id, date, from_account_id, from_account_name, from_currency, total_amount, input_mode, allocations, created_at FROM credit_card_repayment_summaries WHERE id = ? AND user_id = ?',
    [id, auth.userId]
  ));
  if (!summary) return NextResponse.json({ error: 'NotFound', code: 'NotFound' }, { status: 404 });

  let snapshots: AllocationSnapshot[] = [];
  try {
    snapshots = JSON.parse(summary.allocations) as AllocationSnapshot[];
  } catch {
    snapshots = [];
  }

  // 讀取時比對各卡 status（research.md 第 8 節）：intact／modified／deleted
  let anyStale = false;
  const allocations = snapshots.map((snap) => {
    const outRow = asRow<TxRow>(queryOne(
      'SELECT date, account_id, to_account_id, original_amount, amount FROM transactions WHERE id = ? AND user_id = ?',
      [snap.transferOutId, auth.userId]
    ));
    const inRow = asRow<TxRow>(queryOne(
      'SELECT date, account_id, to_account_id, original_amount, amount FROM transactions WHERE id = ? AND user_id = ?',
      [snap.transferInId, auth.userId]
    ));

    let status: 'intact' | 'modified' | 'deleted' = 'intact';
    if (!outRow || !inRow) {
      status = 'deleted';
    } else {
      // date 比對
      if (outRow.date !== summary.date || inRow.date !== summary.date) {
        status = 'modified';
      }
      // 轉出列：account_id = 付款帳戶、to_account_id = 該卡
      else if (outRow.account_id !== summary.from_account_id || outRow.to_account_id !== snap.cardId) {
        status = 'modified';
      }
      // 轉入列：account_id = 該卡
      else if (inRow.account_id !== snap.cardId) {
        status = 'modified';
      }
      // 金額比對（容差 0.005）
      else if (Math.abs(Number(outRow.original_amount) - snap.amount) >= AMOUNT_TOLERANCE
        || Math.abs(Number(inRow.original_amount) - snap.amountInCardCurrency) >= AMOUNT_TOLERANCE) {
        status = 'modified';
      }
    }
    if (status !== 'intact') anyStale = true;
    return {
      cardId: snap.cardId,
      cardName: snap.cardName,
      cardCurrency: snap.cardCurrency,
      amount: snap.amount,
      amountInCardCurrency: snap.amountInCardCurrency,
      status,
    };
  });

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
    stale: anyStale,
    allocations,
  });
}