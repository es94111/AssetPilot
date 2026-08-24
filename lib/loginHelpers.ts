// lib/loginHelpers.ts — 登入稽核、IP 查詢、系統設定等共用邏輯
import crypto from "crypto";
import { getDB, queryOne, saveDB } from "./db";

const IPINFO_TOKEN = process.env.IPINFO_TOKEN || "";
const IP_COUNTRY_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小時
const ipCountryCache = new Map<string, { country: string; at: number }>();

const ENV_ADMIN_IP_ALLOWLIST = parseIpAllowlist(
  process.env.ADMIN_IP_ALLOWLIST || "",
);

export interface SystemSettings {
  publicRegistration: boolean;
  allowedRegistrationEmails: string[];
  adminIpAllowlist: string[];
  routeAuditMode: "security" | "extended" | "minimal";
  lineLoginEnabled: boolean;
  transactionPhotoStorage: "local" | "s3" | null;
  transactionPhotoMaxBytes: number | null;
  stockAutoUpdateEnabled: boolean;
  stockAutoUpdateIntervalMin: number;
  stockAutoUpdateLastRun: number;
  stockAutoUpdateLastSummary: string;
}

export interface LoginAuditResult {
  id: string;
  loginAt: number;
  ipAddress: string;
  loginMethod: string;
  isAdminLogin: boolean;
}

export interface LoginAttemptArgs {
  user?: { id?: string; email?: string; is_admin?: number } | null;
  email?: string;
  headers: Headers | Record<string, string | undefined>;
  method?: string;
  isSuccess?: boolean;
  failureReason?: string;
}

// ── 工具函式 ──

export function uid(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function normalizeEmail(email: string | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function normalizeIp(ip: string | null | undefined): string {
  return String(ip || "")
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, "");
}

function isPrivateOrLocalIp(ip: string): boolean {
  const v = String(ip || "")
    .trim()
    .toLowerCase();
  if (!v || v === "unknown") return true;
  if (v === "::1" || v === "localhost") return true;
  if (
    v.startsWith("127.") ||
    v.startsWith("10.") ||
    v.startsWith("192.168.") ||
    v.startsWith("169.254.")
  )
    return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(v)) return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80:"))
    return true;
  return false;
}

export function parseIpAllowlist(value: string | string[]): string[] {
  const source = Array.isArray(value) ? value.join("\n") : String(value || "");
  return Array.from(
    new Set(
      source
        .split(/[\n,;\s]+/)
        .map((v) => normalizeIp(v))
        .filter(Boolean),
    ),
  );
}

export function parseAllowedRegistrationEmails(
  value: string | string[],
): string[] {
  const source = Array.isArray(value) ? value.join("\n") : String(value || "");
  return Array.from(
    new Set(
      source
        .split(/[\n,;\s]+/)
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase(),
        )
        .filter(
          (v) => isValidEmail(v) || /^\*@[a-z0-9.-]+\.[a-z]{2,}$/.test(v),
        ),
    ),
  );
}

export function matchAllowlist(
  email: string,
  rawList: string | string[],
): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  const list = Array.isArray(rawList)
    ? rawList
    : parseAllowedRegistrationEmails(rawList);
  for (const item of list) {
    if (!item) continue;
    if (item.startsWith("*@")) {
      if (normalized.endsWith(item.slice(1))) return true;
      continue;
    }
    if (item === normalized) return true;
  }
  return false;
}

export function isValidEmail(email: string | null | undefined): boolean {
  const s = normalizeEmail(email);
  if (!s || s.length > 254) return false;
  if (s.includes("..")) return false;
  const at = s.indexOf("@");
  if (at <= 0 || at !== s.lastIndexOf("@") || at >= s.length - 1) return false;
  const [, domain] = s.split("@");
  if (!domain || !domain.includes(".")) return false;
  return true;
}

// ── IP 工具 ──

type HeadersLike = Headers | Record<string, string | undefined>;

function getHeader(headers: HeadersLike, key: string): string {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(key) || "";
  }
  return (headers as Record<string, string | undefined>)[key] || "";
}

/** NextRequest headers 版本 */
export function getRequestIpFromHeaders(headers: HeadersLike): string {
  const forwardedFor = String(getHeader(headers, "x-forwarded-for"))
    .split(",")[0]
    .trim();
  const realIp = getHeader(headers, "x-real-ip");
  const rawIp = forwardedFor || realIp || "";
  return rawIp ? normalizeIp(rawIp) : "unknown";
}

/** 取得 User-Agent 標頭，並截斷至合理長度避免異常超長字串。 */
export function getUserAgentFromHeaders(headers: HeadersLike): string {
  const ua = String(getHeader(headers, "user-agent") || "").trim();
  const appDeviceId = getAppDeviceIdFromHeaders(headers);
  const taggedUa = appDeviceId ? `${ua} AssetPilotDeviceId/${appDeviceId}` : ua;
  return taggedUa.slice(0, 400);
}

