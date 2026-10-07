import { NextRequest, NextResponse } from "next/server";
import { queryAll } from "../../../../../lib/db";
import {
  assertSharedLedger,
  requireLedgerMembership,
} from "../../../../../lib/ledgerCore";

type RouteContext = { params: Promise<{ ledgerId: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const requestedLimit = Number(request.nextUrl.searchParams.get("limit")) || 100;
  const limit = Math.max(1, Math.min(200, Math.trunc(requestedLimit)));
  const rows = queryAll(
    `SELECT id, actor_user_id, actor_email, actor_role, action, resource_type,
            resource_id, result, ip_address, user_agent, metadata, created_at
     FROM ledger_audit_log
     WHERE ledger_id = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ?`,
    [ledgerId, limit],
  );
  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actorEmail: row.actor_email,
      actorRole: row.actor_role,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      result: row.result,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      metadata: String(row.metadata || "{}"),
      createdAt: Number(row.created_at) || 0,
    })),
  );
}
