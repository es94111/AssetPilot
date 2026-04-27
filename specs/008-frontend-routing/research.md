# Phase 0 研究：前端路由與頁面（008-frontend-routing）

**Date**: 2026-04-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**作用**：解析所有 `NEEDS CLARIFICATION` 與設計決策；驗證「不引入新技術」之可行性。

## 0. 「不引入新技術」之可行性確認

使用者明確要求：**「使用目前專案現有的技術規格，不要新增任何技術規格」**。本節列出每個本功能可能誘發新技術的決策點，並逐一驗證可用既有資源完成。

| 候選新技術 | 是否可避免？ | 替代方案（既有） |
| --- | --- | --- |
| 前端 router 套件（page.js／Navigo／vue-router） | ✅ 可 | 純 JS 字串解析 + 既有 `history.pushState`／`popstate`；既有 `navigate(page, sub)` 已是雛型 |
| 前端框架（React／Vue／Svelte） | ✅ 可 | 既有 vanilla JS IIFE；6 個 user story 與 12 個 Modal 不需 reactivity 框架 |
| Modal 函式庫（micromodal／a11y-dialog） | ✅ 可 | 純 JS class／物件 + 既有 12 個 Modal DOM；焦點 trap 用原生 `keydown` + `tabindex` |
| 焦點 trap 套件（focus-trap） | ✅ 可 | ~30 行純 JS 實作 Tab／Shift+Tab 環圈 |
| 圖示套件（Lucide／Heroicons npm） | ✅ 可 | inline SVG 字串字典（~14 個圖示，總計 ~4 KB） |
| 進度條套件（NProgress／topbar.js） | ✅ 可 | 純 CSS keyframe 動畫 + 1 個 `<div>` |
| Build step（Vite／esbuild／Webpack） | ✅ 可 | 既有無 build；本功能新增的 ~600 行純 JS 直接附加於 `app.js` IIFE 內 |
| 路徑遊走偵測（path-traversal-guard） | ✅ 可 | `String.includes('..')` + 一條預編譯 regex |
| RBAC 套件（accesscontrol） | ✅ 可 | 既有 `isUserAdmin(userId)` + `Array.includes()` |
| SR 公告函式庫（ally.js） | ✅ 可 | 純 DOM `<div role="status" aria-live="polite">` |

**結論**：所有候選新技術皆可用既有資源替代；本計畫**不新增任何 npm 套件、不新增 CDN、不引入 build 工具**。

---

## 1. 前端路由模型：URL-first vs 既有「page+sub」雙軌

**決策**：採 URL-first 模型，但保留既有 `navigate(page, sub)` 簽章作 alias。

**理由**：
- spec FR-001 + FR-002 明確要求 18 條 URL 路徑與頁面**一一對應**；`page` 概念是實作細節，不應反過來成為對外契約。
- 既有 `navigate(page, sub)` 已使用 `history.pushState`，但路徑是 `buildPath(page, sub)` 由內部生成，導致：
  - URL 路徑表達能力受限（如 `/stocks/portfolio` 與 `/stocks` 之雙別名難以表達）；
  - 重整時需要先 `parsePath` 才能取得 `{page, sub}`；
  - `?next=` 驗證若依 `page` 比對而非依 path，會因 alias 而漏判。
- URL-first：`parsePath(pathname) → RouteRecord` 一站到位；render 階段再依 `page` 派發即可。

**實作方式**：
1. `const ROUTES` 為單一資料來源（純 JS array of objects）。
2. `parsePath(pathname): RouteRecord | null`：
   - 先 `normalizePath(pathname)`；
   - 線性遍歷 `ROUTES` 找精確 match（無 path-to-regexp，純字串相等）；
   - 找不到回 null（→ 渲染 404 頁）。
3. `buildPath(routeOrPageSub): string`：以路由表中的 `path` 直接回傳；舊 `buildPath(page, sub)` 改為查表。
4. `navigate(page, sub, pushState = true)`（既有簽章保留）：內部呼叫 `buildPath` → `navigateToPath`。
5. `navigateToPath(path, { pushState = true, replace = false })`（新內部 API）：核心切換邏輯。

**否決方案**：
- ❌ 引入 page.js／Navigo：違反「不引入新技術」原則；本功能 18 條靜態路徑無動態 segment（除 stocks 雙別名），無需 path-to-regexp。
- ❌ 既有 `page+sub` 完全不變：FR-006a 之 `?next=` 白名單需依 path 直接比對，沿用 `page+sub` 模型會引入 path-to-(page,sub) 雙向轉換的不對稱風險。