export function getAppDeviceIdFromHeaders(headers: HeadersLike): string {
  return String(getHeader(headers, "x-assetpilot-device-id") || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

/**
 * 將 User-Agent 解析為易讀的裝置描述，例如「Windows · Chrome」「iPhone · Safari」
 * 「Android App」。無法判斷時回傳「未知裝置」。純前後端共用、不依賴外部套件。
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = String(userAgent || "").trim();
  if (!ua) return "未知裝置";
  const appDeviceId =
    /AssetPilotDeviceId\/([a-zA-Z0-9_-]{6,64})/i.exec(ua)?.[1] || "";
  const appDeviceLabel = appDeviceId ? ` · ID ${appDeviceId.slice(0, 8)}` : "";

  // AssetPilot 行動 App（Dart/Flutter http 預設 UA 或自訂 UA）。
  if (/AssetPilot/i.test(ua)) {
    if (/Android/i.test(ua))
      return `AssetPilot App（Android）${appDeviceLabel}`;
    if (/iOS|iPhone|iPad/i.test(ua))
      return `AssetPilot App（iOS）${appDeviceLabel}`;
    return `AssetPilot App${appDeviceLabel}`;
  }
  if (/^Dart\//i.test(ua) || /\(dart:io\)/i.test(ua))
    return `AssetPilot App${appDeviceLabel}`;

  // 作業系統 / 裝置。
  let os = "";
  if (/iPhone/i.test(ua)) os = "iPhone";
  else if (/iPad/i.test(ua)) os = "iPad";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  // 瀏覽器（順序重要：Edge/Chrome 內含其他關鍵字）。
  let browser = "";
  if (/Edg(e|A|iOS)?\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = "Safari";

  const label = [os, browser].filter(Boolean).join(" · ");
  return label || "未知裝置";
}

export function getCountryFromHeaders(headers: HeadersLike): string | null {
  const cfCountry = String(getHeader(headers, "cf-ipcountry"))
    .trim()
    .toUpperCase();
  if (cfCountry && cfCountry !== "XX" && cfCountry !== "T1") return cfCountry;
  return null;
}

export async function fetchIpCountry(ipAddress: string): Promise<string> {
  const ip = String(ipAddress || "").trim();
  if (!ip || ip === "unknown") return "-";
  if (isPrivateOrLocalIp(ip)) return "LOCAL";
  const cached = ipCountryCache.get(ip);
  const now = Date.now();
  if (cached && now - cached.at < IP_COUNTRY_CACHE_TTL_MS)
    return cached.country;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);
  try {
    const tokenQuery = IPINFO_TOKEN
      ? `?token=${encodeURIComponent(IPINFO_TOKEN)}`
      : "";
    const r = await fetch(
      `https://ipinfo.io/${encodeURIComponent(ip)}/json${tokenQuery}`,
      { signal: controller.signal },
    );
    if (!r.ok) {
      ipCountryCache.set(ip, { country: "-", at: now });
      return "-";
    }
    const data = await r.json();
    const country =
      String(data?.country || "")
        .trim()
        .toUpperCase() || "-";
    ipCountryCache.set(ip, { country, at: now });
    return country;
  } catch {
    ipCountryCache.set(ip, { country: "-", at: now });
    return "-";
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── 系統設定 ──

export function getSystemSettings(): SystemSettings {
  const row = queryOne(
    "SELECT public_registration, allowed_registration_emails, admin_ip_allowlist, route_audit_mode, line_login_enabled, transaction_photo_storage, transaction_photo_max_bytes, stock_auto_update_enabled, stock_auto_update_interval_min, stock_auto_update_last_run, stock_auto_update_last_summary FROM system_settings WHERE id = 1",
  ) || {
    public_registration: 1,
    allowed_registration_emails: "",
    admin_ip_allowlist: "",
    route_audit_mode: "security",
    line_login_enabled: 0,
    transaction_photo_storage: "",
    transaction_photo_max_bytes: 0,
    stock_auto_update_enabled: 1,
    stock_auto_update_interval_min: 10,
    stock_auto_update_last_run: 0,
    stock_auto_update_last_summary: "",
  };
  const allowedRegistrationEmails = parseAllowedRegistrationEmails(
    String(row.allowed_registration_emails || ""),
  );
  const dbAdminIpAllowlist = parseIpAllowlist(
    String(row.admin_ip_allowlist || ""),
  );
  const mergedAdminIpAllowlist = Array.from(
    new Set([...ENV_ADMIN_IP_ALLOWLIST, ...dbAdminIpAllowlist]),
  );
  const rawMode = String(row.route_audit_mode || "security");
  const routeAuditMode = (
    ["security", "extended", "minimal"] as const
  ).includes(rawMode as "security")
    ? (rawMode as SystemSettings["routeAuditMode"])
    : "security";
  const rawStorage = String(row.transaction_photo_storage || "").trim();
  const transactionPhotoStorage =
    rawStorage === "local" || rawStorage === "s3" ? rawStorage : null;
  const dbMaxBytes = Number(row.transaction_photo_max_bytes);
  const transactionPhotoMaxBytes =
    Number.isFinite(dbMaxBytes) && dbMaxBytes > 0 ? dbMaxBytes : null;
  const rawInterval = Number(row.stock_auto_update_interval_min);
  const stockAutoUpdateIntervalMin =
    Number.isFinite(rawInterval) && rawInterval >= 1
      ? Math.min(1440, Math.floor(rawInterval))
      : 10;
  return {
    publicRegistration: !!row.public_registration,
    allowedRegistrationEmails,
    adminIpAllowlist: mergedAdminIpAllowlist,
    routeAuditMode,
    lineLoginEnabled: !!row.line_login_enabled,
    transactionPhotoStorage,
    transactionPhotoMaxBytes,
    stockAutoUpdateEnabled: row.stock_auto_update_enabled !== 0,
    stockAutoUpdateIntervalMin,
    stockAutoUpdateLastRun: Number(row.stock_auto_update_last_run) || 0,
    stockAutoUpdateLastSummary: String(
      row.stock_auto_update_last_summary || "",
    ),
  };
}

export function getUserCount(): number {
  const row = queryOne("SELECT COUNT(1) AS count FROM users");
  return Number(row?.count || 0);
}

export function canOAuthRegister(email: string): {
  ok: boolean;
  error?: string;
} {
  const emailLower = normalizeEmail(email);
  if (!emailLower) return { ok: false, error: "電子郵件格式不正確" };
  if (getUserCount() === 0) return { ok: true };
  const settings = getSystemSettings();
  const allowList = settings.allowedRegistrationEmails;
  if (allowList.length > 0) {
    if (matchAllowlist(emailLower, allowList)) return { ok: true };
    return { ok: false, error: "此 Email 未被管理員允許註冊" };
  }
  if (!settings.publicRegistration)
    return {
      ok: false,
      error: "目前已關閉第三方服務註冊，請聯絡管理員開放 Google 或 LINE 登入",
    };
  return { ok: true };
}

// ── 登入稽核 ──

export function recordLoginAudit(
  user: { id?: string; email?: string; is_admin?: number } | null | undefined,
  headers: HeadersLike,
  method = "password",
): LoginAuditResult | null {
  if (!user?.id) return null;
  const loginId = uid();
  const loginAt = Date.now();
  const ipAddress = getRequestIpFromHeaders(headers);
  const loginMethod = String(method || "password")
    .trim()
    .toLowerCase();
  const isAdminLogin = user.is_admin ? 1 : 0;
  const cfCountry = getCountryFromHeaders(headers);
  const userAgent = getUserAgentFromHeaders(headers);
  const appDeviceId = getAppDeviceIdFromHeaders(headers);
  const db = getDB();
  db.run(
    `INSERT INTO login_audit_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, country, user_agent, device_id) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      loginId,
      user.id,
      normalizeEmail(user.email),
      loginAt,
      ipAddress,
      loginMethod,
      isAdminLogin,
      cfCountry,
      userAgent,
      appDeviceId,
    ],
  );
  saveDB();
  if (!cfCountry) {
    fetchIpCountry(ipAddress)
      .then((country) => {
        if (country) {
          getDB().run("UPDATE login_audit_logs SET country = ? WHERE id = ?", [
            country,
            loginId,
          ]);
          saveDB();
        }
      })
      .catch(() => {});
  }
  return {
    id: loginId,
    loginAt,
    ipAddress,
    loginMethod,
    isAdminLogin: !!isAdminLogin,
  };
}

export function recordLoginAttempt({
  user = null,
  email = "",
  headers,
  method = "password",
  isSuccess = false,
  failureReason = "",
}: LoginAttemptArgs): void {
  const loginAt = Date.now();
  const safeHeaders = (headers || {}) as HeadersLike;
  const ipAddress = getRequestIpFromHeaders(safeHeaders);
  const loginMethod = String(method || "password")
    .trim()
    .toLowerCase();
  const normalizedEmail = normalizeEmail(email || user?.email || "");
  const userId = user?.id ? String(user.id) : "";
  const isAdminLogin = user?.is_admin ? 1 : 0;
  const attemptId = uid();
  const cfCountry = getCountryFromHeaders(safeHeaders);
  const userAgent = getUserAgentFromHeaders(safeHeaders);
  const appDeviceId = getAppDeviceIdFromHeaders(safeHeaders);
  const db = getDB();
  db.run(
    `INSERT INTO login_attempt_logs (id, user_id, email, login_at, ip_address, login_method, is_admin_login, is_success, failure_reason, country, user_agent, device_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      attemptId,
      userId,
      normalizedEmail,
      loginAt,
      ipAddress,
      loginMethod,
      isAdminLogin,
      isSuccess ? 1 : 0,
      isSuccess
        ? ""
        : String(failureReason || "unknown")
            .trim()
            .toLowerCase(),
      cfCountry,
      userAgent,
      appDeviceId,
    ],
  );
  saveDB();
  if (!cfCountry) {
    fetchIpCountry(ipAddress)
      .then((country) => {
        if (country) {
          getDB().run(
            "UPDATE login_attempt_logs SET country = ? WHERE id = ?",
            [country, attemptId],
          );
          saveDB();
        }
      })
      .catch(() => {});
  }
}
