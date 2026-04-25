# Phase 1 快速驗證：預算與固定收支

**Branch**: `004-budgets-recurring` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔提供本功能上線後最短的可重現手動驗證流程，覆蓋 [spec.md](./spec.md) 的 5 條 user story 與所有 SC（SC-001 ~ SC-008）。所有步驟皆於本機 `npm start` 後以瀏覽器 + DevTools Network 面板執行；無自動化測試框架（與 001 / 002 / 003 一致）。

---

## 1. 前置條件

- 本機已執行 `npm install`（不需新增 dependency）。
- `node --version` ≥ 24.x（與既有部署需求一致）。
- 已備份 `database.db` 為 `database.db.bak.before-004-quickstart`（migration 會自動備份，但本機開發建議再手動拷一份）。
- `npm start` 啟動後 console 應出現：
  - `[migration 002] …`（若首次升級才有）
  - `[migration 003] …`（若首次升級才有）
  - `[migration 004] 重建 budgets 表（REAL → INTEGER）`（若首次升級才有）
  - `[migration 004] 重建 recurring 表（REAL → INTEGER/TEXT + 補欄位）`（若首次升級才有）
  - 若 self-test 全 PASS 則無 `self-test fail` 警告。
- OpenAPI lint：`npx @redocly/cli lint openapi.yaml` 與 `npx @redocly/cli lint specs/004-budgets-recurring/contracts/budgets-recurring.openapi.yaml` 皆 0 error。

---

## 2. US1 驗證（P1）：設定月度預算並在儀表板看到剩餘空間

### 2.1 整月總支出預算

1. 登入測試帳號 → 切到「預算」頁。
2. 點擊「設定整月總支出預算」→ 月份預設當月（2026-04）→ 金額輸入 `30000` → 儲存。
3. 預期：
   - 預算列表第一條出現「整月總支出 30,000 / 0」。
   - 進度條為**綠色**（< 50%）。
   - DevTools Network：`POST /api/budgets` 回 `{ ok: true, id: "..." }`；`GET /api/budgets?yearMonth=2026-04` 回應的 amount 為 INTEGER `30000`。

### 2.2 分類預算 + 唯一性

1. 點擊「新增分類預算」→ 分類下拉選單中**僅顯示**子分類（leaf-only），父分類為群組標題（FR-004）。
2. 選擇「餐飲 / 午餐」→ 金額 `3000` → 儲存。
3. 再次嘗試為「餐飲 / 午餐」新增 4000 元預算 → 預期 `409 Conflict`，錯誤訊息「該月份此分類已存在預算，請改為編輯既有預算」。

### 2.3 三段配色驗證（FR-006 + Edge Case）

模擬已用金額（在交易頁手動新增餐飲／午餐當月支出）：

| 已用 / 預算 | pct | 進度條應呈 | 百分比文字 |
| --- | --- | --- | --- |
| 1,200 / 3,000 | 40% | 綠（`--green`） | 黑色或品牌色 |
| 1,500 / 3,000 | 50% | 中性灰（`--neutral`，閾值臨界進入下段） | 同上 |
| 2,500 / 3,000 | 83% | 黃（`--yellow`） | 同上 |
| 3,200 / 3,000 | 107% | 紅（`--red`，含條身與百分比文字皆紅） | **紅色 700** |

每次調整後儀表板進度條 P95 ≤ 200ms 內反映（SC-006）。

### 2.4 月份切換 + 歷史月份

1. 進度條月份 nav 點 `<` 切到 2026-03 → 預期顯示「本月尚未設定預算」+「新增預算」入口（FR-007）。
2. 為 2024-08 建立 5,000 元餐飲預算（不限制月份範圍，FR-009a） → 切到 2024-08 應正確顯示。
3. 編輯一筆 2024-08 的歷史交易把金額從 800 改為 1,200 → 切到 2024-08 預算進度條應立即重算反映 1,200（FR-007 即時重算）。

### 2.5 刪除與編輯

1. 編輯 2026-04 餐飲預算金額為 3,500（PATCH）→ 預期回 `{ ok: true }`；進度條分母即時更新為 3,500（SC-006）。
2. 刪除該預算（DELETE）→ 進度條從儀表板消失。

---

## 3. US2 驗證（P1）：固定收支自動產生交易

### 3.1 起始日為過去日期的補產出

1. 切到「固定收支」頁 → 點「新增配方」→ 設定：
   - 類型：收入
   - 金額：`50000`（TWD）
   - 分類：薪資
   - 帳戶：薪轉戶
   - 週期：每月
   - 起始日：今日往回推 2 個月的 5 號（如 `2026-02-05`）
