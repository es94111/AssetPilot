---
description: "Task list for 003-categories implementation"
---

# Tasks: 分類系統（Category System）

**Input**：Design documents from `/specs/003-categories/`
**Prerequisites**：[plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml)、[quickstart.md](./quickstart.md)

**Tests**：本功能沿用 001/002 既有「無自動化測試框架」決策，僅以 [quickstart.md](./quickstart.md) 人工驗證 + `redocly lint` 為驗收依據（[research.md §7](./research.md)）。下列任務不含 test 任務。

**Organization**：依 [spec.md](./spec.md) 三個 user story 分組（US1：P1 預設樹自動建立／US2：P1 兩層階層 CRUD／US3：P2 安全刪除），每組可獨立交付。

**API 路徑命名**：所有自訂方法（reorder、restore-defaults）一律採斜線形式，例 `POST /api/categories/reorder`、`POST /api/categories/restore-defaults`，**不**使用 Google AIP-136 冒號形式（避開 Express 5 / path-to-regexp 對 `:` 的保留語意）。

## Format：`[ID] [P?] [Story?] Description with file path`

- **[P]**：可並行（不同檔案、無相互依賴）
- **[US?]**：對應 user story；Setup／Foundational／Polish 階段不帶此標記

## Path Conventions

- 單體 Web service；既有單一 `server.js` + 根目錄 SPA（`index.html` / `app.js` / `style.css`）。本功能**不**新增 `lib/` 子模組（[plan.md §Structure Decision](./plan.md)）。

---

## Phase 1：Setup（共用基礎建設）

**Purpose**：環境檢查與資料備份；本功能無新增 dependency／環境變數。

- [X] T001 確認執行環境符合 [plan.md Technical Context](./plan.md)：本機 Node.js 24+（`node -v` ≥ v24）、`npm ci` 完成且**未新增任何套件**（git diff `package.json`／`package-lock.json` 僅應有先前已加入的 `engines` 欄位變動）；`Dockerfile` 第 1 行為 `FROM node:26-alpine`
- [X] T002 [P] 於 `server.js` 既有 migration 入口（`initDatabase()` 開頭，於任何 schema 變更前）以 `fs.copyFileSync(DB_PATH, DB_PATH + '.bak.' + Date.now() + '.before-003')` 寫入備份；備份失敗 throw 並中止啟動

---

## Phase 2：Foundational（阻擋所有 user story 的前置基礎）

**Purpose**：Schema migration、共用常數、共用驗證函式。所有 user story 任務必須在本階段完成後才能開始。

**⚠️ CRITICAL**：T003～T008 完成後才能進入 Phase 3。

- [X] T003 於 `server.js` `initDatabase()` 內新增 `migrateTo003_dropIsHidden()`：以 `PRAGMA table_info(categories)` 偵測 `is_hidden` 欄位是否存在；若存在則執行 [data-model.md §3.1](./data-model.md) 之 rebuild 流程（`BEGIN` → 建 `categories_new` → `INSERT … SELECT id, user_id, name, type, color, is_default, sort_order, parent_id` → `DROP categories` → `ALTER … RENAME` → `COMMIT`）；冪等：第二次執行時 PRAGMA 已無 `is_hidden`，直接 return
- [X] T004 於 `server.js` `initDatabase()` 內新增 `db.run("CREATE TABLE IF NOT EXISTS deleted_defaults (user_id TEXT NOT NULL, default_key TEXT NOT NULL, deleted_at INTEGER DEFAULT 0, PRIMARY KEY (user_id, default_key))")`，放在 categories 表建立後
- [X] T005 於 `server.js` `initDatabase()` 索引建立區段（既有 `CREATE INDEX IF NOT EXISTS …` 群組）新增 `CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order)` 與 `CREATE INDEX IF NOT EXISTS idx_cat_user_type ON categories(user_id, type)`
- [X] T006 於 `server.js` 收緊 `isValidColor`（既有行 1264）：改為 `function isValidColor(c) { return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c); }`；空字串、null、`#abc`、`#RRGGBBAA`、命名色一律拒絕（FR-020、FR-021、[research.md §2](./research.md)）
- [X] T007 [P] 於 `server.js` 既有 `defaultSubcategories` const（行 1149）替換為三組常數 `DEFAULT_EXPENSE_PARENTS`、`DEFAULT_INCOME_PARENTS`、`DEFAULT_SUBCATEGORIES`（後者為 `{ expense: { ... }, income: { ... } }` 巢狀結構，避免「其他」鍵衝突）；內容對齊 [research.md §3](./research.md) 的完整列舉（13 父分類 + 56 子分類）
- [X] T008 [P] 於 `server.js` 新增 helper `categoryDefaultKey(type, parentName, name)`：父分類傳 `(type, name)`、`parentName=null` 時回傳 `"<type>:<name>"`；子分類傳全部三參數，回傳 `"<type>:<parentName>:<name>"`；冒號分隔

