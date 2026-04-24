---
description: "實作任務清單：使用者與權限（001-user-permissions）"
---

# Tasks：使用者與權限（Users & Permissions）

**Input**：`/specs/001-user-permissions/` 下的設計文件
**Prerequisites**：
- [plan.md](./plan.md)（必要）
- [spec.md](./spec.md)（必要 — 6 個 User Story）
- [research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)、[contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml)（補充）

**Tests**：本功能規格**未要求**自動化測試框架；驗收以 [quickstart.md](./quickstart.md)
的 `curl` 手動驗證流程為準。下列任務不含 test task；若後續改採 TDD，請於對應
phase 追加 `[P] [US?]` test task 於實作任務之前。

**Organization**：按 User Story 分組，使每個 story 可獨立實作、獨立驗證、獨立
合併（MVP 即 Phase 3 US1）。

## Format：`[ID] [P?] [Story] Description with file path`

- **[P]**：可與同 phase 其他 `[P]` 任務並行（不同檔案、不互相阻擋）
- **[Story]**：`[US1]`..`[US6]` 對應 spec.md 的使用者故事；Setup／Foundational／Polish 不帶 story 標籤
- 所有路徑以 repo root 為基準

## Path Conventions

本專案為 **single-project**（單體 Express + SPA）：

- 後端：`server.js`（所有 API、中介層、背景排程；依「中介層 → DB 升級 → 工具函式 → 路由」分節）
- 前端：`index.html`、`app.js`、`style.css`（SPA，無打包）
- 契約：根目錄 `openapi.yaml`（全站）+ 本功能子契約 `specs/001-user-permissions/contracts/auth.openapi.yaml`
- 資料：`database.db`（sql.js 持久化）
- 環境：`.env`、`.env.example`

---

## Phase 1：Setup（共用基礎設施）

**Purpose**：為本功能新增的環境變數、常量、文件骨架做準備。不影響任何現有 API。

- [ ] T001 於 `.env.example` 新增本功能需要的變數範本：`JWT_EXPIRES=7d`（FR-004）、`GOOGLE_OAUTH_REDIRECT_URIS=`（逗號分隔，FR-011）、保留現有 `JWT_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`、`APP_HOST`、`PORT`；每行附一行 zh-TW 註解說明。完成後以 `grep -oE 'process\.env\.[A-Z_]+' server.js | sort -u` 對照 `.env.example` 現有鍵；若 `server.js` 讀取但 `.env.example` 未列（包含 `RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`APP_URL` 等既有變數），同步補上註解範例
- [ ] T002 [P] 於 `server.js` 檔頭「環境變數解析」區段補齊讀取邏輯：`const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d'`、`const GOOGLE_OAUTH_REDIRECT_URIS = (process.env.GOOGLE_OAUTH_REDIRECT_URIS || '').split(',').map(s => s.trim()).filter(Boolean)`；啟動 log 輸出 `[OAuth] redirect_uri whitelist: N entries`
- [ ] T003 [P] 於 `server.js` 頂部常量區塊補上 `AUDIT_RETENTION_DAYS = 90`、`PRUNE_BATCH = 5000`、`RATE_LIMIT_WINDOW_MS = 15*60*1000`、`RATE_LIMIT_MAX = 20`、`COOKIE_MAX_AGE = 7*24*3600*1000`（FR-004／FR-007／FR-046；對照 [data-model.md](./data-model.md) §6）

---

## Phase 2：Foundational（所有 Story 的阻擋前置）

**Purpose**：Clarification 帶出的 7 項跨故事共用能力。**此 phase 未完成前不得進入任何 User Story 實作。**

**⚠️ CRITICAL**：本 phase 的任務彼此多為同檔案 + 共用資料路徑，需依編號序實作。

