# Phase 1 快速驗證：統計報表

**Branch**: `005-stats-reports` | **Date**: 2026-04-25 | **Plan**: [plan.md](./plan.md)

本檔提供本功能上線後最短的可重現手動驗證流程，覆蓋 [spec.md](./spec.md) 的 3 條 user story 與所有 SC（SC-001 ~ SC-007）。所有步驟皆於本機 `npm start` 後以瀏覽器 + DevTools Network 面板執行；無自動化測試框架（與 001 / 002 / 003 / 004 一致）。

---

## 1. 前置條件

- 本機已執行 `npm install`（**不需新增 dependency**；package.json 不變更）。
- `node --version` ≥ 24.x（與既有部署需求一致）。
- 已備份 `database.db` 為 `database.db.bak.before-005-quickstart`（migration 為純新增表，回滾安全）。
- `npm start` 啟動後 console 應出現：
  - `[migration 005] 已將 singleton 排程遷移為多筆 report_schedules`（若資料庫內既有 singleton 排程才會出現；首次升級或無排程資料則此行不出現）。
  - 若 self-test 全 PASS 則無 `self-test fail` 警告。
- OpenAPI lint：
  - `npx @redocly/cli lint openapi.yaml` 0 error。
  - `npx @redocly/cli lint specs/005-stats-reports/contracts/stats-reports.openapi.yaml` 0 error。
- 至少準備一位有交易、有預算（004 功能）、可選有持股的測試帳號。

---

## 2. US1 驗證（P1）：登入後一眼掌握本月財務狀況

### 2.1 KPI 跟隨月份切換器（FR-001、Round 1 Q1）

1. 登入測試帳號 → 預設進入儀表板，月份切換器預設為當前月份（如 2026-04）。
2. 預期：
   - DevTools Network: `GET /api/dashboard?yearMonth=2026-04` 回 200，response body 含 `yearMonth: "2026-04"`、`income`、`expense`、`net`、`todayExpense`、`catBreakdown[]`、`recent[]`。
   - 三張 KPI 卡顯示該月的收入／支出／淨收支；無「本月」字樣（語意由月份切換器決定）。
3. 點擊月份切換器「<」切到 2026-03。
4. 預期：
   - 重新發出 `GET /api/dashboard?yearMonth=2026-03`。
   - 三張 KPI 卡同步重算為 3 月數字。
   - 「最近 5 筆交易」**只**顯示 3 月內的交易（不顯示 4 月交易）。
   - SC-001 標準：整頁所有區塊（KPI、圓餅、預算、最近交易）在 2 秒內完整呈現。

### 2.2 雙圓餅切換 + 排序穩定性（FR-002、FR-013、SC-003）

1. 確保當月有橫跨 ≥ 3 父分類、≥ 6 子分類的支出交易資料。
2. 預設「雙圓餅」開啟（toggle 勾選）：內圈父分類、外圈子分類。
3. 預期：
   - 圖例與圓餅順序為「父分類總額由高到低，同一父分類下子分類總額由高到低」（FR-013）。
   - tooltip 顯示金額 + 佔比百分比；圖例每列同樣顯示金額 + 百分比（FR-003）。
   - 列出「前 5 名子分類」排行區塊（FR-003）。
4. Toggle「雙圓餅」關閉 → 切換為單圓餅；再次切回雙圓餅。
5. 預期：
   - 切回後排序與第一次完全相同（SC-003 100% 穩定一致）。

### 2.3 「（其他）」虛擬子分類節點（FR-013、Round 3 Q1）

1. 在交易頁建立一筆「直接掛在父分類『飲食』本身」的支出（例：`category_id` 指向飲食父分類，無子分類），金額 500。
2. 切回儀表板（仍 2026-04）→ 觀看支出分類圓餅雙圓餅模式。
3. 預期：
   - 內圈「飲食」弧度包含該 500 元（隨其他子分類加總）。
   - 外圈出現一個「（其他）」扇區，金額 500，與「飲食」其他真實子分類同色階規則排序、混在一起。
   - DevTools: `catBreakdown[]` 內含一筆 `{ name: '（其他）', isOtherGroup: true, parentId: '<飲食 id>', categoryId: null, total: 500 }`。
   - 飲食父分類弧度 **不**重複加 500（FR-013：金額不重複計入）。

