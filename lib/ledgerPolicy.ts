export type LedgerRole = "owner" | "editor" | "viewer";

const LEDGER_DATA_API_PREFIXES = [
  "/api/accounts", "/api/calendar", "/api/categories",
  "/api/credit-card-repayment-summaries", "/api/dashboard", "/api/budgets",
  "/api/recurring", "/api/reports", "/api/transactions", "/api/imports/progress",
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