- [ ] T010 於 `server.js` 實作 / 對齊工具函式 `normalizeEmail(raw)`：`return String(raw || '').trim().toLowerCase()`；放置於「工具函式」區（既有函式位於 `server.js:1494`，請確認簽章一致並統一匯出）(FR-001 / Q8)
- [ ] T011 於 `server.js` 啟動 migration 段加入一次性 Email 正規化（data-model.md M1）：啟動時掃 `users`，以 `normalizeEmail(email)` 結果為 key 找衝突；衝突時保留 `created_at` 最小者，其餘列同步整併 `transactions / accounts / categories / budgets / recurring / stocks / stock_transactions / stock_dividends / stock_settings / stock_recurring / exchange_rate_settings / passkey_credentials / login_audit_logs / login_attempt_logs` 的 `user_id`，最後 `UPDATE users SET email = normalized`；migration log 輸出被合併的筆數，完成後呼叫 `saveDB()`
- [ ] T012 於 `server.js` 實作 `matchAllowlist(email, rawList)` 工具函式於「工具函式」區：先 `normalizeEmail`，再 `split(/[,\n]/)` → `trim` → `filter(Boolean)` → `map(lowercase)`；逐項判斷含 `*` 則套 `*@domain` 通配（`item.startsWith('*@') && normalized.endsWith(item.slice(1))`），否則完全比對；其餘含 `*` 型態視為非法項目略過；exportable 以利單元驗證（FR-032 / Q3，對照 [data-model.md](./data-model.md) §3）
- [ ] T013 於 `server.js` 拆分 rate limiter（FR-007 / Q7）：將現有 `app.use('/api', rateLimit({...}))`（~line 352）與 `authLimiter`（~line 339）改為兩個獨立 limiter — `authLimiter` 套用於 `/api/auth/login`、`/api/auth/register`、`/api/auth/google`（**不含** `/api/auth/google/state`、`/api/auth/passkey/*`、`/api/auth/logout`、`/api/auth/me`）；`staticPageLimiter` 套用於 `/privacy`、`/terms`；兩桶各 `windowMs=RATE_LIMIT_WINDOW_MS`、`max=RATE_LIMIT_MAX`、`standardHeaders='draft-8'`、`legacyHeaders=false`；移除舊的全域 `/api` limiter
- [ ] T014 於 `server.js` 實作 `pruneAuditLogs()` 與 `registerAuditPruneJob()`（FR-046）：以 `serverTimeNow()` 取 adopted 時間，`threshold = now - AUDIT_RETENTION_DAYS*86400*1000`；迴圈 `DELETE FROM login_audit_logs WHERE id IN (SELECT id ... WHERE login_at < ? LIMIT PRUNE_BATCH)` 與對 `login_attempt_logs` 同寫法；兩表該輪 affected 同為 0 即 break；最後 `saveDB()` 並 log `[Audit Prune] removed N rows`。`registerAuditPruneJob()` 啟動時立即跑一次、之後 `setInterval(..., 24*3600*1000)`；`server.js` 啟動 log 印 `[Audit Prune] registered; next run in 24h`
- [ ] T015 在 `server.js` 「密碼變更」兩處路由確認 `token_version` 遞增已落地（FR-005 / Q2）：`POST /api/admin/users/:id/password`（既有 `server.js:2947`）與使用者自改密碼端點（既有 `server.js:3987-3988`），兩處的 `UPDATE users SET password_hash = ?, has_password = 1, token_version = COALESCE(token_version, 0) + 1 WHERE id = ?` 需保留；確認 `authMiddleware`（`server.js:1833-1839`）比對 `decoded.tokenVersion === dbVersion`，不符即 401 並清除 Cookie
- [ ] T016 [P] 於根目錄 `openapi.yaml` 同步本功能引發的行為變更（憲章 Principle II）：
  - `/api/auth/google` 新增 400 `invalid_redirect_uri` 回應描述
  - `/api/admin/users/{userId}` DELETE 的描述補上「成功紀錄硬刪、失敗紀錄以 SHA-256 匿名化保留」
  - `/api/auth/login`、`/api/auth/register`、`/api/auth/google` 的 429 描述補上「auth 桶」
  - `/privacy`、`/terms` 的 429 描述補上「靜態頁桶」
  - `POST /api/auth/logout`、`PUT /api/admin/users/{userId}/password`、`POST /api/auth/change-password` 的描述註明「遞增 token_version，舊 JWT 立即失效」
  - 新增一段 cookie security scheme 說明「JWT_EXPIRES 預設 7d、Cookie Max-Age 同步、無『記住我』選項」
  - 最後以 `python -c "import yaml; d=yaml.safe_load(open('openapi.yaml','r',encoding='utf-8')); assert d['openapi']=='3.2.0'"` 驗證 literal string

**Checkpoint**：Foundational 完成後，以下行為應可驗證：
- 啟動 log 含 `[Audit Prune] registered` 與 `[OAuth] redirect_uri whitelist: N entries`
- 以 `normalizeEmail` / `matchAllowlist` 為入口的邏輯可被直接引用
- 兩桶 rate limiter 互不干涉（打 login 21 次觸發 429，打 /privacy 仍回 200）

---

## Phase 3：User Story 1 — Email 帳密註冊與登入（Priority: P1）🎯 MVP

**Goal**：訪客以 Email + 強密碼註冊、立即自動登入、建立預設分類與「現金」帳戶；既有使用者可以同一組帳密重新登入。

**Independent Test**（spec.md US1 Independent Test）：全新資料庫執行註冊 → 確認 (1) 自動登入到儀表板、(2) DB 有該使用者 + 預設分類 + 現金帳戶、(3) 登出後再以同帳密登入成功。

**對應 FR**：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、FR-007（auth 桶生效）、FR-030、FR-033（政策關閉時阻擋註冊）、FR-065。

### Implementation