### 2.4 資產配置圓餅（FR-004、FR-005、Round 1 Q2、Round 2 Q1）

#### 無持股情境

1. 用一個無持股的帳號登入。
2. 預期：
   - 資產配置圓餅圖只顯示帳戶餘額分布（5 個現金帳戶各一個扇區）。
   - **不顯示**「持股前 5 名」與「帳戶前 5 名」兩欄列表（連標題都不出現；FR-005）。

#### 有持股情境

1. 用有 ≥ 1 檔持股 + ≥ 5 個帳戶（其中至少 1 個為外幣帳戶，如 USD）的帳號登入。
2. 預期：
   - 資產配置圓餅圖混合呈現「股票市值」與各帳戶（皆 TWD 等值）。
   - 下方額外顯示「持股前 5 名」列表（依市值由高到低）與「帳戶前 5 名」列表（依 TWD 等值由高到低）。
   - **不**觸發任何外部查價 API call（DevTools Network 無 `mis.twse.com.tw` 或類似請求；Round 2 Q1）。
   - 股票市值來自 `/api/stocks` 的 `current_price` 快取欄位。
3. 在另一個分頁觸發股票模組「重新整理股價」，再回到儀表板：
   - 儀表板重新載入後資產配置數字應反映新股價（既有 `current_price` 已更新）。

#### `twdAccumulated` 欄位驗證（FR-004、Round 4）

1. DevTools Network 觀察 `GET /api/accounts` response：每筆帳戶物件 MUST 含 `twdAccumulated` 欄位（type: number）。
2. 對某 USD 帳戶：手動 SUM 該帳戶所有 transactions 的 twd_amount（依 income/transfer_in 為正、expense/transfer_out 為負），驗證等於該帳戶 response 的 `twdAccumulated`。
3. 該 USD 帳戶 `balance` 欄位（原幣餘額）應與 `twdAccumulated`（TWD 等值）**不同**（除非匯率剛好為 1）；確認 dashboard 圓餅圖採用 `twdAccumulated`（檢查 console.log 或斷點）。
4. 構造一個被刷爆的帳戶：累積支出 > 收入，使 `twdAccumulated < 0`：
   - 圓餅圖該扇區弧度以**絕對值**參與計算（扇區仍可見、不消失）。
   - tooltip 顯示原值含負號（如 `-12,345`）。
5. 構造一個 USD 帳戶但 `initial_balance = 1000` USD 且**完全無交易**：
   - `twdAccumulated` 應為 `0`（initial_balance 不納入）。
   - 該帳戶 `balance = 1000`（USD），但 dashboard 圓餅圖不會顯示這筆 1000 USD 的 TWD 等值（因為 twdAccumulated = 0）；此為設計（spec round 4 明示）。

### 2.5 預算進度條（FR-006，沿用 004）

1. 登入有當月預算的帳號 → 觀看儀表板「當月預算進度條」區塊。
2. 預期：
   - 配色採 004 規範的四級配色（綠 / 中性 / 黃 / 紅）。
   - 切換月份至 2026-03 後，預算進度條同步重算（004 SC-006 即時重算）。
3. 切換到一個無預算的月份。
4. 預期：顯示「本月尚未設定預算」引導文案。

---

## 3. US2 驗證（P1）：用「期間 + 類型」切換器深度分析

### 3.1 期間預設與即時重繪（FR-008 ~ FR-009、SC-002）

1. 登入有近 6 個月跨多分類交易的帳號 → 切到「統計報表」頁。
2. 預期：
   - 工具列頂端顯示期間選擇器（本月／上月／近 3 個月／近 6 個月／今年／自訂時間）與類型切換器（支出／收入）。
   - 預設「本月」+「支出」。
   - DevTools: `GET /api/reports?type=expense&from=2026-04-01&to=2026-04-30` 回 200。
   - 圓餅、折線、長條三圖立即繪出。
