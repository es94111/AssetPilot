# 功能規格：多時區支援（Multi-Timezone Support）

**Feature Branch**: `009-multi-timezone`
**Created**: 2026-04-29
**Status**: Draft
**Input**: 將系統時區從寫死 `Asia/Taipei` 升級為「per-user 可設定」。後端時間以 UTC+0 + ISO 8601 為唯一語意，前端依使用者偏好時區呈現。

## 使用者情境與測試 *(必填)*

### User Story 1 — 非台灣使用者的「自然日」正確歸屬（Priority: P1）

不在台灣時區的使用者，他在當地深夜記下的一筆帳，必須被歸到「他當地的那一天」，而不是被系統按台灣日期錯歸到隔天；他的月度預算、餘額計算、月份報表也都必須以「他當地的自然日／自然月」為界。

**Why this priority**: 沒有這個能力，所有非 UTC+8 使用者都會在每天最後幾個小時看到錯誤的「今天」與錯誤的當月統計，且歷史資料的日期歸屬會讓他完全無法理解。這是把系統從「單一地區產品」變成「可被任何時區使用者採用」的最低門檻。

**Independent Test**: 將測試帳號時區設為 `America/Los_Angeles`（PST/PDT），於當地 23:30 新增一筆支出。在「今日支出」、「本月支出」、「餘額（未來日不計）」三個檢視中應分別看到該筆交易出現於該使用者當地的當日／當月，且不會被歸到台灣的隔日。

**Acceptance Scenarios**:

1. **Given** 使用者時區為 `America/Los_Angeles`、目前是當地 2026-04-29 23:30，**When** 使用者新增一筆 `date=2026-04-29` 的支出，**Then** 該筆交易顯示於「今日支出」清單，且不出現於「未來交易」清單。
2. **Given** 使用者時區為 `America/Los_Angeles`、目前是當地 2026-04-30 00:30，**When** 使用者打開「今日支出」，**Then** 上一條情境（當地 4/29 23:30 那筆）不出現在「今日支出」，而出現在「昨日／4 月份小計」。
3. **Given** 使用者時區為 `Asia/Taipei`（既有預設），**When** 使用者使用任何依賴「今天／本月」的功能（餘額、預算、報表），**Then** 行為與多時區功能上線前完全相同（regression-free）。
4. **Given** 同一筆 UTC 時間戳 `2026-04-30T07:30:00Z`，**When** 兩名使用者（時區分別為 `Asia/Taipei` 與 `America/Los_Angeles`）同時檢視該筆交易的 `created_at`，**Then** 兩人各自看到的是正確的當地時間字串（台北 15:30、洛杉磯 00:30），且兩人的列表排序結果一致。

---

### User Story 2 — 自動偵測並可手動調整時區（Priority: P2）

新使用者註冊或既有使用者首次升級登入時，系統自動偵測瀏覽器回報的 IANA 時區並儲存為其偏好；使用者可在「個人設定」頁面隨時改成任一合法 IANA 時區。

**Why this priority**: 沒有 P2，使用者必須手動設定時區才能享受 P1 的正確性；多數使用者不會主動找這個設定，導致 P1 對他們等於沒上線。但若 P1 尚未完成，自動偵測本身沒有意義，因此排在 P2。

**Independent Test**: 以一個從未登入過的瀏覽器（系統時區設為 `Europe/London`）首次完成註冊／登入，呼叫 `GET /api/users/me` 應回傳 `timezone: "Europe/London"`；於設定頁將時區改為 `Asia/Tokyo` 後重新整理頁面，回傳值應為 `Asia/Tokyo`，且後續所有「今天」邏輯立刻採用新時區。

**Acceptance Scenarios**:

