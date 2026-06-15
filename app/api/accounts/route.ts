import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import {
  normalizeCurrency, normalizeAccountIcon, categoryFromAccountType, accountTypeFromCategory,
  calcBalance, getExchangeRateToTwd, normalizeStatementClosingDay, creditCardStatementCycle,
  creditCardPaymentWindow,
} from '../../../lib/accountHelpers';
import { todayInUserTz } from '../../../lib/userTime';
import { uid, todayStr } from '../../../lib/userDefaults';

type AccountCategory = 'bank' | 'credit_card' | 'cash' | 'virtual_wallet';

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
  created_at: string | number | null;
  updated_at: string | number | null;
}

interface CreateAccountRequest {
  name?: string;
  initialBalance?: number | string;
  currency?: string;
  icon?: string;
  category?: string;
  accountType?: string;
  excludeFromTotal?: boolean;
  linkedBankId?: string | null;
  overseasFeeRate?: number | string | null;
  statementClosingDay?: number | string | null;
}

const VALID_CATEGORIES: AccountCategory[] = ['bank', 'credit_card', 'cash', 'virtual_wallet'];

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function toAccountCategory(value: unknown, accountType?: string): AccountCategory {
  return VALID_CATEGORIES.includes(value as AccountCategory)
    ? value as AccountCategory
    : categoryFromAccountType(accountType || '') as AccountCategory;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const accounts = asRows<AccountRow>(queryAll('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at', [auth.userId]));
  const today = todayInUserTz(auth.userTimezone);
  const result = accounts.map(a => {
    const accountCurrency = normalizeCurrency(a.currency);
    const balance = calcBalance(a.id, a.initial_balance, auth.userId, accountCurrency);
    const twdAccumulated = Math.round(balance * getExchangeRateToTwd(auth.userId, accountCurrency) * 100) / 100;
    const category = a.category || categoryFromAccountType(a.account_type);

    // 信用卡：若已設定每月結帳日，計算「本期消費」與「上期已結帳帳單的消費/已繳」。
    const closingDay = category === 'credit_card' ? normalizeStatementClosingDay(a.statement_closing_day) : null;
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
        const amtExpr = 'CASE WHEN original_amount > 0 THEN original_amount ELSE amount END';
        const sumByType = (type: string, start: string, end: string): number => {
          const row = asRow<{ s: number | null }>(queryOne(
            `SELECT COALESCE(SUM(${amtExpr}), 0) AS s FROM transactions WHERE user_id = ? AND account_id = ? AND type = ? AND date >= ? AND date <= ?`,
            [auth.userId, a.id, type, start, end]
          ));
          return Math.round((Number(row?.s) || 0) * 100) / 100;
        };
        cycleStart = cycle.start;
        cycleEnd = cycle.end;
        cycleSpending = sumByType('expense', cycle.start, cycle.end);

        // 上一張已結帳帳單 = 以「本期起日的前一天」（即上一個結帳日）為基準推算
        const prevBase = new Date(Date.UTC(
          Number(cycle.start.slice(0, 4)), Number(cycle.start.slice(5, 7)) - 1, Number(cycle.start.slice(8, 10)) - 1
        ));
        const prevBaseStr = `${prevBase.getUTCFullYear()}-${String(prevBase.getUTCMonth() + 1).padStart(2, '0')}-${String(prevBase.getUTCDate()).padStart(2, '0')}`;
        const last = creditCardStatementCycle(closingDay, prevBaseStr);
        if (last) {
          lastCycleStart = last.start;
          lastCycleEnd = last.end;
          lastCycleSpending = sumByType('expense', last.start, last.end);
          // 上期帳單的已繳 = 其繳款窗口（結帳後的下一個區間，即本期區間）內轉入此卡的金額。
          const pw = creditCardPaymentWindow(closingDay, last.end);
          if (pw) lastCyclePayment = sumByType('transfer_in', pw.start, pw.end);
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
      updatedAt: Number(a.updated_at) || 0,
    };
  });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreateAccountRequest;
  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = body;
  const currency = normalizeCurrency(body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const safeName = String(name || '').trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return NextResponse.json({ error: '名稱必須為 1~64 字元', code: 'ValidationError', field: 'name' }, { status: 400 });
  }
  const category = toAccountCategory(body.category, body.accountType);
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = excludeFromTotal ? 1 : 0;

  let safeOverseasFeeRate: number | null = null;
  if (category === 'credit_card' && body.overseasFeeRate != null) {
    const v = Number(body.overseasFeeRate);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return NextResponse.json({ error: '海外手續費率須為 0~100（百分比）', code: 'ValidationError', field: 'overseasFeeRate' }, { status: 400 });
    }
    safeOverseasFeeRate = Math.round(v * 100) / 100;
  }

  let safeClosingDay: number | null = null;
  if (category === 'credit_card' && body.statementClosingDay != null && body.statementClosingDay !== '') {
    safeClosingDay = normalizeStatementClosingDay(body.statementClosingDay);
    if (safeClosingDay == null) {
      return NextResponse.json({ error: '結帳日須為 1~31', code: 'ValidationError', field: 'statementClosingDay' }, { status: 400 });
    }
  }

  let safeLinkedBankId: string | null = null;
  if (category === 'credit_card' && linkedBankId) {
    const bankAcc = asRow<{ id: string }>(queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')", [linkedBankId, auth.userId]));
    if (!bankAcc) return NextResponse.json({ error: '指定的銀行帳戶不存在' }, { status: 400 });
    safeLinkedBankId = linkedBankId;
  }

  const id = uid();
  const nowMs = Date.now();
  const safeInitialBalance = Math.round(Number(initialBalance) || 0);
  getDB().run(
    'INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, statement_closing_day, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, safeName, category, safeInitialBalance, currency, safeIcon, safeExclude, safeLinkedBankId, safeOverseasFeeRate, safeClosingDay, safeAccountType, todayStr(), nowMs]
  );
  saveDB();

  return NextResponse.json({
    id, name: safeName, category, accountType: safeAccountType,
    initialBalance: safeInitialBalance, currency, icon: safeIcon,
    excludeFromTotal: safeExclude === 1, linkedBankId: safeLinkedBankId,
    overseasFeeRate: safeOverseasFeeRate, statementClosingDay: safeClosingDay, updatedAt: nowMs,
  }, { status: 201 });
}
