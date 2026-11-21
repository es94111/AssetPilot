// lib/accountWriteCore.ts — 帳戶建立的共用寫入核心。
// 從 app/api/accounts/route.ts（站內）抽出，供站內 Route Handler 與公開 API
// app/api/v1/accounts/route.ts 共用，確保兩者的輸入驗證、正規化與 INSERT 邏輯
// 完全一致（比照 lib/transactionWriteCore.ts 的共用核心模式）。
// 呼叫端須先完成認證與帳本授權（傳入 dataOwnerId），本模組只做輸入驗證與
// 寫入，不重新驗證身份；驗證失敗一律以既有錯誤形狀回傳，由呼叫端映射為
// 各自的 JSON 回應（站內 NextResponse.json／公開 API jsonNoStore）。
import { getDB, queryOne, saveDB } from './db';
import {
  normalizeCurrency,
  normalizeAccountIcon,
  categoryFromAccountType,
  accountTypeFromCategory,
  normalizeStatementClosingDay,
} from './accountHelpers';
import { uid, todayStr } from './userDefaults';

export type AccountCategory = 'bank' | 'credit_card' | 'cash' | 'virtual_wallet' | 'securities';

export interface CreateAccountRequest {
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
  isActive?: boolean;
}

export interface CreatedAccount {
  id: string;
  name: string;
  category: AccountCategory;
  accountType: string;
  initialBalance: number;
  currency: string;
  icon: string;
  excludeFromTotal: boolean;
  linkedBankId: string | null;
  overseasFeeRate: number | null;
  statementClosingDay: number | null;
  isActive: boolean;
  updatedAt: number;
}

export interface CreateAccountFailure {
  ok: false;
  status: number;
  body: { error: string; code?: string; field?: string };
}

export type CreateAccountResult =
  | { ok: true; account: CreatedAccount }
  | CreateAccountFailure;

const VALID_CATEGORIES: AccountCategory[] = [
  'bank',
  'credit_card',
  'cash',
  'virtual_wallet',
  'securities',
];

function failure(
  status: number,
  body: { error: string; code?: string; field?: string },
): CreateAccountFailure {
  return { ok: false, status, body };
}

export function toAccountCategory(
  value: unknown,
  accountType?: string,
): AccountCategory {
  return VALID_CATEGORIES.includes(value as AccountCategory)
    ? (value as AccountCategory)
    : (categoryFromAccountType(accountType || '') as AccountCategory);
}

/**
 * 建立帳戶（支付帳戶／信用卡／證券戶等全部帳戶類型）。
 * 驗證規則與站內 POST /api/accounts 完全一致：
 * 名稱 1~64 字元、海外手續費率 0~100、結帳日 1~31、
 * linkedBankId 必須為同一資料擁有者的銀行帳戶、初始餘額為有限數值。
 */
export function createAccount(
  userId: string,
  body: CreateAccountRequest,
): CreateAccountResult {
  const category = toAccountCategory(body.category, body.accountType);
  const safeName = String(body.name || '').trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return failure(400, {
      error: '名稱必須為 1~64 字元',
      code: 'ValidationError',
      field: 'name',
    });
  }
  const currency = normalizeCurrency(body.currency);
  const safeIcon = normalizeAccountIcon(body.icon);
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = body.excludeFromTotal ? 1 : 0;
  const safeActive = category === 'credit_card' && body.isActive === false ? 0 : 1;

  let safeOverseasFeeRate: number | null = null;
  if (category === 'credit_card' && body.overseasFeeRate != null) {
    const v = Number(body.overseasFeeRate);
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return failure(400, {
        error: '海外手續費率須為 0~100（百分比）',
        code: 'ValidationError',
        field: 'overseasFeeRate',
      });
    }
    safeOverseasFeeRate = Math.round(v * 100) / 100;
  }

  let safeClosingDay: number | null = null;
  if (
    category === 'credit_card' &&
    body.statementClosingDay != null &&
    body.statementClosingDay !== ''
  ) {
    safeClosingDay = normalizeStatementClosingDay(body.statementClosingDay);
    if (safeClosingDay == null) {
      return failure(400, {
        error: '結帳日須為 1~31',
        code: 'ValidationError',
        field: 'statementClosingDay',
      });
    }
  }

  let safeLinkedBankId: string | null = null;
  if (category === 'credit_card' && body.linkedBankId) {
    const bankRow = queryOne(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')",
      [String(body.linkedBankId), userId],
    ) as { id: string } | null;
    if (!bankRow) {
      return failure(400, { error: '指定的銀行帳戶不存在' });
    }
    safeLinkedBankId = String(body.linkedBankId);
  }

  const parsedInitialBalance =
    body.initialBalance == null || body.initialBalance === ''
      ? 0
      : Number(body.initialBalance);
  if (!Number.isFinite(parsedInitialBalance)) {
    return failure(400, {
      error: '初始餘額必須為有限數值',
      code: 'ValidationError',
      field: 'initialBalance',
    });
  }

  const id = uid();
  const nowMs = Date.now();
  const safeInitialBalance = Math.round(parsedInitialBalance);
  getDB().run(
    'INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, statement_closing_day, account_type, is_active, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [
      id,
      userId,
      safeName,
      category,
      safeInitialBalance,
      currency,
      safeIcon,
      safeExclude,
      safeLinkedBankId,
      safeOverseasFeeRate,
      safeClosingDay,
      safeAccountType,
      safeActive,
      todayStr(),
      nowMs,
    ],
  );
  saveDB();

  return {
    ok: true,
    account: {
      id,
      name: safeName,
      category,
      accountType: safeAccountType,
      initialBalance: safeInitialBalance,
      currency,
      icon: safeIcon,
      excludeFromTotal: safeExclude === 1,
      linkedBankId: safeLinkedBankId,
      overseasFeeRate: safeOverseasFeeRate,
      statementClosingDay: safeClosingDay,
      isActive: safeActive === 1,
      updatedAt: nowMs,
    },
  };
}