**Checkpoint**：Foundation 完成。Phase 3+ 可開始。

---

## Phase 3：US1 — 註冊即擁有完整可用的分類樹（Priority: P1）🎯 MVP

**Goal**：新使用者註冊後立即取得完整 13 父 + 56 子預設樹；舊使用者登入時冪等補建缺漏項；補建跳過 `DeletedDefaultRegistry` 中的項目；P95 ≤ 200 ms。

**Independent Test**：依 [quickstart.md §3](./quickstart.md) 註冊新帳號 → `GET /api/categories` 回傳 69 筆且回應 JSON **無** `isHidden` 欄位；舊帳號登入後新預設項（如「美妝保養」「訂閱服務」）出現於分類清單。

### Implementation for User Story 1

- [X] T009 [US1] 於 `server.js` 重寫 `createDefaultsForUser(userId)`（既有行 1160）：使用 T007 的常數依序建立 8 個支出父分類 + 5 個收入父分類 + 各自全部預設子分類；`is_default=1`；`sort_order` 由 1 起遞增；保留既有「現金」帳戶與 `user_settings` 初始化（行 1186 之後不動）
- [X] T010 [US1] 於 `server.js` 新增 `backfillDefaultsForUser(userId)`：依 [data-model.md §3.4](./data-model.md) 演算法實作（先讀 `deleted_defaults` 為 Set，再對 `expense`／`income` 兩 type 走訪 parents → subs，依 `(user_id, type, name)` 與 `(user_id, parent_id, name)` 比對既有，跳過 deleted_defaults 與既有項，僅 INSERT 缺漏；同 `BEGIN…COMMIT` 內執行）
- [X] T011 [US1] 於 `server.js` 將既有 `migrateDefaultSubcategories()`（行 1124）改名為 `backfillDefaultsForAllUsers()` 並改為呼叫 T010 的 `backfillDefaultsForUser(user_id)`（取代既有迴圈內邏輯）；`initDatabase()` 末段對 `migrateDefaultSubcategories()` 的呼叫（行 781）同步更新呼叫名
- [X] T012 [US1] 於 `server.js` 既有登入流程末段（在簽發 JWT 並寫回 cookie **之前**）插入 `try { backfillDefaultsForUser(userId); } catch (e) { console.error('[003-backfill]', e); }`；同步呼叫，失敗不阻擋登入（FR-010b）。**識別三條登入路徑步驟**：先 `grep -n "jwt.sign\|setAuthCookie\|res.cookie.*authToken" server.js` 取得所有簽 token 的位置；對應期望命中：(a) `POST /api/login`（一般帳密；行號於實作時 grep 補上）、(b) `POST /api/google-login`（SSO；若該路由不存在於本專案則略過此條，實作時以 `grep -n "google-login\|googleLogin" server.js` 確認）、(c) Passkey 認證完成處理（搜尋 `verifyAuthentication\|webauthn` 區段）。每命中一條路徑即在 token 簽發前插入相同 try/catch；不漏不重
- [X] T013 [US1] 於 `server.js` `GET /api/categories`（既有行 4500）回應映射移除 `isHidden: !!r.is_hidden`，改用 explicit SELECT 欄位列表 `SELECT id, user_id, name, type, color, is_default, sort_order, parent_id` + 對應 mapping `{ id, name, type, color, isDefault: !!r.is_default, sortOrder: r.sort_order, parentId: r.parent_id || '' }`

**Checkpoint**：US1 可獨立驗收 — 新／舊使用者皆能取得完整預設樹且補建效能達標。

---

## Phase 4：US2 — 用兩層階層組織自己的分類（Priority: P1）

**Goal**：使用者可新增、編輯、跨父歸屬移動、拖曳排序父／子分類；type 不可變；分類管理頁雙區塊；UI 完全使用原生 HTML5 drag-and-drop 與 `<input type="color">`。

**Independent Test**：依 [quickstart.md §6 §7 §11](./quickstart.md) 新增父分類「寵物」+ 3 子分類；拖曳重排；把「停車費」從交通移到居住；編輯 modal 中 type 為 read-only；變更後 F5 持久化。