3. 點擊「近 3 個月」。
4. 預期：
   - 立即（不需按「套用」按鈕；FR-008）發出 `GET /api/reports?type=expense&from=<3 個月前>&to=<今天>`，三圖同步重繪。
   - SC-002 標準：99% 切換動作在 1 秒內完成同步重繪。

### 3.2 自訂期間邏輯（FR-010）

1. 點擊「自訂時間」→ 期間輸入框出現。
2. **僅填起始日 2026-01-01**（結束日留空）→ 失焦或按 Enter。
3. 預期：
   - DevTools: `GET /api/reports?type=expense&from=2026-01-01&to=<今天>`（自動填今天為 to）。
   - 三圖以「2026-01-01 ~ 今天」期間重繪。
4. 清空起始日，**僅填結束日 2026-04-15**。
5. 預期：
   - DevTools: `GET /api/reports?type=expense&from=2026-04-01&to=2026-04-15`（自動填當月 1 號為 from）。
6. 嘗試輸入「起始日 2026-04-15、結束日 2026-04-01」（反向）。
7. 預期：
   - 系統拒絕並顯示提示，不交換兩值（FR-010：不靜默接受）。

### 3.3 類型切換 + 空狀態（FR-011、FR-015）

1. 切到一個沒有收入交易的期間（如「近 3 個月」），類型切「收入」。
2. 預期：
   - 圓餅、折線、長條三圖**同時**呈現「此期間無資料」空狀態（FR-015：圖示 + 文案一致，無殘影）。
3. 切回「支出」 → 三圖立即恢復顯示。

### 3.4 圓餅圖排序「父總額 desc → 同父下子總額 desc」（FR-013）

依 spec.md US2 Acceptance Scenario 4 構造資料：飲食 8000（午 3000、晚 3500、飲料 1500）、交通 5000。

1. 切到包含這些交易的期間。
2. 預期圓餅與圖例順序：
   - 飲食父（8000）→ 外圈：晚餐（3500）、午餐（3000）、飲料（1500）
   - 交通父（5000）→ 外圈：依該父下子分類排序
3. 切換期間到「上月」（資料不同）；再切回 → 同期間下排序仍 100% 一致。

### 3.5 期間／類型 Session 內保留（FR-011a、Round 1 Q5）

1. 在統計頁切到「近 6 個月 + 收入」。
2. 切到儀表板（離開統計頁）→ 再切回統計頁。
3. 預期：
   - 期間選擇器仍為「近 6 個月」、類型仍為「收入」（**MUST** 保留；非預設值）。
4. 點右上角登出 → 重新登入 → 進入統計頁。
5. 預期：
   - 期間重置為「本月」、類型重置為「支出」（FR-011a：跨 Session 重置）。

### 3.6 圓餅圖點擊跳轉交易列表（FR-015a、Round 3 Q2）

1. 在統計頁（任一期間 + 支出）點擊「飲食」**內圈**扇區。
2. 預期：
   - 跳轉至「交易列表」頁。
   - 列表自動套上 filter：父分類 = 飲食、類型 = 支出、期間 = 該期間。
   - URL hash 或頁面 state 顯示對應 filter（前端實作細節）。
3. 回到統計頁 → 點擊外圈某個**子分類**扇區（如「午餐」）。
4. 預期：篩選為子分類「午餐」+ 類型 + 期間。
5. 點擊外圈「（其他）」虛擬節點。
6. 預期：篩選為「父分類 = X 且 category_id 為父分類本身（即無子分類細項）」+ 類型 + 期間。
7. 切到儀表板 → 點擊資產配置圓餅圖的「股票市值」扇區。
8. 預期：跳轉至股票模組頁。
9. 點擊資產配置某個帳戶扇區。
10. 預期：跳轉至交易列表，filter accountId = 該帳戶。
11. 信件中圓餅為靜態圖片，**不**適用點擊互動（FR-015a 結尾條款）。

