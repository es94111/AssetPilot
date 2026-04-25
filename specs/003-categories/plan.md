# 實作計畫：分類系統（Category System）

**Branch**: `003-categories` | **Date**: 2026-04-25 | **Spec**: [spec.md](./spec.md)
**Input**: 功能規格 `specs/003-categories/spec.md`

## Summary

本計畫將 003 規格（3 user story／**47 base+sub FR**／15 Clarification／7 SC）落
地至既有單體應用。**不新增任何技術棧**：沿用 001/002 已建立的 Node.js 24+、
Express 5、單一 `server.js`、根目錄 SPA（`index.html`／`app.js`／`style.css`）、
sql.js 記憶體執行 + `database.db` 檔案持久化、JWT httpOnly Cookie、OpenAPI
3.2.0 契約、`decimal.js`／`adm-zip`／`bcryptjs`／`@passwordless-id/webauthn`
等既有 dependency；本功能**不引入任何新 npm 套件、不引入新前端 CDN 資源**。

既有 schema（`categories`，server.js:586）已涵蓋 `id` / `user_id` /
`name` / `type` / `color` / `is_default` / `is_hidden` / `sort_order` /
`parent_id` 九個欄位，且 `GET/POST/PUT/DELETE /api/categories` 與
`/api/categories/{id}` 端點已存在（server.js:4500–4558），契約亦於
`openapi.yaml:517` 與 `2274` 登記。本計畫的工作主要是：

1. **Schema migration**：丟棄 `is_hidden` 欄位（規格已明示移除「是否隱藏」整個
   功能）、新增 `deleted_defaults` 資料表存放 `DeletedDefaultRegistry`、補
   `categories` 索引（`(user_id, parent_id, sort_order)`）。
2. **預設樹重新定義**：依 FR-008 改寫 server.js 的 `defaultSubcategories` 與
   `createDefaultsForUser` 內 `expenseCats` / `incomeCats` 常數；補建邏輯
   （`migrateDefaultSubcategories`）改名為 `backfillDefaultsForUser` 並擴充：
   - 處理 8 個支出父分類 + 5 個收入父分類底下全部預設子分類（FR-008 修訂版）。
   - 在 INSERT 前比對 `deleted_defaults`（FR-011c）跳過使用者主動刪除過的項目。
   - 同步補建缺漏的「預設父分類」本身（既有實作只補子分類）。
3. **API 強化與新增**：將既有端點補完樂觀鎖外的所有 003 規格約束，且新增三支端點：
   - `PATCH /api/categories/{id}` 用以**移動子分類至另一父分類**（FR-014a/b/d）。
   - `POST /api/categories:reorder` 用以**批次重排同層分類**（FR-024a/b）。
   - `POST /api/categories:restore-defaults` 用以「還原預設分類」（FR-011d/e/f）。
4. **顏色驗證收緊**：`isValidColor` 既有 regex `/^#[0-9a-fA-F]{3,8}$/` 過於寬鬆；
   依 FR-020 改為 `/^#[0-9A-Fa-f]{6}$/`（**僅** 6 碼 hex，不含 alpha、不含 3 碼縮寫），
   後端拒絕任何不符；前端 `<input type="color">` 原生即輸出 `#RRGGBB`，無需額外處理。
5. **type 不可變**：`PUT/PATCH /api/categories/{id}` 一律不接受 `type` 欄位
   變更請求（FR-014c）；後端 `UPDATE` SQL 不含 `type` 欄位。
6. **編輯父分類禁止改成子分類**（FR-015 防循環）：`PATCH` 拒絕將父分類的
   `parentId` 由空字串變更為非空字串（即父分類 demote 為子分類）；同時拒絕
   將子分類 promote 為父分類（避免破壞唯一性鍵）。
7. **分類管理頁雙區塊化**（FR-022a）：app.js 既有分類管理頁（若已存在）改寫
   為「上半段：支出父分類列+子分類網格、下半段：收入父分類列+子分類網格」雙
   區塊；新增「還原預設分類」按鈕（明確文案：「補回過去刪除的預設分類」）。
8. **HTML5 原生拖曳排序**（FR-024a/b）：使用瀏覽器內建 `draggable` 屬性 +
   `dragstart`/`dragover`/`drop` 事件，不引入任何拖曳函式庫；拖曳完成後
   呼叫 `POST /api/categories:reorder` 一次性更新該層級的 `sort_order` 整批。

本計畫無新外部 API；無 IPinfo／TWSE／Google Identity Services／Resend 互動。