- [ ] T020 [US1] 於 `server.js:1874` `POST /api/auth/register`：將 `email`、`password`、`displayName` 進入點全數改走 `normalizeEmail`；若 `systemSettings.public_registration = 0` 且 `allowed_registration_emails` 為空則回 403 `{ error: 'registration_closed' }` 並寫入 `login_attempt_logs`（`failure_reason='registration_closed'`）
- [ ] T021 [US1] 於同路由完成政策比對：`public_registration = 1` 時放行；`public_registration = 0` 且白名單非空則呼叫 T012 的 `matchAllowlist`；不通過回 403 `{ error: 'email_not_allowed' }`
- [ ] T022 [US1] 於同路由完成密碼強度驗證（FR-002）：前後端雙重驗證，不符回 400 `{ error: 'weak_password' }`；成功建立 user 後立即呼叫 `createDefaultsForUser(userId)`（既有 `server.js:873`，FR-003 預設清單權威）
- [ ] T023 [US1] 於同路由完成 FR-030 首位管理員追認：`COUNT(*) FROM users` 為 0 時新 user `is_admin = 1`；並於啟動 migration 中保留「尚無 admin 時追認最早使用者」邏輯
- [ ] T024 [US1] 於 `server.js:1914` `POST /api/auth/login` 登入成功分支確認 `res.cookie('authToken', token, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: COOKIE_MAX_AGE })`（FR-004），且 JWT payload 帶 `{ userId, tokenVersion }`；`jwt.sign` 使用 `{ expiresIn: JWT_EXPIRES }`
- [ ] T025 [US1] 於登入成功回應中附上 `currentLogin`（FR-006）：同 transaction 寫入 `login_audit_logs` 與 `login_attempt_logs(is_success=1)` 後，回傳 `{ user, currentLogin: { at, ip, country, method: 'password', userAgent } }`
- [ ] T026 [US1] 於 `POST /api/auth/logout`（`server.js:2468`）確認 `UPDATE users SET token_version = token_version + 1 WHERE id = ?` 已存在；清除 Cookie 時參數必須與 `Set-Cookie` 原設定的 `secure`、`sameSite`、`httpOnly`、`path` 一致，否則瀏覽器不會覆蓋
- [ ] T027 [US1] 於 `index.html` 登入／註冊表單確認：(a) 密碼強度 hint 與後端一致、(b) 錯誤訊息一律通用化（FR-065）、(c) 若 `GOOGLE_CLIENT_ID` 未設定則 Google 按鈕區塊整段不渲染（為 US3 預留，但 US1 MVP 需確保無 Google 環境也能順利註冊登入）
- [ ] T028 [US1] 於 `app.js` 登入後儀表板首屏確認：取得 `currentLogin` 後的顯示（時間、IP、方式）符合 spec US1 Scenario 3
- [ ] T029 [US1] 於 `server.js` `POST /api/auth/login` 實作「時序對齊 dummy bcrypt」（FR-065 / SC-006 / analyze-01 C2）：當查無對應 Email 時，**仍**呼叫 `bcrypt.compareSync(req.body.password, DUMMY_HASH)` 一次（`DUMMY_HASH` 為模組頂層一次性產生的 `bcrypt.hashSync('__dummy__', 10)` 常量），以消除「不存在帳號」與「存在但密碼錯誤」兩條路徑的時序差異；整體回應時間差需 < 20ms（以 100 次取樣的 P95 比對）；完成後於 [quickstart.md](./quickstart.md) §8 附一段 bash 腳本驗證時序對齊

**Checkpoint（MVP 驗收）**：依 [quickstart.md](./quickstart.md) §2 執行：
- §2.1 註冊 `Alice@EX.com`，DB `users.email` 為 `alice@ex.com`，回應帶 `isAdmin: true`
- §2.2 用 `ALICE@ex.COM` 再註冊回 409 `email_in_use`
- §2.3 登出後舊 Cookie 打 `/api/auth/me` 回 401

---

## Phase 4：User Story 2 — 管理員控管註冊政策與使用者帳號（Priority: P2）

**Goal**：管理員可切換公開註冊開關、維護 Email 白名單（含 `*@domain`）、建立／重設／刪除使用者；系統任何時刻至少保留一位 admin。

**Independent Test**（spec.md US2 Independent Test）：以管理員切換註冊政策與白名單 → 訪客註冊行為立即生效；刪除使用者後其所有業務資料全數消失，僅保留匿名化失敗登入嘗試紀錄。

**對應 FR**：FR-031、FR-032、FR-033、FR-034、FR-035、FR-036、FR-037、FR-007（auth 桶一併生效）；Clarification Q3、Q9。

### Implementation

- [ ] T030 [US2] 於 `server.js` 將 `/api/admin/settings`（`server.js:2691`、`server.js:2696`）**重命名為 `/api/admin/system-settings`** 以對齊 [contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml)（方向：server.js → 契約，依 [plan.md](./plan.md) Complexity Tracking CT-1 已定案）；**同一 PR 原子翻轉，不保留 301/307 轉導**；於 `app.js` 同步把所有呼叫點改為新路徑（`app.js:5159`、`app.js:5267`）；於 `changelog.json` 新增 entry 聲明「舊 `/api/admin/settings` 已移除」
- [ ] T031 [US2] 於 `PUT /api/admin/system-settings` 寫入路徑接收 `publicRegistration`（0/1）與 `allowedRegistrationEmails`（陣列或字串），寫入前以 `allowedRegistrationEmails.filter(item => item === '*' ? false : true)` 拒絕「單獨 `*`」，其餘交給 T012 的 `matchAllowlist` 判斷；`updated_at = serverTimeNow()`、`updated_by = req.userId` 記錄
- [ ] T032 [US2] 於 `POST /api/admin/users`（`server.js:2896`）確認 `normalizeEmail` 已在 `server.js:2897` 呼叫；新增：即使 `public_registration = 0` 或白名單未通過，管理員建立使用者仍放行（FR-033 / spec.md Edge Case「管理員透過後台直接建立帳號：不套用白名單與公開註冊限制」）；成功後呼叫 `createDefaultsForUser(id)`
- [ ] T033 [US2] 於 `PUT /api/admin/users/:id/password`（`server.js:2930`）確認新密碼與舊密碼不同（FR-037）：先 `bcrypt.compareSync(newPassword, oldHash)`，相同則 400 `{ error: 'same_as_current_password' }`。註：`token_version + 1` 遞增由 T015 權威驗證，本任務不重複檢查（D1 去重）
- [ ] T034 [US2] 於 `DELETE /api/admin/users/:id`（`server.js:2952`）實作 FR-036 保護：若目標 `is_admin = 1` 且 `SELECT COUNT(*) FROM users WHERE is_admin = 1` ≤ 1，回 400 `{ error: 'last_admin_protected' }`；此檢查亦套用於管理員自刪（`req.userId === params.id`）
- [ ] T035 [US2] 於同路由實作 FR-035 混合刪除策略（Q9）：begin transaction → 依 [data-model.md](./data-model.md) §5.2 所列資料表逐一 `DELETE WHERE user_id = ?`（passkey_credentials、transactions、accounts、categories、budgets、recurring、stocks、stock_transactions、stock_dividends、stock_settings、stock_recurring、exchange_rate_settings）→ `DELETE FROM login_audit_logs WHERE user_id = ?`（成功紀錄硬刪）→ `UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0`（`?` 為 `sha256(lower(targetEmail)).hex`）→ `DELETE FROM login_attempt_logs WHERE user_id = ? AND is_success = 1`（已登入成功的嘗試紀錄同步硬刪）→ `DELETE FROM users WHERE id = ?` → commit → `saveDB()`
- [ ] T036 [US2] 於 `server.js` 新增／確認 `createHashedEmail(email)` 工具函式：`crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex')`；匯入 `crypto` 模組（Node 內建）
- [ ] T037 [US2] 於 `app.js` 管理者頁面：
  - 白名單 UI 顯示／編輯 `*@domain` 格式，附輸入提示「單獨的 `*` 不被視為合法項目」
  - 刪除使用者的確認對話方塊文案更新為「此操作將硬刪所有業務資料與成功登入紀錄；失敗登入紀錄將以雜湊保留以利攻擊偵測」
  - 重設密碼 UI 加註「此操作將強制該使用者在所有裝置重新登入」（對應 T015 / FR-005）

