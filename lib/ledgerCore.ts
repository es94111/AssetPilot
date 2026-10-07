import { NextResponse } from "next/server";
import { requireAuth } from "./apiHelpers";
import { getDB, queryOne, saveDB } from "./db";
import { isLedgerRole, type LedgerRole } from "./ledgerPolicy";
import { uid } from "./userDefaults";

export type ApiUser = {
  userId: string;
  actorUserId: string;
  userTimezone: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  adminRole: string;
  isSuperAdmin: boolean;
  themeMode: string;
  sessionId?: string;
};

export type LedgerRow = {
  id: string;
  name: string;
  owner_user_id: string;
  data_owner_id: string;
  is_shared: number;
};

type LedgerLookupRow = Record<string, string | number | null>;

export class LedgerOperationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "LedgerOperationError";
  }
}

export function ledgerErrorResponse(error: unknown): NextResponse {
  if (error instanceof LedgerOperationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

// Serialize member changes on the ledger row and recheck authorization under the lock.
// The synchronous database transaction must not cross an await boundary.
export function mutateLedger<T>(
  ledgerId: string,
  actorId: string,
  roles: LedgerRole[],
  mutation: (ledger: LedgerRow, role: LedgerRole) => T,
): T {
  const db = getDB();
  db.run("BEGIN");
  try {
    const ledger = queryOne("SELECT * FROM financial_ledgers WHERE id = ? FOR UPDATE", [ledgerId]);
    const member = queryOne(
      "SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?",
      [ledgerId, actorId],
    );
    if (!ledger || !member || !isLedgerRole(member.role)) {
      throw new LedgerOperationError("找不到帳本或沒有存取權", 404);
    }
    if (!roles.includes(member.role)) {
      throw new LedgerOperationError("沒有管理此帳本的權限", 403);
    }
    if (Number(ledger.is_shared) !== 1) {
      throw new LedgerOperationError("個人帳本不支援成員管理", 400);
    }
    const result = mutation(ledger as unknown as LedgerRow, member.role);
    db.run("COMMIT");
    return result;
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
}

export async function requireLedgerMembership(
  request: any,
  ledgerId: string,
  allowedRoles?: LedgerRole[],
): Promise<{ auth: ApiUser; ledger: LedgerRow; role: LedgerRole } | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const ledger = queryOne(
    `SELECT l.id, l.name, l.owner_user_id, l.data_owner_id, l.is_shared, m.role
     FROM financial_ledgers l
     JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
     WHERE l.id = ?`,
    [auth.userId, ledgerId],
  ) as LedgerLookupRow | null;
  if (!ledger) {
    return NextResponse.json({ error: "找不到帳本或沒有存取權" }, { status: 404 });
  }
  if (!isLedgerRole(ledger.role)) {
    return NextResponse.json({ error: "找不到帳本或沒有存取權" }, { status: 404 });
  }
  const role = ledger.role;
  if (allowedRoles && !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "沒有管理此帳本的權限" }, { status: 403 });
  }
  return {
    auth,
    ledger: {
      id: String(ledger.id),
      name: String(ledger.name || ""),
      owner_user_id: String(ledger.owner_user_id),
      data_owner_id: String(ledger.data_owner_id),
      is_shared: Number(ledger.is_shared) || 0,
    },
    role: role as LedgerRole,
  };
}

export function assertSharedLedger(
  ledger: LedgerRow,
): NextResponse | null {
  if (Number(ledger.is_shared) === 1) return null;
  return NextResponse.json(
    { error: "個人帳本不支援成員管理" },
    { status: 400 },
  );
}

export function normalizeLedgerEmail(email: unknown): string {
  return String(email || "").trim().toLowerCase();
}

export function createSharedLedger(
  ownerUserId: string,
  name: string,
  timezone = "Asia/Taipei",
): { id: string; dataOwnerId: string } {
  const now = Date.now();
  const id = uid();
  const dataOwnerId = `ledger-data:${uid()}`;
  const db = getDB();
  db.run("BEGIN");
  try {
    db.run(
      `INSERT INTO financial_ledgers
       (id, name, owner_user_id, data_owner_id, timezone, is_shared, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, name, ownerUserId, dataOwnerId, timezone, now, now],
    );
    db.run(
      "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)",
      [id, ownerUserId, now],
    );
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  }
  return { id, dataOwnerId };
}

export function isValidLedgerEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