1. **Given** 全新使用者、瀏覽器系統時區為 `Europe/London`，**When** 使用者完成註冊流程，**Then** 該帳號的儲存時區為 `Europe/London`。
2. **Given** 既有使用者首次在新版登入、瀏覽器系統時區為 `America/New_York`、目前帳號 `timezone` 仍為預設 `Asia/Taipei`，**When** 使用者完成登入，**Then** 系統不主動覆寫其時區（避免出差／VPN 場景錯改），但顯示一次性提示詢問「是否將時區改為 America/New_York？」。
3. **Given** 已登入使用者打開「個人設定 → 時區」並選擇 `Asia/Tokyo`，**When** 儲存設定，**Then** 任何後續 API 呼叫的「今天／當月」計算均以 `Asia/Tokyo` 為基準。
4. **Given** 使用者輸入或選擇了一個非 IANA 合法值（例如 `UTC+8`、`Taipei Standard Time`、空字串），**When** 嘗試儲存，**Then** 系統拒絕並顯示「無效時區」錯誤訊息，原時區設定保留不變。

---

### User Story 3 — 月度報表郵件依使用者本地時區寄送（Priority: P3）

使用者收到的「上月支出總結」郵件，必須在其當地時區的每月 1 號 00:00（≈ 之後不久）送達，而非台灣的 1 號 00:00；信件內呈現的所有時間欄位也以該使用者時區呈現。

**Why this priority**: 對既有 Asia/Taipei 使用者來說行為不變；對非台灣使用者，這是讓郵件「在合理的當地時間到達」的關鍵體驗，但即使延後幾天送達也不影響核心記帳功能正確性，故排 P3。

**Independent Test**: 將測試帳號時區設為 `America/Los_Angeles`，將伺服器時間快進到該使用者當地 1 號 00:00～00:10 區間，觀察排程器是否在該窗口內為此使用者觸發寄送任務，且該月份僅寄送一次（不重寄）。

**Acceptance Scenarios**:

1. **Given** 使用者時區為 `America/Los_Angeles`，**When** UTC 時間到達該使用者當地下個月 1 號 00:00 後的下一個排程心跳，**Then** 系統為其寄出上月份報表郵件，且本月不再重寄。
2. **Given** 使用者時區為 `Asia/Taipei`（預設），**When** 系統運行新版排程，**Then** 該使用者收信時間與舊版本（台灣 1 號 00:00）一致。
3. **Given** 使用者於月初某日（當地 1 號）才將時區從 `Asia/Taipei` 改為 `Pacific/Auckland`（時區更早），且該月台灣 1 號的報表已寄出，**When** 排程器再次評估，**Then** 不會因為時區變更而重複寄送本月報表。

---

### Edge Cases

- **DST 邊界（夏令時間切換）**：直接信任 IANA tz database，不為「重複的 01:30」或「跳過的 02:30」設定特殊處理；任何依賴「使用者當地某時刻」的判斷都以 IANA 規則計算。
- **使用者中途修改時區**：`transactions.date` 既存值不重算；改時區後，新增交易與「今天／當月」邏輯立即採用新時區。
- **TWSE 台股交易時間判斷**：屬市場時間而非使用者偏好，永久鎖定 `Asia/Taipei`；本功能不改變此行為。
- **歷史資料的 `transactions.date`**：本功能上線前的列被視為「以 Asia/Taipei 自然日寫入」；不做資料遷移，現有解讀對既有 Asia/Taipei 使用者不變。
- **共用裝置／VPN**：自動偵測在「首次登入」階段可能取得非使用者真實所在時區；以「提示確認」而非「強制覆寫」處理。
- **無效時區字串**：API 與前端 UI 雙層阻擋；後端視為驗證錯誤回 400。
- **時區資料庫過時**：依賴 Node.js 內建 ICU；若部署環境 ICU 缺漏特定時區，視為部署環境問題，由運維修復而非應用層處理。
- **既有使用者大量升級**：所有未指定時區的使用者套用預設 `Asia/Taipei`，不發信也不強制提示；只在他下次登入時觸發 User Story 2 的提示流程。