| 端點 | 方法 | 對應 FR | 狀態 |
| --- | --- | --- | --- |
| `/api/categories` | GET | FR-026, FR-022a, FR-024 | 既有；補回 `is_hidden` 欄位移除 |
| `/api/categories` | POST | FR-005, FR-005a, FR-012, FR-013, FR-013a, FR-020 | 既有；收緊顏色、補唯一性 |
| `/api/categories/{id}` | PUT | FR-014, FR-014c, FR-015, FR-016, FR-020 | 既有；拒絕 type 變更、拒絕 promote/demote |
| `/api/categories/{id}` | PATCH | FR-014a, FR-014b, FR-014d | **新增**：用於子分類跨父歸屬變更 |
| `/api/categories/{id}` | DELETE | FR-017, FR-018, FR-019, FR-011b, FR-011b1 | 既有；新增寫入 `deleted_defaults` |
| `/api/categories:reorder` | POST | FR-024, FR-024a, FR-024b | **新增**：批次同層重排 |
| `/api/categories:restore-defaults` | POST | FR-011d, FR-011e, FR-011f | **新增**：清空 registry + 補建 |

實作順序：US1（FR-007~FR-011f）→ US2（FR-012~FR-016, FR-022~FR-026）→ US3
（FR-017~FR-019）；對應 P1→P1→P2，詳見 tasks.md（Phase 2，本計畫不產出）。

## Technical Context

**Language/Version**：Node.js 24+（部署於 Zeabur 與 Docker；`package.json`
鎖定 `express ^5.2.1`、`sql.js ^1.14.1`）。前端為瀏覽器原生 ES modules，
無打包步驟（與 001/002 一致）。

**Primary Dependencies**：

- 後端（既有，本功能**完全不新增**）：`express`、`cookie-parser`、`cors`、
  `helmet`、`express-rate-limit`、`jsonwebtoken`、`bcryptjs`、
  `@passwordless-id/webauthn`、`sql.js`、`adm-zip`、`nodemailer`、`resend`、
  `dotenv`、`decimal.js`（002 引入；本功能不使用）。
- 前端（既有，本功能**完全不新增**）：原生 HTML/CSS/JavaScript（SPA）、
  Font Awesome 6 圖示（皆以 SRI 掛載）。**拖曳排序**採 HTML5 原生
  `draggable` + `dragstart`/`dragover`/`drop` 事件，**不引入** dnd-kit、
  SortableJS、Sortable.js 等任何函式庫；**顏色選擇器**採 HTML 原生
  `<input type="color">`，瀏覽器原生輸出格式即 `#RRGGBB`。
- 外部 API：**無**。本功能不呼叫任何外部服務。

**Storage**：SQLite 透過 `sql.js` 於記憶體執行；持久化至 `./database.db`，
`saveDB()` 在每次寫入後序列化覆寫。本功能涉及的資料表：

- `categories`（**migration**）：移除 `is_hidden` 欄位；新增複合索引
  `idx_cat_user_parent_sort (user_id, parent_id, sort_order)` 加速分類管理頁
  讀取與排序；既有 `parent_id`、`sort_order`、`type`、`color`、`is_default`
  欄位語意保持。
- `deleted_defaults`（**新增**）：每使用者刪除過的預設分類識別清單，欄位
  `(user_id, default_key, deleted_at)`，PK = `(user_id, default_key)`；
  `default_key` 為 FR-011b 規定之穩定識別字串（父分類為 `"<type>:<name>"`、
  子分類為 `"<type>:<parent_name>:<name>"`）。

詳細 schema 與 migration 步驟見 [data-model.md](./data-model.md)。

**Testing**：與 001/002 相同——既有專案無自動化測試框架；本計畫不引入新測試
dependency，改以 [quickstart.md](./quickstart.md) 的可重現手動驗證流程為主，
搭配 `npx @redocly/cli lint openapi.yaml` 在 CI／本機進行 schema lint。

**Target Platform**：Linux server（Zeabur／Docker／VPS）；HTTPS 環境；瀏覽器
端僅需支援 HTML5 native drag-and-drop（IE10+；Chrome/Firefox/Edge/Safari 全
支援）與 `<input type="color">`（同左；Safari 自 15+ 支援）。

**Project Type**：Web service（單體）——單一 `server.js` 同時服務 JSON API 與
靜態資產，沒有獨立 SPA build。

**Performance Goals**（對應 SC-001～SC-007）：

