import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryAll, queryOne, saveDB } from "../../../../lib/db";
import {
  normalizeCurrency,
  normalizeAccountIcon,
  categoryFromAccountType,
  accountTypeFromCategory,
  normalizeStatementClosingDay,
} from "../../../../lib/accountHelpers";
import {
  ownsResource,
  assertOptimisticLock,
  lockErrorResponse,
} from "../../../../lib/resourceHelpers";

type AccountCategory = "bank" | "credit_card" | "cash" | "virtual_wallet";
type RouteContext = { params: Promise<{ id: string }> };

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
  updated_at: string | number | null;
}

interface AccountTransactionRow {
  type: string;
  amount: number;
  currency: string | null;
  original_amount: number | null;
}

interface UpdateAccountRequest {
  expectedUpdatedAt?: number | string | null;
  expected_updated_at?: number | string | null;
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

const VALID_CATEGORIES: AccountCategory[] = [
  "bank",
  "credit_card",
  "cash",
  "virtual_wallet",
];

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  // SAFETY: each caller supplies a SELECT list whose shape is represented by T;
  // the database adapter intentionally exposes scalar records generically.
  return rows as unknown as T[];
}

function asRow<T>(
  row: Record<string, string | number | null> | null,
): T | null {
  // SAFETY: the generic is tied to the fixed SELECT list at each call site.
  return row as unknown as T | null;
}

function getOwnedAccount(id: string, userId: string): AccountRow | null {
  return ownsResource("accounts", "id", id, userId) as AccountRow | null;
}

function toAccountCategory(
  value: unknown,
  accountType?: string,
): AccountCategory {
  return VALID_CATEGORIES.includes(value as AccountCategory)
    ? (value as AccountCategory)
    : (categoryFromAccountType(accountType || "") as AccountCategory);
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const a = getOwnedAccount(id, auth.userId);
  if (!a) return NextResponse.json({ error: "NotFound" }, { status: 404 });

  const accountCurrency = normalizeCurrency(a.currency);
  const txs = asRows<AccountTransactionRow>(
    queryAll(
      "SELECT type, amount, currency, original_amount FROM transactions WHERE account_id = ? AND user_id = ?",
      [a.id, auth.userId],
    ),
  );
  let balance = Number(a.initial_balance) || 0;
  txs.forEach((t) => {
    const v =
      Number(t.original_amount) > 0
        ? Number(t.original_amount)
        : Number(t.amount) || 0;
    if (t.type === "income" || t.type === "transfer_in") balance += v;
    else if (t.type === "expense" || t.type === "transfer_out") balance -= v;
  });
  const referenceCount =
    Number(
      asRow<{ c: number }>(
        queryOne(
          "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
          [a.id, a.id, auth.userId],
        ),
      )?.c,
    ) || 0;

  return NextResponse.json({
    id: a.id,
    name: a.name,
    category: a.category || categoryFromAccountType(a.account_type),
    accountType: a.account_type,
    initialBalance: a.initial_balance,
    currency: accountCurrency,
    icon: normalizeAccountIcon(a.icon),
    excludeFromTotal: a.exclude_from_total === 1,
    linkedBankId: a.linked_bank_id || null,
    overseasFeeRate: a.overseas_fee_rate ?? null,
    statementClosingDay:
      (a.category || categoryFromAccountType(a.account_type)) === "credit_card"
        ? normalizeStatementClosingDay(a.statement_closing_day)
        : null,
    currentBalance: Math.round(balance),
    referenceCount,
    updatedAt: Number(a.updated_at) || 0,
  });
}

