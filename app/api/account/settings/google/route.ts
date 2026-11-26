import { NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/apiHelpers";
import { LAST_LOGIN_METHOD_ERROR, removeAccountLoginMethod } from "../../../../../lib/accountLoginMethods";

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const result = removeAccountLoginMethod(auth.userId, { provider: "google" });
  if (result === "missing") {
    return NextResponse.json({ error: "尚未綁定 Google 帳號" }, { status: 400 });
  }
  if (result === "last_method") {
    return NextResponse.json({ error: LAST_LOGIN_METHOD_ERROR }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
