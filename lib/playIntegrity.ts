// lib/playIntegrity.ts — Play Integrity API（classic / nonce 流程）後端驗證
//
// App 在第三方登入時向 Google Play 取得 integrity token，後端在此解碼出
// 「裝置 / App 完整性判定」並評估風險。設計為「軟性」：任何錯誤都不對外拋
// 例外，未設定憑證時 fail-open，由呼叫端依 PLAY_INTEGRITY_ENFORCE 決定是否阻擋。
import jwt from "jsonwebtoken";
import logger from "./logger";
import { recordLoginAttempt } from "./loginHelpers";
import {
  evaluateVerdict,
  getPackageName,
  type IntegrityVerdict,
} from "./playIntegrityVerdict";

export { evaluateVerdict };
export type { IntegrityVerdict };

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const PLAY_INTEGRITY_SCOPE = "https://www.googleapis.com/auth/playintegrity";

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export interface VerifyResult {
  ok: boolean;
  reasons: string[];
  configured: boolean;
  verdict?: IntegrityVerdict;
}

// ── 設定 ──────────────────────────────────────────────────────

let serviceAccountCache: ServiceAccount | null | undefined;

function getServiceAccount(): ServiceAccount | null {
  if (serviceAccountCache !== undefined) return serviceAccountCache;
  const raw = process.env.PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON;
  if (!raw || !raw.trim()) {
    serviceAccountCache = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    if (!parsed.client_email || !parsed.private_key) {
      logger.warn(
        "[playIntegrity] service account JSON 缺少 client_email / private_key",
      );
      serviceAccountCache = null;
      return null;
    }
    // 由 .env 讀入時 \n 常被轉成字面字串，需還原為實際換行。
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    serviceAccountCache = parsed;
    return parsed;
  } catch (e) {
    logger.warn(
      { err: String(e) },
      "[playIntegrity] 無法解析 service account JSON",
    );
    serviceAccountCache = null;
    return null;
  }
}

export function isPlayIntegrityConfigured(): boolean {
  return getServiceAccount() !== null;
}

export function isPlayIntegrityEnforced(): boolean {
  return (
    String(process.env.PLAY_INTEGRITY_ENFORCE || "")
      .trim()
      .toLowerCase() === "true"
  );
}

// ── OAuth2 access token（service account JWT bearer grant）──────

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt - 60 > now) {
    return cachedAccessToken.token;
  }

  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: PLAY_INTEGRITY_SCOPE,
      aud: GOOGLE_TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" },
  );

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text.slice(0, 300) },
        "[playIntegrity] 取得 access token 失敗",
      );
      return null;
    }
    const data = await res.json();
    const token = String(data?.access_token || "");
    const expiresIn = Number(data?.expires_in || 3600);
    if (!token) return null;
    cachedAccessToken = { token, expiresAt: now + expiresIn };
    return token;
  } catch (e) {
    logger.warn({ err: String(e) }, "[playIntegrity] 取得 access token 例外");
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── decodeIntegrityToken ──────────────────────────────────────

async function decodeIntegrityToken(
  integrityToken: string,
): Promise<IntegrityVerdict | null> {
  const sa = getServiceAccount();
  if (!sa) return null;
  const accessToken = await getAccessToken(sa);
  if (!accessToken) return null;

  const packageName = getPackageName();
  const url = `https://playintegrity.googleapis.com/v1/${encodeURIComponent(packageName)}:decodeIntegrityToken`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ integrityToken }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn(
        { status: res.status, body: text.slice(0, 300) },
        "[playIntegrity] decodeIntegrityToken 失敗",
      );
      return null;
    }
    const data = await res.json();
    return (data?.tokenPayloadExternal || null) as IntegrityVerdict | null;
  } catch (e) {
    logger.warn(
      { err: String(e) },
      "[playIntegrity] decodeIntegrityToken 例外",
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── 對外主要進入點 ────────────────────────────────────────────

/**
 * 解碼並評估 integrity token。全程不拋例外。
 * - 未設定憑證：configured=false、ok=false、reasons=['not_configured']（呼叫端 fail-open）。
 * - 設定但解碼/評估失敗：記錄並回 ok=false。
 */
export async function verifyIntegrity(params: {
  token: string;
  expectedNonce?: string;
  context: string; // 'login' | 'register' | ...
  headers?: Headers;
  user?: { id?: string; email?: string } | null;
  email?: string;
}): Promise<VerifyResult> {
  const { token, expectedNonce, context, headers, user, email } = params;

  if (!isPlayIntegrityConfigured()) {
    return { ok: false, reasons: ["not_configured"], configured: false };
  }

  let verdict: IntegrityVerdict | null = null;
  try {
    verdict = await decodeIntegrityToken(token);
  } catch (e) {
    logger.warn(
      { err: String(e), context },
      "[playIntegrity] verifyIntegrity 例外",
    );
  }

  const { ok, reasons } = evaluateVerdict(verdict, { expectedNonce });

  // 記錄 verdict 摘要（不含完整 token / 機敏內容）。
  logger.info(
    {
      context,
      ok,
      reasons,
      appRecognitionVerdict: verdict?.appIntegrity?.appRecognitionVerdict,
      deviceRecognitionVerdict:
        verdict?.deviceIntegrity?.deviceRecognitionVerdict,
      appLicensingVerdict: verdict?.accountDetails?.appLicensingVerdict,
    },
    "[playIntegrity] verdict",
  );

  // 不通過時留一筆稽核（沿用登入失敗紀錄表，便於後台觀察濫用樣態）。
  if (!ok && headers) {
    try {
      recordLoginAttempt({
        user: user || null,
        email: email || user?.email || "",
        headers,
        method: context,
        isSuccess: false,
        failureReason: `integrity_${reasons[0] || "failed"}`,
      });
    } catch (_) {
      // 記錄失敗不影響主流程
    }
  }

  return { ok, reasons, configured: true, verdict: verdict || undefined };
}