2. 儲存後**登出**再**重新登入** → server-side `processRecurringForUser` 應觸發。
3. 預期：交易列表多出 3 筆薪資交易（2026-02-05 / 2026-03-05 / 2026-04-05），每筆 `amount = 50000`、`source_recurring_id = <配方 id>`、`scheduled_date = <對應日期>`。
4. 配方卡片三日期應更新：起始日 2026-02-05、上次產生日 2026-04-05、下次產生日 2026-05-05。

### 3.2 起始日為今日（首產日邏輯，FR-014）

1. 新增配方：起始日設為**今日** → 儲存後登出再登入。
2. 預期：產出**1 筆**當日交易（不延後到下個週期）。

### 3.3 外幣配方（FR-016）

1. 新增配方：金額 `300`、幣別 `USD`、匯率 `32`、起始日今日、每月 → 儲存。
2. 預期：產出 1 筆交易，`amount = 9600`（TWD）、`original_amount = 300`、`fx_rate = "32"`、`currency = "USD"`。
3. 在交易編輯頁將該筆匯率改為 `31.5` → `twd_amount` 應重算為 9450；配方本身的 `fx_rate` 仍為 `"32"`（FR-021c 不溯及既往）。

### 3.4 每月 31 號月底回退（FR-022）

1. 新增配方：起始日 `2026-01-31`、每月 → 登出再登入。
2. 預期：產出至 2026-04 的應為 `2026-01-31`、`2026-02-28`、`2026-03-31`、`2026-04-30`（不跳過任何月份；2 月回退到 28；4 月回退到 30）。

### 3.5 並發冪等（FR-028 / FR-029，SC-005）

1. 在桌機開兩個 browser tab 同時登入同一帳號。
2. 預期：兩個 session 的登入 handler 各自呼叫 `processRecurringForUser`；最終每個 `(source_recurring_id, scheduled_date)` 組合只在 transactions 中出現 1 筆。
3. 用 SQL 驗證：
   ```sql
   SELECT source_recurring_id, scheduled_date, COUNT(*) AS c
   FROM transactions
   WHERE source_recurring_id IS NOT NULL
   GROUP BY source_recurring_id, scheduled_date
   HAVING c > 1;
   ```
   應為 0 筆。

### 3.6 停用配方略過（FR-017）

1. 把某啟用中的配方點 toggle 設為停用 → `last_generated` 應保留不變。
2. 登出再登入 → 該配方不應產出新交易。

---

## 4. US3 驗證（P2）：列表卡片三日期 + 待執行警示

### 4.1 啟用 + 已過下次產生日 → 待執行（FR-019）

1. 手動修改某啟用中配方的 `last_generated`（透過資料庫 SQL）使其下次產生日為**昨日** → 重整列表。
2. 預期：該卡片以**黃色預警背景**顯示；下次產生日後綴「（待執行）」。

### 4.2 停用 + 逾期 → 不顯示警示（FR-019）

1. 將上述配方 toggle 為停用。
2. 預期：卡片切為灰階；不顯示「（待執行）」字樣。

### 4.3 備註直接顯示（FR-018）

1. 編輯某配方備註為「房東：王小明」 → 卡片應直接顯示此文字，無需展開。

---

## 5. US4 驗證（P2）：佔位下拉與「需處理」狀態

### 5.1 分類被刪除 → 自動標記需處理（FR-024）

1. 建立配方 A 綁定「居住 / 房租」分類。
2. 到「分類管理」刪除該子分類（須先確認該分類無交易；可先把所有相關交易改掛到其他分類）。
3. 登出再登入 → server-side `processRecurringForUser` 偵測該分類不存在 → 自動 `UPDATE recurring SET needs_attention = 1`。
4. 預期：該配方卡片以**紅／橘色階**顯示 + ⚠ 文案「需處理：原分類／帳戶已刪除，請重新指定」（FR-024a，與黃色「待執行」分層）。

### 5.2 編輯對話框佔位下拉（FR-020）

1. 點該配方「編輯」→ 預期分類下拉頂部插入 `<option value="__deleted_category__">（原分類已刪除）</option>` 並 selected；視覺以灰字 / italic 區分。
2. 不改任何欄位、按「儲存」→ 預期 `400 Bad Request`，訊息「請先選擇有效分類」。
3. 改選一個有效子分類 → 儲存成功；`needs_attention` 自動清除為 0（FR-024b）；卡片視覺立即恢復正常。
4. 帳戶被刪除的情境同上（重複本節步驟並改測 `account_id`）。

---

## 6. US5 驗證（P2）：編輯／刪除與不溯及既往

### 6.1 編輯起始日 → 重置 last_generated（FR-021a）

