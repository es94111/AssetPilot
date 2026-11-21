// app/api/v1/accounts/route.ts — API Token 認證的公開帳戶端點（API 自動化）
//
// GET  → 查詢帳戶清單（需 accounts:read）
// POST → 新增支付帳戶（需 accounts:write），全部帳戶類型與完整欄位，
//        與站內 POST /api/accounts 共用 lib/accountWriteCore.ts 的驗證與寫入核心。
//
// 與站內 /api/accounts 的差別只在認證方式（Authorization: Bearer ap_api_…）、
// 帳本選擇（query/body ledgerId）與回應欄位（對外穩定欄位，不含信用卡帳單週期等
// 儀表板專用欄位）。回應一律帶 Cache-Control: no-store（見 lib/apiTokenRequestAuth.ts）。
import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '../../../../lib/db';
import {
  normalizeCurrency,
  normalizeAccountIcon,
  categoryFromAccountType,
  calcBalance,
  getExchangeRateToTwd,
  getUserExchangeRateMap,
  normalizeStatementClosingDay,
} from '../../../../lib/accountHelpers';
import { createAccount, type CreateAccountRequest } from '../../../../lib/accountWriteCore';
import { resolveLedgerScope } from '../../../../lib/ledgerScope';
import {
  requireApiToken,
  jsonNoStore,
  readRequestedLedgerId,
  readJsonBody,
  ledgerScopeError,
} from '../../../../lib/apiTokenRequestAuth';

interface AccountRow {
  id: string;
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
}

/** 對外只暴露整合方需要且穩定的欄位。 */
function serializeAccount(
  row: AccountRow,
  dataOwnerId: string,
  rateMap: Record<string, number>,
) {
  const category = row.category || categoryFromAccountType(row.account_type);
  const currency = normalizeCurrency(row.currency);
  const balance = calcBalance(row.id, row.initial_balance, dataOwnerId, currency, rateMap);
  const rate = rateMap[currency] ?? getExchangeRateToTwd(dataOwnerId, currency);
  return {
    id: String(row.id),
    name: String(row.name),
    category,
    accountType: String(row.account_type),
    currency,
    initialBalance: Number(row.initial_balance) || 0,
    balance,
    twdBalance: Math.round(balance * rate * 100) / 100,
    icon: normalizeAccountIcon(row.icon),
    isActive: Number(row.is_active) !== 0,
    excludeFromTotal: Number(row.exclude_from_total) === 1,
    linkedBankId: row.linked_bank_id || null,
    overseasFeeRate: row.overseas_fee_rate == null ? null : Number(row.overseas_fee_rate),
    statementClosingDay:
      category === 'credit_card'
        ? normalizeStatementClosingDay(row.statement_closing_day)
        : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = requireApiToken(request, 'accounts:read');
  if (auth instanceof NextResponse) return auth;

  const scope = resolveLedgerScope({
    userId: auth.userId,
    ledgerId: readRequestedLedgerId(request),
  });
  if (!scope.ok) return ledgerScopeError(scope.reason);

  const rows = queryAll(
    `SELECT id, name, category, account_type, initial_balance, currency, icon,
            exclude_from_total, linked_bank_id, overseas_fee_rate, statement_closing_day, is_active
       FROM accounts
      WHERE user_id = ?
      ORDER BY created_at`,
    [scope.dataOwnerId],
  ) as unknown as AccountRow[];

  const rateMap = getUserExchangeRateMap(scope.dataOwnerId);
  return jsonNoStore({ accounts: rows.map((row) => serializeAccount(row, scope.dataOwnerId, rateMap)) });
}

export async function POST(request: NextRequest) {
  const auth = requireApiToken(request, 'accounts:write');
  if (auth instanceof NextResponse) return auth;

  const scope = resolveLedgerScope({
    userId: auth.userId,
    ledgerId: readRequestedLedgerId(request),
    write: true,
  });
  if (!scope.ok) return ledgerScopeError(scope.reason);

  // 嚴格 body 解析：64KB 上限、必須為 JSON 物件（見 readJsonBody）。
  const parsed = await readJsonBody<CreateAccountRequest>(request);
  if (!parsed.ok) return parsed.response;

  // 與站內 POST /api/accounts 共用相同驗證核心（lib/accountWriteCore.ts）。
  const result = createAccount(scope.dataOwnerId, parsed.body);
  if (!result.ok) return jsonNoStore(result.body, { status: result.status });

  return jsonNoStore({ account: result.account }, { status: 201 });
}