**Checkpoint**：依 [quickstart.md](./quickstart.md) §3：
- §3.1 白名單 `bob@example.com, *@partner.com` 按表格 6 組測資全數符合
- §3.2 刪除使用者後以 SQL 直查 `login_audit_logs`/`login_attempt_logs(is_success=1)` 為 0、失敗紀錄 `user_id=''` 且 `email` 為 64 hex
- §3.3 最後一位 admin 自刪回 400 `last_admin_protected`

---

## Phase 5：User Story 5 — 登入稽核與可視性（Priority: P2）

**Goal**：使用者檢視自己 100 筆、管理員檢視自己管理員身分 200 筆 + 全站 500 筆；支援單刪、批次刪、手動同步；90 天自動清除。

**Independent Test**（spec.md US5 Independent Test）：各以 password / Google / Passkey / 失敗 各登入一次，管理員全站稽核能看到 4 筆含方式／IP／是否成功／管理員身分。

**對應 FR**：FR-040、FR-041、FR-042、FR-043、FR-044、FR-045、FR-046；Clarification Q1。

### Implementation

- [ ] T040 [US5] 於 `server.js` 確認每個登入進入點（`/api/auth/login` 成功分支、`/api/auth/login` 失敗分支、`/api/auth/google` 成功與失敗、`/api/auth/passkey/login` 成功與失敗）皆寫入 `login_attempt_logs`（`is_success` 0/1 + `failure_reason`）；成功分支額外寫入 `login_audit_logs`（FR-040）
- [ ] T041 [US5] 於 `server.js` 寫入稽核時解析國家代碼（FR-041）：優先 `req.headers['cf-ipcountry']`；缺此標頭時查 `ipinfo.io/{ip}/country`（3 秒逾時、快取 24h）；私有網段 / loopback / IPv4-mapped / ULA 皆記為 `LOCAL`；工具函式 `resolveCountry(ip)` 放於「工具函式」區
- [ ] T042 [US5] 於 `server.js` 將下列舊路徑對齊 [contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml) 所定義之路徑（方向：server.js → 契約，依 [plan.md](./plan.md) Complexity Tracking CT-1 已定案；**同一 PR 原子翻轉，同 PR 刪除 `server.js:2575-2586` 既有的 `login-logs/:id` 相容 shim**）：
  - `GET /api/admin/login-logs`（`server.js:2507`） → `GET /api/admin/login-audit`
  - `GET /api/admin/login-logs/admin`（`server.js:2588`）與 `GET /api/admin/login-logs/admin/:id`（`server.js:2599`）→ `GET /api/admin/login-audit?scope=admin_self` 與 `DELETE /api/admin/login-audit/{logId}`
  - `DELETE /api/admin/login-logs/all/:id`（`server.js:2631`）→ `DELETE /api/admin/login-audit/{logId}`
  - `POST /api/admin/login-logs/all/batch-delete`（`server.js:2659`）→ `POST /api/admin/login-audit:batch-delete`
  - 新增 `GET /api/user/login-audit` 使用者自己 100 筆（契約已列，server.js 尚無該路由）
  - 於 `app.js` 同步全部呼叫點（`app.js:4555`、`4735`、`4738`、`4772`、`4790`、`4806`、`4810`）改為新路徑
- [ ] T043 [US5] 於 `GET /api/user/login-audit` 回傳 `user_id = req.userId` 最新 100 筆（`ORDER BY login_at DESC LIMIT 100`；index 已存在，見 [data-model.md](./data-model.md) §7）（FR-042）
- [ ] T044 [US5] 於 `GET /api/admin/login-audit`：以 query 參數 `scope = 'admin-self' | 'all'` 分流 — `admin-self` 回傳 `WHERE is_admin_login = 1 AND user_id = req.userId` 最新 200 筆；`all` 回傳全站最新 500 筆（FR-043）
- [ ] T045 [US5] 於 `DELETE /api/admin/login-audit/{logId}` 與 `POST /api/admin/login-audit:batch-delete`：主鍵刪除；若 logId 格式不符（FR-045 備援）則以 `login_at` + `ip_address` + `user_id` 組合匹配單筆，避免舊資料缺主鍵時無法刪除
- [ ] T046 [US5] 於 `app.js` 管理員稽核頁顯示「上次同步時間」（localStorage 快取）與「同步」按鈕，點擊即重新 fetch；失敗紀錄若 `email` 為 64 hex 顯示為 `[已匿名化 #abc123]`（取 hash 前 6 碼，對應 [data-model.md](./data-model.md) §2.4）
- [ ] T047 [US5] 於 `app.js` 使用者帳號設定「登入紀錄」區塊按 FR-042 呈現：欄位顯示時間（adopted）、IP、國家、方式（password/google/passkey）；依 `login_at DESC` 排列