---

## 2. 路徑正規化演算法（FR-010a）

**決策**：採三步驟純字串操作 — 小寫化 → 折疊連續斜線 → 去尾端斜線（除根 `/`）。

**演算法**（純 JS）：
```js
function normalizePath(rawPath) {
  // 1. 取出 pathname 部分（防 query 與 hash 混入）
  const noQueryHash = rawPath.split(/[?#]/)[0];
  // 2. 全轉小寫
  const lower = noQueryHash.toLowerCase();
  // 3. 折疊連續斜線
  const collapsed = lower.replace(/\/{2,}/g, '/');
  // 4. 去尾端斜線（除 '/'）
  if (collapsed === '/') return '/';
  return collapsed.replace(/\/+$/, '');
}
```

**理由**：
- spec FR-010a 列出三條規則；以上順序保證冪等（`normalizePath(normalizePath(x)) === normalizePath(x)`）。
- 不處理 `%2F`、`%2f`、`..`、`%2e%2e` — 這些走 FR-027 path traversal 攔截（catch-all 寫稽核 + 仍走 SPA index → 前端 router 因 path 不在 ROUTES 表中而落入 404 頁）。
- `URL` constructor 會自動 percent-decode，但本演算法刻意採 raw `pathname` 字串以保留 spec 要求的「encoded `..` 一律 404」語義。

**否決方案**：
- ❌ 採 `new URL()` 處理：會自動 decode `%2F` 為 `/`，破壞 path traversal 偵測。
- ❌ 額外處理 IDN／punycode：本功能僅處理同源 path，無 host 部分需要正規化。

---

## 3. `?next=` 嚴格白名單演算法（FR-006a）

**決策**：採 spec FR-006a 五條規則，演算法與 spec 完全一致。

**演算法**（純 JS）：
```js
function validateNextParam(rawNext) {
  if (typeof rawNext !== 'string' || rawNext.length === 0) {
    return { ok: false, reason: 'empty', fallback: '/dashboard' };
  }
  let decoded;
  try {
    decoded = decodeURIComponent(rawNext);
  } catch (e) {
    return { ok: false, reason: 'malformed-uri', fallback: '/dashboard' };
  }
  // 1. 必須以 '/' 開頭
  if (!decoded.startsWith('/')) {
    return { ok: false, reason: 'not-relative', fallback: '/dashboard' };
  }
  // 2. 不得以 '//' 或 '/\\' 開頭，不得含 '://'
  if (decoded.startsWith('//') || decoded.startsWith('/\\') || decoded.includes('://')) {
    return { ok: false, reason: 'protocol-relative', fallback: '/dashboard' };
  }
  // 3. pathname 部分（去 query 與 hash）正規化後 MUST 命中 ROUTES
  const pathname = decoded.split(/[?#]/)[0];
  const normalized = normalizePath(pathname);
  const route = ROUTES.find(r => r.path === normalized);
  if (!route) {
    return { ok: false, reason: 'unknown-path', fallback: '/dashboard' };
  }
  // 4. 通過：回傳完整解碼後 next（含 query 與 hash 部分）
  return { ok: true, target: decoded };
}
```

**編碼契約**（FR-006a 第 0 點）：
- 寫入時：`?next=' + encodeURIComponent(currentPath + currentSearch + currentHash)`。
- 讀取時：`decodeURIComponent(new URLSearchParams(location.search).get('next'))`。
- 拒絕雙重編碼／base64／其他不透明編碼。

**理由**：
- 涵蓋 spec FR-006a 列出之 4 種失敗模式（malformed、not-relative、protocol-relative、unknown-path）。
- pathname 比對 ROUTES 表確保僅放行已知內部路徑（含管理員專屬路徑；後續由 FR-014 把關角色）。
- `query + hash` 原樣保留（spec 第 5 點）。

**否決方案**：
- ❌ 用 `new URL(rawNext, location.origin)`：相對 path + 同 origin 會接受 `//evil.com` 為 path-relative，不符 spec 第 2 點安全要求。
- ❌ 採 base64 編碼：不便稽核日誌讀取；spec FR-006a 第 0 點明確拒絕。

---

## 4. Modal 共用基底元件設計

**決策**：採純 JS 物件 `ModalBase`（IIFE 內 namespace，與既有 `app.js` 風格一致），對外暴露 `open(modalId, options)` / `close()` / `closeTopmost()` / `getStack()`。

