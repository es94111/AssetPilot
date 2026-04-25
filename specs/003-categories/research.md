# Phase 0 研究紀錄：分類系統（Category System）

**Branch**: `003-categories`｜**Date**: 2026-04-25｜**Plan**: [plan.md](./plan.md)

本檔記錄落地 003 規格時的關鍵技術決策、替代方案，與每個決策對應的 FR / CT
編號。原則：**沿用 001/002 既有技術棧，零新增 dependency**（使用者於
`/speckit.plan` 命令明示）。

## §1 拖曳排序的實作方式（FR-024a/b、CT 無）

**Decision**：使用 HTML5 原生 `draggable` 屬性 + `dragstart`／`dragover`／
`dragenter`／`dragleave`／`drop`／`dragend` 事件實作；不引入任何拖曳函式庫。

**Rationale**：

1. **零新依賴**符合本計畫的核心限制條件；引入 dnd-kit／SortableJS／
   Sortable.js 任一者皆需修改 `package.json` 或 `index.html` 加入 CDN +
   SRI，違反使用者明示要求。
2. **行為足夠簡單**：分類管理頁僅需「同層拖曳排序」（FR-024b 已禁止跨父
   拖曳，跨父歸屬走 FR-014a 的編輯對話框路徑）；HTML5 native API 對單列／
   單網格的同層 reorder 完全勝任。
3. **瀏覽器支援**：Chrome／Firefox／Edge／Safari 皆全面支援；既有專案的
   target platform（HTTPS 部署、現代瀏覽器）無相容性問題。
4. **效能**：拖曳完成只觸發一次 `POST :reorder` 批次寫入，無前端動畫框架
   負擔。
5. **觸控相容性**：HTML5 native drag-and-drop 在 iOS Safari 與 Android
   Chrome 觸控環境支援度與 Library 方案接近（皆需若干 polyfill 或 long-press
   觸發）；分類管理為低頻桌面操作，本計畫不投入觸控專案優化。

**Alternatives considered**：

- `Sortable.js`（CDN）：成熟、touch-friendly、視覺回饋豐富；**否決**——
  違反零依賴限制，且功能過剩（本計畫只需單層 reorder，不需巢狀／多列／
  動畫等）。
- `dnd-kit`（npm）：現代 React 拖曳方案；**否決**——本專案前端非 React，
  且需新增 npm dep。
- 自訂上下移動按鈕（無拖曳）：**否決**——已於 round 2 Q3 明確排除（拖曳
  最直觀，按鈕在分類數一多時極繁瑣）。

**實作要點**（將反映於 tasks.md）：

- 父分類 `<div class="category-row" draggable="true">`、子分類
  `<div class="subcategory-cell" draggable="true">`。
- `dragstart`：記錄被拖曳元素的 `id` 與 `parent_id` 至 `dataTransfer`。
- `dragover`：呼叫 `event.preventDefault()` 以允許 drop；以 `dataset.type`
  與 `dataset.parentId` 比對，僅同層接受 drop（即 FR-024b：parent 列只接受
  parent 列、同 parent 的 sub 只接受同 parent 的 sub）。
- `drop`：依放下位置計算新 `sort_order` 序列（前端先樂觀更新 DOM）→
  `POST /api/categories/reorder` body 為 `{ scope, items: [{ id, sortOrder }] }`，
  scope 為 `"parents:expense"`／`"parents:income"`／`"children:<parentId>"`；
  後端在單一 `BEGIN…COMMIT` 內 UPDATE 所有 ID 的 `sort_order`。

## §2 顏色驗證與 UI 元件（FR-020、FR-021）

**Decision**：

- 後端：`isValidColor` 收緊為 `/^#[0-9A-Fa-f]{6}$/`，僅接受 6 位 hex 含
  `#` 開頭共 7 字元；空值與 null 一律拒絕（**改變**：既有實作 `!c ||
  /^#[0-9a-fA-F]{3,8}$/.test(c)` 接受 3/4/6/8 位且接受空字串，過於寬鬆）。