**Checkpoint**：依 [quickstart.md](./quickstart.md) §6：
- §6.1 模擬 100 天時間偏移
- §6.2 90 天前插入測試紀錄後，pruneAuditLogs 自動清空且 log 出現 `[Audit Prune] removed N rows`

---

## Phase 6：User Story 3 — Google SSO（Priority: P3）

**Goal**：有 Google 帳號的訪客一鍵登入；首次登入且政策允許時自動建帳號；後續可補設本機密碼。

**Independent Test**（spec.md US3 Independent Test）：設定 `GOOGLE_CLIENT_ID` 後重啟 → 登入頁顯示 Google 按鈕 → 走完 Authorization Code Flow 成功登入；移除 `GOOGLE_CLIENT_ID` 後 Google 元素完全消失且原帳密流程完全不變。

**對應 FR**：FR-010、FR-011、FR-012、FR-013；Clarification Q10。

### Implementation

- [ ] T050 [US3] 於 `server.js` 啟動時建立 `googleRedirectUriAllowlist: Set<string>`：從 `GOOGLE_OAUTH_REDIRECT_URIS` 環境變數解析（T002 已完成解析）；若環境變數空則 fallback `[https://${APP_HOST}/api/auth/google, http://localhost:${PORT}/api/auth/google]` 並於 log 標明採用預設值
- [ ] T051 [US3] 於 `POST /api/auth/google`（`server.js:2267`）於交換 code 之前比對 `req.body.redirect_uri ∈ googleRedirectUriAllowlist`；不在白名單 → 立即 400 `{ error: 'invalid_redirect_uri' }`，**絕不外呼 Google**，並寫入 `login_attempt_logs(is_success=0, failure_reason='invalid_redirect_uri')`（FR-011 / Q10）
- [ ] T052 [US3] 於同路由交換 token 時將 `redirect_uri` 一併傳給 Google（`application/x-www-form-urlencoded` 的 `redirect_uri` 欄位）；比對後端收到的 `state` 與先前 `GET /api/auth/google/state` 發行值，不符則 400 `{ error: 'state_mismatch' }`（spec US3 Scenario 4）
- [ ] T053 [US3] 於同路由首次登入分支：以 `normalizeEmail(googleProfile.email)` 為 key；若政策為公開註冊或白名單（T012）通過才新建；建立時 `password_hash = crypto.randomBytes(24).toString('hex')`（意即不可用此密碼登入）、`has_password = 0`、`google_id = profile.sub`、`avatar_url = profile.picture`、`display_name = profile.name`（FR-012）；立即呼叫 `createDefaultsForUser(id)`
- [ ] T054 [US3] 於同路由既有帳號分支（normalized email 已存在）：若 `google_id` 為空則補上 `UPDATE users SET google_id = ? WHERE id = ?`；不影響既有 `has_password`；簽發 JWT、寫稽核、設 Cookie
- [ ] T055 [US3] 於使用者「帳號設定 → 補設密碼」：新增／確認 `POST /api/auth/set-local-password`（或對齊現有路由），要求 `req.user.has_password === 0`，驗密碼強度後 `UPDATE users SET password_hash = ?, has_password = 1, token_version = token_version + 1`（FR-013）；補設後使用者可同時走帳密或 Google 登入
- [ ] T056 [US3] 於 `index.html` 與 `app.js`：Google 按鈕渲染條件 `window.__APP_CONFIG__.hasGoogleClientId`（由 `GET /api/config` 或 `<meta>` 注入）；未設定時不渲染按鈕、不載入 `accounts.google.com/gsi/client` 外部資源（FR-010 / FR-063 SRI 保護）

**Checkpoint**：依 [quickstart.md](./quickstart.md) §4：
- §4.1 合法 redirect_uri 通過
- §4.2 `https://evil.example/callback` 回 400 `invalid_redirect_uri`，**log 無外呼 Google**、`login_attempt_logs` 有一筆 `failure_reason='invalid_redirect_uri'`

---

## Phase 7：User Story 4 — Passkey usernameless（Priority: P3）

**Goal**：已登入使用者可註冊多組 Passkey（命名、獨立刪除）；登入頁直接點「使用 Passkey 登入」即可（不輸入 Email）。

**Independent Test**（spec.md US4 Independent Test）：註冊一組 Passkey → 登出 → 登入頁點 Passkey 直接登入；再註冊第二組、刪除第一組，第二組仍可登入且第一組從清單消失。

**對應 FR**：FR-020、FR-021、FR-022、FR-023；Clarification Q4。

### Implementation