**狀態機**：
```text
modalStack = []                        // 空：無 Modal 開啟
ModalBase.open('modalTransaction')     // → ['modalTransaction']
                                       //   - replaceState({ modalParent: { hash, scrollY } })
                                       //   - pushState({ modalLayer: 'modalTransaction' }, '#modal-transaction')
                                       //   - body.style.overflow = 'hidden' + scrollY 記憶
                                       //   - 焦點 trap 啟用
                                       //   - 第一個可互動元素聚焦
ModalBase.open('modalConfirm')         // → ['modalTransaction', 'modalConfirm']（疊加情境）
                                       //   - pushState({ modalLayer: 'modalConfirm', modalStack: [...] }, '#modal-confirm')
                                       //   - body 鎖維持（不重複套用）
                                       //   - 焦點 trap 切換至 modalConfirm
                                       //   - modalConfirm 內第一個可互動元素聚焦
ModalBase.closeTopmost()               // → ['modalTransaction']
                                       //   - history.back() （popstate 將 event.state.modalLayer 設為 'modalTransaction'）
                                       //   - 維持 body 鎖
                                       //   - 焦點還原至 modalTransaction 內觸發疊加之元素
ModalBase.closeTopmost()               // → []
                                       //   - history.back() （popstate 後 event.state.modalParent 出現）
                                       //   - 解 body 鎖（restore scrollY）
                                       //   - 焦點還原至最初觸發者
                                       //   - location.hash 還原為 modalParent.hash
```

**焦點 trap**（純 DOM API）：
```js
function trapFocus(modalEl, e) {
  if (e.key !== 'Tab') return;
  const focusables = modalEl.querySelectorAll(
    'button, [href], input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    last.focus();
    e.preventDefault();
  } else if (!e.shiftKey && document.activeElement === last) {
    first.focus();
    e.preventDefault();
  }
}
```

**捲動鎖**（含 iOS Safari 滾動穿透防護）：
```css
body.modal-open {
  position: fixed;
  width: 100%;
  overflow: hidden;
  overscroll-behavior: contain;
  touch-action: none;  /* iOS Safari 滾動穿透防護 */
}
```
搭配 JS：
```js
function lockBodyScroll() {
  bodyScrollY = window.scrollY;
  document.body.style.top = `-${bodyScrollY}px`;
  document.body.classList.add('modal-open');
}
function unlockBodyScroll() {
  document.body.classList.remove('modal-open');
  document.body.style.top = '';
  window.scrollTo(0, bodyScrollY);
}
```

**堆疊規則**（FR-024a）：
- 僅 `modalConfirm` 可疊在其他 Modal 上。
- `ModalBase.open(id)` 開頭檢查：若 `modalStack.length > 0` 且 `id !== 'modalConfirm'` → `console.warn('[ModalBase] 違反堆疊規則：' + id)` + 直接 return。
- 若 `modalStack.length > 0` 且 `id === 'modalConfirm'` 且 `modalStack.includes('modalConfirm')` → 同樣 console.warn + return（防 confirm 上再疊 confirm）。
- 違規不拋例外（避免影響使用者體驗），由 console 與 code review 把關。

**理由**：
- 純 JS class／物件 + 純 DOM API 即可實作 spec 要求的所有行為；不需 micromodal／a11y-dialog／focus-trap 等套件。
- 既有 12 個 Modal 之 DOM 與表單邏輯保留；僅其開／關／焦點／捲動鎖之 lifecycle 由共用基底接管。
- 與既有 IIFE 風格一致（`app.js` 內 namespace 物件）。

**否決方案**：
- ❌ 引入 micromodal：增加 ~3 KB；本實作 ~250 行純 JS 即可，更易客製 history 整合。
- ❌ 採 `<dialog>` 原生元素：Safari 16 才支援，且 spec FR-024 之 history 整合需求超出原生 `<dialog>` 設計範圍。
- ❌ 各 Modal 各自實作：違反 spec FR-022 「使用相同基底元件」、FR-023a/24a/24b「共用基底強制」要求。

---

## 5. SR live region 公告策略（FR-010e）

**決策**：應用程式 root 唯一一個 `<div role="status" aria-live="polite" aria-atomic="true" class="sr-only">`，僅由 router 於第一階段（FR-010b 第 1 點）寫入。

**位置**：`index.html` `<body>` 內、所有 `.page` 容器之上：
```html
<div id="sr-route-status" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></div>
```