### 後端 API（Implementation for User Story 2）

- [X] T014 [P] [US2] 於 `server.js` `POST /api/categories`（既有行 4505）強化驗證：`color` 用 T006 收緊版；父分類路徑（`parentId === ''`）改用 `(user_id, type, name)` 唯一檢查（FR-005a）；子分類路徑保持 `(user_id, parent_id, name)`（既有，FR-005）；補上「parent.parent_id === ''」驗證（拒絕兩層以上，FR-001）
- [X] T015 [P] [US2] 於 `server.js` `PUT /api/categories/{id}`（既有行 4526）：UPDATE SQL 僅動 `name, color`（既有行為已正確，且符合修訂版 FR-014「PUT 不負責 sortOrder／parentId」）；新增 type 變更拒絕邏輯（若 body 含 `type` 欄位且值與既有 `cat.type` 不同 → `400 {"error":"分類類型不可變更"}`；FR-014c）；body 中的 `parentId` 與 `sortOrder` 兩欄位**靜默忽略**（不轉 400，與修訂版 FR-014 一致：拖曳排序由 `POST /api/categories/reorder` 專責、跨父歸屬由 `PATCH /api/categories/{id}` 專責）
- [X] T016 [US2] 於 `server.js` 新增 `app.patch('/api/categories/:id', …)`：依 [data-model.md §4.3](./data-model.md) 實作「移動子分類至另一父分類」；body `{ parentId: <newParentId> }`；驗證項目：(1) 此分類為子分類（`parent_id !== ''`），(2) `newParentId` 存在且屬使用者、`parent_id === ''`，(3) `type` 一致（FR-004），(4) `(user_id, newParentId, name)` 唯一（FR-005、FR-016），(5) `newParentId !== id`（防自指向）；UPDATE 設 `parent_id = newParentId, sort_order = MAX(sort_order WHERE user_id=? AND parent_id=newParentId)+1`；不動 `transactions.category_id`（FR-014b、FR-014d）
- [X] T017 [US2] 於 `server.js` 新增 `app.post('/api/categories/reorder', …)`：依 [data-model.md §4.4](./data-model.md) 實作；body `{ scope: "parents:expense"|"parents:income"|"children:<parentId>", items: [{ id, sortOrder }] }`；驗證：scope 合法 + 所有 id 屬使用者 + 所有 id 同 scope（即 type+parent_id 一致，FR-024b）；以 `BEGIN…COMMIT` 包覆批次 UPDATE
- [X] T018 [P] [US2] 於 `server.js` `POST /api/transactions`（002 既有）與 `PATCH /api/transactions/{id}`（002 既有）的 `category_id` 驗證末段補上 leaf-only 檢查（[research.md §6](./research.md)）：查 `categories.parent_id`，若為空字串 → `400 {"error":"交易必須指派至子分類，不能直接掛在父分類底下"}`（FR-013a）

### 前端 UI（Implementation for User Story 2，續）