async function updateAccount(request: NextRequest, id: string) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const existing = getOwnedAccount(id, auth.userId);
  if (!existing)
    return NextResponse.json(
      { error: "資源不存在或無權限", code: "NotFound" },
      { status: 404 },
    );

  const body = (await request.json().catch(() => ({}))) as UpdateAccountRequest;

  if (body.expectedUpdatedAt != null || body.expected_updated_at != null) {
    try {
      assertOptimisticLock(
        "accounts",
        "id",
        id,
        body.expectedUpdatedAt ?? body.expected_updated_at,
      );
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = body;
  const newCurrency =
    body.currency === undefined
      ? normalizeCurrency(existing.currency)
      : normalizeCurrency(body.currency);
  const safeIcon =
    body.icon === undefined
      ? normalizeAccountIcon(existing.icon)
      : normalizeAccountIcon(icon);
  const safeName = String(name === undefined ? existing.name : name).trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return NextResponse.json(
      { error: "名稱必須為 1~64 字元", code: "ValidationError", field: "name" },
      { status: 400 },
    );
  }
  const category =
    body.category === undefined && body.accountType === undefined
      ? toAccountCategory(existing.category, existing.account_type)
      : toAccountCategory(body.category, body.accountType);
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude =
    excludeFromTotal === undefined
      ? Number(existing.exclude_from_total)
        ? 1
        : 0
      : excludeFromTotal
        ? 1
        : 0;

  if (newCurrency && newCurrency !== normalizeCurrency(existing.currency)) {
    const refCount =
      Number(
        asRow<{ c: number }>(
          queryOne(
            "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
            [id, id, auth.userId],
          ),
        )?.c,
      ) || 0;
    if (refCount > 0) {
      return NextResponse.json(
        {
          error: "此帳戶已有交易紀錄，無法變更幣別；如需不同幣別請新增帳戶",
          code: "CurrencyLocked",
          referenceCount: refCount,
        },
        { status: 422 },
      );
    }
  }

  let safeOverseasFeeRate =
    category === "credit_card" ? existing.overseas_fee_rate : null;
  if (body.overseasFeeRate !== undefined) {
    if (category === "credit_card") {
      if (body.overseasFeeRate == null || body.overseasFeeRate === "") {
        safeOverseasFeeRate = null;
      } else {
        const v = Number(body.overseasFeeRate);
        if (!Number.isFinite(v) || v < 0 || v > 100) {
          return NextResponse.json(
            {
              error: "海外手續費率須為 0~100（百分比）",
              code: "ValidationError",
              field: "overseasFeeRate",
            },
            { status: 400 },
          );
        }
        safeOverseasFeeRate = Math.round(v * 100) / 100;
      }
    }
  }

  let safeLinkedBankId: string | null =
    category === "credit_card" ? existing.linked_bank_id || null : null;
  if (category === "credit_card" && body.linkedBankId !== undefined) {
    if (linkedBankId == null || linkedBankId === "") {
      safeLinkedBankId = null;
    } else {
      const bankAcc = asRow<{ id: string }>(
        queryOne(
          "SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')",
          [linkedBankId, auth.userId],
        ),
      );
      if (!bankAcc)
        return NextResponse.json(
          { error: "指定的銀行帳戶不存在" },
          { status: 400 },
        );
      safeLinkedBankId = linkedBankId;
    }
  }

  // 結帳日：非信用卡一律清空；信用卡時，有帶值才更新（空字串視為清除），未帶則維持原值。
  let safeClosingDay = existing.statement_closing_day ?? null;
  if (category !== "credit_card") {
    safeClosingDay = null;
  } else if (body.statementClosingDay !== undefined) {
    if (body.statementClosingDay == null || body.statementClosingDay === "") {
      safeClosingDay = null;
    } else {
      const d = normalizeStatementClosingDay(body.statementClosingDay);
      if (d == null) {
        return NextResponse.json(
          {
            error: "結帳日須為 1~31",
            code: "ValidationError",
            field: "statementClosingDay",
          },
          { status: 400 },
        );
      }
      safeClosingDay = d;
    }
  }

  let safeInitialBalance = Number(existing.initial_balance) || 0;
  if (initialBalance !== undefined) {
    const parsedInitialBalance = Number(initialBalance);
    if (!Number.isFinite(parsedInitialBalance)) {
      return NextResponse.json(
        {
          error: "初始餘額必須為有限數值",
          code: "ValidationError",
          field: "initialBalance",
        },
        { status: 400 },
      );
    }
    safeInitialBalance = Math.round(parsedInitialBalance);
  }
  const nowMs = Date.now();
  getDB().run(
    "UPDATE accounts SET name = ?, category = ?, initial_balance = ?, icon = ?, currency = ?, account_type = ?, exclude_from_total = ?, linked_bank_id = ?, overseas_fee_rate = ?, statement_closing_day = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [
      safeName,
      category,
      safeInitialBalance,
      safeIcon,
      newCurrency,
      safeAccountType,
      safeExclude,
      safeLinkedBankId,
      safeOverseasFeeRate,
      safeClosingDay,
      nowMs,
      id,
      auth.userId,
    ],
  );
  saveDB();
  return NextResponse.json({ ok: true, updatedAt: nowMs });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return updateAccount(request, id);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { id } = await params;
  return updateAccount(request, id);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = getOwnedAccount(id, auth.userId);
  if (!existing)
    return NextResponse.json(
      { error: "資源不存在或無權限", code: "NotFound" },
      { status: 404 },
    );

  const body = (await request.json().catch(() => ({}))) as UpdateAccountRequest;
  let searchParams: URLSearchParams;
  try {
    searchParams = new URL(request.url).searchParams;
  } catch {
    return NextResponse.json(
      { error: "請求 URL 無效", code: "ValidationError" },
      { status: 400 },
    );
  }
  const expectedUpdatedAt =
    body?.expectedUpdatedAt ??
    body?.expected_updated_at ??
    searchParams.get("expected_updated_at");
  if (expectedUpdatedAt != null) {
    try {
      assertOptimisticLock("accounts", "id", id, expectedUpdatedAt);
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  const count =
    Number(
      asRow<{ cnt: number }>(
        queryOne("SELECT COUNT(*) as cnt FROM accounts WHERE user_id = ?", [
          auth.userId,
        ]),
      )?.cnt,
    ) || 0;
  if (count <= 1)
    return NextResponse.json({ error: "至少需保留一個帳戶" }, { status: 400 });

  const refCount =
    Number(
      asRow<{ c: number }>(
        queryOne(
          "SELECT COUNT(*) AS c FROM transactions WHERE (account_id = ? OR to_account_id = ?) AND user_id = ?",
          [id, id, auth.userId],
        ),
      )?.c,
    ) || 0;
  if (refCount > 0) {
    return NextResponse.json(
      {
        error: `請先處理該帳戶上的 ${refCount} 筆交易（可批次移到其他帳戶或刪除）`,
        code: "AccountInUse",
        referenceCount: refCount,
      },
      { status: 422 },
    );
  }

  const db = getDB();
  db.run(
    "UPDATE accounts SET linked_bank_id = NULL WHERE linked_bank_id = ? AND user_id = ?",
    [id, auth.userId],
  );
  db.run("DELETE FROM accounts WHERE id = ? AND user_id = ?", [
    id,
    auth.userId,
  ]);
  saveDB();
  return NextResponse.json({ ok: true });
}
