// app/api/v1/transactions/route.ts — API Token 認證的公開交易端點（issue #258）
//
// GET  → 列出交易（需 transactions:read）
// POST → 新增交易（需 transactions:write），並會觸發 transaction.created Webhook
//
// 與站內 /api/transactions 共用相同的寫入核心與換算邏輯，差別只在認證方式
// （Authorization: Bearer ap_api_…）與回應欄位（對外穩定欄位，不含內部 AI 旗標）。
import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '../../../../lib/db';
import { convertToTwd, resolveOverseasFee } from '../../../../lib/accountHelpers';
import { todayInUserTz, isValidIsoDate } from '../../../../lib/userTime';
import { computeTwdAmount } from '../../../../lib/moneyDecimal';
import { insertIncomeExpenseTransaction } from '../../../../lib/transactionWriteCore';
import { emitTransactionEvent } from '../../../../lib/transactionWebhooks';
import {
  requireApiToken,
  jsonNoStore,
} from '../../../../lib/apiTokenRequestAuth';

const TRANSACTION_TYPES = new Set(['income', 'expense']);
const MAX_ITEMS = 200;

interface TransactionRow {
  id: string;
  type: string;
  amount: number | string | null;
  currency: string | null;
  original_amount: number | string | null;
  twd_amount: number | string | null;
  date: string | null;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
  exclude_from_stats: number | null;
}

