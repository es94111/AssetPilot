// lib/requestIp.ts — 客戶端 IP 解析（含反向代理信任控制）
//
// 安全背景：X-Forwarded-For（XFF）的最「左」段由「第一個發出請求的客戶端」自行填寫，
// 直接信任會讓攻擊者以偽造標頭繞過每 IP 速率限制／管理員 IP 白名單。
//
// TRUST_PROXY 環境變數：
//   未設定 / false（預設，不信任代理鏈）：
//     取 X-Forwarded-For「最後一段」——最接近本伺服器的連線位址：
//     - 無代理直連：Next.js 會以 socket.remoteAddress 補上單一值 → 真實連線 IP
//     - 單層代理（附加模式）：最後一段為代理看到的真實客戶端 IP，客戶端偽造的前段被忽略
//     - 單層代理（覆寫模式，本專案 nginx.conf 以 $remote_addr 覆寫 XFF）：唯一一段即真實 IP
//     ⚠️ 直連（未經代理）部署時，攻擊者自帶的 XFF 無法在應用層驗證——請務必搭配
//        會覆寫 XFF 的反向代理（見 nginx.conf），或將服務埠綁定於本機／內網。
//   true / 1 / yes / on（信任代理）：
//     取 XFF「第一段」作為原始客戶端 IP。適用於：邊緣代理已覆寫或清洗 XFF、
//     或已透過 real_ip 模組還原真實 IP 的多層部署。
//
// 本模組刻意保持零相依（不 import node 內建模組），可在 Edge runtime（proxy.ts）使用。

export type IpHeadersLike = Headers | Record<string, string | undefined>;

function getHeader(headers: IpHeadersLike, name: string): string {
  const maybeGet = (headers as Headers)?.get;
  if (typeof maybeGet === "function") {
    return String((headers as Headers).get(name) || "");
  }
  const value = (headers as Record<string, string | undefined>)[name];
  return String(value || "");
}

export function normalizeIp(ip: string | null | undefined): string {
  return String(ip || "")
    .trim()
    .toLowerCase()
    .replace(/^::ffff:/, "");
}

export function isTrustedProxyEnabled(): boolean {
  const raw = String(process.env.TRUST_PROXY || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** 由請求標頭解析客戶端 IP（含代理信任策略，見檔頭說明）。無法判定時回 "unknown"。 */
export function getClientIpFromHeaders(headers: IpHeadersLike): string {
  const xff = getHeader(headers, "x-forwarded-for");
  const entries = xff
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let rawIp = "";
  if (entries.length > 0) {
    rawIp = isTrustedProxyEnabled()
      ? entries[0]
      : entries[entries.length - 1];
  }
  if (!rawIp) rawIp = getHeader(headers, "x-real-ip");

  const normalized = normalizeIp(rawIp);
  return normalized || "unknown";
}