---

## 4. US3 驗證（P2）：透過排程信件接收每日／每週／每月帳務摘要

### 4.1 多筆排程並存（FR-016、Round 2 Q2）

1. 以管理員登入 → 切到排程設定頁。
2. 為使用者 A 建立第一筆排程：頻率「每日」、Hour 9。
   - DevTools: `POST /api/admin/report-schedules` body `{ userId: 'A', freq: 'daily', hour: 9, enabled: true }` 回 201 + 排程物件。
3. **再為使用者 A 建立第二筆「每日」排程**（hour 18）。
4. 預期：
   - `POST /api/admin/report-schedules` 再回 201（**不**回 409 衝突；Round 2 Q2 允許多筆同 freq 並存）。
   - `GET /api/admin/report-schedules?userId=A` 回兩筆排程，皆 `freq: 'daily'`，但 `id` 與 `hour` 不同。

### 4.2 寄送前股價更新 + 信件版面（FR-017、FR-018、SC-004、SC-005）

#### 觸發

1. 為「有持股的測試帳號」建立每日排程（hour = 當前小時 + 1，避免立即觸發干擾）；或直接呼叫 `POST /api/admin/report-schedules/{id}/run-now` 立即觸發。
2. 預期：
   - DevTools: 觸發 endpoint 回 200，response 含 `status: 'completed'`, `sent: 1`, `priceUpdates >= 0`。
   - 後端 console 輸出觸發摘要。
3. 收件信箱（測試帳號註冊信箱）應收到一封 HTML 信。

#### 信件視覺檢查（Outlook Desktop 與 Web 各檢一次；SC-005）

打開信件，**逐項**檢查：
- [ ] 三色漸層英雄區（紫 / 藍 / 綠或品牌色）。
- [ ] 3 欄 KPI 卡（收入 / 支出 / 淨額），每欄底部含 ▲▼ pill（同型前一段對比；下方第 4.3 節），pill 旁有小字 `compareLabel`（「對比昨日」/「對比上週」/「對比上月」）。
- [ ] 儲蓄率進度條（含百分比文字）。
- [ ] 分類顏色長條（每父分類一條，依金額排序）。
- [ ] 近 5 筆交易摘要（依交易日期由新到舊）。
- [ ] CTA 按鈕（「查看完整報表」），點擊後跳轉至儀表板登入頁。
- [ ] 「股票投資」區塊（若使用者有持股）：4 列（成本 / 市值 / 未實現損益 / 報酬率），未實現損益與報酬率以彩色 ± 符號（正綠 / 負紅）。
- [ ] 整封信件在 Outlook Desktop 與現代瀏覽器 Web 開啟皆無破版、無顏色遺失（SC-005 100% 通過率）。

#### FR-023 資料時間註記驗證（T064a）

1. 構造一檔股票，把 `stocks.updated_at` 手動 (DevTools / SQL) 設為 `Date.now() - 13 * 3600 * 1000`（即 13 小時前）。
2. 立即觸發 run-now（hour 設為當前 + 1 避免自動觸發干擾）。
3. 預期：
   - 信件「股票投資」區塊該檔股票該列右側補小字「資料: YYYY-MM-DD HH:MM」（台灣時區格式）。
   - 12 小時內更新成功的其他股票**不**顯示此註記。
4. 構造另一檔股票，`stocks.updated_at = 0`（NULL / 從未成功更新）：
   - 該列價格欄位顯示「—」、資料時間欄位也顯示「資料: —」（不顯示 NaN）。
   - 整封信件**仍正常寄出**（FR-023 不阻擋）。

### 4.3 對比 ▲▼ pill 隨頻率切換（FR-018、Round 1 Q4）

#### 每日信件

