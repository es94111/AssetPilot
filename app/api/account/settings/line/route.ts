import { NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/apiHelpers";
import { getDB, queryOne, saveDB } from "../../../../../lib/db";

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const user = queryOne("SELECT line_id, google_id FROM users WHERE id = ?", [
    auth.userId,
  ]);
  if (!user || !user.line_id) {
    return NextResponse.json({ error: "尚未綁定 LINE 帳號" }, { status: 400 });
  }
  const passkeyCount = Number(
    queryOne(
      "SELECT COUNT(1) AS count FROM passkey_credentials WHERE user_id = ?",
      [auth.userId],
    )?.count || 0,
  );
  if (!user.google_id && passkeyCount === 0) {
    return NextResponse.json(
      {
        error:
          "至少保留一種其他登入方式（Google 或 Passkey）後才可解除 LINE 綁定",
      },
      { status: 400 },
    );
  }

  getDB().run("UPDATE users SET line_id = '' WHERE id = ?", [auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}
