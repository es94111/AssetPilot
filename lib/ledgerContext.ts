import { NextResponse, type NextRequest } from "next/server";
import { getDB, queryOne, saveDB } from "./db";
import { isLedgerDataPath, resolveLedgerAccess, type LedgerRole } from "./ledgerPolicy";
import { processRecurringForUser } from "./recurringHelpers";
import { uid } from "./userDefaults";
import { todayInUserTz } from "./userTime";

type LedgerLookup = Record<string, string | number | null>;

const READ_ONLY_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const recurringChecks = new Map<string, string>();
const auditContexts = new WeakMap<object, {
  ledgerId: string;
  actorUserId: string;
  actorEmail: string;
  role: LedgerRole;
}>();

export function withLedgerWriteAudit<Args extends unknown[]>(
  handler: (request: NextRequest, ...args: Args) => Promise<NextResponse>,
): (request: NextRequest, ...args: Args) => Promise<NextResponse> {
  return async (request, ...args) => {
    try {
      const response = await handler(request, ...args);
      const context = auditContexts.get(request);
      if (context) {
        auditRequest(request, context.ledgerId, context.actorUserId, context.actorEmail,
          context.role, response.status < 400 ? "success" : "failed");
      }
      return response;
    } catch (error) {
      const context = auditContexts.get(request);
      if (context) {
        auditRequest(request, context.ledgerId, context.actorUserId, context.actorEmail,
          context.role, "failed");
      }
      throw error;
    }
  };
}

function requestPath(request: any): string {
  if (typeof request?.nextUrl?.pathname === "string") return request.nextUrl.pathname;
  try {
    return new URL(String(request?.url || ""), "http://localhost").pathname;
  } catch {
    return "";
  }
}

export function isLedgerDataApiRequest(request: any): boolean {
  return isLedgerDataPath(requestPath(request));
}

export function ensurePersonalLedger(userId: string): string {
  const ledgerId = `personal:${userId}`;
  const now = Date.now();
  getDB().run(
    `INSERT INTO financial_ledgers
     (id, name, owner_user_id, data_owner_id, is_shared, created_at, updated_at)
     VALUES (?, 'Personal ledger', ?, ?, 0, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [ledgerId, userId, userId, now, now],
  );
  getDB().run(
    `INSERT INTO ledger_members (ledger_id, user_id, role, joined_at)
     SELECT id, owner_user_id, 'owner', ? FROM financial_ledgers
     WHERE id = ? AND owner_user_id = ? AND is_shared = 0
     ON CONFLICT (ledger_id, user_id) DO NOTHING`,
    [now, ledgerId, userId],
  );
  return ledgerId;
}

export function writeLedgerAudit(input: {
  ledgerId: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole: LedgerRole;
  action: string;
  resourceType?: string;
  resourceId?: string;
  result: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): void {
  getDB().run(
    `INSERT INTO ledger_audit_log
     (id, ledger_id, actor_user_id, actor_email, actor_role, action, resource_type, resource_id,
      result, ip_address, user_agent, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      input.ledgerId,
      input.actorUserId,
      input.actorEmail || "",
      input.actorRole,
      input.action,
      input.resourceType || "",
      input.resourceId || "",
      input.result,
      input.ipAddress || "",
      input.userAgent || "",
      JSON.stringify(input.metadata || {}),
      Date.now(),
    ],
  );
  saveDB();
}

function auditRequest(
  request: any,
  ledgerId: string,
  actorUserId: string,
  actorEmail: string,
  role: LedgerRole,
  result: string,
): void {
  const path = requestPath(request);
  const segments = path.split("/").filter(Boolean);
  writeLedgerAudit({
    ledgerId,
    actorUserId,
    actorEmail,
    actorRole: role,
    action: `${String(request?.method || "POST").toUpperCase()} ${path}`,
    resourceType: segments[1] || "",
    resourceId: segments[2] || "",
    result,
    ipAddress: String(request?.headers?.get?.("x-forwarded-for") || "")
      .split(",")[0]
      .trim(),
    userAgent: request?.headers?.get?.("user-agent") || "",
  });
}