- [ ] T060 [US4] 於 `server.js:2402` `GET /api/auth/passkey/challenge` 與 `server.js:2408` `POST /api/auth/passkey/login` 確認走 usernameless discoverable credential 流程（`allowCredentials` 為空陣列）；登入 API 由 assertion 的 `userHandle` 反查 `users.id`（FR-021 / Q4）
- [ ] T061 [US4] 於 Passkey 註冊路由（`/api/auth/passkey/register/options` 與 `/api/auth/passkey/register`）確認：`user.id` 以 bytes 寫入 `userHandle`；`residentKey: 'required'`、`userVerification: 'preferred'`；寫入 `passkey_credentials` 的 `credential_id`、`public_key`、`algorithm`、`transports`、`counter`、`device_name`（使用者命名），並回傳清單順序（`ORDER BY created_at DESC`）
- [ ] T062 [US4] 於 `POST /api/auth/passkey/login`（與 register）確認 origin 白名單比對（FR-022）：origin 允許清單由 `APP_HOST` 推導 + 本機 `http://localhost:<PORT>`；不符即 400 `{ error: 'invalid_origin' }` 並寫 `login_attempt_logs(failure_reason='invalid_origin')`
- [ ] T063 [US4] 於 `DELETE /api/auth/passkey/:credentialId`：確認只能刪自己的 credential（`WHERE user_id = req.userId`），避免跨使用者刪除
- [ ] T064 [US4] 於 `index.html` 確認 WebAuthn 前端資源由伺服器本地提供（FR-023）：不引用 CDN；若既有實作已是本地檔則保持
- [ ] T065 [US4] 於 `app.js` 登入頁 Passkey 按鈕點擊即呼叫 `navigator.credentials.get({ publicKey: { challenge, allowCredentials: [] } })`；**不可**要求使用者先輸入 Email（Q4）；成功後 POST `/api/auth/passkey/login` 並依回應設 Cookie + 導向儀表板。**無 WebAuthn 支援環境的 fallback UX**（對應 spec.md Edge Case）：頁面載入時以 `if (!window.PublicKeyCredential) { ... }` 檢查，不支援時按鈕變灰（`disabled` + `opacity: 0.5`）並附 `title="本瀏覽器不支援 WebAuthn，請使用 Chrome／Safari／Edge 最新版或改以帳密登入"` hover 提示；不得讓頁面渲染失敗或出現 JS 例外

**Checkpoint**：依 [quickstart.md](./quickstart.md) §5：
- §5.1 帳號設定新增 `MacBook Touch ID` 後清單出現名稱與時間
- §5.2 登出後不填 Email 也能 Passkey 登入

---

## Phase 8：User Story 6 — 伺服器時間與 NTP 校正（Priority: P3）

**Goal**：管理員可見真實時間／時區／採用時間／偏移／uptime；以「目標時間」或「毫秒偏移量」兩種方式更新；NTP 查詢支援 fallback 與「僅預覽」模式；私有網段拒絕。

**Independent Test**（spec.md US6 Independent Test）：在 UTC 容器設 `SERVER_TIME_OFFSET=+28800000` → 採用時間顯示為台灣時間；NTP 預覽回傳差異但不套用；輸入 `[::1]` 被拒。

**對應 FR**：FR-050、FR-051、FR-052、FR-053、FR-054、FR-055。

### Implementation

- [ ] T070 [US6] **反向**更新 [contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml)：把契約中的 `/api/server-time*` 改回 `/api/admin/server-time*`，以對齊 `server.js` 既有實作（方向：契約 → server.js，依 [plan.md](./plan.md) Complexity Tracking CT-1 已定案；`server.js` 不動，因「伺服器時間管理」為 admin 專屬，契約原本移除 `/admin` 前綴錯誤）；具體：
  - `GET /api/server-time` → `GET /api/admin/server-time`
  - `PUT /api/server-time/offset` → 合併回 `PUT /api/admin/server-time`（移除獨立 `/offset` 路徑，`requestBody` 的 `oneOf{targetTime, offsetMs}` 保留）
  - `POST /api/server-time/ntp` → `POST /api/admin/server-time/ntp-sync`
  - 同 PR 將 `info.version` 由 `0.1.0` bump 至 `0.2.0`（Principle II 規則 #3：paths 破壞性變更）
- [ ] T071 [US6] 於 `PUT /api/server-time/offset` 寫入前檢查 `|offsetMs| <= SERVER_TIME_OFFSET_MAX`（±10 年，FR-052）；接受兩種輸入形態 `{ offsetMs }` 或 `{ targetTime }`（RFC 3339 字串）；後者以 `new Date(targetTime).getTime() - Date.now()` 計算偏移（FR-051）
- [ ] T072 [US6] 於 `POST /api/server-time/ntp` 拆分請求參數 `{ host, apply }`：`host` 為字串必填；`apply=false` 預設 → 僅預覽（FR-054）；`apply=true` → 計算後套用並持久化
- [ ] T073 [US6] 於同路由實作 `validateNtpHost(host)`（FR-055）：拒絕 IPv6（含 `::1`、`[::1]`）、IPv4 私有（`10/8`、`172.16/12`、`192.168/16`、`127/8`、`169.254/16`、`0.0.0.0/8`）、IPv4-mapped-IPv6（`::ffff:...`）；允許 IPv4 公網地址或 FQDN；不符回 400 `{ error: 'invalid_ntp_host' }`；工具函式 exportable 以利驗證
- [ ] T074 [US6] 於同路由 SNTP v3 fallback 鏈（FR-053）：依序 `tw.pool.ntp.org` → `pool.ntp.org` → `time.google.com` → `time.cloudflare.com`；每個 3 秒逾時；計算時扣除單趟網路延遲（`(T1 - T0 + T2 - T3) / 2`）；任一成功即回傳 `{ deltaMs, host, applied }`
- [ ] T075 [US6] 於 `app.js` 管理員「伺服器時間」面板顯示 5 項（真實／時區／採用／偏移／uptime）；「NTP 查詢（不套用）」按鈕呼叫 T072 的 `apply=false`；「套用偏移」按鈕另開彈窗並要求再次確認

**Checkpoint**：依 [quickstart.md](./quickstart.md) §7：
- §7.1 `time.google.com` 預覽回 `{ deltaMs, applied:false }`
- §7.2 `10.0.0.1` 與 `[::1]` 皆 400 `invalid_ntp_host`