**樣式**（`style.css`）：
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

**Router 整合**（`app.js`）：
```js
function announceRoute(pageName) {
  const el = document.getElementById('sr-route-status');
  if (!el) return;
  el.textContent = `已切換至 ${pageName}`;
}
```
於 `navigateToPath(path)` 之第一階段（與 `document.title` 第一階段同時點）呼叫。

**MUST NOT**：
- 第二階段動態 title 覆寫（FR-010b 第 2 點）不重複公告。
- Modal 開啟（FR-024）、FAB 點擊、scroll restoration 不公告。
- Toast 用獨立 live region（既有 Toast 實作若有 aria-live，不衝突）。

**理由**：
- spec FR-010e 第 5 點明定「應用程式內唯一一處用於『路由切換』公告之 aria-live 節點」。
- `aria-live="polite"` 而非 `assertive`：路由切換為使用者主動行為，無需打斷當前螢幕閱讀器讀屏。
- `aria-atomic="true"`：每次 textContent 變更都重新讀整段，避免「已切換至 」之尾巴殘留。

---

## 6. 手動捲動還原（FR-010c）

**決策**：應用程式啟動時 `history.scrollRestoration = 'manual'`；每次 `pushState` 前 `replaceState` 寫入 `state.scrollY`；`popstate` 時依 `state.scrollY` 還原。

**演算法**：
```js
// 啟動
history.scrollRestoration = 'manual';

// pushState 前
function navigateToPath(targetPath) {
  // 1. 寫入當前 scrollY 至「即將離開」條目
  const currentState = history.state || {};
  history.replaceState({ ...currentState, scrollY: window.scrollY }, '', location.pathname + location.search + location.hash);
  // 2. push 新條目
  history.pushState({ page, sub }, '', targetPath);
  // 3. 渲染目標頁；資料 fetch 完成後可選擇捲至頂端
  renderPage(...).then(() => {
    if (!isModalLayer && !isReplaceFromNormalize) {
      window.scrollTo(0, 0);
    }
  });
}

// popstate
window.addEventListener('popstate', (e) => {
  const targetScrollY = e.state?.scrollY;
  if (typeof targetScrollY === 'number' && Number.isFinite(targetScrollY)) {
    requestAnimationFrame(() => window.scrollTo(0, targetScrollY));
    // 資料就緒後再校正一次（避免內容尚未載入導致捲動失敗）
    onDataReady(() => window.scrollTo(0, targetScrollY));
  }
});
```

**例外**（spec FR-010c 第 5、6 點）：
- Modal hash 條目（FR-024）的 `pushState` MUST NOT 觸發本還原邏輯（透過 `event.state.modalLayer` 判別並 short-circuit）。
- 路徑正規化 `replaceState`（FR-010a）不觸發本邏輯（`replaceState` 不會引發 `popstate`）。

**理由**：
- spec FR-010c 第 1 點明定 `history.scrollRestoration = 'manual'`。
- 手動策略統一 Safari／iOS／Chromium 行為差異。
- 雙階段套用（rAF 後 + onDataReady）涵蓋「歷史條目記錄時內容尚未載入」之邊緣情境。

---

## 7. 進度條 + 200ms 延遲門檻（FR-010d）

**決策**：應用程式 root 唯一一條 `<div id="route-progress" class="route-progress" hidden></div>` + 200ms `setTimeout` 延遲。

**HTML**（`index.html`）：
```html
<div id="route-progress" class="route-progress" hidden></div>
```

**CSS**（`style.css`）：
```css
.route-progress {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: transparent;
  pointer-events: none;
  z-index: 9999;
}
.route-progress::after {
  content: '';
  display: block;
  width: 30%;
  height: 100%;
  background: #6366f1;
  animation: route-progress-slide 1s ease-in-out infinite;
}
@keyframes route-progress-slide {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
@media (prefers-reduced-motion: reduce) {
  .route-progress::after {
    animation: none;
    width: 100%;
    background: rgba(99, 102, 241, 0.3);
  }
}
```

**JS**（`app.js`）：
```js
let progressTimer = null;
function showRouteProgress() {
  if (progressTimer) return;
  progressTimer = setTimeout(() => {
    document.getElementById('route-progress').hidden = false;
    progressTimer = 'shown';
  }, 200);
}
function hideRouteProgress() {
  if (progressTimer && progressTimer !== 'shown') {
    clearTimeout(progressTimer);
  }
  progressTimer = null;
  document.getElementById('route-progress').hidden = true;
}
```