## 需求 *(必填)*

### Functional Requirements

#### 資料模型
- **FR-001**: 系統 MUST 為每位使用者保存一個合法 IANA 時區識別碼（例如 `Asia/Taipei`、`America/Los_Angeles`），預設值為 `Asia/Taipei`。
- **FR-002**: 系統 MUST 拒絕任何非 IANA tz database 識別碼的時區值（包含縮寫如 `PST`、固定偏移如 `UTC+8`、空字串、null）。

#### 後端時間語意
- **FR-003**: 後端任何 timestamp 性質的欄位（`*_at`、`created_at`、`updated_at`、`last_login_at` 等）在 API 回應中 MUST 以 ISO 8601 UTC 字串呈現，且以 `Z` 結尾（例如 `2026-04-29T07:30:00.000Z`）。
- **FR-004**: 後端在內部進行任何「今天」「當月」「未來日」的判斷時 MUST 使用該操作所針對的使用者的時區，不得使用 process timezone、`Asia/Taipei` 寫死值或瀏覽器回報值。
- **FR-005**: `transactions.date` 欄位 MUST 維持 `YYYY-MM-DD` 字串格式，但語意定義為「該交易所有人於其偏好時區的當地自然日」；新增交易時若未明確指定 `date`，後端 MUST 以該使用者時區下的「今天」字串為預設值。
- **FR-006**: 月度報表郵件的觸發條件 MUST 由「全系統台灣時區月初 00:00」改為「該使用者於其偏好時區的月初 00:00」；同一使用者於同一月份 MUST NOT 收到重複郵件。

#### API
- **FR-007**: 系統 MUST 提供 `GET /api/users/me` 端點回傳當前使用者個人資料，回傳體 MUST 包含 `timezone` 欄位（IANA 字串）。
- **FR-008**: 系統 MUST 提供 `PATCH /api/users/me/timezone` 端點允許使用者更新自己的時區；端點 MUST 驗證輸入為合法 IANA 識別碼，否則回 400 並維持原值不變。
- **FR-009**: 所有現有依賴「今天／當月」邏輯的 API 端點（餘額、預算、月份報表、定期交易展開、未來日驗證）MUST 改以呼叫者時區計算，且對 `timezone == 'Asia/Taipei'` 的使用者 MUST 維持與升級前完全一致的回應。

#### 前端體驗
- **FR-010**: 前端在使用者首次登入時 MUST 偵測瀏覽器回報的 IANA 時區（`Intl.DateTimeFormat().resolvedOptions().timeZone`），並依規則處理：（a）新註冊使用者直接寫入；（b）既有使用者僅顯示一次性提示詢問是否更新，使用者拒絕後此次登入不再提示。
- **FR-011**: 前端 MUST 在「個人設定」頁提供時區選擇介面（搜尋／選單），允許使用者在所有合法 IANA 時區中選擇任一值。
- **FR-012**: 前端任何時間顯示 MUST 依當前登入使用者的偏好時區呈現（不依賴瀏覽器系統時區），並標示該時區（例如 `2026-04-29 15:30 (Asia/Taipei)`）。
- **FR-013**: 前端送出至後端的「日期類」欄位（如新增交易的 `date`）MUST 為使用者時區下的當地自然日字串；送出至後端的「時間戳類」欄位 MUST 為 UTC ISO 8601。

#### 例外與約束
- **FR-014**: TWSE 台股交易時間（09:00–13:30 週一至週五）的判斷 MUST 永久鎖定 `Asia/Taipei`，不受使用者偏好時區影響；該邏輯位置 MUST 加註解說明此例外。
- **FR-015**: 既有 `transactions.date` 列（升級前已寫入者）MUST 不被遷移；其語意一律解讀為「以 `Asia/Taipei` 寫入的當地自然日」。
- **FR-016**: 系統 MUST 在憲章（`.specify/memory/constitution.md`）中將既有 FR-007a「鎖 UTC+8」原則修訂為「per-user 時區」，並新增「Time & Timezone Discipline」治理原則；本變更 MUST 與本功能於同一 PR 合併。
- **FR-017**: 本功能 MUST 同步更新 `openapi.yaml`（含 `users` 物件 schema、`/api/users/me`、`/api/users/me/timezone`）並通過 `npx @redocly/cli lint openapi.yaml` 檢核；OpenAPI 文件版本 `openapi: 3.2.0` MUST 保持不變。

