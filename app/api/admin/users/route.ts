import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/apiHelpers";
import { queryAll } from "../../../../lib/db";
import { PASSWORD_AUTH_DISABLED_ERROR } from "../../../../lib/authPolicy";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll(
    "SELECT id, email, display_name, created_at, google_id, line_id, is_admin, admin_role FROM users ORDER BY created_at DESC, email ASC",
  );
  const users = rows.map((r) => {
    const isSuperAdmin =
      !!r.is_admin &&
      String(r.admin_role || "super").toLowerCase() !== "readonly";
    return {
      id: r.id,
      email: r.email,
      displayName: r.display_name,
      createdAt: r.created_at,
      googleId: r.google_id || "",
      lineId: r.line_id || "",
      hasPassword: false,
      isAdmin: !!r.is_admin,
      // adminRole 僅在 is_admin 時有意義：'super' | 'readonly'。
      adminRole: r.is_admin ? (isSuperAdmin ? "super" : "readonly") : "",
      isSuperAdmin,
    };
  });
  return NextResponse.json(users);
}

/** Admin-created local accounts are disabled; users must authenticate with a provider. */
export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    {
      error: PASSWORD_AUTH_DISABLED_ERROR,
      code: "password_auth_disabled",
    },
    { status: 410 },
  );
}
