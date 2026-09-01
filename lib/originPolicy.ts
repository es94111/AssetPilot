// lib/originPolicy.ts — WebAuthn 預期 origin 的信任來源（零相依，可測試）
//
// 安全背景：WebAuthn 驗證時的 expectedOrigin 若取自「請求本身的 Origin 標頭」，
// 等同自我比對，永遠通過。正確做法是與伺服器端設定的允許清單比對。
//
// 允許清單來源（擇一）：
//   1. ALLOWED_ORIGINS 環境變數（正式環境應設定，如 https://asset.example.com）
//   2. APP_URL / NEXT_PUBLIC_APP_URL（單一正式網址）
//   3. 開發模式（非 production）fallback 到請求 Origin，維持本機開發體驗；
//      production 未設定任何來源時回 null → 呼叫端應拒絕（fail-closed）。

export type OriginHeadersLike = Headers | Record<string, string | undefined>;

function getHeader(headers: OriginHeadersLike, name: string): string {
  const maybeGet = (headers as Headers)?.get;
  if (typeof maybeGet === "function") {
    return String((headers as Headers).get(name) || "");
  }
  const value = (headers as Record<string, string | undefined>)[name];
  return String(value || "");
}

function configuredAllowedOrigins(): string[] {
  const fromList = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromList.length > 0) return fromList;
  const single = String(
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "",
  ).trim();
  return single ? [single] : [];
}

export interface PasskeyOriginResult {
  /** 傳給 webauthn 驗證的 expected origin；null 代表無法信任，必須拒絕 */
  origin: string | null;
  /** true 代表回退到請求 Origin（僅允許於開發模式） */
  fellBackToRequest: boolean;
}

export function resolvePasskeyExpectedOrigin(
  requestOrigin: string | null | undefined,
  nodeEnv?: string,
): PasskeyOriginResult {
  const allowed = configuredAllowedOrigins();
  if (allowed.length > 0) {
    // Origin header 完全符合清單時直接採用；否則取清單第一個（單一來源時與其一致）。
    const normalizedRequest = String(requestOrigin || "").trim();
    if (normalizedRequest && allowed.includes(normalizedRequest)) {
      return { origin: normalizedRequest, fellBackToRequest: false };
    }
    return { origin: allowed[0], fellBackToRequest: false };
  }

  const environment = nodeEnv || process.env.NODE_ENV || "development";
  if (environment !== "production" && requestOrigin) {
    return { origin: String(requestOrigin), fellBackToRequest: true };
  }
  // production 未設定來源：fail-closed
  return { origin: null, fellBackToRequest: false };
}