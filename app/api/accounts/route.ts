import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import {
  normalizeCurrency, normalizeAccountIcon, categoryFromAccountType, accountTypeFromCategory,
  calcBalance, getExchangeRateToTwd, normalizeStatementClosingDay, creditCardStatementCycle,
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

    // 信用卡：若已設定每月結帳日，計算「當期帳單區間」與該卡本期消費（原幣別 expense 加總）
    const closingDay = category === 'credit_card' ? normalizeStatementClosingDay(a.statement_closing_day) : null;
    let cycleSpending: number | null = null;
    let cycleStart: string | null = null;
    let cycleEnd: string | null = null;
    if (closingDay != null) {
      const cycle = creditCardStatementCycle(closingDay, today);
      if (cycle) {
        cycleStart = cycle.start;
        cycleEnd = cycle.end;
        // 與讀取/餘額邏輯一致：original_amount 為 0 的舊資料回退用 amount。
        const sumRow = asRow<{ s: number | null }>(queryOne(
          "SELECT COALESCE(SUM(CASE WHEN original_amount > 0 THEN original_amount ELSE amount END), 0) AS s FROM transactions WHERE user_id = ? AND account_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
          [auth.userId, a.id, cycle.start, cycle.end]
        ));
        cycleSpending = Math.round((Number(sumRow?.s) || 0) * 100) / 100;
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
