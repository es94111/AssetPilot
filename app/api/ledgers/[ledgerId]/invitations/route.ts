import { NextRequest, NextResponse } from "next/server";
import { getDB, queryAll, queryOne } from "../../../../../lib/db";
import {
  assertSharedLedger,
  requireLedgerMembership,
  mutateLedger,
  ledgerErrorResponse,
  LedgerOperationError,
} from "../../../../../lib/ledgerCore";
import { writeLedgerAudit } from "../../../../../lib/ledgerContext";

type RouteContext = { params: Promise<{ ledgerId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const rows = queryAll(
    `SELECT id, email, role, created_at, expires_at
     FROM ledger_invitations
     WHERE ledger_id = ? AND accepted_at = 0 AND revoked_at = 0 AND expires_at > ?
     ORDER BY created_at DESC`,
    [ledgerId, Date.now()],
  );
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      createdAt: Number(row.created_at) || 0,
      expiresAt: Number(row.expires_at) || 0,
    })),
  );
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const body = await request.json().catch(() => ({}));
  const invitationId = String(body?.invitationId || "");
  if (!invitationId) {
    return NextResponse.json({ error: "缺少邀請識別碼" }, { status: 400 });
  }
  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["owner"], () => {
      const invitation = queryOne(
        `SELECT id FROM ledger_invitations
         WHERE id = ? AND ledger_id = ? AND accepted_at = 0 AND revoked_at = 0`,
        [invitationId, ledgerId],
      );
      if (!invitation) throw new LedgerOperationError("找不到待處理邀請", 404);
      getDB().run(
        `UPDATE ledger_invitations SET revoked_at = ?
         WHERE id = ? AND ledger_id = ? AND accepted_at = 0 AND revoked_at = 0`,
        [Date.now(), invitationId, ledgerId],
      );
      writeLedgerAudit({
        ledgerId,
        actorUserId: access.auth.actorUserId,
        actorEmail: access.auth.email,
        actorRole: "owner",
        action: "invitation.revoked",
        resourceType: "invitations",
        resourceId: invitationId,
        result: "success",
      });
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}