- 前端：使用瀏覽器原生 `<input type="color">`；瀏覽器原生輸出值即為
  `#rrggbb` 小寫格式，符合後端 regex（不分大小寫）。

**Rationale**：

1. FR-020 明確要求僅接受 `#RRGGBB` 6 位；FR-021 強調此驗證「目的明確為
   防止 CSS 注入攻擊」，3 位縮寫與 8 位含 alpha 都不在規格授權範圍。
2. 原生 `<input type="color">` 由瀏覽器內建色票面板呈現，UX 一致、零
   依賴；無須引入 react-color、pickr 等第三方元件。
3. 後端必須驗證（不能僅信任前端）：直接 PUT/PATCH 仍可繞過前端，因此後端
   regex 是 CSS 注入的唯一防線。

**Alternatives considered**：

- 維持既有 `[3,8]` regex：**否決**——違反 FR-020。
- 引入 `pickr`／`@simonwep/pickr` 提供進階調色：**否決**——零依賴限制，
  且使用者輸入未要求進階色票（梯度／HSL 等）。
- 由系統提供固定色票限選：**否決**——使用者能自訂顏色已是 FR-002 既定
  屬性，限選會造成回歸。

## §3 預設樹的雙語意（系統常數 vs 使用者資料）

**Decision**：預設樹定義為 `server.js` 內的兩個 const 常數：

```js
// 8 個支出父分類，name → [color]
const DEFAULT_EXPENSE_PARENTS = [
  ['餐飲', '#ef4444'], ['交通', '#f97316'], ['購物', '#eab308'],
  ['娛樂', '#8b5cf6'], ['居住', '#06b6d4'], ['醫療', '#ec4899'],
  ['教育', '#3b82f6'], ['其他', '#64748b'],
];
// 5 個收入父分類，name → [color]
const DEFAULT_INCOME_PARENTS = [
  ['薪資', '#10b981'], ['獎金', '#14b8a6'], ['投資', '#6366f1'],
  ['兼職', '#f59e0b'], ['其他', '#71717a'],
];
// 父分類 name → [[sub_name, sub_color], ...]（依 FR-008 修訂版）
const DEFAULT_SUBCATEGORIES = {
  // 支出
  '餐飲': [['早餐','#fca5a5'], ['午餐','#f87171'], ['晚餐','#dc2626'], ['飲料','#fb923c'], ['點心','#fdba74']],
  '交通': [['大眾運輸','#fdba74'], ['計程車','#fb923c'], ['加油','#f97316'], ['停車費','#ea580c'], ['高鐵/火車','#c2410c']],
  '購物': [['日用品','#fde047'], ['服飾','#facc15'], ['3C用品','#eab308'], ['家電','#ca8a04'], ['美妝保養','#a16207']],
  '娛樂': [['電影/影音','#a78bfa'], ['遊戲','#8b5cf6'], ['旅遊','#7c3aed'], ['運動健身','#6d28d9'], ['訂閱服務','#5b21b6']],
  '居住': [['房租/房貸','#22d3ee'], ['水電費','#06b6d4'], ['瓦斯費','#0891b2'], ['網路費','#0e7490'], ['管理費','#155e75']],
  '醫療': [['掛號費','#f9a8d4'], ['藥品','#f472b6'], ['保健食品','#ec4899'], ['牙科','#db2777'], ['健檢','#be185d']],
  '教育': [['學費','#93c5fd'], ['書籍','#60a5fa'], ['線上課程','#3b82f6'], ['補習費','#2563eb']],
  '其他': [['雜支','#94a3b8'], ['禮金/紅包','#64748b'], ['捐款','#475569'], ['罰款','#334155']],
  // 收入
  '薪資': [['月薪','#34d399'], ['加班費','#10b981']],
  '獎金': [['年終獎金','#5eead4'], ['績效獎金','#2dd4bf'], ['節日禮金','#14b8a6']],
  '投資': [['股利','#a5b4fc'], ['利息','#818cf8'], ['資本利得','#6366f1']],
  '兼職': [['接案','#fbbf24'], ['家教','#f59e0b'], ['打工','#d97706']],
  '其他': [['退稅','#a1a1aa'], ['贈與/紅包','#71717a'], ['雜項','#52525b']],
};
```

