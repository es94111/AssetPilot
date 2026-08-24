// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth, normalizeThemeMode } from "../../../../lib/apiHelpers";
import { queryOne } from "../../../../lib/db";
import { toIsoUtc } from "../../../../lib/userTime";
import { getOrCreateUserCurrencySettings } from "../../../../lib/userCurrencySettings";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const u = queryOne(
    "SELECT id, email, display_name, google_id, line_id, has_password, avatar_url, theme_mode, is_admin, is_active, created_at, timezone FROM users WHERE id = ?",
    [auth.userId],
  );
  if (!u)
    return NextResponse.json(
      { error: "User not found", code: "NotFound" },
      { status: 404 },
    );
  const currencySettings = getOrCreateUserCurrencySettings(auth.userId);

  return NextResponse.json({
    id: u.id,
    email: u.email,
    display_name: u.display_name,
    timezone: u.timezone || "Asia/Taipei",
    has_password: false,
    google_id: u.google_id || "",
    line_id: u.line_id || "",
    avatar_url: u.avatar_url || "",
    theme_mode: normalizeThemeMode(u.theme_mode),
    default_currency: currencySettings.defaultCurrency,
    is_admin: !!u.is_admin,
    is_active: u.is_active == null ? true : !!u.is_active,
    created_at: toIsoUtc(u.created_at || new Date(0)),
    updated_at: null,
  });
}