- [X] T019 [P] [US2] 於 `index.html` 既有 SPA 結構新增分類管理頁節點：`<section id="page-categories">` 內含 `<div class="cat-section" data-type="expense">` 與 `<div class="cat-section" data-type="income">` 兩個區塊容器；於主導覽列加入「分類管理」入口（位置與既有「帳戶」「交易」並排）
- [X] T020 [US2] 於 `app.js` 新增 `renderCategoryPage()`：呼叫 `GET /api/categories` 後，依 `type` 分組為 expense／income，再依 `parentId === ''` 篩出父分類、依 `sortOrder` 排序；先渲染 expense `cat-section`（標題「支出」+ 8 父列）、再渲染 income `cat-section`（標題「收入」+ 5 父列）；每個父列下緊接其子分類網格（FR-022、FR-022a、FR-023）；中間以 `<hr class="cat-section-divider">` 分隔
- [X] T021 [US2] 於 `app.js` 為父列 `<div class="category-row" draggable="true" data-id="…" data-scope="parents:<type>">` 與子分類網格項目 `<div class="subcategory-cell" draggable="true" data-id="…" data-scope="children:<parentId>">` 綁定原生 drag 事件：`dragstart`／`dragover`（須 `preventDefault()`）／`dragenter`／`dragleave`／`drop`／`dragend`；drop 時比對兩端 `data-scope` 相同才接受（[research.md §1](./research.md)）；落定後計算新 sortOrder 序列，呼叫 `POST /api/categories/reorder` 一次性更新（FR-024a/b）；無任何外部拖曳函式庫
- [X] T022 [US2] 於 `app.js` 新增「新增／編輯分類」modal：欄位含 `name`（必填）／`color`（HTML5 `<input type="color">`）；type 欄位**新增模式**為 radio 可選（expense/income）、**編輯模式**為 disabled radio + 提示文字「分類類型一經建立不可變更」（FR-014c）；新增子分類時 type 自動繼承父分類且隱藏該欄；提交呼叫 POST 或 PUT；錯誤訊息直接顯示後端 `error` 欄位
- [X] T023 [US2] 於 `app.js` 編輯子分類 modal 額外加上「移到另一父分類」`<select>`：選項為**同 type** 的所有父分類；選擇不同於目前的父分類後送出，呼叫 `PATCH /api/categories/{id}` 帶 `{ parentId: newParentId }`；前端對於父分類則隱藏此下拉
- [X] T024 [P] [US2] 於 `style.css` 新增分類管理頁樣式：`.cat-section`（區塊）、`.cat-section-title`（區塊標題）、`.cat-section-divider`（分隔線）、`.category-row`（父列：整列寬度、左色塊、右側 `+`／`✏️` 按鈕）、`.subcategory-grid`（子分類 CSS Grid 佈局，3 欄響應式）、`.subcategory-cell`（縮排、左側 4px 藍色邊框 `border-left: 4px solid #3b82f6`、箭頭 `▸` 前綴）、`.dragging`（拖曳中：opacity 0.5）、`.drag-over`（合法 drop target 高亮）、`.drag-forbidden`（不合法 target 紅色框）

**Checkpoint**：US1 + US2 同時可獨立運作 — 預設樹完整、可 CRUD、可拖曳重排、可跨父歸屬移動。

---

## Phase 5：US3 — 安全地刪除不再需要的分類（Priority: P2）

**Goal**：刪除規則保護有交易的分類；連帶刪除整棵樹時對 `DeletedDefaultRegistry` 對稱寫入；提供「還原預設分類」入口。

**Independent Test**：依 [quickstart.md §8](./quickstart.md)：嘗試刪除有交易的子分類 → 400；刪除無交易的預設子分類 → 200 且 `deleted_defaults` 多 1 列；登出再登入 → 該預設項未被自動補回；點還原 → 補回。

### 後端 API（Implementation for User Story 3）

- [X] T025 [US3] 於 `server.js` `DELETE /api/categories/{id}`（既有行 4539）按 [data-model.md §4.5](./data-model.md) 強化：包整個刪除流程於 `BEGIN…COMMIT`；對被刪除的 `is_default=1` 子分類：先 SELECT 該子分類所屬父分類的 name → 用 T008 helper `categoryDefaultKey(type, parentName, name)` 生 key → `INSERT OR REPLACE INTO deleted_defaults (user_id, default_key, deleted_at) VALUES (?, ?, Date.now())`；對被連帶刪除的整棵樹：父分類本身（若 `is_default=1`）+ 每個 `is_default=1` 子分類各別寫入（FR-011b、FR-011b1）
- [X] T026 [US3] 於 `server.js` 新增 `app.post('/api/categories/restore-defaults', …)`：`BEGIN` → `DELETE FROM deleted_defaults WHERE user_id = ?`（記錄刪除前列數為 `cleared`）→ 呼叫 `backfillDefaultsForUser(userId)`（內部統計 INSERT 數）→ `COMMIT`；回傳 `{ ok: true, restored: N }`；非破壞性：絕不 UPDATE 既有分類（FR-011d、FR-011e）

### 前端 UI（Implementation for User Story 3，續）

- [X] T027 [P] [US3] 於 `app.js` 在分類管理頁右上角新增「補回過去刪除的預設分類」按鈕（**禁用「重置」「恢復出廠」字眼**，FR-011f）；點擊後彈出確認 modal：「將補回您過去刪除的預設分類；不會修改任何現有分類。」；確認後呼叫 `POST /api/categories/restore-defaults`；成功後若 `restored === 0` 顯示「目前沒有需要補回的預設分類」、否則顯示「已補回 N 個分類」並重新呼叫 `renderCategoryPage()`
- [X] T028 [P] [US3] 於 `app.js` 強化既有分類「刪除」按鈕的二次確認 modal：父分類列出「將連帶刪除底下所有子分類」+ 子分類數；子分類則顯示分類名；錯誤訊息（如「此分類下有交易記錄」）以 toast 呈現

