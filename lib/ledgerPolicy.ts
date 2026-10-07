export type LedgerRole = "owner" | "editor" | "viewer";

const LEDGER_DATA_API_PREFIXES = [
  "/api/accounts", "/api/calendar", "/api/categories",
  "/api/credit-card-repayment-summaries", "/api/dashboard", "/api/budgets",
  "/api/goals", "/api/repayment-plans", "/api/recurring", "/api/reports", "/api/transactions", "/api/imports/progress",
  "/api/stocks", "/api/stock-transactions", "/api/stock-dividends",
  "/api/stock-recurring", "/api/stock-realized", "/api/stock-realized-pl",
  "/api/stock-settings", "/api/exchange-rates",
  // 010-bank-broker-reconciliation（issue #251）：對帳匯入會讀取帳本交易並寫入
  // 對帳結果，必須走同一套帳本授權（viewer 唯讀、editor／owner 可寫）。
  "/api/reconciliation",
];

export function isLedgerDataPath(path: string): boolean {
  return LEDGER_DATA_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function ledgerFileUrl(url: string, ledgerId?: string): string {
  if (!ledgerId) return url;
  const parsed = new URL(url, "http://localhost");
  parsed.searchParams.set("ledgerId", ledgerId);
  return `${parsed.pathname}${parsed.search}`;
}

export type LedgerAccessDecision =
  | { allowed: true; role: LedgerRole }
  | { allowed: false; reason: "not-a-member" | "read-only" };

export function isLedgerRole(value: unknown): value is LedgerRole {
  return value === "owner" || value === "editor" || value === "viewer";
}

export function canWriteLedger(role: unknown): role is "owner" | "editor" {
  return role === "owner" || role === "editor";
}

export function canManageLedger(role: unknown): role is "owner" {
  return role === "owner";
}

export function resolveLedgerAccess(input: {
  role: unknown;
  method: string;
  memberFound: boolean;
}): LedgerAccessDecision {
  if (!input.memberFound || !isLedgerRole(input.role)) {
    return { allowed: false, reason: "not-a-member" };
  }
  const method = String(input.method || "GET").toUpperCase();
  if (!new Set(["GET", "HEAD", "OPTIONS"]).has(method) && !canWriteLedger(input.role)) {
    return { allowed: false, reason: "read-only" };
  }
  return { allowed: true, role: input.role };
}