- `GET /api/categories` 列表 P95 `< 200ms`（典型分類數 < 100，sql.js 單表讀取
  + 新增複合索引足以支撐）。
- 登入時補建（`backfillDefaultsForUser`）P95 `< 200ms`（FR-010a、SC-007）：
  比對 `deleted_defaults` + 至多 50 筆 INSERT，皆於同一交易內。
- 拖曳排序（`POST :reorder`）P95 `< 200ms`：批次 UPDATE，N 筆同層整數欄位。
- 還原預設（`POST :restore-defaults`）P95 `< 500ms`：DELETE all from registry
  + 補建一次。

**Constraints**：

- **零新依賴**（使用者 input 強制要求）：禁止新增 npm dependency 與前端
  CDN 資源；拖曳、顏色、UI 元件全部走原生 API。
- **顏色嚴格 #RRGGBB**：後端 `isValidColor` 收緊為 `/^#[0-9A-Fa-f]{6}$/`
  （FR-020、FR-021）；不接受 `#RGB`、`#RRGGBBAA`、命名色。
- **type 不可變**：所有 update 路徑（PUT、PATCH）忽略並拒絕 type 欄位
  （FR-014c）。
- **leaf-only**：`POST /api/transactions` 與 `PATCH /api/transactions/{id}`
  在驗證 `category_id` 時 MUST 額外檢查該分類 `parent_id != ''`（即必為子
  分類），父分類 ID 一律 `400 Bad Request`（FR-013a）。**此檢查屬 002 既有
  端點的 PATCH，本計畫於 server.js 既有 transaction 端點補上單行驗證**。
- **OpenAPI 3.2.0**：本功能新端點同步寫入 `openapi.yaml` 與
  `contracts/categories.openapi.yaml`，憲章 Principle II。

**Scale/Scope**：單節點 sql.js；預估每使用者父分類 < 30、子分類 < 200，
百人級使用者下 `categories` 全表 < 30,000 筆；`deleted_defaults` 上限為「預
設樹完整定義列數 × 使用者數」≈ 50 × 100 = 5,000 筆，可忽略。

## Constitution Check

*GATE：Phase 0 研究前必過；Phase 1 設計後重測。*

Gates（憲章 v1.1.0）：

- **[I] 繁體中文文件規範 Gate**：✅ PASS
  - `spec.md`、本 `plan.md`、`research.md`、`data-model.md`、`quickstart.md`、
    `contracts/**` 皆以 zh-TW 撰寫。
  - 保留識別字（`parent_id`、`sort_order`、`is_default`、`deleted_defaults`、
    `default_key`、`category_id`、`reorder`、`restore-defaults`）、套件名
    （`sql.js`、`Express`）、HTTP 狀態碼為英文／符號，符合憲章例外條款。
- **[II] OpenAPI 3.2.0 契約 Gate**：✅ PASS
  - 本功能對既有 `/api/categories`、`/api/categories/{id}` 端點補強欄位
    與行為，並新增 `PATCH /api/categories/{id}`、`POST /api/categories:reorder`、
    `POST /api/categories:restore-defaults` 三支端點，皆於
    [contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml)
    宣告，`openapi: 3.2.0` 字串。
  - 同 PR 將同步更新根目錄 `openapi.yaml` 加入相同端點與 schema
    （`Category` 移除 `isHidden`、新增 `CategoryReorderRequest`、
    `CategoryMoveRequest`），符合憲章 Principle II 規則 #2。
  - 共用 schemas（`Category`、`CategoryUpsert`、`CategoryReorderRequest`、
    `CategoryMoveRequest`、`Error`）以 `components.schemas` + `$ref` 表達；
    所有端點宣告 `security: [{ cookieAuth: [] }]`。
  - `info.version` 沿用 `4.23.0`（002 已 bump 至此）；本 PR 因新增端點屬
    minor，bump 至 `4.24.0`（同步寫入 `openapi.yaml` 與 `changelog.json`，
    見 tasks.md）。
- **Development Workflow Gate**：✅ PASS
  - 功能分支 `003-categories` 已由 `create-new-feature.ps1` 建立。
  - 實作完成後將同步更新 `changelog.json` 新增 release entry、`SRS.md`
    版本歷史。
  - 含 schema migration（移除 `is_hidden`、新增 `deleted_defaults` 表、
    新增索引、預設樹重新定義）屬破壞性變更；PR 描述將以繁體中文列出
    遷移步驟（見 [data-model.md §3 Migration](./data-model.md) 與
    [quickstart.md §5](./quickstart.md)）。
  - API 變更與實作於同一 PR 更新契約，禁止「先實作後補契約」順序。

