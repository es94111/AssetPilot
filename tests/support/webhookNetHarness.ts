// tests/support/webhookNetHarness.ts — Webhook 投遞測試的封閉網路環境（issue #285）
//
// 目的：在不連任何真實外部網路、不需要 PostgreSQL 的前提下，驗證「公開 HTTPS 端點」
// 的投遞路徑（含 TLS 憑證驗證、SNI、Host 標頭）。
//
// 手法（兩層，缺一不可）：
// 1. 假的 DNS：攔截 `dns.promises.lookup`，把測試主機名對應到指定的（假）公開 IP。
//    真實 DNS 不可能讓我們控制「公開主機名解析到內網位址」這種情境。
// 2. 連線改寫：投遞層驗證通過後會**直接以解析出的位址連線**（防 DNS rebinding），
//    因此這裡攔截 `net.Socket.prototype.connect`，把「假公開 IP」改寫成 loopback，
//    讓本機的測試 https 伺服器收到請求。TLS 仍以原始主機名做 SNI 與憑證驗證。
//
// 測試結束務必呼叫 harness.restore()（或以 `using` 自動還原）。
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import { generateSelfSignedCert } from './selfSignedCert.ts';

/** 測試用主機名（.example 為保留網域，保證不會與真實 DNS 衝突）。 */
export const TEST_HOSTNAME = 'webhook-public.example';
export const TEST_HOSTNAME_V6 = 'webhook-public-v6.example';
export const TEST_HOSTNAME_MULTI = 'webhook-public-multi.example';

/** 測試中被當成「公開位址」使用的 IP（文件用網段：93.184.216.0/24、2606:4700::/32）。 */
export const FAKE_PUBLIC_IPV4 = '93.184.216.34';
export const FAKE_PUBLIC_IPV6 = '2606:4700:4700::1111';

export interface HarnessOptions {
  /** 額外要假造的主機名 → 位址對應（例如測試私有 DNS 回應）。 */
  extraHosts?: Record<string, { address: string; family: number }>;
}

export interface WebhookNetHarness {
  /** 以 loopback 上的測試 https 伺服器網址，組成指向測試主機名的公開 URL。 */
  publicUrl(hostname: string, server: https.Server, path: string): string;
  restore(): void;
}

function fakeLookupFor(map: Map<string, Array<{ address: string; family: number }>>) {
  const realLookup = dns.promises.lookup;
  return {
    realLookup,
    lookup: (async (hostname: string, options?: unknown) => {
      const hit = map.get(String(hostname).toLowerCase());
      if (!hit) return (realLookup as (...args: unknown[]) => Promise<unknown>)(hostname, options);
      const wantsAll = Boolean(options && typeof options === 'object' && 'all' in options && (options as { all?: boolean }).all);
      return wantsAll ? hit : hit[0];
    }) as typeof dns.promises.lookup,
  };
}

/**
 * 建立測試網路環境。回傳統一使用的主機名對應：
 * - TEST_HOSTNAME：單一 IPv4 的假公開位址
 * - TEST_HOSTNAME_V6：單一 IPv6 的假公開位址
 * - TEST_HOSTNAME_MULTI：IPv6 + IPv4 混合（驗證 IPv4 優先與「全部位址都須公開」）
 */
export function installWebhookNetHarness(options: HarnessOptions = {}): WebhookNetHarness {
  const map = new Map<string, Array<{ address: string; family: number }>>([
    [TEST_HOSTNAME, [{ address: FAKE_PUBLIC_IPV4, family: 4 }]],
    [TEST_HOSTNAME_V6, [{ address: FAKE_PUBLIC_IPV6, family: 6 }]],
    [
      TEST_HOSTNAME_MULTI,
      [
        { address: FAKE_PUBLIC_IPV6, family: 6 },
        { address: FAKE_PUBLIC_IPV4, family: 4 },
      ],
    ],
  ]);
  for (const [host, entries] of Object.entries(options.extraHosts || {})) {
    map.set(host.toLowerCase(), [{ address: entries.address, family: entries.family }]);
  }

  const { realLookup, lookup } = fakeLookupFor(map);
  dns.promises.lookup = lookup;

  // 投遞層以解析出的位址直連（不再查 DNS），因此只能在 socket 層把假位址改寫到 loopback。
  const realConnect = net.Socket.prototype.connect;
  const pinned = new Set([FAKE_PUBLIC_IPV4, FAKE_PUBLIC_IPV6]);
  net.Socket.prototype.connect = function patchedConnect(
    this: net.Socket,
    ...args: unknown[]
  ): net.Socket {
    const target = args[0];
    if (target && typeof target === 'object') {
      const opts = target as { host?: string; address?: string; family?: number };
      const host = opts.host || opts.address || '';
      if (pinned.has(host)) {
        if (host === FAKE_PUBLIC_IPV6) {
          opts.host = '::1';
          opts.address = '::1';
          opts.family = 6;
        } else {
          opts.host = '127.0.0.1';
          opts.address = '127.0.0.1';
          opts.family = 4;
        }
      }
    }
    const connect = realConnect as unknown as (...connectArgs: unknown[]) => net.Socket;
    return connect.apply(this, args);
  } as typeof net.Socket.prototype.connect;

  return {
    publicUrl(hostname: string, server: https.Server, path: string): string {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : 0;
      return `https://${hostname}:${port}${path}`;
    },
    restore(): void {
      dns.promises.lookup = realLookup;
      net.Socket.prototype.connect = realConnect;
    },
  };
}

/**
 * 建立測試用 https 伺服器，並把自簽憑證加入行程預設信任清單，
 * 讓 TLS 憑證驗證在測試中仍是「真的」在跑（而不是用 NODE_TLS_REJECT_UNAUTHORIZED 關掉驗證）。
 */
export async function startTestHttpsServer(
  handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void,
  options: { host?: string; hostnames?: string[] } = {},
): Promise<{ server: https.Server; hostnames: string[] }> {
  const hostnames = options.hostnames || [TEST_HOSTNAME, TEST_HOSTNAME_V6, TEST_HOSTNAME_MULTI];
  const { certPem, keyPem } = generateSelfSignedCert({
    commonName: hostnames[0],
    dnsNames: hostnames,
    ipAddresses: [FAKE_PUBLIC_IPV4, FAKE_PUBLIC_IPV6],
  });
  tls.setDefaultCACertificates([...tls.getCACertificates('bundled'), certPem]);

  const server = https.createServer({ cert: certPem, key: keyPem }, handler);
  await new Promise<void>((resolve) => {
    server.listen(0, options.host || '127.0.0.1', resolve);
  });
  return { server, hostnames };
}