---

## Phase 9：Polish & Cross-Cutting

**Purpose**：整合驗收、文件同步、版號記錄。

- [ ] T090 於 [quickstart.md](./quickstart.md) §10 完成勾選單（10 項）逐項驗證；若有任一項不通過，回上游 phase 追補
- [ ] T091 於 [quickstart.md](./quickstart.md) §8 兩桶 rate limit 驗證：連打 `/api/auth/login` 21 次 → 第 21 次 429；同時 `/privacy` 不受影響；再連打 `/privacy` 21 次第 21 次才 429（FR-007）
- [ ] T092 [P] 根 `openapi.yaml` 以 `python -c "import yaml; d=yaml.safe_load(open('openapi.yaml','r',encoding='utf-8')); assert d['openapi']=='3.2.0'; print(len(d['paths']),'paths')"` 與 `npx @redocly/cli lint openapi.yaml` 驗證通過（憲章 Principle II）
- [ ] T093 [P] `specs/001-user-permissions/contracts/auth.openapi.yaml` 同上驗證（`openapi: 3.2.0` 字串、lint 通過）
- [ ] T094 更新 `changelog.json`：`currentVersion` bump 至 **4.22.0**（minor；當前 `4.21.1`）；新增 release entry 涵蓋（a）Email 正規化 migration 的**不可逆**提醒、（b）`token_version` 於密碼變更遞增的「所有裝置登出」影響、（c）兩桶 rate limit、（d）redirect_uri 白名單、（e）白名單 `*@domain` 語法、（f）混合刪除策略、（g）90 天稽核保留、（h）契約 `info.version: 0.1.0 → 0.2.0` 的三組路徑重命名（CT-1）、（i）安全基線回歸驗證（FR-060 ~ FR-064；CT-2／T098）；依 [.claude/commands/update-docs.md](../../.claude/commands/update-docs.md) 的流程處理
- [ ] T095 同步更新 `SRS.md` 版本歷程（§4.2 或 §8.2）與頁首版本；`README.md` 若有版本徽章一併更新（對應 T094 的版本號）
- [ ] T096 於 `docs/` 或 `README.md` 運維段補「部署新版本時必做」清單：`GOOGLE_OAUTH_REDIRECT_URIS` 必須填寫（否則 Google 登入將全部失敗，降級為 log 預設值）、資料庫自動跑 Email 正規化 migration、提醒「管理員重設密碼會強制該使用者所有裝置重新登入」
- [ ] T097 最後以 [quickstart.md](./quickstart.md) §9 Rollback 說明為據，確認備份與還原流程可行（Docker compose 掛載 `./data`、`database.db.bak` 與 `package.json` tag 對應）
- [ ] T098 [P] 安全基線回歸檢查（對應 [analyze-01.md](./analyze-01.md) C1；MEDIUM — 同 PR 帶上、驗收失敗不阻擋合併但需於 `changelog.json` 記錄）。依 [plan.md](./plan.md) Complexity Tracking CT-2 執行 6 項驗證並寫入 [quickstart.md](./quickstart.md) §10 checklist（或追加 §11）：
  - **FR-062 安全標頭（6 項）**：啟動 server 後 `curl -sI http://localhost:3000/` 檢查回應含以下 6 項 header（對應更新後的 [spec.md](./spec.md) FR-062）：`Content-Security-Policy`、`Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`、`Permissions-Policy`（至少禁用 `geolocation=()`、`microphone=()`、`camera=()`）。以 `curl -sI http://localhost:3000/ | grep -iE '^(content-security-policy|strict-transport-security|x-content-type-options|referrer-policy|x-frame-options|permissions-policy):' | wc -l` 取得命中數，預期 = 6
  - **FR-063 SRI integrity**：`grep -c 'integrity=' index.html` 回傳 ≥ 1；若專案已無 CDN 依賴則本項標示 N/A
  - **FR-064 .env 權限**：POSIX 環境 `stat -c '%a' .env` 應為 `600`；Windows 環境以 PowerShell `(Get-Acl .env).Access` 檢查僅 `Administrators` 與 `%USERNAME%` 具寫入
  - **FR-064 ignore 清單**：`grep -F '*.db' .gitignore` 與 `grep -F '*.db' .dockerignore` 各回傳 ≥ 1 行，且兩檔均含 `.env`
  - **FR-060 HTML escape 基線**：`grep -c 'innerHTML\s*=\s*' app.js` 與 main branch 相比不得暴增（作為 regression guard，非硬性上限）
  - **FR-061 色碼 hex 驗證**：`grep -n '#[0-9A-Fa-f]\{6\}' app.js` 對應輸入點仍走 regex 驗證（非字串拼接）
  - 所有驗證結果（pass／fail／N/A）寫入 `changelog.json` 本版 `changes[]` 一則「安全基線回歸驗證（FR-060 ~ FR-064）：N/M 通過」（M = FR-062 6 項 + FR-063 + FR-064 權限 + FR-064 ignore + FR-060 + FR-061 = 最多 11 子項）；任一項 fail 於 PR 描述明列並登記為下一版修復項
- [ ] T099 [P] SC-004 壓測（對應 [analyze-01.md](./analyze-01.md) C3；MEDIUM — 同 PR 帶上、驗收失敗阻擋合併）：依 [quickstart.md](./quickstart.md) §3.3.1 的 bash for-loop 連續嘗試刪除最後管理員 1000 次，預期全部回 HTTP 400 `last_admin_protected`；`fail = 0` 方為通過。若 `fail > 0` 視為 P0 級競態漏洞，須先修復 `server.js` 管理員計數查詢之 transaction isolation 再重跑

---