**理由**：
- spec FR-010d 明定「200ms 延遲、indeterminate、單一進度條、prefers-reduced-motion 降級」全部要點。
- 純 CSS 動畫 + 1 個 DOM 節點，不引入 NProgress／topbar.js。
- `hidden` 屬性比 `display: none` 更語義化，且不影響無障礙（hidden 元素不會被讀屏）。

---

## 8. 側邊欄三件式 active + 圖示策略

**Active 三件式**（FR-015a）：純 CSS，由前端 router 自動套用 `.active` class。
```css
.nav-item {
  display: flex;
  align-items: center;
  height: 40px;
  padding: 0 12px;
  gap: 12px;
  color: var(--text-secondary);
  border-left: 4px solid transparent;
  background: transparent;
  position: relative;
}
.nav-item:hover { background: rgba(0, 0, 0, 0.04); }
.nav-item.active {
  border-left-color: #6366f1;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.08);
}
.nav-item:focus-visible {
  outline: 2px solid #6366f1;
  outline-offset: -2px;
}
```

**圖示**（FR-015b）：`SIDEBAR_ICONS` 字典 + inline SVG（採 Lucide 字彙；`stroke="currentColor"` 自動繼承文字色）。
- 14 個圖示（儀表板、交易、報表、預算、帳戶、分類、固定、持股、股票交易、股利、實現、API、設定、管理員）+ 1 個 fallback「首字方塊」。
- 每個 SVG ~200 ~ 400 bytes；總計 ~4 KB inline 於 `app.js`。
- 不引入 SVG sprite、不引入字型檔。

**否決方案**：
- ❌ 引入 Lucide CDN：違反「不引入 CDN」原則，且 Lucide 全套 ~50 KB > 14 個 inline SVG 總和。
- ❌ 用 emoji：缺乏視覺一致性，與既有設計系統不符。

---

## 9. 後端 admin-only 路徑常數 + 稽核（FR-032、FR-032a）

**決策**：`server.js` 內模組級常數 `ADMIN_ONLY_PATHS = ['/settings/admin']`；catch-all 內偵測 + 寫稽核。

