import { NextResponse } from "next/server";
import { requireAuth, clearAuthCookie } from "../../../../lib/apiHelpers";
import { queryOne, saveDB } from "../../../../lib/db";
import { deleteUserCompletely } from "../../../../lib/userDeletion";
import { auditSensitiveAction } from "../../../../lib/auditHelpers";

function normalizeEmail(email: string | number | null | undefined) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { confirmEmail } = body;

  const user = queryOne("SELECT * FROM users WHERE id = ?", [auth.userId]);
  if (!user)
    return NextResponse.json({ error: "使用者不存在" }, { status: 404 });

  if (user.is_admin) {
    const adminCount = Number(
      queryOne("SELECT COUNT(1) AS count FROM users WHERE is_admin = 1")
        ?.count || 0,
    );
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "系統至少需保留一位管理員，請先指定其他管理員" },
        { status: 400 },
      );
    }
  }

  // All accounts use provider authentication. Re-confirm intent by typing the
  // account's own email address; local passwords are not accepted here.
  if (normalizeEmail(confirmEmail) !== normalizeEmail(user.email)) {
    return NextResponse.json(
      { error: "請輸入正確的帳號電子信箱以確認刪除" },
      { status: 400 },
    );
  }

  const deletedEmail = normalizeEmail(user.email);
  const wasAdmin = !!user.is_admin;
  await deleteUserCompletely(auth.userId);
  saveDB();

  // 敏感操作：使用者自助刪除帳號（含所有資料）。於刪除後寫入以確保留痕。
  auditSensitiveAction(
    request,
    { userId: auth.userId, isAdmin: wasAdmin },
    {
      action: "account.self_delete",
      metadata: {
        target_user_id: auth.userId,
        target_email: deletedEmail,
        was_admin: wasAdmin,
        self: true,
      },
    },
  );
  saveDB();

  const res = NextResponse.json({ success: true });
  clearAuthCookie(res);
  return res;
}