**陷阱**：JS 物件鍵以「字串」識別，**「其他」鍵在支出與收入皆出現**將造成
鍵衝突；改以 `(type, parentName)` 元組為鍵，使用 `Map` 或巢狀物件結構：

```js
const DEFAULT_SUBCATEGORIES = {
  expense: { '其他': [...], '餐飲': [...], ... },
  income:  { '其他': [...], '薪資': [...], ... },
};
```

`backfillDefaultsForUser(userId)` 走訪兩層：先 expense 再 income；對每個父
分類，若使用者尚無同 `(type, name)` 父分類則 INSERT，再對其下每個預設子分
類查 `(user_id, parent_id, name)` 是否存在或已在 `deleted_defaults` 中，否則
INSERT。

**Rationale**：

1. spec.md round 2 Q1 已明示「為每個父分類重新設計一組合理的預設子分類」，
   含支出「其他」與全部 5 個收入父分類；此 Decision 即落地該答案。
2. 顏色採 Tailwind 色階家族系列以維持各父分類「同色系不同濃度」的子分
   類視覺；色值合法（皆 `#RRGGBB`），可立即過 FR-020 驗證。
3. 預設子分類數量控制：父分類最多 5 個子（餐飲、交通、購物、娛樂、居住、
   醫療皆 5），最少 2 個子（薪資為 2）；總計 56 個預設子分類 + 13 父分類
   = 69 筆預設項，補建單次 INSERT 上限可控（< 100 筆，遠低於 200ms 限制）。

**Alternatives considered**：

- 將預設樹移至 JSON 檔（如 `lib/defaultCategories.json`）：**否決**——增
  加 I/O 成本與檔案分散風險；既有 `defaultSubcategories` 已是內嵌 const，
  延續即可。
- 動態從資料庫表讀取「系統預設定義」：**否決**——需新增 `system_defaults`
  表，與專案既有「常數寫死於 server.js」風格不一致；且預設樹改版需走 PR
  + migration，不需 DB 表的彈性。

## §4 `DeletedDefaultRegistry` 的識別鍵設計（FR-011b、FR-011b1）

**Decision**：以新表 `deleted_defaults(user_id, default_key, deleted_at)`
存放，PK = `(user_id, default_key)`；`default_key` 為穩定字串：

- 父分類：`"<type>:<name>"`，例：`"expense:餐飲"`、`"income:薪資"`。
- 子分類：`"<type>:<parent_name>:<name>"`，例：`"expense:餐飲:早餐"`。

**Rationale**：

1. **跨 schema 改名穩定**：`default_key` 以「預設定義時的 type + 名稱階層」
   為依據，與使用者實際 `categories` 表中的 `id`（uid()）解耦；即使使用者
   自行刪除預設「早餐」、後又自行新建一個叫「早餐」的子分類（id 不同），
   `deleted_defaults` 仍能在下次補建時正確跳過該預設項。
2. **JSON 式字串較 tuple 友善 SQLite**：sql.js 不支援 array 型，字串拼
   接是最簡實作；冒號 `:` 不會出現在 type／name 中（type 限 enum，name
   為使用者可見字串但預設名都不含 `:`）。
3. **DELETE 路徑寫入**：`DELETE /api/categories/{id}` 內：
   - 若 `is_default === 1`：依其 type + name + parent.name（若為子分類）
     算出 `default_key`，`INSERT OR REPLACE INTO deleted_defaults`；
   - 若刪父分類連帶子（FR-019）：對每個被連帶刪除的 `is_default=1` 子分類
     都各別寫入 registry（FR-011b1 對稱寫入語意）。
