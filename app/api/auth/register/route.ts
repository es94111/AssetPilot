import { NextResponse } from "next/server";
import { PASSWORD_AUTH_DISABLED_ERROR } from "../../../../lib/authPolicy";

/**
 * Local email/password registration has been retired. New accounts must be
 * created through a configured identity provider such as Google or LINE.
 */
export function POST() {
  return NextResponse.json(
    {
      error: PASSWORD_AUTH_DISABLED_ERROR,
      code: "password_auth_disabled",
    },
    { status: 410 },
  );
}
