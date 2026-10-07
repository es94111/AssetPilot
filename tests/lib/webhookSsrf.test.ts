// tests/lib/webhookSsrf.test.ts — Webhook 投遞的 SSRF／重新導向防護測試（issue #285）
//
// 刻意不加 DATABASE_URL 略過守衛：本檔只測 lib/webhookDelivery.ts（相依 node:https／node:dns
// 與零相依的 lib/apiTokenCore.ts），不需要 PostgreSQL，因此在任何環境都能執行。
// 全部情境都在封閉網路中進行（見 tests/support/webhookNetHarness.ts），不連任何真實外部服務。
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import {
  FAKE_PUBLIC_IPV4,
  FAKE_PUBLIC_IPV6,
  TEST_HOSTNAME,
  TEST_HOSTNAME_MULTI,
  TEST_HOSTNAME_V6,
  installWebhookNetHarness,
  startTestHttpsServer,
} from '../support/webhookNetHarness.ts';
import { sendWebhookPayload } from '../../lib/webhookDelivery.ts';
import {
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  isBlockedIpAddress,
  verifyWebhookSignature,
} from '../../lib/apiTokenCore.ts';

const SECRET = 'whsec_ssrf_test_secret';

function target(url: string, overrides: Partial<Parameters<typeof sendWebhookPayload>[0]> = {}) {
  return {
    url,
    secret: SECRET,
    deliveryId: 'dl_ssrf',
    eventType: 'transaction.created',
    rawBody: '{"id":"tx1","amount":100}',
    ...overrides,
  };
}

