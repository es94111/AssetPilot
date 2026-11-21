import { withLedgerWriteAudit } from '../../../lib/ledgerContext';
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../lib/apiHelpers";
import { queryAll, queryOne } from "../../../lib/db";
import {
  normalizeCurrency,
  normalizeAccountIcon,
  categoryFromAccountType,
  calcBalance,
  getExchangeRateToTwd,
  getUserExchangeRateMap,
  normalizeStatementClosingDay,
  creditCardStatementCycle,
  creditCardPaymentWindow,
} from "../../../lib/accountHelpers";
import { createAccount, type CreateAccountRequest } from "../../../lib/accountWriteCore";
import { todayInUserTz } from "../../../lib/userTime";

interface AccountRow {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  account_type: string;
  initial_balance: number;
  currency: string | null;
  icon: string | null;
  exclude_from_total: number | null;
  linked_bank_id: string | null;
  overseas_fee_rate: number | null;
  statement_closing_day: number | null;
  is_active: number | null;
  created_at: string | number | null;
  updated_at: string | number | null;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  // SAFETY: callers provide the domain type for the fixed SELECT projection;
  // the adapter exposes database scalar rows through a generic record.
  return rows as unknown as T[];
}

function asRow<T>(
  row: Record<string, string | number | null> | null,
): T | null {
  // SAFETY: the generic is tied to the fixed SELECT columns at each call site.
  return row as unknown as T | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const accounts = asRows<AccountRow>(
    queryAll("SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at", [
      auth.userId,
    ]),
  );
  const today = todayInUserTz(auth.userTimezone);
  const rateMap = getUserExchangeRateMap(auth.userId);
  const result = accounts.map((a) => {
    const accountCurrency = normalizeCurrency(a.currency);
    const balance = calcBalance(
      a.id,
      a.initial_balance,
      auth.userId,
      accountCurrency,
      rateMap,
    );
    const rate = rateMap[accountCurrency] ?? getExchangeRateToTwd(auth.userId, accountCurrency);
    const twdAccumulated =
      Math.round(balance * rate * 100) / 100;
    const category = a.category || categoryFromAccountType(a.account_type);

    // 信用卡：若已設定每月結帳日，計算「本期消費」與「上期已結帳帳單的消費/已繳」。
    const closingDay =
      category === "credit_card"
        ? normalizeStatementClosingDay(a.statement_closing_day)
        : null;
    let cycleSpending: number | null = null;
    let cycleStart: string | null = null;
    let cycleEnd: string | null = null;
    // 上期帳單（最近一張已結帳）：消費 + 已繳（繳款對應回它所清償的帳單）
    let lastCycleStart: string | null = null;
    let lastCycleEnd: string | null = null;
    let lastCycleSpending: number | null = null;
    let lastCyclePayment: number | null = null;
    if (closingDay != null) {
      const cycle = creditCardStatementCycle(closingDay, today);
      if (cycle) {
        // 與讀取/餘額邏輯一致：original_amount 為 0 的舊資料回退用 amount。
        const amtExpr =
          "CASE WHEN original_amount > 0 THEN original_amount ELSE amount END";
        const sumByType = (
          type: string,
          start: string,
          end: string,
        ): number => {
          const row = asRow<{ s: number | null }>(
            queryOne(
              `SELECT COALESCE(SUM(${amtExpr}), 0) AS s FROM transactions WHERE user_id = ? AND account_id = ? AND type = ? AND date >= ? AND date <= ?`,
              [auth.userId, a.id, type, start, end],
            ),
          );
          return Math.round((Number(row?.s) || 0) * 100) / 100;
        };
        cycleStart = cycle.start;
        cycleEnd = cycle.end;
        cycleSpending = sumByType("expense", cycle.start, cycle.end);

        // 上一張已結帳帳單 = 以「本期起日的前一天」（即上一個結帳日）為基準推算
        const prevBase = new Date(
          Date.UTC(
            Number(cycle.start.slice(0, 4)),
            Number(cycle.start.slice(5, 7)) - 1,
            Number(cycle.start.slice(8, 10)) - 1,
          ),
        );
        const prevBaseStr = `${prevBase.getUTCFullYear()}-${String(prevBase.getUTCMonth() + 1).padStart(2, "0")}-${String(prevBase.getUTCDate()).padStart(2, "0")}`;
        const last = creditCardStatementCycle(closingDay, prevBaseStr);
        if (last) {
          lastCycleStart = last.start;
          lastCycleEnd = last.end;
          lastCycleSpending = sumByType("expense", last.start, last.end);
          // 上期帳單的已繳 = 其繳款窗口（結帳後的下一個區間，即本期區間）內轉入此卡的金額。
          const pw = creditCardPaymentWindow(closingDay, last.end);
          if (pw) lastCyclePayment = sumByType("transfer_in", pw.start, pw.end);
        }
      }
    }

    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
      twdAccumulated,
      linkedBankId: a.linked_bank_id || null,
      category,
      overseasFeeRate: a.overseas_fee_rate ?? null,
      statementClosingDay: closingDay,
      cycleSpending,
      cycleStart,
      cycleEnd,
      lastCycleStart,
      lastCycleEnd,
      lastCycleSpending,
      lastCyclePayment,
      excludeFromTotal: a.exclude_from_total === 1,
      isActive: a.is_active !== 0,
      updatedAt: Number(a.updated_at) || 0,
    };
  });
  return NextResponse.json(result);
}

async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as CreateAccountRequest;
  // 建立邏輯與公開 API /api/v1/accounts 共用 lib/accountWriteCore.ts，兩端驗證一致。
  const result = createAccount(auth.userId, body);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  return NextResponse.json(result.account, { status: 201 });
}

export const POST = withLedgerWriteAudit(handlePOST);