### Key Entities

- **User Timezone Preference**：使用者個人化設定的一部分，紀錄該使用者對「當地時間」的解讀基準；以 IANA 識別碼字串持久化，預設 `Asia/Taipei`，可由使用者主動更新或由系統於首次登入時建議。
- **Transaction Calendar Date**：交易在使用者當地時區的「自然日」標籤（`YYYY-MM-DD`），非瞬時時間；用於分日／分月彙整。歷史列被視為以 `Asia/Taipei` 寫入。
- **Monthly Report Send State**：每位使用者每個月份的「報表是否已寄出」狀態，用於 P3 防止重寄；以 `(user_id, year_month)` 為唯一鍵。

## 成功準則 *(必填)*

### Measurable Outcomes

- **SC-001**：升級後將任一既有 `Asia/Taipei` 使用者完整功能逐一比對，所有 API 回應與 UI 行為相對於升級前 100% 一致（自動化 regression 測試 0 失敗）。
- **SC-002**：將測試帳號時區設為 `America/Los_Angeles` 並於 PST 23:30 新增一筆當日支出，於三個檢視（今日支出／本月小計／餘額）中皆能在 1 秒內看到該筆交易正確歸入當地當日／當月。
- **SC-003**：於 100 名隨機抽樣使用者中，至少 95% 在其當地月份 1 號的 00:00～00:30 之間（≤30 分鐘延遲）收到月度報表郵件。
- **SC-004**：對 API 回應隨機抽 1000 個 timestamp 性質欄位，100% 為合法 ISO 8601 UTC 字串（含 `Z` 結尾）；任何違例自動化檢核 MUST fail build。
- **SC-005**：於六個典型瀏覽器系統時區（UTC、Asia/Taipei、America/Los_Angeles、Europe/London、Asia/Tokyo、Pacific/Auckland）下分別開啟同一帳號，所有時間顯示與「今天／本月」邊界一致地以該帳號的偏好時區為準（不受瀏覽器影響）。
- **SC-006**：使用者於「個人設定」變更時區後，畫面所有時間／日期顯示在 1 秒內反映新時區（不需登出重登）。

## Assumptions

- 既有 process timezone 對後端邏輯不重要：後端時間運算已使用 UTC ms 與 `Date.UTC()` 進行（`server.js` 已有此實踐），不會因為部署環境 TZ 差異而錯亂。
- Node.js runtime 內建 ICU 支援完整 IANA tz database；部署環境（Docker base image）不需額外安裝 tz 套件。
- 既有 `transactions.date` 欄位的歷史寫入皆以 `Asia/Taipei` 自然日為語意（與既有 FR-007a 一致）；不存在「歷史寫入錯亂」需要先修補的情況。
- 使用者一次只在一個時區生活：若同一使用者頻繁在多時區切換（出差、VPN 共用），系統不主動偵測並覆寫其偏好，由使用者於設定中自行調整。
- 月度報表郵件量級在「每分鐘排程心跳掃一次未寄送 user」可承受（單機 SQLite 規模）；不需要分散式排程或佇列。
- DST 切換不需要額外特殊處理；以 IANA tz database 規則為準。
- 升級為 breaking change 但不影響既有 Asia/Taipei 使用者的可觀察行為，故不做雙寫／灰度，但會在憲章與 PR 描述同步遷移指南（憲章 v1.3.0）。