/** 啟動一個「內網服務」，記錄是否有任何請求送達（正確行為下必須永遠是 0）。 */
async function startInternalTrap(): Promise<{
  hitCount: () => number;
  lastBody: () => string;
  origin: string;
  close: () => Promise<void>;
}> {
  let hits = 0;
  let body = '';
  const server = http.createServer((req, res) => {
    hits += 1;
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      body = raw;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"stolen":true}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    hitCount: () => hits,
    lastBody: () => body,
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

test('Webhook 投遞：公開端點的 307／308 重新導向不得被跟隨，payload 不得轉送內網', async () => {
  const harness = installWebhookNetHarness();
  const seen: Array<{ location: string; body: string }> = [];
  const trap = await startInternalTrap();
  try {
    for (const status of [307, 308, 301, 302]) {
      const { server } = await startTestHttpsServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => {
          raw += chunk;
        });
        req.on('end', () => {
          seen.push({ location: String(req.headers['x-test-status'] || ''), body: raw });
          res.writeHead(status, { Location: `${trap.origin}/steal` });
          res.end();
        });
      });
      try {
        const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')));
        assert.equal(result.ok, false, `${status} 重新導向不得視為成功`);
        assert.equal(result.statusCode, status);
        assert.equal(result.blocked, true, `${status} 應被標記為安全政策阻擋（永久失敗、不重試）`);
        assert.match(result.error, /重新導向/);
        assert.match(result.error, /不跟隨重新導向/);
        // 目的地（內網服務）必須完全沒有收到請求，也就不可能拿到 payload 或簽章密鑰
        assert.equal(trap.hitCount(), 0, `重新導向至 ${trap.origin} 不得被跟隨`);
        assert.equal(trap.lastBody(), '');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
    assert.equal(trap.hitCount(), 0);
    // 每個 3xx 都確實由公開端點回應（證明請求有送達原始目的地）
    assert.equal(seen.length, 4);
    assert.ok(seen.every((entry) => entry.body.includes('"id":"tx1"')), '原始目的地仍應收到 payload');
  } finally {
    await trap.close();
    harness.restore();
  }
});

test('Webhook 投遞：重新導向到 RFC1918／link-local／雲端 metadata 亦不得被跟隨', async () => {
  const harness = installWebhookNetHarness();
  const internalTargets = [
    'http://10.0.0.5/hooks',
    'http://192.168.1.10/hooks',
    'http://172.16.0.1/hooks',
    'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
    'http://[::1]/hooks',
    'http://[fd00::1]/hooks',
    'https://metadata.google.internal/computeMetadata/v1/',
  ];
  try {
    for (const destination of internalTargets) {
      const { server } = await startTestHttpsServer((_req, res) => {
        res.writeHead(308, { Location: destination });
        res.end();
      });
      try {
        const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')));
        assert.equal(result.ok, false, `不得跟隨重新導向至 ${destination}`);
        assert.equal(result.blocked, true, `重新導向至 ${destination} 應被阻擋`);
        assert.equal(result.responseBody, '', '被阻擋的回應不得把對方內容當成投遞結果帶回');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  } finally {
    harness.restore();
  }
});

test('Webhook 投遞：訂閱網址的 DNS 解析結果含私有位址時拒絕投遞（防 DNS rebinding／split-horizon）', async () => {
  // 每個主機名都解析到非公開位址；這些主機名各自「通過」validateWebhookUrl 的字面檢查，
  // 唯有在投遞前檢查 DNS 解析結果才能擋下。
  const privateAnswers: Array<[string, string, number]> = [
    ['private-a.example', '127.0.0.1', 4],
    ['private-b.example', '10.1.2.3', 4],
    ['private-c.example', '192.168.0.1', 4],
    ['private-d.example', '169.254.169.254', 4],
    ['private-e.example', '100.64.0.1', 4],
    ['private-f.example', '::1', 6],
    ['private-g.example', 'fe80::1', 6],
    ['private-h.example', 'fd00::1', 6],
    ['private-i.example', '::ffff:127.0.0.1', 6],
  ];
  const harness = installWebhookNetHarness({
    extraHosts: Object.fromEntries(
      privateAnswers.map(([host, address, family]) => [host, { address, family }]),
    ),
  });
  const trap = await startInternalTrap();
  try {
    for (const [host, address] of privateAnswers) {
      const result = await sendWebhookPayload(target(`https://${host}/hooks`));
      assert.equal(result.ok, false, `${host}（${address}）不得投遞`);
      assert.equal(result.blocked, true, `${host}（${address}）應被標記為阻擋`);
      assert.match(result.error, /非公開位址/);
      assert.ok(result.error.includes(address), '錯誤訊息應指出被阻擋的解析位址以便排查');
      assert.equal(result.responseBody, '');
    }
    assert.equal(trap.hitCount(), 0);
  } finally {
    await trap.close();
    harness.restore();
  }
});

test('Webhook 投遞：混合位址只要有一個非公開即拒絕（避免 Happy Eyeballs 選到內網）', async () => {
  const harness = installWebhookNetHarness({
    extraHosts: {
      'mixed.example': { address: FAKE_PUBLIC_IPV4, family: 4 },
    },
  });
  // 覆寫成「公開 IPv4 + 私有 IPv6」的雙筆回應
  const dns = await import('node:dns');
  const realLookup = dns.default.promises.lookup;
  dns.default.promises.lookup = (async (hostname: string, options?: unknown) => {
    if (hostname === 'mixed.example') {
      const entries = [
        { address: 'fd00::1', family: 6 },
        { address: FAKE_PUBLIC_IPV4, family: 4 },
      ];
      return options && typeof options === 'object' && 'all' in options && (options as { all?: boolean }).all
        ? entries
        : entries[0];
    }
    return (realLookup as (...args: unknown[]) => Promise<unknown>)(hostname, options);
  }) as typeof dns.default.promises.lookup;
  try {
    const { server } = await startTestHttpsServer((_req, res) => {
      res.writeHead(200);
      res.end('ok');
    });
    try {
      const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks'), {
        url: `https://mixed.example:${(server.address() as AddressInfo).port}/hooks`,
      }));
      assert.equal(result.ok, false);
      assert.equal(result.blocked, true, '只要有一個解析位址非公開，就必須拒絕整筆投遞');
      assert.match(result.error, /fd00::1/);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  } finally {
    dns.default.promises.lookup = realLookup;
    harness.restore();
  }
});

test('Webhook 投遞：IPv6 目標的合法公開端點可正常投遞，IPv6 私有位址則被阻擋', async () => {
  const harness = installWebhookNetHarness();
  const received: Array<{ body: string; signature: string; event: string; host: string }> = [];
  // 測試伺服器同時監聽 IPv6 loopback；harness 會把假公開 IPv6 改寫成 ::1
  const { server } = await startTestHttpsServer(
    (req, res) => {
      let raw = '';
      req.on('data', (chunk) => {
        raw += chunk;
      });
      req.on('end', () => {
        received.push({
          body: raw,
          signature: String(req.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] || ''),
          event: String(req.headers[WEBHOOK_EVENT_HEADER.toLowerCase()] || ''),
          host: String(req.headers.host || ''),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    },
    { host: '::1' },
  );
  try {
    const url = harness.publicUrl(TEST_HOSTNAME_V6, server, '/ipv6-hooks');
    const result = await sendWebhookPayload(target(url));
    assert.equal(result.ok, true, `IPv6 公開端點應可投遞：${result.error}`);
    assert.equal(result.statusCode, 200);
    assert.equal(result.blocked, false);
    assert.equal(received.length, 1);
    assert.equal(received[0].event, 'transaction.created');
    // Host 標頭必須保留原始主機名（而非被鎖定的 IP），SNI 才能與 Host 一致
    assert.ok(received[0].host.startsWith(TEST_HOSTNAME_V6), `Host 應為原始主機名，實際：${received[0].host}`);
    assert.ok(
      verifyWebhookSignature(SECRET, received[0].body, received[0].signature),
      '接收端應能以簽章密鑰驗證 HMAC（IPv6 路徑不得改變簽章）',
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：IP 字面值的目標網址亦受同一套規則約束（不經 DNS 亦有防護）', async () => {
  const harness = installWebhookNetHarness();
  const trap = await startInternalTrap();
  try {
    const internalPort = Number(new URL(trap.origin).port);
    for (const host of ['127.0.0.1', '10.0.0.5', '169.254.169.254', '100.64.0.1', '[::1]', '[fd00::1]']) {
      const literal = host.startsWith('[') ? `${host}:${internalPort}` : `${host}:${internalPort}`;
      const result = await sendWebhookPayload(target(`https://${literal}/hooks`));
      assert.equal(result.ok, false, `${host} 不得投遞`);
      assert.equal(result.blocked, true, `${host} 應被標記為阻擋`);
      assert.match(result.error, /投遞前驗證|非公開位址/);
    }
    assert.equal(trap.hitCount(), 0, 'IP 字面值的私有目標不得被連線');
  } finally {
    await trap.close();
    harness.restore();
  }
});

test('Webhook 投遞：HTTP（非 HTTPS）與含帳密的目標網址在投遞前仍會被拒絕', async () => {
  const harness = installWebhookNetHarness();
  try {
    const insecure = await sendWebhookPayload(target(`http://${TEST_HOSTNAME}/hooks`));
    assert.equal(insecure.ok, false);
    assert.equal(insecure.blocked, true);
    assert.match(insecure.error, /HTTPS/);

    const withCredentials = await sendWebhookPayload(target(`https://user:pass@${TEST_HOSTNAME}/hooks`));
    assert.equal(withCredentials.ok, false);
    assert.equal(withCredentials.blocked, true);
    assert.match(withCredentials.error, /帳號密碼/);
  } finally {
    harness.restore();
  }
});

test('Webhook 投遞：合法公開 URL 正常投遞，簽章與標頭與既有行為一致', async () => {
  const harness = installWebhookNetHarness();
  const received: Array<{ body: string; signature: string; event: string; delivery: string; timestamp: string; contentType: string; host: string }> = [];
  const { server } = await startTestHttpsServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      received.push({
        body: raw,
        signature: String(req.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] || ''),
        event: String(req.headers[WEBHOOK_EVENT_HEADER.toLowerCase()] || ''),
        delivery: String(req.headers['x-assetpilot-delivery'] || ''),
        timestamp: String(req.headers['x-assetpilot-timestamp'] || ''),
        contentType: String(req.headers['content-type'] || ''),
        host: String(req.headers.host || ''),
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end('{"received":true}');
    });
  });
  try {
    const url = harness.publicUrl(TEST_HOSTNAME, server, '/hooks?tenant=a');
    const rawBody = JSON.stringify({ id: 'tx9', type: 'expense', amount: 42 });
    const result = await sendWebhookPayload(target(url, { rawBody, deliveryId: 'dl_abc', eventType: 'transaction.updated' }));

    assert.equal(result.ok, true, `合法公開 URL 應投遞成功：${result.error}`);
    assert.equal(result.statusCode, 201);
    assert.equal(result.responseBody, '{"received":true}');
    assert.equal(result.error, '');
    assert.equal(result.blocked, false);

    assert.equal(received.length, 1);
    assert.equal(received[0].body, rawBody, 'payload 必須逐位元組一致（否則簽章會失效）');
    assert.equal(received[0].event, 'transaction.updated');
    assert.equal(received[0].delivery, 'dl_abc');
    assert.equal(received[0].contentType, 'application/json');
    assert.ok(received[0].timestamp.length > 0);
    assert.ok(received[0].host.startsWith(TEST_HOSTNAME), 'Host 應保留原始主機名');
    assert.ok(
      verifyWebhookSignature(SECRET, rawBody, received[0].signature),
      '簽章必須與既有 signWebhookPayload 格式相容（t=<unix>,v1=<hex>）',
    );
    // 錯誤密鑰必須驗證失敗（確保簽章真的綁定密鑰）
    assert.equal(verifyWebhookSignature('whsec_other', rawBody, received[0].signature), false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：混合 IPv4／IPv6 的公開主機名優先走 IPv4（符合部署環境只有 IPv4 對外路由）', async () => {
  const harness = installWebhookNetHarness();
  const { server } = await startTestHttpsServer((_req, res) => {
    res.writeHead(200);
    res.end('ok');
  });
  try {
    // TEST_HOSTNAME_MULTI 的 DNS 回應刻意把 IPv6 排在前面
    const lookupCalls: string[] = [];
    const dns = await import('node:dns');
    const realLookup = dns.default.promises.lookup;
    dns.default.promises.lookup = (async (hostname: string, options?: unknown) => {
      lookupCalls.push(String(hostname));
      return (realLookup as (...args: unknown[]) => Promise<unknown>)(hostname, options);
    }) as typeof dns.default.promises.lookup;
    try {
      const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME_MULTI, server, '/hooks')));
      assert.equal(result.ok, true, `混合位址的公開主機名應可投遞：${result.error}`);
      assert.equal(result.statusCode, 200);
      // 投遞層自行解析（而非交給連線層），確保驗證與連線使用同一組位址
      assert.equal(lookupCalls.length, 1);
      assert.equal(lookupCalls[0], TEST_HOSTNAME_MULTI);
    } finally {
      dns.default.promises.lookup = realLookup;
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：目標伺服器 5xx／4xx 的失敗語意與既有重試策略一致', async () => {
  const harness = installWebhookNetHarness();
  try {
    for (const status of [500, 503, 429, 400, 404, 422]) {
      const { server } = await startTestHttpsServer((_req, res) => {
        res.writeHead(status);
        res.end('nope');
      });
      try {
        const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')));
        assert.equal(result.ok, false, `HTTP ${status} 不得視為成功`);
        assert.equal(result.statusCode, status, '狀態碼必須原樣回報，重試判斷才能與既有邏輯一致');
        assert.equal(result.blocked, false, `${status} 為對方伺服器回應，不是本機政策阻擋`);
        assert.equal(result.error, `HTTP ${status}`);
        assert.equal(result.responseBody, 'nope');
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    }
  } finally {
    harness.restore();
  }
});

test('Webhook 投遞：回應主體長度上限維持 500 字元（避免被對方以大量內容灌爆）', async () => {
  const harness = installWebhookNetHarness();
  const { server } = await startTestHttpsServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('x'.repeat(5_000));
  });
  try {
    const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')));
    assert.equal(result.ok, true);
    assert.equal(result.responseBody.length, 500);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：對方送出標頭後中斷連線必須收斂為可重試失敗，不得卡住 promise', async () => {
  const harness = installWebhookNetHarness();
  // 宣告 Content-Length 後只送一部分就斷線：Node 不會發出 'end'，若未處理 'close'／'aborted'
  // 則投遞 promise 永不解決，投遞列會永遠卡在認領狀態。
  const { server } = await startTestHttpsServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': '1000' });
    res.write('partial');
    setTimeout(() => res.destroy(), 20);
  });
  try {
    const result = await Promise.race([
      sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks'))),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('sendWebhookPayload 未在中斷後收斂（promise 卡住）')), 4_000),
      ),
    ]);
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 0, '中斷屬於連線層失敗，狀態碼 0 代表可重試');
    assert.equal(result.blocked, false, '對方中斷不是本機安全政策阻擋');
    assert.ok(result.error.length > 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：慢速滴流的對方不得拖過投遞逾時（絕對截止時間，非閒置計時器）', async () => {
  const harness = installWebhookNetHarness();
  // 每 80ms 送一點內容、永不結束：若逾時用閒置計時器就會被持續重置而無限延長，
  // 拖過認領視窗後同一列可能被另一個 drain 重複投遞。
  const { server } = await startTestHttpsServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    const timer = setInterval(() => res.write('drip'), 80);
    res.on('close', () => clearInterval(timer));
  });
  try {
    const startedAt = Date.now();
    const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')), 600);
    const elapsed = Date.now() - startedAt;
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 0);
    assert.equal(result.blocked, false);
    assert.ok(elapsed < 3_000, `必須在逾時附近收斂（實際 ${elapsed}ms）`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：3xx 的對方持續送內容時仍須立刻釋放連線（不得洩漏 socket）', async () => {
  const harness = installWebhookNetHarness();
  let connections = 0;
  const { server } = await startTestHttpsServer((_req, res) => {
    res.writeHead(307, { Location: 'https://internal.example/steal' });
    const timer = setInterval(() => res.write('keep-alive-chunk'), 50);
    res.on('close', () => clearInterval(timer));
  });
  server.on('connection', () => {
    connections += 1;
  });

  try {
    const result = await sendWebhookPayload(target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks')));
    assert.equal(result.blocked, true);
    assert.equal(result.statusCode, 307);

    const open = () =>
      new Promise<number>((resolve, reject) => {
        server.getConnections((error, count) => (error ? reject(error) : resolve(count)));
      });
    // 等待對方／我們各自關閉連線（正常情況下我們主動 destroy）
    for (let i = 0; i < 40 && (await open()) > 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal(connections, 1, '只應建立一條連線');
    assert.equal(await open(), 0, '拒投後必須立刻銷毀連線，不得被對方的內容拖住');
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：請求帶 Content-Length，維持舊版 fetch() 的位元組框架', async () => {
  const harness = installWebhookNetHarness();
  let observed: { contentLength: string; transferEncoding: string; body: string } | null = null;
  const { server } = await startTestHttpsServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      observed = {
        contentLength: String(req.headers['content-length'] ?? ''),
        transferEncoding: String(req.headers['transfer-encoding'] ?? ''),
        body: raw,
      };
      res.writeHead(200);
      res.end('ok');
    });
  });
  try {
    const rawBody = '{"id":"tx1","amount":100}';
    const result = await sendWebhookPayload(
      target(harness.publicUrl(TEST_HOSTNAME, server, '/hooks'), { rawBody }),
    );
    assert.equal(result.ok, true);
    assert.ok(observed);
    const seen = observed as unknown as { contentLength: string; transferEncoding: string; body: string };
    assert.equal(seen.contentLength, String(Buffer.byteLength(rawBody)), '應帶正確的 Content-Length');
    assert.equal(seen.transferEncoding, '', '不得使用 chunked（部分接收端會因此拒絕）');
    assert.equal(seen.body, rawBody);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    harness.restore();
  }
});

