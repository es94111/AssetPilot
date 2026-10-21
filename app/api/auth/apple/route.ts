import { NextResponse } from "next/server";
import { getDB, queryOne, saveDB } from "../../../../lib/db";
import {
  normalizeEmail,
  getUserCount,
  canOAuthRegister,
  recordLoginAudit,
  recordLoginAttempt,
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
import { consumeAppleOAuthStateEntry } from "@/lib/appleOAuthState";
import { verifyAppleIdentityToken, appleEmail } from "@/lib/appleOAuth";
import { createLoginSession } from "../../../../lib/sessionHelpers";
import { verifyTurnstileToken } from "../../../../lib/turnstile";

/**
 * Apple 登入：以 Apple 身分令牌（identity token）換取 AssetPilot 帳號。
 *
 * 安全設計：
 * - 身分令牌的簽章、iss、aud、exp 與 nonce 全部在伺服器端驗證（lib/appleOAuth.ts）。
 * - 帳號以 Apple 的 `sub`（stable user id）識別，不以 email 自動合併，
 *   避免 Apple 隱藏 email 或 email 變更時誤綁到他人帳號。
 * - state + bindingToken 綁定發起流程的 client，關閉 login-CSRF。
 * - 既有帳號要綁定 Apple 身分時，必須先以該帳號身分重新驗證（見
 *   app/api/account/link-apple），不可僅憑 email 自動附加。
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { identityToken, state, bindingToken: bodyBindingToken, fullName } = body;
  const turnstileToken = String(
    body.turnstileToken || body["cf-turnstile-response"] || "",
  );
  const headers = request.headers;

  if (!identityToken)
    return NextResponse.json({ error: "invalid_identity_token" }, { status: 400 });

  const stateEntry = consumeAppleOAuthStateEntry(state);
  if (!stateEntry)
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });

  const providedBindingToken = String(bodyBindingToken || "");
  if (
    !stateEntry.bindingToken ||
    providedBindingToken !== stateEntry.bindingToken
  ) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "apple",
      isSuccess: false,
      failureReason: "binding_mismatch",
    });
    return NextResponse.json({ error: "state_mismatch" }, { status: 400 });
  }

  // Turnstile：與其他登入方式一致，啟用時必須完成真人驗證。
  const turnstile = await verifyTurnstileToken(turnstileToken, headers, "login");
  if (!turnstile.ok) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "apple",
      isSuccess: false,
      failureReason: "turnstile_failed",
    });
    return NextResponse.json(
      { error: turnstile.error || "請先完成真人驗證" },
      { status: 403 },
    );
  }

  const verified = await verifyAppleIdentityToken(identityToken, {
    expectedNonce: stateEntry.nonce,
  });
  if (!verified.ok) {
    recordLoginAttempt({
      email: "",
      headers,
      method: "apple",
      isSuccess: false,
      failureReason: "invalid_identity_token",
    });
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const claims = verified.claims;
  const appleId = String(claims.sub);
  const email = appleEmail(claims);
  // Apple 只在首次授權時提供姓名；使用者也可自訂顯示名稱。
  const providedName = String(fullName || "").trim();
  const appleName = providedName || String(claims.name || "").trim();

  try {
    const db = getDB();
    // 以 Apple sub 為唯一識別來源。既有帳號若要綁定，需走明確的
    // link 流程（app/api/account/link-apple），不可在此自動合併。
    let user = queryOne("SELECT * FROM users WHERE apple_id = ?", [appleId]);

    if (!user && email) {
      // 既有帳號（僅 Google／LINE 登入）第一次使用 Apple 登入：不自動合併，
      // 改為回覆明確錯誤，讓使用者改用原登入方式或在 App 內執行綁定流程。
      const existing = queryOne("SELECT * FROM users WHERE email = ?", [email]);
      if (existing) {
        recordLoginAttempt({
          email,
          headers,
          method: "apple",
          isSuccess: false,
          failureReason: "email_already_registered",
        });
        return NextResponse.json(
          {
            error:
              "此 Email 已存在其他登入方式的帳號。請改用原登入方式，或在 App 內以原帳號身分綁定 Apple 登入。",
            code: "email_already_registered",
          },
          { status: 409 },
        );
      }
    }

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
      // Apple 隱藏 email 時不寫入真實 email：以 apple_id 衍生的佔位值滿足
      // email 欄位的 NOT NULL UNIQUE 限制，識別仍以 apple_id 為準。
      const storedEmail = email || `${appleId}@apple.invalid`;
      db.run(
        "INSERT INTO users (id, email, password_hash, display_name, apple_id, is_admin, has_password, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [
          id,
          storedEmail,
          disabledPasswordHash,
          appleName || storedEmail.split("@")[0],
          appleId,
          isAdmin,
          0,
          todayStr(),
        ],
      );
      createDefaultsForUser(id);
      saveDB();
      user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
    } else if (appleName) {
      const updates: string[] = [];
      const vals: string[] = [];
      if (
        !user.display_name ||
        user.display_name === String(user.email || "").split("@")[0]
      ) {
        updates.push("display_name = ?");
        vals.push(appleName);
      }
      if (updates.length > 0) {
        db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, [
          ...vals,
          user.id,
        ]);
        saveDB();
        user = queryOne("SELECT * FROM users WHERE id = ?", [user.id]);
      }
    }

    if (!user)
      return NextResponse.json({ error: "使用者不存在" }, { status: 401 });
    if (!isActiveUserFlag(user.is_active)) {
      recordLoginAttempt({
        email: String(user.email || ""),
        headers,
        method: "apple",
        isSuccess: false,
        failureReason: "account_disabled",
      });
      return NextResponse.json(
        { error: "帳號已停用，請聯繫管理員" },
        { status: 403 },
      );
    }

    const loginUser = {
      id: String(user.id),
      email: String(user.email || ""),
      is_admin: Number(user.is_admin) || 0,
    };
    const currentLogin = recordLoginAudit(loginUser, headers, "apple");
    recordLoginAttempt({
      user: loginUser,
      email: loginUser.email,
      headers,
      method: "apple",
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
    return setAuthCookie(
      NextResponse.json({
        user: formatUser(user),
        currentLogin,
      }),
      token,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知錯誤";
    console.error("Apple 登入錯誤:", message);
    return NextResponse.json(
      { error: "Apple 登入失敗：" + message },
      { status: 500 },
    );
  }
}
