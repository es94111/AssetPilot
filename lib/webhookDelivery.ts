// lib/webhookDelivery.ts — Webhook 投遞的 HTTPS 傳送層（issue #285）
//
// 職責：把已簽章的 payload 送往單一、已鎖定的目的地，並拒絕任何重新導向。
// 安全模型（對應 issue #285 驗收條件）：
// 1. 送出前重新驗證目標 URL（scheme／hostname）與 DNS 解析出的**每一個** IPv4／IPv6
//    位址；只要有一個非公開位址即拒投，避免 split-horizon／DNS rebinding 讓公開
//    主機名指向內網、loopback、link-local 或雲端 metadata（169.254.169.254）。
// 2. 驗證後以「已解析的位址」直接連線（`host` 固定為該位址、`servername` 保留原始
//    主機名以維持 TLS SNI 與憑證驗證），連線階段不再查詢 DNS，消除驗證與連線之間
//    的 TOCTOU 視窗。
// 3. 3xx 一律視為拒投：不跟隨、不重送，因此 payload 與簽章內容絕不會被轉送到未經驗證
//    的新 origin（舊版直接 fetch() 且預設跟隨 redirect，307/308 會連同 POST body 轉送）。
// 4. 每個請求使用獨立連線（agent: false）：連線池以 IP:port 為鍵，若沿用預設 agent，
//    不同主機名可能共用同一條已建立（且只對前一主機名做過憑證驗證）的 TLS 連線。
//
// 刻意獨立於 lib/webhookHelpers.ts（後者相依資料庫）：本模組只依賴 node:https／node:dns
// 與零相依的 lib/apiTokenCore.ts，因此可在無 PostgreSQL 的環境直接單測。
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import {
  ApiTokenError,
  DELIVERY_TIMEOUT_MS,
  WEBHOOK_DELIVERY_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  isBlockedIpAddress,
  signWebhookPayload,
  validateWebhookUrl,
} from './apiTokenCore';

export const RESPONSE_BODY_MAX = 500;

const HTTPS_DEFAULT_PORT = 443;

// DNS 解析與連線各自逾時，總和必須小於 lib/webhookHelpers.ts 認領（claim）視窗
// 的 `DELIVERY_TIMEOUT_MS * 2`，否則認領可能在使用中過期而被第二次認領重複投遞。
const DNS_LOOKUP_TIMEOUT_MS = 5_000;

// DNS may consume 5s and the HTTPS request another 10s; add one request-timeout margin so
// another drain cannot reclaim an in-flight row even when the earlier batch took time.
export const WEBHOOK_DELIVERY_CLAIM_LEASE_MS = DNS_LOOKUP_TIMEOUT_MS + DELIVERY_TIMEOUT_MS * 2;

export interface WebhookDeliveryResult {
  ok: boolean;
  statusCode: number;
  responseBody: string;
  error: string;
  /**
   * 被本機安全政策阻擋（未與目的端完成 HTTP 交換）→ 永久失敗、不重試。
   * 與 `isRetryableStatus()` 的語意互補：連線／逾時錯誤仍以狀態碼 0 表示可重試。
   */
  blocked: boolean;
}

export interface WebhookDeliveryTarget {
  url: string;
  secret: string;
  deliveryId: string;
  eventType: string;
  rawBody: string;
}

function blocked(reason: string, statusCode = 0): WebhookDeliveryResult {
  return { ok: false, statusCode, responseBody: '', error: reason, blocked: true };
}

/**
 * 解析主機名為位址清單；IP 字面值直接回傳自身（不經 DNS，也就沒有 rebinding 風險）。
 * 逾時與解析失敗皆以 `null` 表示，交由呼叫端轉成可重試的連線錯誤。
 */
async function resolveTargetAddresses(
  hostname: string,
): Promise<Array<{ address: string; family: number }> | null> {
  const literalFamily = net.isIP(hostname);
  if (literalFamily !== 0) return [{ address: hostname, family: literalFamily }];

  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      dns.promises.lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('DNS 解析逾時')), DNS_LOOKUP_TIMEOUT_MS);
      }),
    ]);
    return addresses.map((entry) => ({ address: String(entry.address), family: Number(entry.family) || 4 }));
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 以單一 HTTPS 請求投遞 webhook payload；回傳值語意與舊版 fetch() 實作相同
 * （ok／statusCode／responseBody／error），差別在於絕不跟隨重新導向。
 */
