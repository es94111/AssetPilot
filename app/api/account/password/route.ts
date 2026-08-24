import { NextResponse } from "next/server";
import { PASSWORD_AUTH_DISABLED_ERROR } from "../../../../lib/authPolicy";

/** Local email/password credentials cannot be created or changed. */
export function PUT() {
  return NextResponse.json(
    {
      error: PASSWORD_AUTH_DISABLED_ERROR,
      code: "password_auth_disabled",
    },
    { status: 410 },
  );
}
