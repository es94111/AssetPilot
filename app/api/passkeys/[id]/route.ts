// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';

import { LAST_LOGIN_METHOD_ERROR, removeAccountLoginMethod } from "../../../../lib/accountLoginMethods";

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = removeAccountLoginMethod(auth.userId, { provider: "passkey", credentialId: id });
  if (result === "missing") {
    return NextResponse.json({ error: "找不到此 Passkey" }, { status: 404 });
  }
  if (result === "last_method") {
    return NextResponse.json({ error: LAST_LOGIN_METHOD_ERROR }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