function processDueRecurringForLedger(
  dataOwnerId: string,
  timezone: string,
  context: { ledgerId: string; actorUserId: string; actorEmail: string; role: LedgerRole },
): void {
  const today = todayInUserTz(timezone || "Asia/Taipei");
  const version = queryOne(
    "SELECT COALESCE(MAX(updated_at), 0) AS updated_at FROM recurring WHERE user_id = ?",
    [dataOwnerId],
  );
  const cacheKey = `${today}:${version?.updated_at || 0}`;
  if (recurringChecks.get(dataOwnerId) === cacheKey) return;
  const db = getDB();
  db.run('BEGIN');
  try {
    queryOne('SELECT id FROM financial_ledgers WHERE id = ? FOR UPDATE', [context.ledgerId]);
    const member = queryOne('SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?', [context.ledgerId, context.actorUserId]);
    if (member?.role === 'owner' || member?.role === 'editor') {
      const generated = processRecurringForUser(dataOwnerId, { userTimezone: timezone, maxSync: Infinity });
      if (generated > 0) {
        writeLedgerAudit({
          ledgerId: context.ledgerId,
          actorUserId: context.actorUserId,
          actorEmail: context.actorEmail,
          actorRole: member.role,
          action: 'recurring.generated',
          resourceType: 'transactions',
          result: 'success',
          metadata: { generated },
        });
      }
    }
    db.run('COMMIT');
    recurringChecks.set(dataOwnerId, cacheKey);
  } catch (error) {
    db.run('ROLLBACK');
    recurringChecks.delete(dataOwnerId);
    console.error("[ledger] Failed to process shared-ledger recurring transactions", error);
  }
}

export function applyLedgerContext<T extends { userId: string; userTimezone: string }>(
  request: any,
  auth: T,
): (T & {
  actorUserId: string;
  ledgerId: string;
  ledgerRole: LedgerRole;
  isSharedLedger: boolean;
}) | NextResponse {
  const actorUserId = auth.userId;
  const actorEmail = String((auth as { email?: unknown }).email || "");
  const headerLedgerId = String(request?.headers?.get?.("x-ledger-id") || "").trim();
  const url = new URL(String(request?.url || ""), "http://localhost");
  const queryLedgerId = (url.searchParams.get("ledgerId") || "").trim();
  if (headerLedgerId && queryLedgerId && headerLedgerId !== queryLedgerId) {
    return NextResponse.json({ error: "帳本識別碼不一致" }, { status: 400 });
  }
  const ledgerId = headerLedgerId || queryLedgerId || ensurePersonalLedger(actorUserId);
  const ledger = queryOne(
    `SELECT l.id, l.data_owner_id, l.is_shared, l.timezone, m.role
     FROM financial_ledgers l
     JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
     WHERE l.id = ?`,
    [actorUserId, ledgerId],
  ) as LedgerLookup | null;

  const decision = resolveLedgerAccess({
    role: ledger?.role,
    method: request?.method || "GET",
    memberFound: !!ledger,
  });
  if (!decision.allowed) {
    if (ledger && decision.reason === "read-only") {
      auditRequest(request, ledgerId, actorUserId, actorEmail, "viewer", "denied_read_only");
      return NextResponse.json(
        { error: "此帳本為唯讀，無法修改資料" },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: "找不到帳本或沒有存取權" },
      { status: 404 },
    );
  }

  const method = String(request?.method || "GET").toUpperCase();
  if (!READ_ONLY_METHODS.has(method)) {
    auditContexts.set(request, { ledgerId, actorUserId, actorEmail, role: decision.role });
  }

  const dataOwnerId = String(ledger?.data_owner_id || "");
  if (dataOwnerId && dataOwnerId !== actorUserId && decision.role !== "viewer") {
    processDueRecurringForLedger(dataOwnerId, String(ledger?.timezone || "Asia/Taipei"), {
      ledgerId, actorUserId, actorEmail, role: decision.role,
    });
  }
  return {
    ...auth,
    userId: dataOwnerId,
    userTimezone: Number(ledger?.is_shared) === 1 ? String(ledger?.timezone || 'Asia/Taipei') : auth.userTimezone,
    actorUserId,
    ledgerId,
    ledgerRole: decision.role,
    isSharedLedger: Number(ledger?.is_shared) === 1,
  };
}