1. 觸發每日信件（測試帳號昨日有支出 1000，前日有支出 800）。
2. 預期：
   - 信件 KPI「支出」欄 ▲▼ pill 對比為「+25%」（1000 vs 800）；對比 label 顯示「對比昨日」。

#### 每週信件

1. 為同一帳號建立每週排程（weekday = 1 = 週一）。
2. 立即觸發（`run-now`）。
3. 預期：
   - 信件「交易紀錄」區塊顯示 Mon-Sun 每日彙總（FR-019）；**第一筆 row 為週一**（驗證 T064b 的 Mon-Sun 起點修正）；**最後一筆 row 為週日**。
   - 額外顯示「區間收入 / 支出 / 淨額」三欄總覽卡。
   - **週六與週日的日期文字以紫色標示**（FR-019、T064b）；以瀏覽器 inspect element 驗證 `color: #a855f7;` inline style 套於該兩列；其他 5 列為預設色。
   - KPI ▲▼ pill 對比「上週」（即上上週）；對比 label 顯示「對比上週」。

#### 每月信件

1. 為同一帳號建立每月排程（dayOfMonth = 1）。
2. 立即觸發。
3. 預期：
   - 信件「交易紀錄」區塊顯示上月每天彙總（FR-019）。
   - KPI ▲▼ pill 對比「上月」（即上上月）；對比 label 顯示「對比上月」。
   - 其餘版面（英雄區、儲蓄率、分類顏色長條、近 5 筆交易、CTA、股票投資 4 列）結構與每日／每週版本一致（FR-019 結尾）。

### 4.4 寄信通道執行期 fallback（FR-021、Round 1 Q3）

#### 同時設定 SMTP + Resend

1. 管理員 UI 設定 SMTP（host / port / user / password / from）。
2. 環境變數設定 `RESEND_API_KEY` 與 `RESEND_FROM_EMAIL`。

#### 模擬 SMTP 執行期失敗

1. 暫時把 SMTP host 改為一個不可達的位址（如 `smtp.invalid.example.com`）。
2. 觸發 `POST /api/admin/report-schedules/{id}/run-now`。
3. 預期：
   - 後端在 `sendStatsEmail` 內 SMTP 嘗試 throw（連線失敗）→ 自動退回 Resend → 寄送成功。
   - response body `provider: 'resend'`（記錄實際成功的通道）。
   - 收件信箱仍收到信件（內容相同）。
   - **不**重試 SMTP、**不**寫入「待重試」狀態（Round 1 Q3）。

#### 模擬兩通道皆失敗

1. SMTP host 仍為不可達；同時把 `RESEND_API_KEY` 改為無效字串。
2. 觸發 run-now。
3. 預期：
   - response body `status: 'completed'` 但 `failed: 1`、`reason` 含 fail message。
   - `last_summary` 包含失敗描述。
   - **不**於下次自然觸發點補寄（FR-021、Round 1 Q3）。

### 4.5 通道兩者皆未設定（FR-021）

1. 把管理員 SMTP 設定清空（host = ''）；同時把 `RESEND_API_KEY` 清空。
2. 觸發 run-now。
3. 預期：
   - response 503 + body `status: 'no_email_service', reason: '寄信服務未設定'`（FR-021）。
   - **不**靜默吞錯。

### 4.6 台灣時區排程（FR-022、SC-004）

1. 確認部署主機時區為 UTC（`date` 顯示 UTC 時間）；若本機為非 UTC 環境，於 docker-compose 設 `TZ=UTC` 模擬。
2. 排程設定為 `freq: 'daily', hour: 0`（台灣凌晨 00:00）。
3. 等待至實際台灣 00:00（即 UTC 16:00 前一日）後 5 分鐘內。
4. 預期：
   - `checkAndRunSchedule` 5 分鐘 tick 觸發。
   - 後端 console 出現觸發 log，`twParts(serverNow())` 計算的 `hours` 為 0、`date` 為當日台灣日期。
   - 收件信箱在台灣 00:05 前收到信件（SC-004 5 分鐘 SLO）。