export async function sendWebhookPayload(
  target: WebhookDeliveryTarget,
  timeoutMs: number = DELIVERY_TIMEOUT_MS,
): Promise<WebhookDeliveryResult> {
  // 1. 送出前重驗 URL：與建立訂閱時同一份規則（僅 HTTPS、無帳密、非本機／內網字面值）。
  let url: URL;
  try {
    url = new URL(validateWebhookUrl(target.url));
  } catch (e) {
    if (e instanceof ApiTokenError) return blocked(`Webhook 目標網址未通過投遞前驗證：${e.message}`);
    return blocked('Webhook 目標網址無法解析');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const port = url.port ? Number(url.port) : HTTPS_DEFAULT_PORT;

  // 2. 解析並驗證所有位址：必須「全部」為公開位址才投遞（任一私有即拒投）。
  const addresses = await resolveTargetAddresses(hostname);
  if (!addresses || addresses.length === 0) {
    return { ok: false, statusCode: 0, responseBody: '', error: `無法解析 Webhook 目標主機名`, blocked: false };
  }
  for (const entry of addresses) {
    if (isBlockedIpAddress(entry.address)) {
      return blocked(
        `Webhook 目標主機名解析到非公開位址（${entry.address}），已阻止投遞以避免 SSRF`,
      );
    }
  }
  // 部署環境（Zeabur）容器只有 IPv4 對外路由；verbatim 順序可能把 AAAA 排在前面，
  // 直接取第一筆會 Network unreachable，因此優先挑 IPv4（同 lib/mcpOAuth.ts 的取捨）。
  const selected = [...addresses].sort((a, b) => a.family - b.family)[0];

  const timestampSeconds = Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    // 明確帶上 Content-Length：否則 Node 會改用 chunked 編碼，與舊版 fetch() 送出的
    // 位元組框架不同，部分閘道／會讀 content-length 的接收端會因此驗證失敗。
    'Content-Length': String(Buffer.byteLength(target.rawBody)),
    // Host 必須是原始主機名（而非鎖定的 IP），否則共享主機／反向代理會路由錯誤。
    Host: url.host,
    [WEBHOOK_EVENT_HEADER]: target.eventType,
    [WEBHOOK_DELIVERY_HEADER]: target.deliveryId,
    [WEBHOOK_TIMESTAMP_HEADER]: String(timestampSeconds),
    [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(target.secret, target.rawBody, timestampSeconds),
  };

  return await new Promise<WebhookDeliveryResult>((resolve) => {
    // 多條路徑（正常結束、對方中斷、逾時、連線錯誤）都可能收斂，必須只解決一次。
    let settled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: WebhookDeliveryResult) => {
      if (settled) return;
      settled = true;
      if (deadlineTimer) clearTimeout(deadlineTimer);
      resolve(result);
    };
    const connectionError = (message: string): WebhookDeliveryResult => ({
      ok: false,
      statusCode: 0,
      responseBody: '',
      error: message,
      blocked: false,
    });

    const request = https.request(
      {
        protocol: 'https:',
        host: selected.address,
        family: selected.family,
        port,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers,
        // 只在使用主機名時設定 SNI；IP 字面值不應作為 servername（否則憑證驗證必然失敗）。
        servername: net.isIP(hostname) === 0 ? hostname : undefined,
        agent: false,
      },
      (response) => {
        const statusCode = Number(response.statusCode) || 0;

        // 3. 任何 3xx 一律拒投：不跟隨、不讀取、不重送。
        if (statusCode >= 300 && statusCode < 400) {
          // 附上目的地（去控制字元並截斷）方便使用者修正訂閱網址；此值來自對方伺服器，
          // 不可能是本站機密，但仍須清理以免污染日誌與 UI。
          const location = String(response.headers.location || '(未提供 Location)')
            .replace(/[\u0000-\u001f\u007f]+/g, ' ')
            .slice(0, 200);
          finish(
            blocked(
              `Webhook 目標回應 HTTP ${statusCode} 重新導向至 ${location}；依安全政策不跟隨重新導向`,
              statusCode,
            ),
          );
          // 立即銷毀連線：對方若持續送內容（甚至無止盡），也不該由我們持有 socket。
          // 先掛上 no-op error 監聽：destroy 可能讓 response 以 error 收尾，而沒有監聽器的
          // 'error' 事件會直接拋出。
          response.on('error', () => {});
          response.destroy();
          request.destroy();
          return;
        }

        const chunks: Buffer[] = [];
        let total = 0;
        response.on('data', (chunk: Buffer | string) => {
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (total >= RESPONSE_BODY_MAX) return;
          total += bytes.length;
          chunks.push(bytes);
        });
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8').slice(0, RESPONSE_BODY_MAX);
          finish({
            ok: statusCode >= 200 && statusCode < 300,
            statusCode,
            responseBody: body,
            error: statusCode >= 200 && statusCode < 300 ? '' : `HTTP ${statusCode}`,
            blocked: false,
          });
        });
        // 對方送出標頭後中途斷線（截斷的回應，例如反向代理逾時或被攻擊者刻意中斷）不會
        // 觸發 'end'，若不在此收斂，promise 將永不解決、投遞列卡在認領狀態無法更新。
        response.on('close', () => {
          if (!response.complete) {
            finish(connectionError('Webhook 回應未完整即中斷連線'));
          }
        });
        response.on('error', (error: Error) => {
          finish(connectionError(error instanceof Error ? error.message : String(error)));
        });
      },
    );

    // HTTP 101 會走 ClientRequest 的 upgrade 事件，而不是一般 response callback；
    // webhook 投遞不支援協定升級，需明確收斂結果並關閉升級後的 socket。
    request.on('upgrade', (response, socket) => {
      const statusCode = Number(response.statusCode) || 101;
      finish({
        ok: false,
        statusCode,
        responseBody: '',
        error: `Webhook 目標回應 HTTP ${statusCode} Upgrade；不支援協定升級`,
        blocked: false,
      });
      socket.on('error', () => {});
      socket.destroy();
      request.destroy();
    });

    // 絕對上限（對應舊版 fetch() 實作的 AbortController 截止時間）。刻意不用
    // request.setTimeout：那是「閒置」計時器，會被持續的少量資料重置，慢速滴流的
    // 對方可藉此拖過認領視窗，讓同一列被另一個 drain 重複投遞。
    deadlineTimer = setTimeout(() => {
      const error = new Error(`Webhook 投遞逾時（${timeoutMs}ms）`);
      // 先解決，避免某些 socket close/upgrade 時序下 destroy() 不發出 error 而懸掛。
      finish(connectionError(error.message));
      request.destroy(error);
    }, timeoutMs);
    request.on('error', (error: Error) => {
      finish(connectionError(error instanceof Error ? error.message : String(error)));
    });

    request.write(target.rawBody);
    request.end();
  });
}