**Checkpoint**：所有 user story 獨立可運作。整個 003 功能可端到端驗證。

---

## Phase 6：Polish & Cross-Cutting Concerns

**Purpose**：契約／版本／文件對齊、執行 quickstart 驗收。

- [X] T029 [P] 於根目錄 `openapi.yaml` 修改 `Category` schema（行 2274）：移除 `isHidden` 屬性（其原本即不在 `required` 內，但仍須移除 properties 行）
- [X] T030 [P] 於根目錄 `openapi.yaml` `components.schemas` 新增 `CategoryEdit`、`CategoryMoveRequest`、`CategoryReorderRequest`、`CategoryReorderItem`、`RestoreDefaultsResponse` 五個 schema，內容對齊 [contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml)
- [X] T031 [P] 於根目錄 `openapi.yaml` `paths` 新增 `PATCH /api/categories/{id}`、`POST /api/categories/reorder`、`POST /api/categories/restore-defaults` 三條路徑（路徑採斜線形式，與 server.js T016／T017／T026 一致），含 `security: [{ cookieAuth: [] }]`
- [X] T032 於根目錄 `openapi.yaml` `info.version` 由 `4.23.0` bump 至 `4.24.0`；同步檢查 [contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml) `info.version` 已為 `4.24.0`（已於 plan 階段設定）
- [X] T033 [P] 於 `changelog.json` 在 `versions` 陣列頂端新增 4.24.0 條目（保留既有條目格式）：`{"version":"4.24.0","date":"2026-04-25","title":"分類系統重整：兩層階層、預設樹補建、拖曳排序、刪除追蹤","changes":[…]}`；`changes` 至少涵蓋：(a) 移除「是否隱藏」屬性、(b) 預設子分類重新設計（含支出「其他」與全部收入分類）、(c) 新增 `PATCH /api/categories/{id}`／`/reorder`／`/restore-defaults` 端點、(d) 引入 `DeletedDefaultRegistry`、(e) 收緊顏色驗證至 `#RRGGBB`、(f) 升級 Dockerfile 至 Node 26；`currentVersion` 同步更新為 `4.24.0`
- [X] T034 [P] 於 `SRS.md` 版本歷史區段新增 4.24.0 條目；於對應分類功能段落更新規格描述（移除「隱藏」相關文字、補上拖曳排序與還原預設）
- [X] T035 [P] 執行 `npx @redocly/cli lint openapi.yaml` 與 `npx @redocly/cli lint specs/003-categories/contracts/categories.openapi.yaml`；兩者皆需 `0 errors`
- [X] T036 依 [quickstart.md §3 ~ §11](./quickstart.md) 逐節執行人工驗證並勾選 §12 checklist；若任一節失敗，回到對應 phase 修正

---

## Dependencies & Execution Order

### Phase 依賴

- **Phase 1 (Setup)**：無依賴；T001 必先於 T002（驗證環境後才啟用備份邏輯）
- **Phase 2 (Foundational)**：依賴 Phase 1 完成；**阻擋 Phase 3+**
- **Phase 3 (US1)**：依賴 Phase 2；可與 Phase 4／5 並行（不同團隊）
- **Phase 4 (US2)**：依賴 Phase 2；可與 Phase 3／5 並行
- **Phase 5 (US3)**：依賴 Phase 2 + Phase 3 中的 T010（`backfillDefaultsForUser` 為 T026 「還原」所用）+ Phase 2 中的 T008（`categoryDefaultKey` 為 T025 寫入 registry 所用）
- **Phase 6 (Polish)**：依賴所有 user story phase 完成

### User Story 依賴

- **US1 (P1)**：可在 Phase 2 後立即開始；無依賴其他 story
- **US2 (P1)**：可在 Phase 2 後立即開始；後端強化（T014/T015）依賴 T006 顏色 helper 與 T007 常數結構
- **US3 (P2)**：T025 寫入 `deleted_defaults` 依賴 T008 helper；T026 還原依賴 T010 `backfillDefaultsForUser`；故 US3 在 US1（至少 T008、T010 完成）之後啟動最佳

### 任務內細節（避免 server.js 同檔案 merge conflict）

- T003 → T004 → T005（同 `initDatabase()` 連續區段，順序執行）
- T009 → T010 → T011 → T012（同 `server.js` 預設樹／補建區段，順序執行）
- T020 → T021 → T022 → T023（同 `app.js` 分類管理頁區段，順序執行）

### 標記為 [P] 的任務（可並行）

