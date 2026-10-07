import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../lib/apiHelpers";
import { queryAll } from "../../../lib/db";
import { createSharedLedger } from "../../../lib/ledgerCore";
import { ensurePersonalLedger, writeLedgerAudit } from "../../../lib/ledgerContext";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  ensurePersonalLedger(auth.actorUserId);

  const rows = queryAll(
    `SELECT l.id, l.name, l.is_shared, l.owner_user_id, l.created_at, m.role,
            (SELECT COUNT(*) FROM ledger_members members WHERE members.ledger_id = l.id) AS member_count
     FROM financial_ledgers l
     JOIN ledger_members m ON m.ledger_id = l.id
     WHERE m.user_id = ?
     ORDER BY l.is_shared DESC, l.created_at DESC, l.id`,
    [auth.actorUserId],
  );
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      isShared: Number(row.is_shared) === 1,
      isPersonal: Number(row.is_shared) !== 1,
      role: row.role,
      ownerUserId: row.owner_user_id,
      memberCount: Number(row.member_count) || 0,
      createdAt: Number(row.created_at) || 0,
    })),
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  if (!name || name.length > 80) {
    return NextResponse.json(
      { error: "帳本名稱必須為 1 至 80 個字元" },
      { status: 400 },
    );
  }

  const ledger = createSharedLedger(auth.actorUserId, name, auth.userTimezone);
  writeLedgerAudit({
    ledgerId: ledger.id,
    actorUserId: auth.actorUserId,
    actorEmail: auth.email,
    actorRole: "owner",
    action: "ledger.created",
    resourceType: "ledgers",
    resourceId: ledger.id,
    result: "success",
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") || "",
  });
  return NextResponse.json(
    { id: ledger.id, name, isShared: true, role: "owner", memberCount: 1 },
    { status: 201 },
  );
}
