import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sendStatsEmail } from "../../../../../lib/emailService";
import { getDB, queryAll, queryOne, saveDB } from "../../../../../lib/db";
import {
  assertSharedLedger,
  normalizeLedgerEmail,
  requireLedgerMembership,
  mutateLedger,
  ledgerErrorResponse,
  LedgerOperationError,
  isValidLedgerEmail,
} from "../../../../../lib/ledgerCore";
import { writeLedgerAudit } from "../../../../../lib/ledgerContext";
import { uid } from "../../../../../lib/userDefaults";

type RouteContext = { params: Promise<{ ledgerId: string }> };

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId);
  if (access instanceof NextResponse) return access;

  const members = queryAll(
    `SELECT u.id, u.email, u.display_name, m.role, m.joined_at
     FROM ledger_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.ledger_id = ?
     ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END,
              m.joined_at, u.display_name`,
    [ledgerId],
  );
  return NextResponse.json({
    ledger: {
      id: access.ledger.id,
      name: access.ledger.name,
      isShared: Number(access.ledger.is_shared) === 1,
      role: access.role,
    },
    members: members.map((member) => ({
      id: member.id,
      email: member.email,
      displayName: member.display_name,
      role: member.role,
      joinedAt: Number(member.joined_at) || 0,
    })),
  });
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const body = await request.json().catch(() => ({}));
  const email = normalizeLedgerEmail(body?.email);
  const role = body?.role;
  if (email.length > 254 || !isValidLedgerEmail(email)) {
    return NextResponse.json({ error: "請輸入有效的電子郵件" }, { status: 400 });
  }
  if (role !== "editor" && role !== "viewer") {
    return NextResponse.json(
      { error: "邀請角色只能是 editor 或 viewer" },
      { status: 400 },
    );
  }
  if (email === normalizeLedgerEmail(access.auth.email)) {
    return NextResponse.json({ error: "你已是此帳本的成員" }, { status: 409 });
  }

  const existingMember = queryOne(
    `SELECT m.user_id
     FROM ledger_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.ledger_id = ? AND LOWER(u.email) = ?`,
    [ledgerId, email],
  );
  if (existingMember) {
    return NextResponse.json({ error: "此電子郵件已是帳本成員" }, { status: 409 });
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = Date.now();
  const invitationId = uid();
  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["owner"], () => {
      const count = queryOne(
        "SELECT COUNT(*) AS count FROM ledger_invitations WHERE invited_by = ? AND created_at >= ?",
        [access.auth.actorUserId, now - 60 * 60 * 1000],
      );
      if (Number(count?.count) >= 20) throw new LedgerOperationError("邀請寄送次數過多，請稍後再試", 429);
      getDB().run(
        `UPDATE ledger_invitations SET revoked_at = ?
         WHERE ledger_id = ? AND email = ? AND accepted_at = 0 AND revoked_at = 0`,
        [now, ledgerId, email],
      );
      getDB().run(
        `INSERT INTO ledger_invitations
         (id, ledger_id, email, role, token_hash, invited_by, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [invitationId, ledgerId, email, role, tokenHash, access.auth.actorUserId, now, now + 7 * 24 * 60 * 60 * 1000],
      );
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  saveDB();

  try {
    const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    if (!configuredUrl && process.env.NODE_ENV === 'production') throw new Error('APP_URL is required');
    const baseUrl = new URL(configuredUrl || request.nextUrl.origin);
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) throw new Error('Invalid APP_URL');
    if (process.env.NODE_ENV === 'production' && baseUrl.protocol !== 'https:') throw new Error('HTTPS APP_URL is required');
    const inviteUrl = new URL("/settings/ledgers", baseUrl);
    inviteUrl.searchParams.set("invite", rawToken);
    const sender = escapeHtml(access.auth.displayName || access.auth.email);
    const ledgerName = escapeHtml(access.ledger.name);
    const safeUrl = escapeHtml(inviteUrl.toString());
    const delivered = await sendStatsEmail({
      to: email,
      subject: `AssetPilot 帳本邀請：${access.ledger.name}`,
      html: `<p>您好，${sender} 邀請你加入「${ledgerName}」帳本（${role === "editor" ? "可編輯" : "唯讀"}）。</p><p><a href="${safeUrl}">接受帳本邀請</a></p><p>邀請將於 7 天後失效；你必須使用此邀請信的電子郵件登入 AssetPilot 才能接受。</p>`,
    });
    if (!delivered) throw new Error("Email provider is not configured");
  } catch {
    getDB().run(
      "UPDATE ledger_invitations SET revoked_at = ? WHERE id = ? AND accepted_at = 0",
      [Date.now(), invitationId],
    );
    writeLedgerAudit({
      ledgerId,
      actorUserId: access.auth.actorUserId,
      actorEmail: access.auth.email,
      actorRole: 'owner',
      action: 'member.invited',
      resourceType: 'invitations',
      resourceId: invitationId,
      result: 'failed',
      metadata: { email, role },
    });
    saveDB();
    return NextResponse.json(
      { error: "無法寄送邀請信，請檢查郵件服務設定" },
      { status: 503 },
    );
  }

  writeLedgerAudit({
    ledgerId,
    actorUserId: access.auth.actorUserId,
    actorEmail: access.auth.email,
    actorRole: "owner",
    action: "member.invited",
    resourceType: "invitations",
    resourceId: invitationId,
    result: "success",
    ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    userAgent: request.headers.get("user-agent") || "",
    metadata: { email, role },
  });
  return NextResponse.json({ id: invitationId, email, role }, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const body = await request.json().catch(() => ({}));
  const userId = String(body?.userId || "");
  const role = body?.role;
  if (!userId || (role !== "editor" && role !== "viewer")) {
    return NextResponse.json(
      { error: "請提供成員與 editor/viewer 角色" },
      { status: 400 },
    );
  }
  if (userId === access.auth.actorUserId) {
    return NextResponse.json(
      { error: "帳本擁有者需透過移交功能變更角色" },
      { status: 409 },
    );
  }
  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["owner"], () => {
      const member = queryOne(
        "SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?",
        [ledgerId, userId],
      );
      if (!member) throw new LedgerOperationError("找不到成員", 404);
      if (member.role === "owner") throw new LedgerOperationError("請使用移交擁有者功能", 409);
      getDB().run(
        "UPDATE ledger_members SET role = ? WHERE ledger_id = ? AND user_id = ? AND role <> 'owner'",
        [role, ledgerId, userId],
      );
      writeLedgerAudit({
        ledgerId,
        actorUserId: access.auth.actorUserId,
        actorEmail: access.auth.email,
        actorRole: "owner",
        action: "member.role_changed",
        resourceType: "members",
        resourceId: userId,
        result: "success",
        metadata: { role },
      });
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const { ledgerId } = await params;
  const access = await requireLedgerMembership(request, ledgerId, ["owner"]);
  if (access instanceof NextResponse) return access;
  const privateLedger = assertSharedLedger(access.ledger);
  if (privateLedger) return privateLedger;

  const body = await request.json().catch(() => ({}));
  const userId = String(body?.userId || "");
  if (!userId || userId === access.auth.actorUserId) {
    return NextResponse.json(
      { error: "請由其他帳本管理員移除成員，或使用離開功能" },
      { status: 400 },
    );
  }
  try {
    mutateLedger(ledgerId, access.auth.actorUserId, ["owner"], () => {
      const member = queryOne(
        "SELECT m.role, u.email FROM ledger_members m JOIN users u ON u.id = m.user_id WHERE m.ledger_id = ? AND m.user_id = ?",
        [ledgerId, userId],
      );
      if (!member) throw new LedgerOperationError("找不到成員", 404);
      if (member.role === "owner") throw new LedgerOperationError("請先移交帳本擁有權，再移除擁有者", 409);
      getDB().run(
        "DELETE FROM ledger_members WHERE ledger_id = ? AND user_id = ? AND role <> 'owner'",
        [ledgerId, userId],
      );
      getDB().run(
        "UPDATE ledger_invitations SET revoked_at = ? WHERE ledger_id = ? AND email = ? AND accepted_at = 0 AND revoked_at = 0",
        [Date.now(), ledgerId, normalizeLedgerEmail(member.email)],
      );
      writeLedgerAudit({
        ledgerId,
        actorUserId: access.auth.actorUserId,
        actorEmail: access.auth.email,
        actorRole: "owner",
        action: "member.removed",
        resourceType: "members",
        resourceId: userId,
        result: "success",
      });
    });
  } catch (error) {
    return ledgerErrorResponse(error);
  }
  return NextResponse.json({ ok: true });
}
