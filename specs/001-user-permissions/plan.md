# 實作計畫：使用者與權限（Users & Permissions）

**Branch**: `001-user-permissions` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/001-user-permissions/spec.md`

## Summary

本計畫將 `spec.md`（42 FR／6 使用者故事／10 Clarification）落地到既有實作。
技術路線沿用專案既有單體結構：Node.js 24+ 搭配 Express 5、單一 `server.js`
聚合所有 API 與中介層、根目錄 SPA（`index.html` / `app.js` / `style.css`）、
sql.js 於記憶體執行並以 `database.db` 檔案持久化。JWT 以 `HttpOnly` + `Secure`
+ `SameSite=Strict` Cookie 傳遞、`JWT_EXPIRES` 預設 7 天；密碼採 bcryptjs、
Passkey 以 `@passwordless-id/webauthn` 驗證。

規格大量描述既有行為；真正的變更為十項 Clarification 產生的「既有實作 → 新要求」
差異（detailed 差異表見 [research.md](./research.md) §2）：

1. **Email 正規化（FR-001／FR-032）**：註冊、登入、白名單比對全數以 `trim().toLowerCase()` 後的字串為準，資料庫儲存正規化後值。
2. **Token 撤銷（FR-005）**：密碼變更（使用者自行或管理員重設）一併遞增 `token_version`。
3. **兩桶 rate limit（FR-007）**：分離 `auth` 桶與 `靜態頁` 桶，各自 20 次／15 分鐘／IP。
4. **OAuth `redirect_uri` 白名單（FR-011）**：後端以 `GOOGLE_OAUTH_REDIRECT_URIS` 環境變數維護白名單，與 Google Cloud Console 同步。
5. **白名單萬用字元（FR-032）**：單項含 `*` 視為 `*@<domain>` 網域通配，否則為大小寫不敏感完全比對。
6. **使用者刪除混合策略（FR-035）**：刪成功登入紀錄、匿名化保留失敗登入紀錄（`user_id = ''` 空字串、`email = SHA-256(email)`；`user_id` 採空字串而非 NULL 以對齊既有 NOT NULL 約束，權威見 [data-model.md](./data-model.md) §2.4）。
7. **90 天稽核保留（FR-046）**：背景排程每日清除超過 90 天的 `login_audit_logs` 與 `login_attempt_logs`。

其餘 FR 在 `server.js` 已存在對應實作（驗證於 research.md §1），本計畫仍須在
實作階段逐一對齊並補齊自動化驗證。

## Technical Context

**Language/Version**：Node.js 24+（部署於 Zeabur 與 Docker；`package.json` 已鎖定
`express ^5.2.1`、`sql.js ^1.14.1`）。前端為瀏覽器原生 ES modules，無打包步驟。

**Primary Dependencies**：
- 後端：`express`、`cookie-parser`、`cors`、`helmet`、`express-rate-limit`、
  `jsonwebtoken`、`bcryptjs`、`@passwordless-id/webauthn`、`sql.js`、`adm-zip`、
  `nodemailer`、`resend`、`dotenv`。
- 前端：原生 HTML/CSS/JavaScript（SPA，無框架），Chart.js 負責儀表板圖表、
  Font Awesome 6 提供圖示。所有外部資源以 SRI 掛載。
- WebAuthn：前端走瀏覽器原生 `navigator.credentials.*`，後端以
  `@passwordless-id/webauthn` 驗證註冊與登入 assertion。

**Storage**：SQLite 透過 `sql.js` 於記憶體執行；檔案持久化至 `./database.db`，
`saveDB()` 在寫入後序列化並覆寫。重點資料表：`users`、`passkey_credentials`、
`login_audit_logs`（成功登入）、`login_attempt_logs`（含失敗）、`system_settings`
（全站設定）；詳細 schema 與欄位差異見 [data-model.md](./data-model.md)。

**Testing**：既有專案無自動化測試；本計畫不新增測試框架依賴，改以
[quickstart.md](./quickstart.md) 的可重現手動驗證流程 + `openapi.yaml` schema
驗證（`npx @redocly/cli lint openapi.yaml`）為主要驗收依據。

**Target Platform**：Linux server（Zeabur／Docker／VPS）；必須為 HTTPS 環境
（`Secure` Cookie 前提）。本機開發以 `http://localhost:<PORT>` 運行，
Google OAuth 與 Passkey 皆要求 origin 在白名單內。

**Project Type**：Web service（單體）——單一 `server.js` 同時服務 JSON API
與靜態資產；沒有獨立 SPA build。倉庫中的 `backend/`、`frontend/` 目錄為
早期實驗性拆分，本功能不納入範圍。