4. **「還原預設分類」路徑**（FR-011d/e）：
   - 第一步 `DELETE FROM deleted_defaults WHERE user_id = ?`；
   - 第二步呼叫 `backfillDefaultsForUser(userId)` 補建所有當前 registry
     已空但仍缺漏的預設項；
   - **不覆寫**任何已存在分類（FR-011e）。

**Alternatives considered**：

- 在 `categories` 表加 `was_deleted` 旗標（軟刪除）：**否決**——使用者
  期待的「刪除」是真正消失（FR-019 連帶刪除子分類即明確的硬刪），保留
  資料會違反語意；且若使用者自建同名分類後再刪，旗標模型會混淆。
- 以 `(type, parent_default_id, default_id)` 三欄結構化 PK：**否決**——
  「預設定義」沒有獨立的 `default_id` 來源（系統內定義以名稱為準），
  改用 `name` 拼接才能跨版本穩定。

## §5 sql.js 不支援 `DROP COLUMN` 的 schema migration 策略（CT-1）

**Decision**：採 SQLite 標準的「rebuild」模式：

```sql
BEGIN;
CREATE TABLE categories_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('income','expense')),
  color TEXT DEFAULT '#6366f1',
  is_default INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  parent_id TEXT DEFAULT ''
);
INSERT INTO categories_new
  SELECT id, user_id, name, type, color, is_default, sort_order, parent_id
  FROM categories;
DROP TABLE categories;
ALTER TABLE categories_new RENAME TO categories;
CREATE INDEX IF NOT EXISTS idx_cat_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_cat_user_parent_sort ON categories(user_id, parent_id, sort_order);
COMMIT;
```

**Rationale**：

1. sql.js 內建 SQLite 版本未必達 3.35（支援 `DROP COLUMN`），rebuild 是
   跨版本通用解。
2. 原子性透過 `BEGIN…COMMIT` 保證；`initDatabase()` 已建立的整表 try/catch
   pattern（行 974 等）可沿用。
3. 既有 `transactions.category_id` 外鍵以字串 `id` 連動，rebuild 過程
   `id` 完全保留，無需更新交易表。
4. **migration 偵測**：以 `PRAGMA table_info(categories)` 檢查是否仍有
   `is_hidden` 欄位；若有則執行 rebuild、否則跳過（冪等）。

**Alternatives considered**：

- 直接 `ALTER TABLE categories DROP COLUMN is_hidden;`：**否決**——sql.js
  對應的 SQLite 版本可能不支援。
- 保留欄位，僅清空資料：**否決**——違反 FR-002（「MUST NOT 設計或儲存
  『是否隱藏』屬性」）。

## §6 leaf-only 驗證點（FR-013a）對既有 transaction 端點的影響

**Decision**：在 `POST /api/transactions` 與 `PATCH /api/transactions/{id}`
（002 既有路由）的 `category_id` 驗證末端，補上：

```js
if (categoryId) {
  const cat = queryOne(
    "SELECT id, parent_id FROM categories WHERE id = ? AND user_id = ?",
    [categoryId, req.userId]
  );
  if (!cat) return res.status(400).json({ error: '分類不存在或無權限' });
  if (!cat.parent_id) {
    return res.status(400).json({ error: '交易必須指派至子分類，不能直接掛在父分類底下' });
  }
}
```

**Rationale**：

1. FR-013a 明示「父分類 MUST NOT 出現在新增／編輯交易的分類選單中」；前
   端遵守即可滿足正常路徑，但**後端是不可繞過的最後防線**。
2. 既有 `assertOwned('categories', categoryId, req.userId)` 已驗證擁有
   權，本檢查在其後加入 leaf-only 即可。
3. 影響範圍極小：兩個既有 endpoint 末段補約 4 行；不改變回應 schema、
   不改變既有 200 路徑的成功語意。