1. 取一筆已自動產出 3 筆交易的配方（`last_generated = 2026-04-05`）。
2. 編輯起始日為 `2026-06-15`（未來日期） → 儲存。
3. 預期：`last_generated` 變為 NULL（透過 SQL 驗證或開 DevTools 看 GET /api/recurring 回應）。
4. 立即登出再登入 → 該配方今日仍未到 6/15，產生流程不應產出任何交易；`last_generated` 維持 NULL。
5. 待時間到 6/15 後（或手動把伺服器時間／配方 start_date 調為今日）登入 → 應產出 1 筆 6/15 交易作為首產日（FR-014）。

### 6.2 編輯週期 → 保留 last_generated（FR-021b）

1. 取一筆已自動產出 3 筆交易的配方（`last_generated = 2026-04-05`、週期每月）。
2. 編輯週期為「每週」（**不**改起始日） → 儲存。
3. 預期：`last_generated` 保留為 `2026-04-05`；下次產生日依新週期推算為 `2026-04-12`。

### 6.3 編輯業務欄位 → 不溯及既往（FR-021c）

1. 取一筆配方（金額 50,000，已產出 3 筆 50,000 交易）。
2. 編輯金額為 60,000 → 儲存。
3. 預期：歷史 3 筆交易**仍為 50,000**（不變）；`last_generated` 保留；下次產出開始為 60,000。
4. PR review 時驗證 `grep -nE "UPDATE\s+transactions" server.js` 在 PUT /api/recurring/:id handler 範圍內無任何 SQL（程式碼層護欄）。

### 6.4 刪除衍生交易不會被補回（FR-026）

1. 取一筆配方產出的歷史交易，手動刪除。
2. 登出再登入 → 該交易不會被自動補回（`last_generated` 已過該日期，產生流程不會再嘗試該日期）。

### 6.5 刪除配方不影響歷史（FR-021）

1. 刪除某有 3 筆歷史衍生交易的配方。
2. 預期：配方從列表消失；3 筆衍生交易仍保留在交易列表；`source_recurring_id` 仍指向原 ID 但 LEFT JOIN 為 NULL → UI 顯示「（來源配方已刪除）」灰字（FR-027）。

---

## 7. SC 驗收映射

| SC | 驗收方式 |
| --- | --- |
| SC-001：90 秒內完成第一次預算設定 | 手動計時 §2.1 + §2.2 |
| SC-002：120 秒內完成第一筆固定收支設定 | 手動計時 §3.1 |
| SC-003：登入時產生流程 P95 ≤ 500ms（≤ 30 筆） | DevTools Network → `POST /api/auth/login` 的 Time（含 server-side 觸發）；`console.log` 觀察 `[004-recurring] generated=N elapsed=Tms` |
| SC-004：> 30 筆時不阻塞登入頁面 | 建立 50 筆每日配方、起始日 90 天前 → 登入後 elapsed 仍 ≤ 500ms（剩餘交給 setImmediate） |
| SC-005：連續登入／登出 10 次冪等 | 自動化：寫一個 bash for 迴圈打 `/api/auth/login` 10 次，最後跑 §3.5 SQL 驗證為 0 筆 |
| SC-006：進度條 ≤ 200ms 反映 | DevTools Network → `POST /api/transactions` 後的 `GET /api/budgets` Time；額外於 `app.js` `renderBudget()` 入口與結尾以 `console.time('renderBudget')` / `console.timeEnd('renderBudget')` 標記，DevTools Performance 面板錄影前後頁可看到 render 耗時（不引入新監控 stack） |
| SC-007：90% 使用者一週後仍查看進度條 | 業務指標，本機驗證階段不適用；上線後依 access log 統計 |
| SC-008：0 筆因介面靜默清空誤儲存 | §5.2 多次嘗試「不改任何欄位、按儲存」皆被 400 拒絕 |

---

## 8. 失敗時的快速還原

若任一驗證項目失敗：

1. 停止服務（`Ctrl+C` 或 `docker compose stop`）。
2. 還原 migration 前備份：`cp database.db.bak.<timestamp>.before-004 database.db`。
3. revert 本 PR 至 003 commit：
   ```bash
   git checkout 003-categories  # 或 dev branch（已含 003 squash merge）
   ```
4. 重啟服務。
5. 在 PR 描述附上失敗截圖 + DevTools Network HAR 檔，等待修補。

歷史備份在功能驗收完成後保留 7 天再手動清除（沿用 002 / 003 約定）。

---

## 9. OpenAPI 契約驗證

```bash
npx @redocly/cli lint openapi.yaml
npx @redocly/cli lint specs/004-budgets-recurring/contracts/budgets-recurring.openapi.yaml
```

兩條皆應 0 error；若 redocly 偵測到任何 `:verb` colon-style path（憲章 Principle III 違反）將直接失敗。

---

驗證流程完成後，執行 `/speckit.tasks` 產出 Phase 2 的 tasks.md（本計畫不涵蓋）。