**Performance Goals**：一般 API `< 200 ms` p95；NTP 查詢 3 秒 fallback（FR-053）；
登入端點（含 bcrypt 雜湊）允許 `< 500 ms`。

**Constraints**：
- 登入稽核每日清除超過 90 天紀錄，顯示層上限維持 100／200／500 筆（FR-046）。
- JWT 有效期預設 7 天；Cookie `Max-Age` 同步，無「記住我」選項（FR-004）。
- Email 強制 `trim + lowercase`，`Alice@EX.com` 與 `alice@ex.com` 視為同帳號。
- 所有 HTTP API 契約須在 `openapi.yaml` 宣告，且 `openapi` 欄位為字串 `3.2.0`。

**Scale/Scope**：單節點 SQLite，預計百人級使用者、萬筆級交易；此規格假設
不需多節點一致性。`login_audit_logs` 在 90 天保留政策下，100 個活躍使用者
／日均 5 次登入時約 45,000 筆，單表容量在 SQLite 可接受範圍。

## Constitution Check

*GATE：Phase 0 研究前必過；Phase 1 設計後重測。*

Gates（憲章 v1.1.0）：

- **[I] 繁體中文文件規範 Gate**：✅ PASS
  - `spec.md`、本 `plan.md`、`research.md`、`data-model.md`、`quickstart.md`、
    `contracts/**` 皆以 zh-TW 撰寫。
  - 保留識別字（`token_version`、`JWT_EXPIRES`、`GOOGLE_OAUTH_REDIRECT_URIS`、
    `redirect_uri`）與套件／環境變數名稱為英文，符合憲章例外條款。
- **[II] OpenAPI 3.2.0 契約 Gate**：✅ PASS
  - 本功能不新增端點（既有端點已涵蓋於根 `openapi.yaml`）；但因
    Clarification 觸發的行為變更（兩桶 rate limit、redirect_uri 白名單拒絕、
    token_version 於密碼變更遞增、90 天清除）將於實作同一 PR 更新
    `openapi.yaml` 的對應描述、錯誤回應、參數說明。
  - 本功能子契約存放於 `contracts/auth.openapi.yaml`，`openapi: 3.2.0` 為
    字串，涵蓋 `/api/auth/*`、`/api/admin/users`、`/api/admin/system-settings`、
    `/api/admin/login-audit/*`、`/api/server-time/*` 列入本功能範圍的端點。
  - Schemas 採 `components.schemas` + `$ref`，已驗證身分端點宣告
    `security: [{ cookieAuth: [] }]`。
- **Development Workflow Gate**：✅ PASS
  - 功能分支 `001-user-permissions` 已由 `create-new-feature.ps1` 自動建立。
  - 實作完成後將同步更新 `changelog.json`（新增一條 release entry）與
    `SRS.md`（版本歷史）。
  - 本功能包含 `login_attempt_logs.email` 欄位語意變化（可能存入 SHA-256）
    與新排程（每日清除），PR 描述將以繁體中文列出遷移步驟（見
    [quickstart.md](./quickstart.md) §5）。
  - API 變更與實作於同一 PR 更新 `openapi.yaml`。

無憲章違反，Complexity Tracking 留空。

## Project Structure

### Documentation (this feature)

```text
specs/001-user-permissions/
├── plan.md                       # 本檔（/speckit.plan 產出）
├── research.md                   # Phase 0：Clarification 落地決策與既有實作映射
├── data-model.md                 # Phase 1：資料表 schema 與狀態流
├── quickstart.md                 # Phase 1：最短驗證流程（含本機與容器）
├── contracts/
│   └── auth.openapi.yaml         # Phase 1：本功能所屬端點的 3.2.0 子契約
├── spec.md                       # 由 /speckit.specify 建立、已 clarify 兩輪
└── tasks.md                      # Phase 2（/speckit.tasks）——尚未產生
```

### Source Code (repository root)

既有單體結構；本功能不新增頂層目錄：

```text
/（repo root）
├── server.js                     # Express 5 + sql.js；所有 API、中介層、背景排程
├── app.js                        # 前端 SPA 主檔（~7500 行）
├── index.html                    # SPA 入口與登入畫面
├── style.css                     # 全站樣式
├── privacy.html / terms.html     # 法律靜態頁（速率限制「靜態頁桶」套用對象）
├── openapi.yaml                  # 全站 API 契約（openapi: 3.2.0）
├── database.db                   # sql.js 持久化檔（gitignore）
├── package.json / package-lock.json
├── Dockerfile / docker-compose.yml
├── .env / .env.example           # JWT_SECRET、JWT_EXPIRES、GOOGLE_*、NTP_*、
│                                 # GOOGLE_OAUTH_REDIRECT_URIS（本功能新增）
├── SSL/                          # 自簽憑證（本機 HTTPS）
└── docs/                         # 既有補充文件
```

