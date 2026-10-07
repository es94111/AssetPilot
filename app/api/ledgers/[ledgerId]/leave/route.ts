import { NextRequest, NextResponse } from "next/server";
import { getDB } from "../../../../../lib/db";
import {
  assertSharedLedger,
  requireLedgerMembership,
  mutateLedger,
  ledgerErrorResponse,
} from "../../../../../lib/ledgerCore";
import { writeLedgerAudit } from "../../../../../lib/ledgerContext";

type RouteContext = { params: Promise<{ ledgerId: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;
  if (access.role === "owner") {
    return NextResponse.json(
      { error: "移交帳本擁有權後才能離開" },
      { status: 409 },
    );
  }

  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["editor", "viewer"], (_ledger, role) => {
      getDB().run(
        "DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ? AND role <> 'owner'",
        [ledgerId, access.auth.actorUserId],
      );
      getDB().run(
        "UPDATE ledger_invitations SET revoked_at = ? WHERE ledger_id = ? AND email = ? AND accepted_at = 0 AND revoked_at = 0",
        [Date.now(), ledgerId, access.auth.email.toLowerCase()],
      );
      writeLedgerAudit({
        ledgerId,
        actorUserId: access.auth.actorUserId,
        actorEmail: access.auth.email,
        actorRole: role,
        action: "member.left",
        resourceType: "members",
        resourceId: access.auth.actorUserId,
        result: "success",
      });
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}
