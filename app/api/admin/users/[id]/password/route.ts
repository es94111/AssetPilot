import { NextResponse } from "next/server";
import { PASSWORD_AUTH_DISABLED_ERROR } from "../../../../../../lib/authPolicy";

/** Admins cannot create or reset local email/password credentials. */
export function PUT() {
  return NextResponse.json(
    {
      error: PASSWORD_AUTH_DISABLED_ERROR,
      code: "password_auth_disabled",
    },
    { status: 410 },
  );
}