**Structure Decision**：沿用 single-project layout。`server.js` 內部已依
「中介層 → 資料表建立與升級 → 工具函式 → 路由」分節組織；本功能的實作
調整會集中在以下區段：
1. `setupRateLimiting()`（現位於頂部中介層區段）：拆成 `authLimiter` 與
   `staticPageLimiter` 兩桶。
2. `initDatabase()`：不新增欄位；`login_attempt_logs.email` 允許存入雜湊字串
   （欄位型別 TEXT 已相容）。
3. Google OAuth 路由（`/api/auth/google`）：新增 `redirect_uri` 白名單比對。
4. 註冊／登入／白名單比對：統一經過 `normalizeEmail(email)` 工具。
5. 背景排程（既有 `setInterval` 排程群）：新增每日 `pruneAuditLogs()`，
   清除超過 90 天的紀錄。
6. 使用者刪除流程（`DELETE /api/admin/users/:id`）：新增「硬刪成功紀錄、
   匿名化失敗紀錄」兩階段 SQL。

倉庫根的 `backend/`、`frontend/`、`asset_openapi.yaml`、`SRS copy.md`
與本功能無關，不納入實作範圍。

## Complexity Tracking

### CT-1：三組 API 路徑 rename migration（F1 定案 2026-04-24）

`/speckit.analyze` 報告 F1（HIGH）指出契約與 server.js 三組路徑不一致。為滿
足憲章 Principle II 規則 #2（handler 必須與 `paths.*` 匹配），於本計畫統一決
策如下：

| 路徑案 | 舊（server.js） | 新（定案） | 對齊方向 | 影響檔案 |
| --- | --- | --- | --- | --- |
| 設定 | `/api/admin/settings` | `/api/admin/system-settings` | server.js → 契約 | `server.js:2691,2696`；`app.js:5159,5267` |
| 登入稽核（管理員視角） | `/api/admin/login-logs`、`/login-logs/admin/*`、`/login-logs/all/*` | `/api/admin/login-audit`（`?scope=admin-self\|all`）、`/login-audit/{logId}`、`/login-audit:batch-delete` | server.js → 契約 | `server.js:2507,2576,2588,2599,2631,2659`；`app.js:4555,4735,4738,4772,4790,4806,4810` |
| 使用者自己的稽核 | （本 PR 新增） | `/api/user/login-audit` | 新增 | `server.js`（新路由）；`app.js`（新呼叫點） |
| 伺服器時間 | `/api/admin/server-time`、`/server-time/ntp-sync` | **保留** `/api/admin/server-time`、`/server-time/ntp-sync` | 契約 → server.js | `specs/001-user-permissions/contracts/auth.openapi.yaml` |

**採「契約為權威」方向的理由**：
1. Case 1／Case 2 的契約命名更貼合語意（`system-settings` vs `settings` 避免
   與未來使用者層設定衝突；`login-audit` 直接對應 DB 表 `login_audit_logs`
   與 FR-040–FR-046 的「稽核」語義）。
2. Case 2 同時收攏三組舊路徑為統一的「`?scope=` + `{logId}` + `:batch-delete`」，
   端點數由 5 個降為 3 個；契約層去重後與 [data-model.md](./data-model.md) §2.3、
   §2.4 的資料表結構對應更清爽。

**採「server.js 為權威」方向的理由（Case 3）**：
3. `/api/admin/server-time*` 為 admin 專屬；路徑前綴反映 auth 需求是既有全站
   慣例（整個 `/api/admin/*` 皆經 `adminMiddleware`）；若改成 `/api/server-time/*`
   會讓讀者誤以為一般使用者也能呼叫。回頭改契約即可，成本最小。

**Migration 策略**：
- 三組變更於**同一 PR** 同步落地：server.js 路由 rename + app.js 所有呼叫點
  更新 + 契約同步（Case 3 反向更新）。
- **不加** 307/308 轉導：本專案前端為單一 SPA 且所有呼叫點都在 repo 內，同
  PR 原子性翻轉比保留舊路徑更乾淨（避免長期技術債與永久快取問題）。對應
  現有 `login-logs/:id` 相容 shim（`server.js:2575-2586`）亦於同 PR 移除。