**位置**：catch-all（[server.js:10168](../../server.js#L10168)）附近，可見即可。

**演算法**（pseudo）：
```js
const ADMIN_ONLY_PATHS = ['/settings/admin'];

function normalizeRoutePath(rawPath) {
  // 與前端 normalizePath 同演算法
}

app.get('{*path}', rateLimit(...), (req, res) => {
  const rawUrl = req.originalUrl;
  const normalized = normalizeRoutePath(req.path);
  const userId = req.userId;  // 由前置 authMiddleware 解 cookie 取得（catch-all 不在 /api 之下，需獨立解 token）

  // FR-027：path traversal
  if (rawUrl.includes('..') || /(%2e|%252e){2}/i.test(rawUrl)) {
    if (auditMode !== 'minimal') {
      writeOperationAudit({ action: 'static_path_traversal_blocked', metadata: { path: rawUrl }, ... });
    }
  }

  // FR-006a：open redirect
  if (req.path === '/login' && req.query.next) {
    if (!isValidNextParam(req.query.next)) {
      if (auditMode !== 'minimal') {
        writeOperationAudit({ action: 'route_open_redirect_blocked', metadata: { next: req.query.next, reason }, ... });
      }
    }
  }

  // FR-014 + FR-032a：admin-only path
  if (ADMIN_ONLY_PATHS.includes(normalized)) {
    const isAdmin = userId && isUserAdmin(userId);
    if (!isAdmin && auditMode !== 'minimal') {
      writeOperationAudit({ action: 'route_admin_path_blocked', metadata: { path: normalized }, ... });
    }
  }

  res.sendFile(path.join(__dirname, 'index.html'));
});
```

**理由**：
- spec FR-032a 明定「後端維護獨立的 admin-only 路徑常數陣列」+ 「與前端路由表手動同步並由 code review 把關一致性」。
- 採 `Array.includes()` 比對；單條目時 O(1)；未來新增條目時 O(N) 仍可接受（< 10 條）。
- 寫稽核透過既有 `writeOperationAudit()`；不新增 helper。
- catch-all 解 cookie 取 userId：既有 `authMiddleware` 僅在 `app.use('/api', authMiddleware)` 之後生效，catch-all 在 `/api` 之外，需獨立讀 cookie 解 JWT；複用既有 JWT verify helper（`verifyJwt(req.cookies.token)`）。

---

## 10. 路由稽核模式設定（FR-033）

**決策**：`system_settings` 加 1 欄 `route_audit_mode TEXT DEFAULT 'security'`；既有 `/api/admin/system-settings` 端點擴欄。

**Schema 變更**：
```js
try {
  db.run("ALTER TABLE system_settings ADD COLUMN route_audit_mode TEXT DEFAULT 'security'");
} catch (e) { /* ignore - 欄位已存在 */ }
```

**端點變更**：
- `GET /api/admin/system-settings`：response 加 `routeAuditMode`。
- `PUT /api/admin/system-settings`：request body 接受可選 `routeAuditMode`（值需 ∈ `{ 'security', 'extended', 'minimal' }`，否則 400）。

**Catch-all 讀取**：
```js
function getRouteAuditMode() {
  const row = queryOne("SELECT route_audit_mode FROM system_settings WHERE id = 1");
  return row?.route_audit_mode || 'security';
}
```
- 每次 catch-all 觸發都查一次（無快取；單行 SQL；< 1ms）。
- 若管理員切換模式，下次 catch-all 即生效。

**理由**：
- 不新增端點；既有 `/api/admin/system-settings` 已含 SMTP、`public_registration` 等多欄位，加一欄符合既有風格。
- 預設 `security` 與 spec FR-033 對齊。

---

## 11. 401 自動導向（FR-007a）— 漸進式改寫

**決策**：新增 `apiFetch(url, options)` wrapper；既有 fetch 呼叫漸進式改寫。

**`apiFetch` 設計**：
```js
async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401 && !url.startsWith('/api/auth/')) {
    redirectToLogin('session-expired');
    throw new Error('SESSION_EXPIRED');
  }
  return res;
}

function redirectToLogin(reason) {
  if (reason === 'session-expired') {
    const next = location.pathname + location.search + location.hash;
    const encoded = encodeURIComponent(next);
    toast('您的登入已過期，請重新登入', 'error');
    location.assign(`/login?next=${encoded}`);
  } else if (reason === 'unauthenticated') {
    const next = location.pathname + location.search + location.hash;
    const encoded = encodeURIComponent(next);
    location.assign(`/login?next=${encoded}`);
  } else if (reason === 'logout') {
    // FR-007b：清 next + theme_pref
    localStorage.removeItem('theme_pref');
    location.assign('/login');
  }
}
```

**漸進式改寫**：
- 既有 `fetch('/api/...')` 散落於 `app.js` 多處（>100 處）。
- 一次性全部改寫風險高；採漸進式：
  1. 先實作 `apiFetch`。
  2. 修改最高頻路徑（dashboard、transactions、stocks）改用 `apiFetch`。
  3. 其餘路徑於 tasks 階段逐一改寫。
- 未改寫的 `fetch` 仍可運作，僅缺 401 自動導向；過期後使用者下次 fetch 才觸發；可接受過渡。

**例外**：
- `/api/auth/login` / `/api/auth/register` / `/api/auth/google` 之 401 為「登入失敗」非「session 過期」，不導向。

**理由**：
- 集中 401 處理避免每個 fetch 點各自實作。
- 漸進式改寫降低風險。
- spec FR-007a 對應的所有要件皆涵蓋。

---

## 12. theme localStorage 樂觀渲染（FR-021a）

**決策**：localStorage key `theme_pref`；啟動時讀 → 套用 `<html data-theme>`；`/api/auth/me` 回應到達後若不一致則覆寫。

**啟動邏輯**：
```js
// app.js 最早期（before fetch /api/auth/me）
function applyTheme(mode) {
  const resolved = mode === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : mode;
  document.documentElement.setAttribute('data-theme', resolved);
}
function init() {
  const cached = localStorage.getItem('theme_pref');
  const validCached = ['system', 'light', 'dark'].includes(cached);
  applyTheme(validCached ? cached : 'system');
  // ... 接著 fetch /api/auth/me
}

// fetch /api/auth/me 回應到達後
function onUserLoaded(user) {
  const serverTheme = user.themeMode;  // 既有欄位
  if (serverTheme && serverTheme !== localStorage.getItem('theme_pref')) {
    localStorage.setItem('theme_pref', serverTheme);
    applyTheme(serverTheme);
  }
}

// 登出時
function onLogout() {
  localStorage.removeItem('theme_pref');
}
```

**FR-019 後端持久化**：
- 既有 `/api/account/theme` PUT 端點已實作（[server.js:5502](../../server.js#L5502)）；
- 既有 `users.theme_mode` 欄位已存在（[server.js:799](../../server.js#L799)）；
- 既有 `/api/auth/login`、`/api/auth/me` 回應已含 `themeMode`（[server.js:2952、3559](../../server.js#L2952)）。
- 本功能僅補：前端 localStorage 快取 + 樂觀渲染 + 登出清除。

**理由**：
- spec FR-021a 三層 fallback 全涵蓋。
- 不新增後端端點；不變更資料庫 schema。
- localStorage 為現有瀏覽器 API；不引入 IndexedDB／Storage Manager 等。

---

## 13. 公開頁 `/privacy` 與 `/terms` 之雙軌處理

**現狀**：`server.js` 既有 `app.get('/privacy', ...)` 與 `app.get('/terms', ...)` 直接 `sendFile(privacy.html)`；同時 catch-all 也會處理（但路由先匹配先贏，獨立 handler 先匹配）。

**問題**：spec FR-001 + FR-002 要求 `/privacy` 與 `/terms` 為前端路由；若後端直接送獨立 HTML，瀏覽器拿到的不是 SPA `index.html`，無法享有：
- SPA 的側邊欄（雖然公開頁不需要）；
- 一致的設計系統（雖然 `privacy.html` 可獨立維護一份相同樣式）；
- `?next=` 機制於 `/privacy` 點擊「登入」後跳回。

**決策**：保留既有 `privacy.html` / `terms.html` 為獨立靜態檔，但**移除** `app.get('/privacy', ...)` 與 `app.get('/terms', ...)` 兩個獨立 handler；改由 catch-all 提供 SPA `index.html`，前端 router 渲染 `#page-privacy` / `#page-terms` 容器。

**理由**：
- 與 FR-001 + FR-003（SPA history.pushState 路由）一致。
- `privacy.html` / `terms.html` 仍存在於 PUBLIC_FILES 白名單作為「raw HTML 下載入口」（極罕見場景；保留向後兼容）。
- 內容由 `<div id="page-privacy">` / `<div id="page-terms">` 直接內嵌於 `index.html`；維護一處即可。

**否決方案**：
- ❌ 保留兩個獨立 handler：`/privacy` 與 `/terms` 將不享有 SPA 設計系統；違反 FR-001 + FR-003。
- ❌ 完全刪除 `privacy.html` / `terms.html`：無法滿足 FR-026 白名單之歷史條目（雖然非必要）；風險低，但不必激進刪除。

---

## 14. 不採用之技術 — 對照表

| 候選技術 | 否決原因 | 替代方案 |
| --- | --- | --- |
| page.js / Navigo | 違反「不引入新技術」原則 | 純 JS `parsePath` + `history.pushState` |
| React Router / Vue Router | 同上 | 同上 |
| micromodal / a11y-dialog | 同上 | `ModalBase` IIFE 物件 |
| focus-trap | 同上 | 純 DOM `keydown` Tab／Shift+Tab |
| NProgress / topbar.js | 同上 | CSS keyframe 動畫 |
| Lucide / Heroicons npm | 同上 | inline SVG 字典 |
| Vite / esbuild build | 同上 | 直接編輯 `app.js` |
| `<dialog>` 原生元素 | Safari 16+ 才支援；不利 history 整合 | ModalBase + `<div role="dialog">` |
| Service Worker | spec FR-029 明確排除 PWA | — |
| i18n 套件 | spec FR-030 明確排除 | — |
| Zustand / Redux 等狀態管理 | 不需要 | 既有 IIFE 內 module-scoped 變數 |

---

## 15. 已解決之 NEEDS CLARIFICATION

spec.md 的 23 條 Clarification 已全部於 spec 階段解決（見 [spec.md](./spec.md) 第 8~36 行）。本研究無新增 NEEDS CLARIFICATION。

| 主題 | 對應 FR | 解決方案來源 |
| --- | --- | --- |
| 一般使用者輸入 admin URL | FR-014 | spec Q1：顯示 404 訊息頁 |
| Modal 與「上一頁」整合 | FR-024 | spec Q2：history.state `modalLayer` 標記 + popstate 判別 |
| 首次深層連結 JS 載入中 | Edge Cases | spec Q3：index.html 內聯 spinner + logo |
| 頁面切換效能 | SC-008 | spec Q4：雙層指標 100ms / 1000ms |
| Session 過期 | FR-007a | spec Q5：401 → ?next= → /login + Toast |
| 路由稽核範圍 | FR-032、FR-033 | spec Q6：security/extended/minimal 三模式 |
| Modal 捲動鎖 | FR-023a | spec Q7：body 鎖 + iOS Safari 防穿透 |
| Modal 堆疊 | FR-024a | spec Q8：僅 modalConfirm 可疊在其他 Modal 上 |
| 路徑正規化 | FR-010a | spec Q9：小寫 + 折雙斜 + 去尾斜 + replaceState 改寫 |
| 後端 admin-only 路徑 | FR-032a | spec Q10：常數陣列 + 手動同步 + code review |
| Theme FOUC | FR-021a | spec Q11：API → localStorage → prefers-color-scheme 三層 |
| Sidebar active 視覺 | FR-015a | spec Q12：三件式（直條 + 主色文字 + 主色 8% 背景） |
| ?next= 演算法 | FR-006a | spec Q13：5 條規則 + ROUTES 表比對 |
| 登出清理 | FR-007b | spec Q14：清 next + theme_pref |
| 瀏覽器支援矩陣 | SC-007 | spec Q15：Chrome/Edge/Firefox latest 2、Safari 16+ |
| document.title 兩階段 | FR-010b | spec Q16：靜態（與 URL 同步）→ 動態（資料就緒） |
| Scroll restoration | FR-010c | spec Q17：manual + state.scrollY |
| Modal 焦點管理 | FR-024b | spec Q18：記憶 activeElement → trap → 還原 |
| 主內容區殼 | FR-010d | spec Q19：殼立刻可見 + 200ms 延遲進度條 + in-place 填充 |
| Sidebar 圖示 | FR-015b | spec Q20：圖示 + 文字並列 + inline SVG |
| SR 路由公告 | FR-010e | spec Q21：唯一 aria-live polite 區域 |
| Modal hash 與錨點共存 | FR-024 第 3 點 | spec Q22：history.state modalLayer/modalParent 區分 |
| ?next= 編碼契約 | FR-006a 第 0 點 | spec Q23：單次 encodeURIComponent / decodeURIComponent |
| Sidebar 溢位 | FR-015c | spec Q24：三段式（上中下，中段獨立 scroll） |
| 載入微提示形式 | FR-010d | spec Q25：頂部 2px indeterminate 進度條 + 200ms 延遲 |

---

## 16. 風險與緩解

| 風險 | 機率 | 影響 | 緩解 |
| --- | --- | --- | --- |
| 既有 `navigate(page, sub)` 重構不完整，部分頁面切換失靈 | 中 | 中 | 保留既有簽章作 alias，漸進式改寫；以 quickstart.md 18 條路徑逐一驗證 |
| Modal 共用基底元件強制套用，導致既有 Modal 行為變化（如關閉動畫、表單提交流程） | 中 | 中 | ModalBase 暴露 `onClose` callback；既有業務邏輯仍在各 Modal 內；逐一回歸驗證 |
| 焦點 trap 漏接 iframe／contenteditable | 低 | 低 | 本應用無 iframe；contenteditable 僅在備註欄罕見使用；可接受 |
| iOS Safari `position: fixed` 捲動鎖在橫螢幕／底部 toolbar 出現／消失時失效 | 中 | 低 | 以 `overscroll-behavior: contain` + `touch-action: none` 雙保險；於 quickstart.md 加 iOS 驗證項 |
| 後端 catch-all 解 cookie 取 userId 失敗（cookie 過期但路徑為 admin-only） | 低 | 低 | 解 token 失敗視為非管理員，仍寫稽核（防探測）；既有 `verifyJwt` 失敗回 null 已涵蓋 |
| `?next=` ROUTES 表比對與後端 ADMIN_ONLY_PATHS 不同步 | 中 | 中 | spec FR-032a 已要求單一 PR 同步更新 + code review 把關；plan.md 第 16 點明列 |
| 14 個圖示之 inline SVG 增加 `app.js` 大小 ~4 KB | 低 | 低 | 既有 `app.js` 已 ~9000 行；4 KB ≪ 1% 增量；可接受 |
| 漸進式 `apiFetch` 改寫不徹底，部分頁面 401 後不導向 | 中 | 低 | 不影響功能，僅體驗稍差；後續 PR 補完即可 |

---

**研究結論**：所有 spec 要件皆可用既有技術完成；無需引入任何新依賴、新框架、新工具。Phase 1 可開始輸出 `data-model.md`、`contracts/`、`quickstart.md`。