## Dependencies & Execution Order

### Phase 依賴

- **Phase 1（Setup）**：無依賴，可立即開始
- **Phase 2（Foundational）**：依賴 Phase 1；**BLOCKS** 所有 User Story
- **Phase 3（US1 MVP）**：依賴 Phase 2
- **Phase 4（US2）**：依賴 Phase 2；可與 Phase 3 併行（不同路由群）
- **Phase 5（US5）**：依賴 Phase 2；與 Phase 3、4 併行，但其 90 天清除（T014）為 US5 的後端根基、於 Phase 2 已完成
- **Phase 6（US3 Google）**：依賴 Phase 2；可與 Phase 3-5 併行
- **Phase 7（US4 Passkey）**：依賴 Phase 2；可與 Phase 3-6 併行
- **Phase 8（US6 NTP）**：依賴 Phase 2；可與 Phase 3-7 併行
- **Phase 9（Polish）**：依賴所有 desired User Story 完成

### User Story 之間

- US1（P1）：獨立可交付 → **MVP**
- US2（P2）：可獨立交付；與 US1 共用 `normalizeEmail`／`token_version`（Foundational 已備）
- US5（P2）：可獨立交付；依賴 US1 的登入稽核寫入 hook 已存在（Foundational + Phase 3 之後即具全貌）
- US3（P3）：可獨立交付；切換 `GOOGLE_CLIENT_ID` 即可 toggle 整段功能
- US4（P3）：可獨立交付；關閉 Passkey UI 不影響其他登入路徑
- US6（P3）：運維屬性功能；未完成不影響一般使用者路徑

### 每個 Story 內

- 無 test 任務（本功能採手動驗證）
- 先完成資料存取／後端路由 → 再調整前端 UI → 對齊契約
- 每個 story 完成後走 quickstart 對應 § 做 checkpoint 驗收

### Parallel Opportunities

- **Phase 1**：T002、T003 並行（不同區段）
- **Phase 2**：除 T010/T011（同一 migration 執行順序）與 T013（rate limiter，與其他 middleware 區段共檔）外，T012、T014、T015、T016 可與 T010 之後的任一併行
- **Phase 3–8**：不同 User Story 可由不同人併行；單 Story 內同一檔案（主要是 `server.js`、`app.js`）任務需序列化
- **Phase 9**：T092、T093 並行驗證；T094–T095 依 [.claude/commands/update-docs.md](../../.claude/commands/update-docs.md) 序列化處理

---

## Parallel Example：Phase 2 Foundational（部分）

```text
# T010 完成 normalizeEmail 後同步並行：
Task: "T012 實作 matchAllowlist 於 server.js 工具函式區"
Task: "T014 實作 pruneAuditLogs + registerAuditPruneJob 於 server.js 排程區"
Task: "T016 同步更新根 openapi.yaml"
```

## Parallel Example：跨 Story（Phase 2 完成後）

```text
# 多人併行：
Developer A: Phase 3 US1（T020–T028）— MVP 主線
Developer B: Phase 4 US2（T030–T037）— 管理員政策
Developer C: Phase 5 US5（T040–T047）— 稽核可視性
# 之後：
Developer A: Phase 6 US3（T050–T056）
Developer B: Phase 7 US4（T060–T065）
Developer C: Phase 8 US6（T070–T075）
```

---

## Implementation Strategy

### MVP First（僅 US1）

1. Phase 1：Setup（T001–T003）
2. Phase 2：Foundational（T010–T016）
3. Phase 3：US1（T020–T028）
4. **STOP & VALIDATE**：執行 [quickstart.md](./quickstart.md) §2、§8、§9 的子集
5. 若 `GOOGLE_CLIENT_ID` / Passkey 功能未設定，MVP 本身仍完整可用並可上線

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. + US1（P1） → **MVP**：能註冊、登入、登出、改密碼
3. + US2（P2） → 可控管理：白名單、公開註冊開關、刪除使用者
4. + US5（P2） → 可視性：稽核清單與 90 天清除
5. + US3（P3） → Google SSO 便利性
6. + US4（P3） → Passkey 體驗
7. + US6（P3） → 跨時區部署支援

### 單人開發節奏建議

- Day 1：Phase 1 + Phase 2（T001–T016），期末啟動 log 應含 `[Audit Prune] registered` 與 `[OAuth] redirect_uri whitelist: N entries`
- Day 2：Phase 3 US1 + quickstart §2 驗收
- Day 3–4：Phase 4 US2 + Phase 5 US5（兩者資料層共享）+ quickstart §3、§6
- Day 5：Phase 6 US3 + quickstart §4
- Day 6：Phase 7 US4 + quickstart §5
- Day 7：Phase 8 US6 + quickstart §7
- Day 8：Phase 9 Polish + 版號更新 + PR 提交

---

## Notes

- 本專案既有實作已涵蓋 33/42 FR；tasks.md 的每項任務均可追溯至 [research.md](./research.md) §1 的「部分實作」或「未實作」差異，或 §2 的 10 項 Clarification 落地條目
- 所有新增／變更路由必須同步更新根 `openapi.yaml`（Principle II）
- 所有文件與 commit message body 必須為 zh-TW；識別字／環境變數／commit prefix（`feat:` / `fix:` / `docs:`）與 `openapi: '3.2.0'` 字面值為例外（Principle I）
- 任一任務涉及資料庫寫入後需呼叫 `saveDB()`；跨表 DELETE 以 `db.run('BEGIN')` / `db.run('COMMIT')` 包起來避免中斷殘留
- 每完成一個 phase checkpoint，建議立即建一個 commit（小步 commit、便於回退）
