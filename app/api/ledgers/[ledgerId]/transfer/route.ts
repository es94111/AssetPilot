import { NextRequest, NextResponse } from "next/server";
import { getDB, queryOne } from "../../../../../lib/db";
import {
  assertSharedLedger,
  requireLedgerMembership,
  mutateLedger,
  ledgerErrorResponse,
  LedgerOperationError,
} from "../../../../../lib/ledgerCore";
import { writeLedgerAudit } from "../../../../../lib/ledgerContext";

type RouteContext = { params: Promise<{ ledgerId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const body = await request.json().catch(() => ({}));
  const targetUserId = String(body?.userId || "");
  if (!targetUserId || targetUserId === access.auth.actorUserId) {
    return NextResponse.json({ error: "請選擇另一位帳本成員" }, { status: 400 });
  }
  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["owner"], () => {
      const target = queryOne(
        "SELECT m.role FROM ledger_members m JOIN users u ON u.id = m.user_id WHERE m.ledger_id = ? AND m.user_id = ? AND u.is_active = 1",
        [ledgerId, targetUserId],
      );
      if (!target) throw new LedgerOperationError("找不到可接任的成員", 404);
      const db = getDB();
      db.run(
        "UPDATE financial_ledgers SET owner_user_id = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?",
        [targetUserId, Date.now(), ledgerId, access.auth.actorUserId],
      );
      if (db.getRowsModified() !== 1) throw new LedgerOperationError("帳本擁有權已變更，請重新整理", 409);
      db.run(
        "UPDATE ledger_members SET role = 'editor' WHERE ledger_id = ? AND user_id = ? AND role = 'owner'",
        [ledgerId, access.auth.actorUserId],
      );
      db.run(
        "UPDATE ledger_members SET role = 'owner' WHERE ledger_id = ? AND user_id = ?",
        [ledgerId, targetUserId],
      );
      writeLedgerAudit({
        ledgerId,
        actorUserId: access.auth.actorUserId,
        actorEmail: access.auth.email,
        actorRole: "owner",
        action: "ledger.ownership_transferred",
        resourceType: "members",
        resourceId: targetUserId,
        result: "success",
      });
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  return NextResponse.json({ ok: true, newOwnerId: targetUserId });
}
