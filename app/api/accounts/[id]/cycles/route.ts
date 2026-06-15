import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { queryOne } from '../../../../../lib/db';
import {
  normalizeCurrency, categoryFromAccountType, normalizeStatementClosingDay,
  creditCardStatementCycles, creditCardPaymentWindow,
} from '../../../../../lib/accountHelpers';
import { todayInUserTz } from '../../../../../lib/userTime';
import { ownsResource } from '../../../../../lib/resourceHelpers';

type RouteContext = { params: Promise<{ id: string }> };

interface AccountRow {
  id: string;
  name: string;
  category: string | null;
  account_type: string;
  currency: string | null;
  statement_closing_day: number | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

// 每張信用卡的歷史每期帳單：每期含消費（expense）與實際繳款（轉入此卡）金額。
export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const a = asRow<AccountRow>(ownsResource('accounts', 'id', id, auth.userId));
  if (!a) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  const category = a.category || categoryFromAccountType(a.account_type);
  if (category !== 'credit_card') {
    return NextResponse.json({ error: '此帳戶不是信用卡', code: 'NotCreditCard' }, { status: 400 });
  }
  const closingDay = normalizeStatementClosingDay(a.statement_closing_day);
  if (closingDay == null) {
    return NextResponse.json({ error: '尚未設定結帳日', code: 'NoClosingDay' }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const count = Math.max(1, Math.min(36, Number(searchParams.get('count')) || 12));
  const today = todayInUserTz(auth.userTimezone);
  const currency = normalizeCurrency(a.currency);

  const amtExpr = 'CASE WHEN original_amount > 0 THEN original_amount ELSE amount END';
  const sumByType = (type: string, start: string, end: string): number => {
    const row = asRow<{ s: number | null }>(queryOne(
      `SELECT COALESCE(SUM(${amtExpr}), 0) AS s FROM transactions WHERE user_id = ? AND account_id = ? AND type = ? AND date >= ? AND date <= ?`,
      [auth.userId, a.id, type, start, end]
    ));
    return Math.round((Number(row?.s) || 0) * 100) / 100;
  };

  const cycles = creditCardStatementCycles(closingDay, today, count).map((c, idx) => {
    // 繳款對應回它所清償的帳單：此帳單結帳後的下一個區間內轉入此卡的金額才算它的繳款。
    const pw = creditCardPaymentWindow(closingDay, c.end);
    return {
      start: c.start,
      end: c.end,
      current: idx === 0,
      spending: sumByType('expense', c.start, c.end),
      payment: pw ? sumByType('transfer_in', pw.start, pw.end) : 0,
    };
  });

  return NextResponse.json({
    id: a.id,
    name: a.name,
    currency,
    statementClosingDay: closingDay,
    cycles,
  });
}