T002／T007／T008／T014／T015／T018／T019／T024／T027／T028／T029／T030／T031／T033／T034／T035 共 **16 個** [P] 任務。

---

## Parallel Example：User Story 2

```bash
# 後端三個既有端點強化可並行（皆於 server.js 不同 handler 區段）：
Task: T014 強化 POST /api/categories（FR-005a 唯一鍵 + FR-001 拒絕兩層以上）
Task: T015 強化 PUT /api/categories/{id}（拒絕 type/parentId/sortOrder 變更）
Task: T018 transactions 端點補 leaf-only 驗證

# 前端骨架可與後端並行：
Task: T019 index.html 新增 page-categories 區塊
Task: T024 style.css 新增分類管理頁樣式
```

---

## Implementation Strategy

### MVP First（US1 only）

1. 完成 Phase 1（T001、T002）
2. 完成 Phase 2（T003～T008，schema migration、常數、helper、isValidColor）
3. 完成 Phase 3（T009～T013）
4. **STOP & VALIDATE**：依 [quickstart.md §3](./quickstart.md) 註冊新使用者 → 取得 69 筆預設項；依 §10 驗證補建 P95 < 200 ms
5. MVP 可上線（**注意**：MVP 僅可看見預設樹，尚不可編輯／刪除；通常仍需 US2/US3 才算可用，但本步驟用於切分風險）

### Incremental Delivery

1. Phase 1 + Phase 2 → 基礎與 schema 就緒
2. + US1（Phase 3）→ 預設樹建立／補建可運作 → demo
3. + US2（Phase 4）→ 完整 CRUD + 拖曳 + 雙區塊 UI → demo（**功能可上線**）
4. + US3（Phase 5）→ 刪除追蹤 + 還原 → demo
5. + Polish（Phase 6）→ 契約／版本／文件對齊 → 合併 PR

### Parallel Team Strategy

於 Phase 2 結束後：

- 開發者 A：US1（T009～T013，server.js 後端）
- 開發者 B：US2 後端（T014～T018，server.js）
- 開發者 C：US2 前端（T019～T024，index.html / app.js / style.css）
- 開發者 D：US3（T025～T028，待 A 完成 T010 後啟動）
- 文件／契約（Phase 6 部分）可由任一人於空檔處理 T029～T034

---

## 任務數量總覽

| Phase | 任務數 | 並行可能 |
| --- | --- | --- |
| Phase 1：Setup | 2 | T002 [P] |
| Phase 2：Foundational | 6 | T007／T008 [P] |
| Phase 3：US1 | 5 | 同檔案順序執行 |
| Phase 4：US2 | 11 | T014／T015／T018／T019／T024 [P] |
| Phase 5：US3 | 4 | T027／T028 [P] |
| Phase 6：Polish | 8 | T029／T030／T031／T033／T034／T035 [P] |
| **總計** | **36** | **約 16 個 [P] 任務** |

## Independent Test 摘要

| Story | Independent Test |
| --- | --- |
| US1 | 註冊新使用者 → `GET /api/categories` 回 69 筆且無 `isHidden` 欄位；補建 P95 < 200 ms |
| US2 | 新增父分類「寵物」+ 3 子分類 → 拖曳重排 → 把「停車費」移到「居住」→ F5 後狀態持久化；type 欄位 read-only |
| US3 | 刪除有交易的子分類 → 400；刪除無交易預設子分類 → 200 + `deleted_defaults` 寫入 → 登出登入未復活 → 點還原補回 |

## Format Validation

✅ 全部 36 個任務皆採 `- [ ] T### [P?] [US?] Description with file path` 格式。
✅ Setup／Foundational／Polish 任務無 `[Story]` 標籤。
✅ US1～US3 任務皆帶對應 `[US1]`／`[US2]`／`[US3]` 標籤。
✅ 每個任務皆指明具體檔案路徑（`server.js`／`app.js`／`index.html`／`style.css`／`openapi.yaml`／`changelog.json`／`SRS.md`／`Dockerfile` 或 spec 內衍生產物）。

## Notes

- [P] = 不同檔案或獨立區段，無依賴
- [US?] = 對應 user story，便於追蹤
- 每 user story 完成後即為可獨立驗收的 increment
- 提交建議：每完成一個 task 或一組邏輯相關 task 即 commit
- 任一 checkpoint 可暫停以驗證該 story 獨立性
- 避免：模糊任務、同檔案衝突、跨 story 強依賴破壞 story 獨立性
