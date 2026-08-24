import { NextResponse } from "next/server";
import { PASSWORD_AUTH_DISABLED_ERROR } from "../../../../lib/authPolicy";

/**
 * Legacy email/password authentication has been retired. Use Google, LINE, or
 * Passkey authentication through the provider-specific endpoints instead.
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