/** 對外只暴露整合方需要且穩定的欄位（不含 AI 標記、手續費連結等內部欄位）。 */
function serializeTransaction(row: TransactionRow) {
  return {
    id: String(row.id),
    type: String(row.type),
    amount: Number(row.twd_amount ?? row.amount ?? 0),
    originalAmount: row.original_amount == null ? null : Number(row.original_amount),
    currency: String(row.currency || 'TWD'),
    date: String(row.date || ''),
    categoryId: row.category_id || null,
    accountId: row.account_id || null,
    note: String(row.note || ''),
    excludeFromStats: Number(row.exclude_from_stats) === 1,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireApiToken(request, 'transactions:read');
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = String(searchParams.get('dateFrom') || '').trim();
  const dateTo = String(searchParams.get('dateTo') || '').trim();
  const type = String(searchParams.get('type') || '').trim();
  const limitRaw = parseInt(searchParams.get('limit') || '', 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_ITEMS) : 50;

  if (dateFrom && !isValidIsoDate(dateFrom)) {
    return jsonNoStore({ error: 'dateFrom 格式無效', code: 'ValidationError' }, { status: 400 });
  }
  if (dateTo && !isValidIsoDate(dateTo)) {
    return jsonNoStore({ error: 'dateTo 格式無效', code: 'ValidationError' }, { status: 400 });
  }
  if (type && !TRANSACTION_TYPES.has(type)) {
    return jsonNoStore({ error: 'type 必須為 income 或 expense', code: 'ValidationError' }, { status: 400 });
  }

  // 僅回傳一般收支（排除自動產生的手續費副交易與轉帳腳），與對外語意一致。
  let where = "t.user_id = ? AND t.type IN ('income', 'expense') AND COALESCE(t.is_fx_fee, 0) = 0";
  const params: Array<string | number | null> = [auth.userId];
  if (dateFrom) { where += ' AND t.date >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND t.date <= ?'; params.push(dateTo); }
  if (type) { where += ' AND t.type = ?'; params.push(type); }

  const rows = queryAll(
    `SELECT t.id, t.type, t.amount, t.currency, t.original_amount, t.twd_amount, t.date,
            t.category_id, t.account_id, t.note, t.exclude_from_stats
       FROM transactions t
      WHERE ${where}
      ORDER BY t.date DESC, t.created_at DESC
      LIMIT ?`,
    [...params, limit],
  ) as unknown as TransactionRow[];

  return jsonNoStore({ transactions: rows.map(serializeTransaction) });
}

export async function POST(request: NextRequest) {
  const auth = requireApiToken(request, 'transactions:write');
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    type?: string;
    amount?: unknown;
    originalAmount?: unknown;
    currency?: string;
    fxRate?: number | string | null;
    fxFee?: number | string | null;
    date?: string;
    categoryId?: string | null;
    accountId?: string | null;
    note?: string;
    excludeFromStats?: boolean;
  };

  const type = String(body?.type || '');
  if (!TRANSACTION_TYPES.has(type)) {
    return jsonNoStore({ error: 'type 必須為 income 或 expense', code: 'ValidationError' }, { status: 400 });
  }

  const userTimezone = 'Asia/Taipei';
  const rawDate = body?.date;
  const date = rawDate == null || String(rawDate).trim() === ''
    ? todayInUserTz(userTimezone)
    : String(rawDate).trim();
  if (!isValidIsoDate(date)) {
    return jsonNoStore({ error: '日期格式無效', code: 'ValidationError', field: 'date' }, { status: 400 });
  }

  const numAmt = Number(body.originalAmount ?? body.amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return jsonNoStore({ error: '金額必須大於 0', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }

  let converted;
  try {
    converted = convertToTwd(
      Number(body.originalAmount ?? body.amount),
      body.currency || 'TWD',
      body.fxRate ?? undefined,
      auth.userId,
    );
  } catch (e) {
    return jsonNoStore(
      { error: e instanceof Error ? e.message : '金額格式錯誤', code: 'ValidationError' },
      { status: 400 },
    );
  }

  const categoryId = body.categoryId ? String(body.categoryId) : null;
  const accountId = body.accountId ? String(body.accountId) : null;
  const note = String(body.note || '');

  // 與站內 /api/transactions 相同：分類／帳戶必須屬於呼叫者，且分類需為子分類。
  // 缺這層檢查會讓其他使用者的 id 被寫入自己的交易，並在報表中顯示他人分類名稱（issue #258 review）。
  if (categoryId) {
    const catRow = queryOne(
      'SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?',
      [categoryId, auth.userId],
    );
    if (!catRow) {
      return jsonNoStore({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
    }
    if (!catRow.parent_id) {
      return jsonNoStore(
        { error: '交易必須指派至子分類，不能直接掛在父分類底下', code: 'ValidationError', field: 'categoryId' },
        { status: 400 },
      );
    }
  }
  if (accountId) {
    const accRow = queryOne(
      'SELECT id, category, account_type, is_active FROM accounts WHERE id = ? AND user_id = ?',
      [accountId, auth.userId],
    );
    if (!accRow) {
      return jsonNoStore({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' }, { status: 400 });
    }
    const isCreditCard = accRow.category === 'credit_card' || accRow.account_type === '信用卡';
    if (type === 'expense' && isCreditCard && Number(accRow.is_active) === 0) {
      return jsonNoStore({ error: '此信用卡已停用，無法新增刷卡消費', code: 'CreditCardDisabled' }, { status: 409 });
    }
  }

  // 國外刷卡手續費另存為獨立交易，故原交易 twd_amount 不含手續費（fx_fee=0）。
  const fxFee = resolveOverseasFee({
    userId: auth.userId,
    accountId,
    currency: converted.currency,
    twdBase: converted.twdAmount,
    clientFxFee: body.fxFee,
  });
  const twdAmountInt = computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    converted.fxRate,
    0,
  );

  let result;
  try {
    result = insertIncomeExpenseTransaction({
      userId: auth.userId,
      type,
      twdAmount: twdAmountInt,
      currency: converted.currency,
      originalAmount: converted.originalAmount,
      fxRate: converted.fxRate,
      fxFee,
      date,
      categoryId,
      accountId,
      note,
      excludeFromStats: !!body.excludeFromStats,
    });
  } catch (e) {
    return jsonNoStore(
      { error: e instanceof Error ? e.message : '新增交易失敗', code: 'WriteFailed' },
      { status: 400 },
    );
  }

  emitTransactionEvent(auth.userId, 'transaction.created', {
    id: result.id,
    type,
    amount: twdAmountInt,
    currency: converted.currency,
    date,
    account_id: accountId,
    category_id: categoryId,
    note,
  });

  return jsonNoStore(
    {
      transaction: {
        id: result.id,
        type,
        amount: twdAmountInt,
        currency: converted.currency,
        date,
        categoryId,
        accountId,
        note,
        excludeFromStats: !!body.excludeFromStats,
      },
    },
    { status: 201 },
  );
}
