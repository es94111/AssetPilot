# 實作計畫：交易與帳戶（Transactions & Accounts）

**Branch**: `002-transactions-accounts` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/002-transactions-accounts/spec.md`

## Summary

本計畫將 002 規格（6 user story／**34 base FR + 4 sub-FR（`a` 後綴：
FR-007a / 014a / 020a / 022a）= 38 total**／20 Clarification／8 SC）落地
至既有單體應用。沿用 001 已建立的技術骨架：Node.js 24+、Express 5、單一
`server.js`、根目錄 SPA（`index.html` / `app.js` / `style.css`）、sql.js
記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、bcryptjs、
Passkey（`@passwordless-id/webauthn`）。本功能新增的整合僅有匯率資料源
（`https://www.exchangerate-api.com/`），**IPinfo／TWSE／Google Identity
Services／Resend** 雖已於專案存在但與本功能直接需求無關（IPinfo 屬
登入稽核地理位置；TWSE 屬未來股票模組；GIS／Resend 屬 001-user-permissions
登入流程），本計畫不對其改動。

規格中每一項 Clarification 已被歸納為以下八類技術決策（落地細節見
[research.md](./research.md)）：

1. **金額精度（FR-022a）**：`amount` / `twd_amount` / `fx_fee` /
   `accounts.initial_balance` 全數改採 `INTEGER` 幣別最小單位；`fx_rate`
   改採 `TEXT` decimal 字串。後端引入 [`decimal.js`](https://github.com/MikeMcl/decimal.js)
   (新增 dependency) 處理乘除與四捨五入；既有 `REAL` 欄位需 migration。
2. **時區（FR-007a）**：所有「今天／未來」判定先以 `Asia/Taipei`
   (UTC+8) 轉換後比對 `transactions.date`；DB 內部 `created_at` /
   `updated_at` 仍為 UTC epoch ms。後端工具函式 `todayInTaipei()` 統一
   計算當天日期字串。
3. **資料表 schema 擴充**：`accounts` 補 `category`（enum）/
   `overseas_fee_rate`（INTEGER 千分點）/ `updated_at`；`transactions` 補
   `to_account_id`、`twd_amount`、`updated_at` 索引；新增
   `user_settings`（`pinned_currencies` JSON）；既有 `exchange_rates`
   合併本功能用法（去除 `user_id` 改成跨使用者快取，FR-023）。
4. **樂觀鎖（FR-014a）**：所有 `PATCH` / `DELETE` 端點要求
   `expected_updated_at`（epoch ms），不符回 `409 Conflict`。
5. **IDOR 防線（FR-060）**：新增**底層通用** helper
   `ownsResource(table, idColumn, idValue, userId)`（PK 欄位名稱由 caller
   指定，使 `accounts.id` / `transactions.id` / `user_settings.user_id`
   皆可共用同一查詢介面），其上包裝 `requireOwnedAccount` /
   `requireOwnedTransaction` middleware；不符一律回 `404 Not Found`，不
   洩漏存在性。
6. **Atomic 批次操作（FR-045）**：`POST /api/transactions:batch-update`
   / `:batch-delete` 一律包在 `db.run('BEGIN'…'COMMIT/ROLLBACK')`；
   單次最多 500 筆、超過回 `400`；任一筆失敗整批回滾。
7. **匯率快取（FR-023 / FR-024）**：跨使用者共用記憶體快取（5 分鐘
   in-flight dedup + 30 分鐘伺服器快取），失敗時走「最近成功快取 →
   使用者手動輸入」fallback。獨立模組 `lib/exchangeRateCache.js`。
8. **跨幣別轉帳禁止（FR-015）**：UI 來源／目標幣別不一致時
   submit 鈕 `disabled`；後端 `POST /api/transfers` 比對
   `accounts.currency`，不同則 `422 Unprocessable Entity`。

本功能新增端點（皆於 `/api/accounts/*`、`/api/transactions/*`、
`/api/transfers/*`、`/api/exchange-rates/*` 命名空間下；詳細契約見
[contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml)）：

| 端點 | 方法 | 對應 FR |
| --- | --- | --- |
| `/api/accounts` | GET / POST | FR-001, FR-002, FR-003, FR-004 |
| `/api/accounts/{accountId}` | GET / PATCH / DELETE | FR-005, FR-006, FR-014a |
| `/api/transactions` | GET / POST | FR-010~FR-018, FR-050~FR-052 |
| `/api/transactions/{txId}` | GET / PATCH / DELETE | FR-014, FR-014a |
| `/api/transactions:batch-update` | POST | FR-041, FR-043, FR-044, FR-045 |
| `/api/transactions:batch-delete` | POST | FR-042, FR-044, FR-045 |
| `/api/transfers` | POST | FR-015 |
| `/api/exchange-rates/{currency}` | GET | FR-020, FR-023, FR-024 |
| `/api/user/settings/pinned-currencies` | GET / PUT | FR-020a |

實作順序由規格的 P1（US1, US2）→ P2（US3, US4, US5）→ P3（US6）對應，
詳見 [tasks.md](./tasks.md)（Phase 2，本計畫不產出）。

## Technical Context

**Language/Version**：Node.js 24+（部署於 Zeabur 與 Docker；`package.json`
鎖定 `express ^5.2.1`、`sql.js ^1.14.1`）。前端為瀏覽器原生 ES modules，
無打包步驟（與 001 相同）。

**Primary Dependencies**：

- 後端（既有）：`express`、`cookie-parser`、`cors`、`helmet`、
  `express-rate-limit`、`jsonwebtoken`、`bcryptjs`、
  `@passwordless-id/webauthn`、`sql.js`、`adm-zip`、`nodemailer`、
  `resend`、`dotenv`。
- 後端（**本功能新增**）：[`decimal.js ^10.4.x`](https://github.com/MikeMcl/decimal.js)
  ——FR-022a 強制要求 decimal 函式庫處理 `fx_rate × amount + fx_fee`
  計算。**不引入 luxon/dayjs**：時區單一固定為 `Asia/Taipei`，以原生
  `Date` + `Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei' })`
  即可滿足，不必為單一時區拉入額外 dependency（理由詳見
  [research.md §2](./research.md)）。
- 前端（既有）：原生 HTML/CSS/JavaScript（SPA）、Chart.js 圖表、
  Font Awesome 6 圖示，所有外部資源以 SRI 掛載。
- 前端（**本功能新增**）：(a) QR 掃描元件——採用瀏覽器原生
  [`BarcodeDetector` API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
  為主、不支援時 fallback 至 `jsQR` (CDN + SRI 載入)；理由與替代方案見
  [research.md §6](./research.md)。(b) `decimal.js`——以 CDN + SRI 載入
  （`https://cdn.jsdelivr.net/npm/decimal.js@10.4.3/decimal.min.js`），
  暴露 `window.Decimal`，供 `lib/moneyDecimal.js` 同構載入時於前端解析；
  與後端 `npm install decimal.js` 共用同一版本以避免 round 結果漂移。
- 外部 API：`https://v6.exchangerate-api.com/v6/{KEY}/latest/TWD`
  （匯率，沿用 001 既有環境變數 `EXCHANGE_RATE_API_KEY`）；其餘
  IPinfo／TWSE／Google Identity Services／Resend 於本功能不直接呼叫。

**Storage**：SQLite 透過 `sql.js` 於記憶體執行；持久化至 `./database.db`，
`saveDB()` 在每次寫入後序列化覆寫。本功能涉及的資料表：

- `accounts`（**migration 補欄位**）：`category`、`overseas_fee_rate`、
  `updated_at`；`initial_balance` 由 `REAL` 改為 `INTEGER`（資料 migration）。
- `transactions`（**migration 補欄位**）：`to_account_id`、
  `twd_amount`、`updated_at` index；`amount` / `original_amount` /
  `fx_fee` 由 `REAL` 改為 `INTEGER`、`fx_rate` 由 `REAL` 改為 `TEXT`
  decimal 字串（資料 migration）。
- `exchange_rates`（**schema 重構**）：移除 `user_id` 改成跨使用者
  快取；以 `currency` 為 PK；新增 `source`（API 名稱）。既有
  `exchange_rate_settings.user_id` 欄位保留（屬使用者個人設定，非快取）。
- `user_settings`（**新增**）：`user_id` PK、`pinned_currencies`
  TEXT（JSON array）、`updated_at`。

詳細 schema 與 migration 步驟見 [data-model.md](./data-model.md)。

**Testing**：與 001 相同——既有專案無自動化測試框架；本計畫不引入新
測試 dependency，改以 [quickstart.md](./quickstart.md) 的可重現手動驗證
流程 + `openapi.yaml` schema 驗證（`npx @redocly/cli lint openapi.yaml`）為
主要驗收依據。決策理由詳見 [research.md §7](./research.md)。

**Target Platform**：Linux server（Zeabur／Docker／VPS）；HTTPS 環境
（`Secure` Cookie 前提）。本機開發以 `http://localhost:<PORT>` 運行。
QR 掃描功能（FR-030）僅在行動瀏覽器之 HTTPS 上下文可用，桌面瀏覽器
fallback 至「上傳圖片」。

**Project Type**：Web service（單體）——單一 `server.js` 同時服務
JSON API 與靜態資產，沒有獨立 SPA build。倉庫中的 `backend/`、
`frontend/` 目錄為早期實驗，本功能不納入範圍（與 001 一致）。

**Performance Goals**（對應 SC-001 ~ SC-008）：

- 帳戶餘額計算 P95 `< 1s`（SC-002）。
- 匯率自動填入 P95 `< 2s`、快取命中 `< 100ms`（SC-003）。
- 批次操作（100 筆）端到端 P95 `< 3s`（SC-005）。
- 一般 API（CRUD、列表）P95 `< 200ms`，列表分頁 SQL 透過 `(user_id, date)`
  與 `(user_id, account_id)` 複合索引支撐。

**Constraints**：

- **時區**：所有日期判定（餘額過濾、未來標籤、報表）一律以
  `Asia/Taipei` 計算 `CURRENT_DATE`（FR-007a）。
- **金額精度**：禁用原生 float／`Number.toFixed()` 直接相乘；改以
  `decimal.js` 計算後 `.round(0, ROUND_HALF_UP).toNumber()` 取最小單位
  整數（FR-022a）。
- **批次上限**：500 筆；超過回 `400 Bad Request`（FR-044, FR-051）。
- **樂觀鎖**：所有 `PATCH` / `DELETE` 須帶 `expected_updated_at`，
  不符回 `409 Conflict`（FR-014a）。
- **IDOR**：所有 `/accounts`、`/transactions`、`/transfers` 端點以
  session user 驗證 `user_id`，不符一律 `404`（FR-060）。
- **OpenAPI 3.2.0**：本功能新端點同步寫入 `openapi.yaml` 與
  `contracts/transactions.openapi.yaml`，憲章 Principle II。

**Scale/Scope**：單節點 SQLite，預計百人級使用者、單使用者萬筆級
交易；交易表預期最大量為使用者 5 年 × 月均 100 筆 = 6,000 筆／使用者，
百人 × 6,000 = 60 萬筆，sql.js 仍可接受。匯率快取為跨使用者共用，
記憶體 footprint < 1KB（每幣別一筆，常用幣別 < 30 種）。

## Constitution Check

*GATE：Phase 0 研究前必過；Phase 1 設計後重測。*

Gates（憲章 v1.1.0）：

- **[I] 繁體中文文件規範 Gate**：✅ PASS
  - `spec.md`、本 `plan.md`、`research.md`、`data-model.md`、
    `quickstart.md`、`contracts/**` 皆以 zh-TW 撰寫。
  - 保留識別字（`overseas_fee_rate`、`twd_amount`、`expected_updated_at`、
    `pinned_currencies`、`exclude_from_total`、`exclude_from_stats`、
    `linked_id`、`fx_rate`、`fx_fee`）、套件名（`decimal.js`、
    `BarcodeDetector`、`jsQR`）、HTTP 狀態碼、ISO 4217 代碼為英文／符號，
    符合憲章例外條款。
- **[II] OpenAPI 3.2.0 契約 Gate**：✅ PASS
  - 本功能新增 `/api/accounts/*`、`/api/transactions/*`、
    `/api/transfers`、`/api/exchange-rates/{currency}`、
    `/api/user/settings/pinned-currencies` 端點，皆於
    [contracts/transactions.openapi.yaml](./contracts/transactions.openapi.yaml)
    宣告，`openapi: 3.2.0` 字串。
  - 同 PR 將同步更新根目錄 `openapi.yaml` 加入相同端點（憲章 Principle II
    規則 #2：handler 與 `paths.*` 必須同 PR 對齊）。
  - 共用 schemas（`Account`、`Transaction`、`Money`、`OptimisticLock`、
    `BatchResult`）以 `components.schemas` + `$ref` 表達；所有需驗證身分
    端點宣告 `security: [{ cookieAuth: [] }]`。
  - `info.version` **沿用 001 已建立的 `4.22.0`**（與 `changelog.json
    .currentVersion` 對齊）；本 PR 因新增端點屬 minor，依憲章規則 #3
    bump 至 `4.23.0`（同步寫入 `openapi.yaml` 與 `changelog.json`，見
    tasks.md T140 / T142）。後續 breaking change（如欄位 rename）依
    憲章 versioning 規則處理。
- **Development Workflow Gate**：✅ PASS
  - 功能分支 `002-transactions-accounts` 已由 `create-new-feature.ps1`
    建立、首批 commit 已上推（`566734d docs(002): 新增「交易與帳戶」
    功能規格`）。
  - 實作完成後將同步更新 `changelog.json` 新增 release entry、
    `SRS.md` 版本歷史。
  - 含 schema migration（`REAL → INTEGER`、`REAL → TEXT decimal`）屬
    破壞性變更，PR 描述將以繁體中文列出遷移步驟（見
    [data-model.md §3 Migration](./data-model.md) 與
    [quickstart.md §5](./quickstart.md)）。
  - API 變更與實作於同一 PR 更新契約，禁止「先實作後補契約」順序。

無憲章違反，[Complexity Tracking](#complexity-tracking) 記錄一項
schema migration 風險（CT-1）以利審查。

## Project Structure

### Documentation (this feature)

```text
specs/002-transactions-accounts/
├── plan.md                          # 本檔（/speckit.plan 產出）
├── research.md                      # Phase 0：技術決策與替代方案
├── data-model.md                    # Phase 1：資料表 schema 與 migration
├── quickstart.md                    # Phase 1：最短驗證流程
├── contracts/
│   └── transactions.openapi.yaml    # Phase 1：本功能子契約（openapi: 3.2.0）
├── checklists/                      # /speckit.checklist 產出（已存在）
├── spec.md                          # /speckit.specify + 4 輪 /speckit.clarify
└── tasks.md                         # Phase 2（/speckit.tasks 尚未產生）
```

### Source Code (repository root)

沿用 001 既有單體結構；本功能不新增頂層目錄：

```text
/（repo root）
├── server.js                        # Express 5 + sql.js；本功能於既有路由區段
│                                    # 末尾新增 /api/accounts/* /api/transactions/*
│                                    # /api/transfers /api/exchange-rates/* 路由
├── app.js                           # 前端 SPA 主檔；本功能新增交易頁／帳戶頁／
│                                    # 批次操作列／QR 掃描元件
├── index.html                       # SPA 入口；補 jsQR fallback CDN（SRI）
├── style.css                        # 全站樣式；新增「未來」分區、批次操作列
│                                    # 紫色強調、半選 checkbox 樣式
├── lib/                             # 【本功能新增】共用純函式工具
│   ├── moneyDecimal.js              # 金額 decimal.js 工具（**同構模組，前後端共用**）：
│   │                                # smallestUnit↔decimal、各幣別最小單位定義表、
│   │                                # computeTwdAmount、formatForDisplay
│   ├── exchangeRateCache.js         # 跨使用者匯率快取（**server-only**：
│   │                                # in-flight dedup + 30 分鐘 server cache）
│   └── taipeiTime.js                # Asia/Taipei 時區工具（**server-only**：
│                                    # todayInTaipei()、isFutureDate(dateStr)）
├── openapi.yaml                     # 全站契約；本功能於 PR 內同步加入新端點
├── database.db                      # sql.js 持久化檔（gitignore）
├── package.json / package-lock.json # 新增 decimal.js dependency
├── Dockerfile / docker-compose.yml  # 不變
├── .env / .env.example              # 不新增環境變數（沿用 001 的
│                                    # EXCHANGE_RATE_API_KEY）
├── SSL/                             # 自簽憑證（本機 HTTPS）
└── docs/                            # 既有補充文件
```

**Structure Decision**：沿用 single-project layout 並新增 `lib/` 目錄
存放 server 端純函式工具。理由：

1. **單一 server.js 已達 28 萬字元（~280KB）**，FR-022a / FR-007a /
   FR-023 三項需要可測純函式（金額換算、時區、匯率快取去重），抽到
   `lib/*` 既能避免 server.js 進一步膨脹，亦便於未來引入測試。
2. **`lib/` 採混合策略以避免雙端重複邏輯**：
   - **`lib/moneyDecimal.js` 為同構模組**（前後端共用，single source of
     truth）：因 FR-021 海外手續費 UI（T123）與 FR-004 / FR-020 儀表板
     跨幣別 TWD 換算（T125）需前端即時計算 fxFee／TWD 等值，且後端
     T035 / T113 / T035 須採同套 `decimal.js` 公式；若 `lib/` 僅
     server-side，前端只能 (a) 多打 API 換算（往返成本）或 (b) 重寫一份
     簡化邏輯（漂移風險）。同構策略以 UMD 樣式同時暴露 `module.exports`
     與 `window.moneyDecimal`，server.js 以 `require('./lib/moneyDecimal')`
     載入、前端以 `<script>` 載入後從 `window.moneyDecimal` 取用；
     `decimal.js` 依賴於前端以 CDN + SRI 掛載（與 jsQR fallback 同模式）。
   - **`lib/exchangeRateCache.js` 與 `lib/taipeiTime.js` 仍為 server-only**：
     前者持有伺服器記憶體 cache 物件、後者僅 server 端寫入
     `transactions.date` 時需要；兩者前端皆不直接呼叫，無重複邏輯風險。
3. **不新增 backend／frontend 目錄拆分**：001 已決策不採此拆分，本
   功能延續以保持結構一致。

`server.js` 內部實作將集中在以下區段（均於 server.js 「路由區段」
末尾追加新路由群、不破壞既有結構）：

1. **`initDatabase()`**：新增 `accounts.category` /
   `accounts.overseas_fee_rate` / `accounts.updated_at`、
   `transactions.to_account_id` / `transactions.twd_amount` /
   `transactions.updated_at` 欄位 ALTER；REAL→INTEGER 與
   REAL→TEXT migration。新增 `user_settings` 資料表。
2. **新增 middleware**：`requireOwnedAccount(req, res, next)`、
   `requireOwnedTransaction(req, res, next)`，於本功能所有路由套用。
3. **新增路由群**（依規格分節）：
   - `/api/accounts/*`（FR-001 ~ FR-007）
   - `/api/transactions/*`（FR-010 ~ FR-018, FR-050 ~ FR-052）
   - `/api/transactions:batch-*`（FR-040 ~ FR-045）
   - `/api/transfers`（FR-015）
   - `/api/exchange-rates/{currency}`（FR-020, FR-023, FR-024）
   - `/api/user/settings/pinned-currencies`（FR-020a）
4. **註冊預設「現金」帳戶**：於既有 `createDefaultsForUser(userId)`
   末尾追加 `INSERT INTO accounts ... category='cash'`（FR-002）。

`app.js` 變更區塊：

- 帳戶管理頁：新增 tabs（依 `category` 分頁）、信用卡分組顯示、
  「一鍵還款」捷徑、`overseas_fee_rate` 編輯欄位。
- 交易頁：新增類型色標（紅／綠／藍）、未來分區標籤、自訂每頁筆數
  輸入（1~500）、URL query 還原（`sort=<field>_<asc|desc>`）。
- 交易 Modal：幣別下拉（pinned + 「新增其他幣別」）、自動匯率欄位、
  TWD 等值即時計算、信用卡海外手續費欄位、QR 掃描按鈕。
- 批次操作列（紫色）：表頭半選 checkbox、500 筆上限阻擋、批次變更
  分類自訂下拉（含色點與分區結構）、批次刪除二次確認 Modal（含
  「N 組轉帳對 + 連動刪除 M 筆」）。

倉庫根的 `backend/`、`frontend/`、`asset_openapi.yaml` 與本功能無關，
不納入實作範圍（同 001 決策）。

## Complexity Tracking

### CT-1：金額／匯率欄位型別 migration（REAL → INTEGER / REAL → TEXT）

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| 既有 `accounts.initial_balance`、`transactions.amount` / `original_amount` / `fx_fee` 由 `REAL` migrate 至 `INTEGER`；`transactions.fx_rate` 由 `REAL` migrate 至 `TEXT` decimal 字串。並非新增憲章違反，而是為了 FR-022a「禁用 float」要求所做的 schema breaking change。 | 規格 FR-022a 明確要求金額以幣別最小單位整數儲存、匯率以 decimal 字串儲存，避免浮點誤差累積（已知 IEEE-754 場景：`0.1 + 0.2 = 0.30000000000000004`）。本系統長期將累積跨年度交易，誤差會放大至月報表偏差。 | **替代 1：保留 REAL、僅在計算時轉 decimal** — 否決原因：每次讀取需從 DB 反序列化為 decimal、寫入再四捨五入回 float，往返誤差仍可能累積；且 SQL `SUM(amount)` 在 REAL 上仍是浮點加總，無法產生精準月報。**替代 2：以 TEXT 儲存所有金額為 decimal 字串** — 否決原因：失去 SQL 整數聚合最佳化，索引比對退化為字串比對，效能退化；INTEGER 最小單位與 SQL 整數運算一致，效能最佳。 |

**Migration 策略**（詳見 [data-model.md §3](./data-model.md)）：

1. **同 PR 完成 schema + 資料 migration**：以 `db.run('BEGIN')` 包裹
   整個流程；任一步驟失敗整批 rollback。
2. **資料轉換規則**：
   - `accounts.initial_balance`（REAL TWD 元）→ INTEGER：直接
     `Math.round(initial_balance)`（既有資料推測皆為 TWD 元，無 sub-元
     資料）；外幣帳戶於 002 之前不存在（既有 schema 雖有 `currency` 欄
     但 UI 未提供選擇），故無 sub-元 → 分／円 的歷史轉換需求。
   - `transactions.amount` (REAL TWD 元) → INTEGER：同上。
   - `transactions.fx_rate`（REAL）→ TEXT：`String(fx_rate)`，
     decimal.js 載入時自動 normalize。
   - 既有交易若 `currency != 'TWD'`：理論上不存在（前端從未開放），
     若有則於 migration 階段 log 警告並按 `Math.round(amount * 1)`
     處理（保守作法，使用者可後續手動修正）。
3. **回滾計畫**：migration 前自動備份至 `database.db.bak.<timestamp>`；
   若 migration 後 self-test 失敗，可手動還原備份檔。
4. **測試自動化**：於 [quickstart.md §5](./quickstart.md) 加入「升級
   既有 v3.x 資料庫 → 啟動 → 驗證帳戶餘額不變」流程，作為 PR 合併前
   人工驗證 checklist。

**為何記入 Complexity Tracking 而非直接通過**：此 migration 屬一次性
breaking 操作，誤改可能導致歷史交易金額永久損毀；雖無憲章違反，仍須
顯式記錄審查重點供 reviewer 確認備份／回滾步驟到位。