無憲章違反，[Complexity Tracking](#complexity-tracking) 記錄兩項風險（CT-1、
CT-2）以利審查。

## Project Structure

### Documentation (this feature)

```text
specs/003-categories/
├── plan.md                          # 本檔（/speckit.plan 產出）
├── research.md                      # Phase 0：技術決策與替代方案
├── data-model.md                    # Phase 1：資料表 schema 與 migration
├── quickstart.md                    # Phase 1：最短驗證流程
├── contracts/
│   └── categories.openapi.yaml      # Phase 1：本功能子契約（openapi: 3.2.0）
├── checklists/
│   └── requirements.md              # /speckit.specify 產出
├── spec.md                          # /speckit.specify + 3 輪 /speckit.clarify
└── tasks.md                         # Phase 2（/speckit.tasks 尚未產生）
```

### Source Code (repository root)

沿用 001/002 既有單體結構；本功能不新增頂層目錄、不新增 `lib/` 子模組
（既有 `lib/moneyDecimal.js`／`exchangeRateCache.js`／`taipeiTime.js` 與本
功能無關），所有邏輯皆於 `server.js` 與 `app.js` 內就地擴充：

```text
/（repo root）
├── server.js                        # 既有；本功能於下列區段擴充：
│                                    #  - initDatabase()：移除 is_hidden、
│                                    #    新增 deleted_defaults 表與索引
│                                    #  - defaultSubcategories 常數：依
│                                    #    FR-008 重新定義
│                                    #  - createDefaultsForUser()：依新預
│                                    #    設樹建立 8 支出 + 5 收入父分類
│                                    #    及其全部子分類
│                                    #  - backfillDefaultsForUser()（取代
│                                    #    既有 migrateDefaultSubcategories）：
│                                    #    比對 deleted_defaults 後補建
│                                    #  - isValidColor()：收緊為 #RRGGBB
│                                    #  - /api/categories/* 路由群：補強
│                                    #    既有 GET/POST/PUT/DELETE，新增
│                                    #    PATCH/:reorder/:restore-defaults
│                                    #  - /api/transactions POST/PATCH：
│                                    #    補上 leaf-only 驗證單行
├── app.js                           # 既有；本功能新增「分類管理頁」：
│                                    #  - 雙區塊（支出在上、收入在下）
│                                    #  - HTML5 原生拖曳排序（同層）
│                                    #  - 編輯 modal（type 為 read-only）
│                                    #  - 子分類「改父分類」下拉
│                                    #  - 「還原預設分類」按鈕
├── index.html                       # 既有；補分類管理頁節點（容器 div）
├── style.css                        # 既有；新增分類管理頁雙區塊版面、
│                                    # 父分類整列、子分類網格 + 左側藍色
│                                    # 邊框 + 箭頭、拖曳中視覺回饋
├── openapi.yaml                     # 全站契約；本 PR 同步加入新端點與
│                                    # 移除 isHidden 欄位
├── database.db                      # sql.js 持久化檔（gitignore）
├── package.json / package-lock.json # **不新增任何 dependency**
├── Dockerfile / docker-compose.yml  # 不變
└── .env / .env.example              # 不新增環境變數
```

**Structure Decision**：完全沿用 single-project monolith；本功能不抽出
`lib/` 模組。理由：

1. **既有 categories CRUD 已在 server.js 內**（行 4500–4558）；新增三支端點
   仍歸於同一路由群，邏輯量約 + 200 行，不需獨立模組。
2. **預設樹常數（`defaultSubcategories`、`expenseCats`、`incomeCats`）**
   既已在 server.js 行 1149–1167 以 const 物件定義；改寫即可，不需另設模組。
3. **拖曳與顏色 UI 為純 DOM 操作**：app.js 既已包含類似的 dropdown / modal
   程式碼；分類管理頁的 ~ 400 行 UI 邏輯延續同檔案模式即可。
4. **001 / 002 已決議不採 `backend/` `frontend/` 拆分**；本功能延續以保持
   結構一致。

倉庫根的 `backend/`、`frontend/` 目錄為早期實驗，本功能不納入範圍（同
001/002 決策）。

## Complexity Tracking

### CT-1：移除 `categories.is_hidden` 欄位之 schema migration

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| 既有 `categories` 表含 `is_hidden INTEGER DEFAULT 0` 欄位（server.js:593），規格已明示移除「是否隱藏」整個功能（spec.md round 3 Q5）。SQLite 不支援 `ALTER TABLE … DROP COLUMN`（< 3.35），需以「建新表 → 複製 → 改名」方式 migrate。並非新增憲章違反，而是規格決策衍生的 schema breaking change。 | FR-002 明確禁止 `is_hidden` 欄位的存在（「系統 MUST NOT 設計或儲存『是否隱藏』屬性」）。保留欄位會留下未使用 dead code、增加未來 schema 漂移風險。 | **替代 1：保留欄位但永不寫入** — 否決原因：違反 FR-002 字面要求；未來 reviewer 看到 schema 仍有 `is_hidden` 會質疑語意；保留 dead column 屬技術債。**替代 2：軟刪除（`UPDATE … SET is_hidden = 0` 一次性）** — 否決原因：仍未消除欄位本身，只是把資料清空，違反 FR-002。 |

**Migration 策略**（詳見 [data-model.md §3.1](./data-model.md)）：

1. **同 PR 完成 schema migration**：以 `db.run('BEGIN')` 包裹，建立
   `categories_new`（不含 `is_hidden`）→ `INSERT INTO categories_new SELECT
   id, user_id, name, type, color, is_default, sort_order, parent_id FROM
   categories` → `DROP TABLE categories` → `ALTER TABLE categories_new
   RENAME TO categories` → 重建索引；任一步驟失敗 ROLLBACK。
2. **回滾計畫**：migration 前自動備份至 `database.db.bak.<timestamp>.before-003`；
   sql.js 失敗時可手動還原備份檔。
3. **既有資料保留**：所有 `id`、關聯（`transactions.category_id`）、`name`、
   `type`、`color`、`is_default`、`sort_order`、`parent_id` 完整保留，無需
   batch UPDATE。

### CT-2：FR-008 預設樹重新定義 vs 既有使用者升級

| 違反項 | 為何需要 | 較簡單替代被否決原因 |
| --- | --- | --- |
| FR-008 重新定義所有父分類的預設子分類集（含改名「公車/捷運→大眾運輸」、「3C 產品→3C 用品」、「網路/電話→網路費」、「電影→電影/影音」、「課程/補習→補習費」等，並新增「美妝保養」「訂閱服務」「瓦斯費」「牙科」「健檢」等項，且為支出「其他」與全部 5 個收入父分類補上預設子分類）。配合 FR-011（不覆寫使用者既有客製化），舊版使用者升級後其「公車/捷運」會保留（被視為使用者客製化），而新預設「大眾運輸」會被補建——兩者並存。 | FR-008 是 leaf-only（FR-013a）規則下確保「每個父分類在註冊後立即可用」的必要設計；FR-011 是保護使用者客製化的不可妥協原則。兩者交集就會產生「並存」現象，無法兩全。 | **替代 1：不重設預設樹，沿用舊版** — 否決原因：違反 spec.md round 2 Q1 答案 A（「為每個父分類重新設計一組合理的預設子分類」），且支出「其他」與所有收入父分類仍會 leaf-only 不可用。**替代 2：強制 rename 舊預設項為新名** — 否決原因：違反 FR-011（不覆寫客製化），且若使用者已將「公車/捷運」自訂改名為「大眾運輸」，rename 會造成同父下重名衝突（違反 FR-005）。 |

**緩解措施**（詳見 [data-model.md §3.4](./data-model.md) 與
[quickstart.md §5](./quickstart.md)）：

1. **CHANGELOG 顯式說明**：在 `changelog.json` 4.24.0 條目以繁體中文列出
   「預設子分類已調整；既有使用者的舊版預設項視為自訂保留，新版預設項會於
   下次登入時自動補建並可能與舊版並存」。
2. **使用者操作建議**：在分類管理頁的「還原預設分類」按鈕旁加上
   tooltip：「若您未曾刪除任何預設分類，補建已自動完成；若想清理同名舊版
   預設項，請手動刪除（無交易者可直接刪）」。
3. **不擾動現網資料**：本系統屬第一版上線（spec round 4 報告中已指出尚無
   「舊使用者」），故本 CT-2 屬未來性風險，僅於 CHANGELOG 與 tooltip 處留
   引導，不主動 rename / merge / cleanup 任何使用者資料。

**為何記入 Complexity Tracking 而非直接通過**：此設計選擇隱含「舊預設項
可能與新預設項並存」之長期狀態，雖無憲章違反，仍須顯式記錄供 reviewer
確認規格與實作之一致性，並讓未來迭代者理解此處有意為之。
