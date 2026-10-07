import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/apiHelpers";
import { getDB, queryOne } from "../../../../../lib/db";
import { normalizeLedgerEmail } from "../../../../../lib/ledgerCore";
import { writeLedgerAudit } from "../../../../../lib/ledgerContext";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const token = String(body?.token || "").trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return NextResponse.json({ error: "邀請連結無效或已失效" }, { status: 404 });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = Date.now();
  const invitation = queryOne(
    `SELECT id, ledger_id, email, role
     FROM ledger_invitations
     WHERE token_hash = ? AND accepted_at = 0 AND revoked_at = 0 AND expires_at > ?`,
    [tokenHash, now],
  );
  if (!invitation) {
    return NextResponse.json({ error: "邀請連結無效或已失效" }, { status: 404 });
  }
  if (normalizeLedgerEmail(auth.email) !== normalizeLedgerEmail(invitation.email)) {
    return NextResponse.json(
      { error: "請使用收到邀請的電子郵件帳號登入" },
      { status: 403 },
    );
  }
  if (
    queryOne(
      "SELECT user_id FROM ledger_members WHERE ledger_id = ? AND user_id = ?",
      [invitation.ledger_id, auth.actorUserId],
    )
  ) {
    return NextResponse.json({ error: "你已是此帳本的成員" }, { status: 409 });
  }

  const db = getDB();
  db.run("BEGIN");
  try {
    const ledger = queryOne(
      "SELECT id FROM financial_ledgers WHERE id = ? AND is_shared = 1 FOR UPDATE",
      [invitation.ledger_id],
    );
    if (!ledger) {
      db.run("ROLLBACK");
      return NextResponse.json({ error: "邀請連結無效或已失效" }, { status: 404 });
    }
    if (queryOne("SELECT user_id FROM ledger_members WHERE ledger_id = ? AND user_id = ?", [invitation.ledger_id, auth.actorUserId])) {
      db.run("ROLLBACK");
      return NextResponse.json({ error: "你已是此帳本的成員" }, { status: 409 });
    }
    db.run(
      `UPDATE ledger_invitations SET accepted_at = ?
       WHERE id = ? AND accepted_at = 0 AND revoked_at = 0 AND expires_at > ?`,
      [now, invitation.id, now],
    );
    if (db.getRowsModified() !== 1) {
      db.run("ROLLBACK");
      return NextResponse.json({ error: "邀請連結無效或已失效" }, { status: 404 });
    }
    db.run(
      `INSERT INTO ledger_members (ledger_id, user_id, role, joined_at)
       VALUES (?, ?, ?, ?)`,
      [invitation.ledger_id, auth.actorUserId, invitation.role, now],
    );
    writeLedgerAudit({
      ledgerId: String(invitation.ledger_id),
      actorUserId: auth.actorUserId,
      actorEmail: auth.email,
      actorRole: String(invitation.role) as "editor" | "viewer",
      action: "invitation.accepted",
      resourceType: "members",
      resourceId: auth.actorUserId,
      result: "success",
    });
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch {
      // Preserve the original database error.
    }
    throw error;
  }

  return NextResponse.json({
    ledgerId: invitation.ledger_id,
    role: invitation.role,
    accepted: true,
  });
}