- 契約 `info.version` 依憲章 Principle II 規則 #3 bump：
  `0.1.0` → `0.2.0`（minor，因為是 path rename 屬 breaking 但同一功能面內的
  重組；若認定為全新版本可採 major，但僅影響 repo 內前後端同步，不擴散
  至第三方整合者，minor 足夠）。

**本修正觸發的 tasks.md 變更**：
- **T030**：移除「或反之」；改為單向「server.js → 契約」；同時把
  `/api/admin/login-logs/admin/:id`、`/admin/batch-delete` 舊 shim 於同 PR
  刪除。301/307 轉導條款刪除。
- **T042**：移除「或反之」；同向；加註「同 PR 刪除相容 shim」。
- **T070**：反向——改為「更新契約 `auth.openapi.yaml` 把 `/api/server-time*`
  改回 `/api/admin/server-time*`、`/api/server-time/ntp` 改回
  `/api/admin/server-time/ntp-sync`；server.js 不動」。

### CT-2：FR-060 ~ FR-064 安全基線回歸保護（C1 定案 2026-04-24）

`/speckit.analyze` 報告 C1（HIGH；本 PR 歸類 MEDIUM 不阻擋）指出五項安全基線
FR 於 [research.md](./research.md) §1 標為「已實作」但 tasks.md 無 regression
task；若日後重構誤刪 `helmet` / CSP / SRI integrity / `.env` 權限保護，本規格
交付時不會察覺。

**定案**：於 Phase 9 Polish 追加 **T098「安全基線回歸檢查」**，同一 PR 帶上，
驗收失敗不阻擋 001-user-permissions 合併但需於 `changelog.json` 顯式記錄（對
應 FR-060 ~ FR-064 五項回歸點）。

**驗收項目**（對應 [analyze-01.md](./analyze-01.md) §1 C1 recommendation）：
1. `helmet` 於 `server.js` 仍啟用：`curl -sI http://localhost:3000/` 檢視 FR-062
   列舉之 **6 項 header** 均存在：`Content-Security-Policy`、
   `Strict-Transport-Security`、`X-Content-Type-Options: nosniff`、
   `Referrer-Policy: strict-origin-when-cross-origin`、`X-Frame-Options: DENY`、
   `Permissions-Policy`（至少禁用 `geolocation=()`、`microphone=()`、`camera=()`）。
   任一項缺失即 fail；詳見 [tasks.md](./tasks.md) T098 第 1 項。
2. `index.html` CDN 資源仍帶 `integrity=` 與 `crossorigin=` 屬性：
   `grep -c 'integrity=' index.html` 回傳 ≥ 1（FR-063）。
3. `.env` 於 POSIX 檔系權限為 `600`（`stat -c '%a' .env`）；**Windows 開發環境
   以 NTFS ACL `icacls .env` 檢查僅 `Administrators` 與 `%USERNAME%` 具寫入** 作
   為等效替代（FR-064；對應 I1 的 OS fallback 備註）。
4. `.gitignore` 與 `.dockerignore` 均含 `*.db*` 與 `.env`：`grep -F '*.db' .gitignore` 與
   `.dockerignore` 各回傳 ≥ 1 行（FR-064）。
5. FR-060（HTML escape）：確認 `app.js` 顯示使用者輸入處（搜尋 `textContent =` 或
   `escapeHtml(` 覆蓋率）；`grep -c 'innerHTML\s*=\s*' app.js` **不應暴增**（相較
   main branch 基線）。
6. FR-061（色碼 hex 驗證）：`grep -n '#[0-9A-Fa-f]\{6\}' app.js` 對應輸入點仍走
   regex 驗證（非字串拼接）。

**Windows 開發環境替代方案**（FR-064 / I1）：
- PowerShell 檢查：`(Get-Acl .env).Access | Where-Object { $_.IdentityReference -notmatch 'Administrators|'+$env:USERNAME }` 應回傳空集。
- 若使用 WSL，則走 POSIX `stat -c '%a' .env` 路徑即可。

**T098 輸出格式**：於 [quickstart.md](./quickstart.md) §10 checklist 新增 6 項勾選項
（或獨立 §11），並於 `changelog.json` 本版 `changes[]` 新增一則「安全基線回歸
驗證通過（FR-060 ~ FR-064）」。若任一項失敗，於 PR 描述中明列並決定是否於合
併前修復（MEDIUM 不阻擋，但失敗項需追蹤至下一版）。
