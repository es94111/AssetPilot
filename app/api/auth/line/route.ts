import { NextResponse } from "next/server";
import { getDB, queryOne, saveDB } from "../../../../lib/db";
import {
  normalizeEmail,
  getUserCount,
  canOAuthRegister,
  recordLoginAudit,
  recordLoginAttempt,
  getSystemSettings,
} from "../../../../lib/loginHelpers";
import {
  uid,
  todayStr,
  createDefaultsForUser,
  backfillDefaultsForUser,
} from "../../../../lib/userDefaults";
import {
  formatUser,
  isActiveUserFlag,
  setAuthCookie,
} from "../../../../lib/apiHelpers";
import { consumeLineOAuthStateEntry } from "@/lib/lineOAuthState";
import { createLoginSession } from "../../../../lib/sessionHelpers";
import { getTurnstileSiteKey } from "../../../../lib/turnstile";
import {
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  exchangeLineCodeForToken,
  isAllowedLineRedirectUri,
  verifyLineIdToken,
} from "../../../../lib/lineOAuth";

const LINE_OAUTH_TXN_COOKIE = "line_oauth_txn";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { code, redirect_uri, state, bindingToken: bodyBindingToken } = body;
  const headers = request.headers;

  if (!code)
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  if (!isAllowedLineRedirectUri(String(redirect_uri || "").trim())) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "line",
      isSuccess: false,
      failureReason: "invalid_redirect_uri",
    });
    return NextResponse.json(
      { error: "invalid_redirect_uri" },
      { status: 400 },
    );
  }

  const stateEntry = consumeLineOAuthStateEntry(state);
  // The login consumer must only ever accept a state minted for the login
  // flow — a link-flow state (issued without the login Turnstile challenge)
  // must never be usable here, otherwise Turnstile enforcement can be
  // bypassed by requesting a link-flow state instead (AUTH-VULN-03 /
  // AUTHZ-VULN-05).
  if (!stateEntry || stateEntry.flow !== "login")
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });

  // Browser/client binding: proves this request comes from the same party
  // that initiated the OAuth flow, not a relayed code+state pair submitted
  // from a different (victim) browser/session (AUTH-VULN-02).
  const cookieBindingToken = (request as any).cookies?.get?.(
    LINE_OAUTH_TXN_COOKIE,
  )?.value;
  const providedBindingToken = String(bodyBindingToken || cookieBindingToken || "");
  if (
    !stateEntry.bindingToken ||
    providedBindingToken !== stateEntry.bindingToken
  ) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "line",
      isSuccess: false,
      failureReason: "binding_mismatch",
    });
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
  }

  if (
    getTurnstileSiteKey() &&
    stateEntry.flow === "login" &&
    !stateEntry.turnstileVerified
  ) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "line",
      isSuccess: false,
      failureReason: "turnstile_failed",
    });
    return NextResponse.json({ error: "請先完成真人驗證" }, { status: 403 });
  }
  const nonce = stateEntry.nonce;

  const settings = getSystemSettings();
  if (!settings.lineLoginEnabled)
    return NextResponse.json({ error: "LINE 登入未啟用" }, { status: 403 });
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET)
    return NextResponse.json({ error: "LINE 登入未設定" }, { status: 400 });

  try {
    const redirectUri = String(redirect_uri || "").trim();
    const { tokenRes, tokenData } = await exchangeLineCodeForToken(
      String(code),
      redirectUri,
    );
    if (!tokenRes.ok || !tokenData?.id_token) {
      recordLoginAttempt({
        email: "",
        headers,
        method: "line",
        isSuccess: false,
        failureReason: "token_exchange_failed",
      });
      return NextResponse.json(
        {
          error:
            "LINE 授權碼交換失敗：" +
            (tokenData?.error_description || tokenData?.error || "未知錯誤"),
        },
        { status: 401 },
      );
    }

    const { verifyRes, payload } = await verifyLineIdToken(
      String(tokenData.id_token),
      nonce,
    );
    if (!verifyRes.ok) {
      recordLoginAttempt({
        email: "",
        headers,
        method: "line",
        isSuccess: false,
        failureReason: "id_token_verify_failed",
      });
      return NextResponse.json(
        {
          error:
            "LINE ID Token 驗證失敗：" +
            (payload?.error_description || payload?.error || "未知錯誤"),
        },
        { status: 401 },
      );
    }

    const lineId = String(payload.sub || "");
    const email = normalizeEmail(payload.email);
    const name = payload.name || email?.split("@")[0] || "LINE User";
    const picture = payload.picture || "";

    if (!lineId)
      return NextResponse.json(
        { error: "無法取得 LINE 使用者 ID" },
        { status: 400 },
      );
    if (!email)
      return NextResponse.json(
        {
          error:
            "無法取得 LINE 帳號 Email，請確認 LINE Login channel 已申請 email 權限",
        },
        { status: 400 },
      );

    const db = getDB();
    let user = queryOne("SELECT * FROM users WHERE line_id = ?", [lineId]);
    if (!user) user = queryOne("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      const registerCheck = canOAuthRegister(email);
      if (!registerCheck.ok)
        return NextResponse.json(
          { error: registerCheck.error },
          { status: 403 },
        );
      const id = uid();
      const firstUser = getUserCount() === 0;
      const isAdmin = firstUser ? 1 : 0;
      const disabledPasswordHash = `disabled:${uid()}`;
      db.run(
        "INSERT INTO users (id, email, password_hash, display_name, line_id, avatar_url, is_admin, has_password, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [
          id,
          email,
          disabledPasswordHash,
          name,
          lineId,
          picture,
          isAdmin,
          0,
          todayStr(),
        ],
      );
      createDefaultsForUser(id);
      saveDB();
      user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
    } else {
      const updates: string[] = [];
      const vals: Array<string | number | null> = [];
      if (!user.line_id) {
        updates.push("line_id = ?");
        vals.push(lineId);
      }
      if (Number(user.has_password)) {
        updates.push("has_password = ?");
        vals.push(0);
      }
      if (picture && picture !== user.avatar_url) {
        updates.push("avatar_url = ?");
        vals.push(picture);
      }
      if (
        name &&
        (!user.display_name ||
          user.display_name === String(user.email || "").split("@")[0])
      ) {
        updates.push("display_name = ?");
        vals.push(name);
      }
      if (updates.length > 0) {
        db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [
          ...vals,
          String(user.id),
        ]);
        saveDB();
        user = queryOne("SELECT * FROM users WHERE id = ?", [String(user.id)]);
      }
    }

    if (!user)
      return NextResponse.json({ error: "使用者不存在" }, { status: 401 });
    if (!isActiveUserFlag(user.is_active)) {
      recordLoginAttempt({
        email: String(user.email || ""),
        headers,
        method: "line",
        isSuccess: false,
        failureReason: "account_disabled",
      });
      return NextResponse.json({ error: "帳號已停用，請聯繫管理員" }, { status: 403 });
    }
    const loginUser = {
      id: String(user.id),
      email: String(user.email || ""),
      is_admin: Number(user.is_admin) || 0,
    };
    const currentLogin = recordLoginAudit(loginUser, headers, "line");
    recordLoginAttempt({
      user: loginUser,
      email: loginUser.email,
      headers,
      method: "line",
      isSuccess: true,
    });
    try {
      backfillDefaultsForUser(loginUser.id);
    } catch (e) {
      console.error("[backfill]", e);
    }

    const { token } = createLoginSession(
      loginUser.id,
      Number(user.token_version) || 0,
      headers,
    );
    const response = NextResponse.json({
      user: formatUser(user),
      currentLogin,
      returnTo: stateEntry.returnTo,
    });
    response.cookies.delete(LINE_OAUTH_TXN_COOKIE);
    return setAuthCookie(response, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知錯誤";
    console.error("LINE SSO 錯誤:", message);
    return NextResponse.json(
      { error: "LINE 登入失敗：" + message },
      { status: 500 },
    );
  }
}