### 4.7 排程停用→啟用不補寄（FR-024a、Round 2 Q3）

1. 為帳號 A 建立每日排程，等其至少觸發過一次（`last_run` 已寫入）。
2. 管理員 PUT `/api/admin/report-schedules/{id}` body `{ enabled: false }`。
3. 等待 ≥ 1 個自然觸發點（如隔天）。
4. 預期：信箱**不**收到信（因 enabled = 0，`checkAndRunSchedule` 跳過）。
5. PUT `{ enabled: true }` 重新啟用。
6. 預期：
   - `last_run` 仍為步驟 1 的值（**不**被重新啟用動作改寫）。
   - 等待下一個自然觸發點（如再隔天）才寄送；停用期間漏掉的所有觸發點**不**補寄（Round 2 Q3）。

### 4.8 持股快取為空時的「—」呈現（spec Edge Case「股價更新失敗」）

1. 在持股表為某檔股票建立 row 但 `current_price = 0`（透過直接 DB 操作或新增持股後不重新整理）。
2. 暫時讓 TWSE 查價失敗（停用網路或改 invalid host）。
3. 觸發 run-now。
4. 預期：
   - 信件「股票投資」區塊該檔顯示「—」price 與 0% 報酬率，不阻擋整封信件寄出。
   - 其他持股仍正常呈現。

### 4.9 使用者帳號停用（FR-024）

1. 管理員把帳號 A 的 `is_active` 設為 0（既有功能）。
2. 觸發 run-now（針對 A 的排程）。
3. 預期：
   - 系統略過 A 的寄送，response `skipped: 1`。
   - A 的排程設定**不變**（enabled、freq 等保留；FR-024）。

---

## 5. SC 對照表

| SC | 驗證步驟 | 通過標準 |
| --- | --- | --- |
| SC-001 | 2.1 | 儀表板 KPI / 圓餅 / 預算 / 最近交易 2 秒內呈現 |
| SC-002 | 3.1, 3.3 | 統計頁切換期間／類型 1 秒內三圖重繪；99% 達標 |
| SC-003 | 2.2, 3.4 | 圓餅排序穩定 100% 一致 |
| SC-004 | 4.6, 4.7 | 排程信件 5 分鐘內寄送；錯誤紀錄含使用者 ID/頻率/觸發時間/通道/失敗原因 |
| SC-005 | 4.2 | Outlook Desktop 與 Web 視覺一致無破版 100% |
| SC-006 | 2.1 + 編輯交易 | 新增/修改/刪除交易後重進儀表板/統計頁圖表反映變動 |
| SC-007 | 主觀（無自動化） | 90% 使用者 30 秒內可回答「我這個月過得如何」 |

---

## 6. OpenAPI 同步驗證

1. `npx @redocly/cli lint openapi.yaml` → 0 error、0 warning。
2. `npx @redocly/cli lint specs/005-stats-reports/contracts/stats-reports.openapi.yaml` → 0 error、0 warning。
3. 兩份檔案 `info.version` 同步為 `4.26.0`。
4. 兩份檔案 `openapi: 3.2.0` 字串完全相等（憲章 Principle II）。
5. 所有新增路徑無冒號（憲章 Principle III）；多字動詞為 kebab-case（如 `run-now`）。

---

## 7. 回滾步驟（萬一上線後出問題）

1. `git revert <本功能合併 commit>`（或回到 `004-budgets-recurring` merge 後的 commit）。
2. 重啟 server；既有 singleton 排程仍可從 `system_settings.report_schedule_*` 欄位繼續運作（migration 為純新增表，未動既有資料）。
3. 若需徹底清除新表：登入 sql.js shell（或新增臨時管理腳本）`DROP TABLE IF EXISTS report_schedules;` 後 `saveDB()`。
4. 還原至 `4.25.0` 版本標籤；CI 會以 `changelog.json.currentVersion` 重新打 Docker tag。

無資料損失風險，因為本功能對既有業務資料（transactions / accounts / stocks / budgets）完全唯讀。