test('Webhook 投遞：無法解析的主機名視為可重試的連線錯誤（非政策阻擋）', async () => {
  const harness = installWebhookNetHarness();
  try {
    // .invalid 為 RFC 2606 保留網域，保證解析失敗（不會連到任何真實服務）
    const result = await sendWebhookPayload(target('https://not-a-real-host.invalid/hooks'));
    assert.equal(result.ok, false);
    assert.equal(result.statusCode, 0, '狀態碼 0 代表連線／DNS 錯誤，屬可重試');
    assert.equal(result.blocked, false, 'DNS 解析失敗不是安全政策阻擋，應保留重試');
    assert.ok(result.error.length > 0);
  } finally {
    harness.restore();
  }
});

test('isBlockedIpAddress：公開位址放行、非公開位址與非法值一律阻擋', () => {
  for (const allowed of [FAKE_PUBLIC_IPV4, FAKE_PUBLIC_IPV6, '8.8.8.8', '2001:4860:4860::8888']) {
    assert.equal(isBlockedIpAddress(allowed), false, `應放行公開位址 ${allowed}`);
  }
  for (const blocked of [
    '127.0.0.1',
    '127.1.2.3',
    '0.0.0.0',
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.254',
    '192.168.1.1',
    '100.64.0.1',
    '169.254.169.254',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    'fe80::1%en0',
    '',
    'not-an-ip',
    'example.com',
    '999.1.1.1',
  ]) {
    assert.equal(isBlockedIpAddress(blocked), true, `應阻擋 ${blocked}`);
  }
});
