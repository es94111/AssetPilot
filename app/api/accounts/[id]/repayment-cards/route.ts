import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../lib/db';
import { normalizeCurrency } from '../../../../../lib/accountHelpers';
import { toIsoUtc, __nowMs } from '../../../../../lib/userTime';
import { ownsResource } from '../../../../../lib/resourceHelpers';
import { collectPayableCards } from '../../../../../lib/creditCardRepayment';

type RouteContext = { params: Promise<{ id: string }> };

interface AccountRow {
  id: string;
  name: string;
  category: string | null;
  account_type: string;
  currency: string | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const a = asRow<AccountRow>(ownsResource('accounts', 'id', id, auth.userId));
  if (!a) return NextResponse.json({ error: 'NotFound', code: 'NotFound' }, { status: 404 });

  // 付款帳戶為信用卡 → 400 NotCreditCardPayer
  if (a.account_type === '信用卡') {
    return NextResponse.json({ error: '付款帳戶不可為信用卡', code: 'NotCreditCardPayer' }, { status: 400 });
  }

  const fromCurrency = normalizeCurrency(a.currency);
  const cards = collectPayableCards(auth.userId, id, fromCurrency);
  const totalDebt = cards.reduce((sum, c) => sum + c.debt, 0);

  // 每張卡只輸出 5 個欄位，不得輸出 createdAt（Principle IV 規則 2）
  return NextResponse.json({
    fromAccount: {
      id: a.id,
      name: a.name,
      currency: fromCurrency,
    },
    cards: cards.map((c) => ({
      id: c.id,
      name: c.name,
      currency: c.currency,
      debt: c.debt,
      debtInCardCurrency: c.debtInCardCurrency,
    })),
    totalDebt,
    minTotalAmount: cards.length,
    snapshotAt: toIsoUtc(__nowMs()),
  });
}