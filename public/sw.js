/* service worker — 007-pwa-offline-entry
 *
 * 目標（見 Issue 驗收條件）：
 *   - 快取靜態資源（manifest、圖示、字型、Next 靜態 chunk），讓離線或網路不穩時
 *     仍能開啟「基本頁面」（離線說明頁），而非瀏覽器錯誤頁。
 *   - 絕不快取 API 回應：財務資料一律即時向伺服器取得；顯示過期餘額比顯示錯誤更危險。
 *   - 絕不快取已登入的 HTML 頁面：本 App 為財務工具，共用裝置上把帳戶畫面寫進
 *     Cache Storage 會讓下一位使用者離線時看到前一位的資料。因此導覽請求一律走網路，
 *     失敗時只回退到公開的 /offline 說明頁。
 *
 * 刻意不做：整頁 HTML 的 pre-cache，以及 background sync 背景送出
 *（iOS Safari 尚未支援，且前端已有 online 事件重送機制）。
 */

const VERSION = 'v4.113.0';
const SHELL_CACHE = `assetpilot-shell-${VERSION}`;
const OFFLINE_URL = '/offline';
// 每次 service worker 啟用週期至多 revalidate 一次離線頁，避免已安裝用戶在
// SW cache key 未變的部署後長期看到舊版內容；也避免每次導覽都多打一個請求。
let shellRevalidated = false;
let shellRevalidationInFlight = false;

/** App Shell：安裝時必定快取的公開靜態資源（不含任何使用者資料）。 */
const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/logo.svg',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // 個別加入：單一資源失敗（例如離線頁尚未部署）不應讓整個 SW 安裝失敗。
      await Promise.all(SHELL_ASSETS.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== SHELL_CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

/** 可安全快取的公開靜態資源（不含使用者資料）。 */
function isCacheableStatic(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/favicon.svg' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === OFFLINE_URL
  );
}

/**
 * 路徑固定、內容會隨部署更新的公開資源。這些必須在背景重新驗證，
 * 否則 SW 的 VERSION 不變時，既有使用者會永遠拿到舊版離線頁／manifest／圖示
 *（next.config.ts 的 cache headers 也因請求改由 SW 處理而失效）。
 * `/_next/static/**` 以內容雜湊命名，可安全長快取而不需重新驗證。
 */
function needsRevalidation(url) {
  return (
    !url.pathname.startsWith('/_next/static/') &&
    (url.pathname === OFFLINE_URL ||
      url.pathname === '/manifest.webmanifest' ||
      url.pathname === '/logo.svg' ||
      url.pathname === '/favicon.svg' ||
      url.pathname.startsWith('/icons/'))
  );
}

/** 抓取並寫入快取（供首次填入與背景重新驗證共用）。 */
async function fetchAndCache(request) {
  const response = await fetch(request);
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    await caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

/** 導覽請求：network-first；離線時只回退離線說明頁，絕不回退已登入頁面。 */
async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    // 僅快取公開的離線說明頁，且每次線上導覽成功後更新快取；一般已登入 HTML
    // 永不快取，避免共用裝置離線時洩漏財務畫面。此更新亦確保 SW bytes／VERSION
    // 未變的部署仍能更新 `/offline` 內容。
    if (new URL(request.url).pathname === OFFLINE_URL && response && response.ok && response.type === 'basic') {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(OFFLINE_URL, response.clone());
    }
    return response;
  } catch {
    const shell = await caches.match(OFFLINE_URL);
    if (shell) return shell;
    return new Response('離線中，且此頁面尚未快取。', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/**
 * 靜態資源：cache-first；固定路徑資源另做 stale-while-revalidate，
 * 讓部署更新能傳遞到已安裝 SW 的既有使用者。
 */
async function handleStatic(request, url, event) {
  const cached = await caches.match(request);
  if (cached) {
    if (needsRevalidation(url)) {
      // 背景更新：立即回快取版本，同時抓新版寫回，下次載入即為最新。
      const revalidate = fetchAndCache(request).catch(() => undefined);
      if (event && typeof event.waitUntil === 'function') event.waitUntil(revalidate);
    }
    return cached;
  }
  try {
    return await fetchAndCache(request);
  } catch {
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 只處理同源請求。
  if (url.origin !== self.location.origin) return;
  // 財務資料一律走網路，永不快取（見檔頭說明）。
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    // 每次 SW 啟用週期成功後至多 revalidate 一次離線頁；失敗（例如使用者離線）時
    // 不標記完成，下一次導覽仍會重試。Cache key 版本另於每次 release 同步更新。
    if (!shellRevalidated && !shellRevalidationInFlight) {
      shellRevalidationInFlight = true;
      event.waitUntil(
        fetchAndCache(OFFLINE_URL)
          .then(() => { shellRevalidated = true; })
          .catch(() => undefined)
          .finally(() => { shellRevalidationInFlight = false; })
      );
    }
    event.respondWith(handleNavigation(request));
    return;
  }

  if (isCacheableStatic(url)) {
    event.respondWith(handleStatic(request, url, event));
  }
});

// 允許頁面要求立即接管（更新部署後不需等所有分頁關閉）。
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// ── Web Push 推播通知（issue #257）──
// 通知一律由 push service 的 payload 帶來（伺服器以 VAPID 簽章），SW 只負責顯示與導頁。
// 刻意不快取任何通知內容：財務摘要留在記憶體中，關閉通知即消失。
const NOTIFICATION_ICON = '/icons/icon-192.png';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = typeof payload.title === 'string' && payload.title ? payload.title : 'AssetPilot';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const tag = typeof payload.tag === 'string' && payload.tag ? payload.tag : undefined;
  const url = typeof payload.url === 'string'
    && payload.url.startsWith('/')
    && !payload.url.startsWith('//')
    && !payload.url.includes('\\')
    ? payload.url
    : '/dashboard';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      // 同一事件（同 tag）再次送達時取代舊通知，不重複堆疊。
      renotify: false,
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || '/dashboard',
    self.location.origin
  ).href;

  event.waitUntil(
    (async () => {
      // 已有開啟中的 App 分頁就直接聚焦並導頁，避免每次點通知都多開一個視窗。
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if (typeof client.navigate === 'function') await client.navigate(target);
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});