4. **既有交易資料**：升級前若有交易直接掛在父分類（理論上不存在，因
   舊版前端 UI 雖未提供此選項，但若 API 直接被呼叫則可能寫入），本計
   畫不主動 migrate，僅透過 quickstart.md §5 的人工 inspection 步驟提示
   reviewer 檢查；資料層面屬「歷史可保留、未來禁止新增」狀態。

**Alternatives considered**：

- 新增資料庫 CHECK 約束：**否決**——SQLite CHECK 不支援子查詢（無法
  CHECK 「`category_id` 對應的 row 之 `parent_id != ''`」）；只能在應用
  層驗證。
- 觸發器 (trigger) 強制 leaf-only：**否決**——sql.js 觸發器支援度可，
  但應用層驗證已足，引入 trigger 反而增加維運複雜度。
- migrate 既有交易（檢查 `category_id` 並補上對應子分類）：**否決**——
  屬於 002 範疇的資料完整性，且本系統第一版上線無相關歷史資料；本計畫
  僅添加未來保護。

## §7 測試策略（沿用 001/002）

**Decision**：手動驗證流程於 [quickstart.md](./quickstart.md) 落地；不引
入新測試 dependency。

**Rationale**：

- 001/002 已明確不引入測試框架（`research.md §7` of 002）；003 延續以
  保持結構一致；專案憲章（v1.1.0）未強制要求自動化測試。
- 本功能可量測點皆能透過 quickstart.md 的人工劇本 + curl 驗證：
  1. 註冊新使用者、立即驗證預設樹完整（FR-007/FR-008、SC-001）；
  2. 嘗試刪除有交易的子分類，預期 `400`（FR-017、SC-003）；
  3. 拖曳排序後重新整理頁面、驗證順序持久化（FR-024a）；
  4. 刪除預設子分類、登出再登入、驗證未被自動補回（FR-011c）；
  5. 點「還原預設分類」、驗證該預設項補回（FR-011d/e）。
- `openapi.yaml` 一致性透過 `npx @redocly/cli lint openapi.yaml` 自動檢
  查；CI 既有步驟已包含此項。

**Alternatives considered**：

- 引入 Jest / Vitest / supertest：**否決**——零依賴限制 + 與 001/002
  決策不一致；引入後既有所有歷史程式碼皆需補測試才不留 coverage 空洞。
- 引入 Playwright / Cypress E2E：**否決**——同上；且本功能 UI 偏靜態，
  E2E 投資報酬率低。

## §8 OpenAPI 契約結構（憲章 Principle II）

**Decision**：

- **新建** `specs/003-categories/contracts/categories.openapi.yaml`，
  `openapi: 3.2.0`，僅描述本功能新增／修改的端點與 schema。
- **同 PR 更新** 根目錄 `openapi.yaml`：
  - `Category` schema：移除 `isHidden` 屬性。
  - 新增 schemas：`CategoryReorderRequest`、`CategoryMoveRequest`、
    `CategoryReorderItem`。
  - 新增端點：`PATCH /api/categories/{id}`、`POST /api/categories/reorder`、
    `POST /api/categories/restore-defaults`。
  - `info.version` bump 至 `4.24.0`，與 `changelog.json.currentVersion`
    對齊。

**Rationale**：

1. 憲章 Principle II 規則 #2：「handler 與 `paths.*` 必須同 PR 對齊」。
2. 規則 #4：共用 schema 必須以 `components.schemas` + `$ref` 表達；
   `Category` 已是 shared，直接修改該 schema 即可。
3. 所有新端點皆需驗證身分（cookie auth），sets `security: [{ cookieAuth:
   [] }]`。

**Alternatives considered**：

- 不修改根目錄 `openapi.yaml`，只寫子契約：**否決**——違反憲章 Principle
  II 規則 #2。
- 使用 OpenAPI 3.1.0 / 3.0.x：**否決**——憲章硬性要求 3.2.0。
