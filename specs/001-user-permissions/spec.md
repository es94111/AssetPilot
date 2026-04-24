# 功能規格：使用者與權限（Users & Permissions）

**Feature Branch**: `001-user-permissions`
**Created**: 2026-04-24
**Status**: Draft
**Input**: 使用者描述：「使用者與權限：註冊、登入、Google SSO、Passkey、管理員身分、登入稽核、伺服器時間校正、安全基線」

## Clarifications

### Session 2026-04-24

- **Q1 — 登入稽核保留策略**：採 (C) 保留 **90 天**後自動清除；顯示時仍分別取使用者 100／管理員 200／全站 500 筆上限。
- **Q2 — 密碼變更時的 Token 撤銷**：採 (A) 密碼變更與登出同樣會遞增 `token_version`，使所有舊裝置立即登出。
- **Q3 — 白名單格式**：採 (C) 混用——以項目內是否含 `*` 作為切換依據：不含 `*` 時採完全一致比對；含 `*` 時視為 domain wildcard（例如 `*@example.com` 放行整個網域），多個項目間為 OR 關係。
- **Q4 — Passkey 登入模式**：採 (A) 真正的 usernameless discoverable credential——登入頁直接點擊 Passkey 按鈕即觸發瀏覽器彈出可用金鑰選單；`userHandle` 為帳號查找依據，不須先輸入 Email。
- **Q5 — 預設分類內容**：採 (A) 以現行 `server.js` 邏輯為準，完整清單已寫入 FR-003。

### Session 2026-04-24（第二輪）

- **Q6 — JWT 有效期預設與 Cookie 持久化**：採 (A) 預設 **7 天**（`JWT_EXPIRES=7d`），Cookie 為 persistent（`Max-Age` 同 JWT 有效期，瀏覽器關閉後仍有效）；不提供「記住我」選項，全員一致 7 天。
- **Q7 — 速率限制桶**：採 (C) 分成兩桶——`/api/auth/login`、`/api/auth/register`、`/api/auth/google` 共用 **auth 桶**；`/privacy`、`/terms` 共用 **靜態頁桶**。兩桶各自獨立計數 20 次／15 分鐘／IP。
- **Q8 — Email 大小寫與唯一性**：採 (A) 註冊、登入、白名單比對前一律將 Email **trim + lowercase**，以正規化後的字串作為 DB 儲存值與比對依據；`Alice@EX.com` 與 `alice@ex.com` 視為同一帳號。
- **Q9 — 使用者刪除 vs 稽核紀錄保留**：採 (C) 混合策略——刪使用者時，其**成功登入**紀錄（方便使用者／管理員個人稽核的部分）硬刪；但**失敗登入嘗試**紀錄（方便攻擊偵測）保留，僅將 `user_id` 置 NULL、Email 以雜湊表示，保留 IP、時間、失敗原因。
- **Q10 — Google OAuth redirect_uri 白名單**：採 (A) 後端維護 `redirect_uri` 白名單（預設為 `https://<APP_HOST>/api/auth/google` 與 `http://localhost:<PORT>/api/auth/google`，可由環境變數擴充），向 Google 換 token 時一併傳入並於後端比對；任何不在白名單內的 `redirect_uri` 皆拒絕。

## 使用情境與測試 *(mandatory)*

### User Story 1 — 使用電子郵件與密碼建立並登入帳號（Priority: P1）

訪客以電子郵件與強密碼註冊並立即登入，系統同時建立預設分類與一個「現金」帳戶，讓使用者能立刻進入主畫面開始記帳。既有使用者可在登入頁輸入相同帳密完成登入。

**Why this priority**：沒有帳號，整個資產管理系統對終端使用者而言不存在。P1 是最小可用單元（MVP）：只要此故事成立，使用者即可完成「取得身分 → 進入系統 → 開始記帳」的最短閉環。

**Independent Test**：在全新資料庫上執行註冊流程；確認：(1) 註冊成功後自動登入並看到儀表板；(2) 資料庫中有該使用者、一組預設分類、一個「現金」帳戶；(3) 登出後能以同一組帳密再次登入。

**Acceptance Scenarios**：

1. **Given** 訪客開啟登入頁且資料庫尚無任何使用者，**When** 輸入合法電子郵件與符合強密碼規則的密碼送出註冊，**Then** 系統建立帳號、將該使用者設為管理員、自動登入、載入預設分類與「現金」帳戶。
2. **Given** 訪客開啟登入頁且資料庫已存在其他使用者，**When** 輸入新電子郵件、合法密碼完成註冊，**Then** 系統建立一般使用者帳號（非管理員）、自動登入，且其分類／帳戶與其他使用者完全隔離。
3. **Given** 已註冊使用者登出後重新開啟頁面，**When** 於登入頁輸入正確帳密，**Then** 系統回傳成功並發送 JWT Cookie；頁面顯示該使用者本次登入資訊（時間、IP、登入方式）。
4. **Given** 已註冊使用者忘記密碼或輸入錯誤，**When** 連續嘗試登入失敗，**Then** 系統顯示通用錯誤訊息（不揭露帳號是否存在），且每次失敗皆寫入稽核紀錄。

---

### User Story 2 — 管理員控管註冊政策與使用者帳號（Priority: P2）

管理員在管理介面可切換「公開註冊開關」、維護「允許註冊的 Email 白名單」；亦可直接建立、重設密碼、刪除使用者帳號，藉此在不同營運階段（封閉測試、邀請制、公開上線）採用不同開放度。

**Why this priority**：P1 解決了「能用」，P2 解決了「可控」。缺少 P2 時系統只能以第一位使用者為管理員 + 全開放註冊的組態運行，無法承擔真實營運。

**Independent Test**：以管理員身分切換公開註冊開關與白名單；確認一般訪客頁面的註冊行為隨設定即時生效（允許／拒絕），且刪除使用者帳號後該使用者的交易、帳戶、分類、預算、股票資料全部消失。

**Acceptance Scenarios**：

1. **Given** 管理員關閉公開註冊且白名單為空，**When** 訪客嘗試註冊任意 Email，**Then** 系統拒絕並提示註冊已關閉；管理員可直接在後台新增該使用者。
2. **Given** 管理員設定白名單 `alice@example.com`，**When** `bob@example.com` 嘗試註冊，**Then** 系統拒絕；當 `alice@example.com` 註冊時系統允許。
3. **Given** 管理員建立新使用者並勾選「授與管理員身分」，**When** 該使用者首次登入，**Then** 其身份為管理員並可進入管理介面。
4. **Given** 系統目前僅有一位管理員，**When** 該管理員嘗試刪除自己，或另一位管理員嘗試刪除最後一位管理員，**Then** 系統拒絕並顯示「系統必須至少保留一位管理員」。
5. **Given** 管理員刪除某位使用者，**When** 刪除完成，**Then** 該使用者的交易、帳戶、分類、預算、固定收支、股票、Passkey、登入紀錄、Google 綁定皆一併移除，系統中不留任何孤兒資料。

---

### User Story 3 — 以 Google 單一登入取得身分（Priority: P3）

具備 Google 帳號的訪客可一鍵登入；若是首次登入且註冊政策允許，系統自動建立對應帳號並匯入顯示名稱；若是既有帳號，Google 登入亦可作為補登入方式。

**Why this priority**：降低新使用者摩擦的重要加速器，但非 MVP 必要條件；在 `GOOGLE_CLIENT_ID` 未設定的佈署中此功能整段隱藏，不影響 P1/P2。

**Independent Test**：於 `.env` 設定 Google OAuth 憑證後重啟；登入頁顯示 Google 按鈕，點擊走完 OAuth Authorization Code Flow 後可成功登入；若移除 `GOOGLE_CLIENT_ID`，Google 按鈕不再出現，且原帳密流程完全不變。

**Acceptance Scenarios**：

1. **Given** 系統未設定 `GOOGLE_CLIENT_ID`，**When** 訪客開啟登入頁，**Then** 頁面不顯示任何 Google 相關元素。
2. **Given** 系統已設定 Google OAuth 且註冊政策允許該 Email，**When** 訪客首次以 Google 登入，**Then** 系統建立新帳號、匯入顯示名稱、自動登入；該帳號標記為「Google 綁定」但沒有本機密碼。
3. **Given** 使用者曾用 Google 首次註冊後，**When** 在帳號設定補設本機密碼，**Then** 之後可改以帳密登入，Google 綁定仍保留。
4. **Given** Google 登入回呼時 state 不相符（可能為 CSRF），**When** 後端比對失敗，**Then** 系統拒絕交換授權碼並返回登入頁顯示錯誤。

---

### User Story 4 — 以 Passkey 無密碼登入（Priority: P3）

使用者可在「帳號設定」註冊一組或多組 Passkey（指紋、Face ID、PIN、硬體金鑰）並命名；之後在登入頁點擊 Passkey 按鈕即可直接登入，不再輸入密碼。

**Why this priority**：提升體驗的高價值功能，但非必要。P1 已可讓使用者完成所有操作；Passkey 屬於錦上添花。

**Independent Test**：使用支援 WebAuthn 的瀏覽器註冊一組 Passkey；登出後在登入頁點擊 Passkey 登入，應能直接進入系統且不需輸入任何密碼。再註冊第二組 Passkey、刪除第一組，確認第二組仍可登入、第一組不再出現於清單。

**Acceptance Scenarios**：

1. **Given** 已登入使用者進入帳號設定，**When** 完成 Passkey 註冊流程並命名為「MacBook Touch ID」，**Then** 清單顯示該 Passkey 名稱與建立時間。
2. **Given** 使用者擁有至少一組 Passkey，**When** 登出後在登入頁點擊 Passkey 登入，**Then** 瀏覽器彈出驗證對話，成功驗證後即登入系統。
3. **Given** 使用者同時擁有兩組 Passkey，**When** 刪除其中一組，**Then** 該 Passkey 立即從清單消失且無法再用於登入；另一組不受影響。
4. **Given** 攻擊者嘗試在不同來源網址重放 Passkey 回應，**When** 伺服器比對 origin 白名單，**Then** 拒絕該請求並於稽核紀錄標記失敗原因。

---

### User Story 5 — 登入稽核與可視性（Priority: P2）

每一次登入（成功或失敗）都寫入稽核紀錄，使用者可在「帳號設定」檢視自己最近的 100 筆；管理員另可檢視自己作為管理員登入的 200 筆，以及全站 500 筆。

**Why this priority**：安全可視性是治理的基礎；沒有稽核紀錄，管理員無法察覺異常登入，使用者也無法回溯帳號是否被盜用。優先級高於便利性功能（P3）。

**Independent Test**：用正確帳密、錯誤帳密、Google、Passkey 各登入一次（共 4 筆），以管理員身分檢視全站稽核紀錄應可看到全部 4 筆，且每筆都標註時間、IP、登入方式、是否成功、管理員身分旗標。

**Acceptance Scenarios**：

1. **Given** 使用者剛完成登入，**When** 進入「帳號設定 → 登入紀錄」，**Then** 清單顯示本次登入，欄位包含時間、IP、方式，最新紀錄置頂；最多顯示 100 筆。
2. **Given** 來自 Cloudflare 的請求帶有 `CF-IPCountry` 標頭，**When** 寫入稽核紀錄，**Then** 國家代碼直接採用該標頭值；無此標頭時改查 ipinfo.io；私有網段 IP 標記為 `LOCAL`。
3. **Given** 管理員開啟「全站登入紀錄」畫面，**When** 點擊「同步」，**Then** 清單重新載入並顯示「上次同步時間」；即使某筆舊資料沒有主鍵，也能以時間戳備援識別並單筆刪除。
4. **Given** 管理員選取多筆紀錄，**When** 點擊「批次刪除」，**Then** 系統一次移除所選紀錄；剩餘紀錄不受影響。

---

### User Story 6 — 伺服器時間與 NTP 校正（Priority: P3）

管理員可在管理介面檢視伺服器真實時間、時區、採用時間（含偏移）、啟動後偏移量與 uptime，並於雲端部署遇到時區不一致時（例如 Zeabur / Docker 預設 UTC）調整偏移量，使排程能以台灣時間判斷。

**Why this priority**：運維屬性功能，部署在同時區機器上時完全用不到；但在跨時區 / 容器化部署的場景中不可或缺。

**Independent Test**：部署於 UTC 容器，將 `SERVER_TIME_OFFSET` 設為 `+28800000`（台灣時區）並重啟；管理介面顯示「採用時間」為台灣時間；觸發固定收支執行應以台灣當日日期計算。呼叫 NTP 校正預覽應回傳差異值而不實際套用。

**Acceptance Scenarios**：

1. **Given** 管理員開啟「伺服器時間」區塊，**When** 頁面載入，**Then** 顯示真實時間、時區、採用時間、偏移量、uptime 五項資訊。
2. **Given** 管理員輸入「目標時間 2026-04-24 12:00 +08:00」，**When** 送出調整，**Then** 系統計算並儲存相應偏移量；之後所有以系統時間為基準的排程（固定收支、月報）依新偏移運行。
3. **Given** 管理員點擊「NTP 查詢（不套用）」，**When** 後端依序詢問 `tw.pool.ntp.org`、`pool.ntp.org`、`time.google.com`、`time.cloudflare.com`，**Then** 系統回傳與本機差異值但不修改偏移。
4. **Given** 管理員輸入 NTP 主機 `[::1]` 或 `192.168.1.1` 等高風險目標，**When** 送出校正，**Then** 系統拒絕並提示僅接受 IPv4 公網地址或 FQDN。

### 邊界案例（Edge Cases）

- 註冊時電子郵件已被占用：回傳通用錯誤，不揭露具體原因。
- 密碼不符強密碼規則：前後端雙端驗證；後端為權威。
- 白名單啟用時 Google 首次註冊的 Email 不在白名單：拒絕建立帳號並提示聯繫管理員。
- 僅剩一位管理員嘗試解除自己的管理員身分或刪除自己：拒絕。
- JWT `token_version` 在登出／密碼變更後遞增：舊 Token 立即失效，即使 Cookie 尚未過期。
- Passkey 註冊時裝置不支援 WebAuthn：前端以清楚訊息告知使用者，不破壞頁面。
- NTP 查詢所有來源皆逾時（3 秒 fallback）：回傳錯誤訊息，不改動偏移。
- 使用者在兩個裝置同時登入後於其中一台變更密碼：另一台 Token 失效後需重新登入。
- 速率限制觸發（每 IP 15 分鐘 20 次）：回傳 429 並提示稍後再試，不寫入使用者帳戶鎖定紀錄。
- 管理員透過後台直接建立帳號：不套用白名單與公開註冊限制（管理員即是授權來源）。

## 需求 *(mandatory)*

### Functional Requirements

#### 註冊與登入
- **FR-001**：系統必須允許訪客以電子郵件與密碼註冊帳號，前提是該 Email（經 trim + lowercase 正規化後）尚未被使用、格式正確且密碼符合強密碼規則。Email 正規化規則同樣適用於登入、白名單比對、管理員新增使用者等所有牽涉 Email 的操作；正規化後的字串即為資料庫中儲存的值（不保留原始大小寫）。
- **FR-002**：系統必須強制密碼至少 8 字元，且同時包含大寫字母、小寫字母、數字、特殊符號。
- **FR-003**：系統必須在註冊成功後自動登入，並為該使用者建立以下預設資料：
  - **支出分類（8 項頂層）**：餐飲、交通、購物、娛樂、居住、醫療、教育、其他
  - **支出子分類（7 個頂層下的 27 項）**：餐飲 →〔早餐、午餐、晚餐、飲料、點心〕；交通 →〔公車/捷運、計程車、加油、停車費、高鐵/火車〕；購物 →〔日用品、服飾、3C產品、家電〕；娛樂 →〔電影、遊戲、旅遊、運動〕；居住 →〔房租/房貸、水電費、網路/電話、管理費〕；醫療 →〔掛號費、藥品、保健食品〕；教育 →〔學費、書籍、課程/補習〕。「其他」不配子分類。
  - **收入分類（5 項）**：薪資、獎金、投資、兼職、其他
  - **預設帳戶（1 個）**：名稱「現金」、初始餘額 0、圖示 `fa-wallet`
  - 每個預設分類皆標記 `is_default = 1`；使用者可改名、改色、隱藏，但若其下已有交易則不可刪除。
- **FR-004**：系統必須使用 JWT Token 並存放於 `HttpOnly`、`Secure`、`SameSite=Strict` 的 **persistent Cookie**；有效期由環境變數 `JWT_EXPIRES` 控制，**預設 7 天**；Cookie 的 `Max-Age` 與 JWT 有效期一致，瀏覽器關閉後仍有效；系統不提供「記住我」勾選，所有登入一律以相同有效期處理。
- **FR-005**：系統必須在下列事件發生時遞增資料庫端 `token_version`，使尚未過期的舊 Token 全部立即失效：（a）登出 ——同時清除 Cookie；（b）使用者變更密碼 ——無論由使用者自行於帳號設定變更、或由管理員重設，皆須遞增並強制所有裝置重新登入。
- **FR-006**：登入 API 必須在回應中附上本次登入的稽核紀錄（`currentLogin`），讓前端可立即顯示。
- **FR-007**：系統必須對指定路徑套用速率限制，分為兩個獨立計數桶（各自上限 20 次／15 分鐘／IP）：
  - **auth 桶**：`/api/auth/login`、`/api/auth/register`、`/api/auth/google` 共用；任一路徑觸頂皆一併封鎖 15 分鐘。
  - **靜態頁桶**：`/privacy`、`/terms` 共用，與 auth 桶互不影響。
  - 超過限額時回傳 HTTP 429 並附 `Retry-After` 標頭；速率限制不得寫入使用者帳戶鎖定紀錄。

#### Google SSO
- **FR-010**：系統必須僅在後端設定 `GOOGLE_CLIENT_ID` 時於登入頁顯示 Google 登入按鈕；否則完全隱藏，不影響其他流程。
- **FR-011**：系統必須以 OAuth Authorization Code Flow 完成 Google 登入，並在授權前由後端發行一次性 `state`，於回呼時驗證；`redirect_uri` 必須比對後端維護的白名單才放行——
  - 白名單預設包含 `https://<APP_HOST>/api/auth/google` 與 `http://localhost:<PORT>/api/auth/google`（供本機開發）。
  - 可由環境變數 `GOOGLE_OAUTH_REDIRECT_URIS`（逗號分隔）擴充。
  - 與 Google Cloud Console 在 OAuth 2.0 Client 設定的 Authorized redirect URIs 完全一致（兩邊同步維護）。
  - `redirect_uri` 不在白名單內時，後端拒絕交換授權碼並不建立登入 session，防止授權碼被重新導向至攻擊者控制的網址。
- **FR-012**：若 Google 登入為新 Email 且註冊政策允許，系統必須自動建立帳號，匯入顯示名稱，將密碼欄位填入隨機雜湊（意即不能用該隨機值登入）。
- **FR-013**：系統必須允許 Google 綁定帳戶的使用者之後在帳號設定補設本機密碼，補設後即可同時用帳密或 Google 登入。

#### Passkey（WebAuthn）
- **FR-020**：系統必須允許已登入使用者在帳號設定註冊零至多組 Passkey，每組可命名並獨立刪除。
- **FR-021**：系統必須允許使用者在登入頁以 Passkey 完成無密碼登入，採 **usernameless discoverable credential** 模式——使用者不須先輸入 Email 或任何識別資訊，點擊「使用 Passkey 登入」即由瀏覽器／作業系統列出本裝置可用的 Passkey 供使用者選擇；後端以 `userHandle`（於註冊時以 User ID 寫入）作為帳號查找依據。
- **FR-022**：系統必須比對 WebAuthn origin 白名單，拒絕 origin 不符的請求。
- **FR-023**：系統必須由伺服器本地（非 CDN）提供 WebAuthn 相關前端資源。

#### 管理員與註冊政策
- **FR-030**：系統必須自動將第一位註冊成功的使用者設為管理員；若資料庫升級後尚無任何管理員，最早建立的使用者必須被追認為管理員。
- **FR-031**：系統必須讓管理員可切換「是否開放公開註冊」與維護「允許註冊的 Email 白名單」。
- **FR-032**：白名單非空時，一般註冊與 Google 首次註冊皆須比對白名單；比對規則以清單中每一項的字串是否含 `*` 字元為切換依據——
  - **不含 `*`**：必須與註冊 Email 完全一致（大小寫不敏感）。例：`alice@example.com` 僅放行 `alice@example.com`。
  - **含 `*`**：視為 domain wildcard，僅支援 `*@<domain>` 格式，放行該 domain 下任一 local part。例：`*@example.com` 放行 `alice@example.com`、`bob@example.com`，但不放行 `carol@other.com`。
  - 多個項目之間為 **OR** 關係：符合任一項即通過。兩種格式可在同一清單並存。
- **FR-033**：白名單為空且公開註冊關閉時，訪客不得自行註冊；此時僅管理員可直接建立帳號。
- **FR-034**：系統必須允許管理員新增使用者（可選是否授與管理員身分）、重設任一使用者密碼、刪除任一使用者。
- **FR-035**：刪除使用者時，系統必須連帶刪除其所有交易、帳戶、分類、預算、固定收支、股票標的、股票交易、股利、Passkey、Google 綁定。登入稽核紀錄以 **混合策略** 處理：
  - **成功登入**紀錄（`success = 1`）：硬刪，與使用者一起消失。
  - **失敗登入嘗試**紀錄（`success = 0`）：**匿名化保留**——將 `user_id` 清為空字串、Email 欄位改以 SHA-256 雜湊（長度 64 hex；保留可比對但不可還原），維持 IP、時間、User Agent、失敗原因等攻擊偵測關鍵資訊。`user_id` 採空字串而非 NULL，以對齊既有 `NOT NULL` 欄位約束（見 [data-model.md](./data-model.md) §2.4 為權威）。
  - 目的：保護隱私的同時，不讓刪除帳號成為洗掉攻擊紀錄的手段。
- **FR-036**：系統必須拒絕任何會導致剩餘管理員數為零的刪除或降級操作，且該規則適用於管理員本人（不得自刪）。
- **FR-037**：管理員重設使用者密碼時，新密碼不得與舊密碼相同。

#### 登入稽核
- **FR-040**：系統必須為每一次登入（成功與失敗）寫入一筆稽核紀錄，欄位至少包含時間、IP、登入方式（password / google / passkey）、成功與否、失敗原因、是否以管理員身分登入。
- **FR-041**：系統必須優先以 Cloudflare `CF-IPCountry` 標頭作為國家代碼來源；缺此標頭時改查 ipinfo.io；內網／私有 IP 標記為 `LOCAL`。
- **FR-042**：一般使用者必須能在「帳號設定」看到自己最近的 100 筆登入紀錄。
- **FR-043**：管理員必須能額外看到「自己作為管理員身分登入」最近 200 筆，以及「全站所有使用者」最近 500 筆（含失敗）。
- **FR-044**：管理員的兩種紀錄清單必須支援單筆刪除、多選批次刪除、手動同步、並顯示「上次同步時間」。上次同步時間以瀏覽器 **localStorage** 為儲存層（鍵名 `assetpilot.audit.lastSyncAt`），為該瀏覽器本地值；使用者更換瀏覽器或清除瀏覽器資料後該欄顯示「尚未同步」而不顯示錯誤。
- **FR-045**：即使舊稽核資料缺少主鍵，系統仍必須能以時間戳備援識別並刪除單筆。
- **FR-046**：系統必須以 **90 天**為登入稽核資料的保留期限——超過 90 天的紀錄應由背景作業自動清除，避免資料庫無限成長。顯示層則維持 FR-042／FR-043 的上限（使用者 100 筆、管理員 200／500 筆），取最新者。清除作業頻率至少每日一次：實作上允許「啟動時立即執行一次 + 之後每 24 小時週期」，排程漂移亦不得使相鄰兩次執行間隔超過 48 小時（`max(interval) < 48h`）。

#### 伺服器時間與 NTP
- **FR-050**：管理員必須能在管理介面檢視伺服器真實時間、時區、採用時間（含偏移）、啟動後偏移量與 uptime。
- **FR-051**：管理員必須能以「目標時間」或「毫秒偏移量」兩種方式更新 `SERVER_TIME_OFFSET`；系統時鐘本身不變，僅排程邏輯使用偏移。
- **FR-052**：偏移值必須持久化於 `system_settings`，上限 ±10 年。
- **FR-053**：系統必須提供「NTP 查詢」功能，依序嘗試 `tw.pool.ntp.org`、`pool.ntp.org`、`time.google.com`、`time.cloudflare.com`，3 秒逾時 fallback；校正時須扣除單趟網路延遲。
- **FR-054**：「NTP 查詢」必須支援「僅預覽不套用」模式。
- **FR-055**：NTP 主機參數僅接受 IPv4 公網地址或 FQDN；拒絕 IPv6、私有網段（10/8、172.16/12、192.168/16、127/8）、IPv4-mapped、link-local 等 SSRF 風險目標。

#### 安全基線
- **FR-060**：所有使用者輸入必須經過 HTML 跳脫後方可插入 DOM。
- **FR-061**：分類顏色必須符合 `#RRGGBB` 格式，前後端雙端驗證。
- **FR-062**：系統必須啟用下列安全標頭（由 `helmet` 套件預設 + 自訂組態提供），並停用 `X-Powered-By`：
  - `Content-Security-Policy`（至少禁用 `unsafe-eval`，允許 `'self'` + 明確列舉之 CDN）
  - `Strict-Transport-Security`（`max-age≥31536000; includeSubDomains`）
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin` 或更嚴格
  - `X-Frame-Options: DENY`
  - `Permissions-Policy`（至少禁用 `geolocation=()`、`microphone=()`、`camera=()`）

  T098 驗收以此六項清單為權威；缺任一項即 fail。其他 helmet 預設標頭（如 `X-DNS-Prefetch-Control`）視為加分、不強制。
- **FR-063**：任何外部 CDN 腳本必須附加 SRI `integrity` 屬性。
- **FR-064**：`.env` 檔案權限必須限制讀寫為擁有者本身——
  - **POSIX 檔系（Linux / macOS / 容器）**：必須為 `0o600`（`stat -c '%a' .env` 回傳 `600`）。
  - **Windows 開發環境（NTFS）**：以 NTFS ACL 限制僅 `Administrators` 與 `%USERNAME%` 具寫入權限（`(Get-Acl .env).Access` 不得含其他身分），作為 POSIX mode 的等效替代。

  資料庫備份檔（`*.db*`）與 `.env` 皆必須列入 `.gitignore` 與 `.dockerignore`，不得進入版本控制或 Docker Image。
- **FR-065**：登入錯誤訊息必須採用通用化文案（例如「帳號或密碼錯誤」），不得揭露帳號是否存在。

### Key Entities

- **User（使用者）**：身分主體。關鍵屬性包含電子郵件（唯一）、密碼雜湊（bcrypt）、顯示名稱、主題偏好、是否為管理員、`token_version`、建立時間。與「Passkey」「Google 綁定」為一對多關聯；與交易、帳戶、分類、預算、股票等所有業務實體為擁有關係。
- **Passkey**：WebAuthn Credential。關鍵屬性包含 `credentialId`、`publicKey`、使用者自訂名稱、建立時間、最後使用時間。與 User 一對多。
- **GoogleAccountLink（Google 綁定）**：Google 子識別（`sub`）與 User 的綁定關係；一個 User 最多一筆。
- **LoginAuditLog（登入稽核）**：每次登入的事件紀錄。關鍵屬性包含 User ID、Email、登入方式、是否成功、失敗原因、IP、國家代碼、User Agent、建立時間、是否以管理員身分登入。
- **SystemSettings（系統設定）**：註冊政策（公開註冊開關、白名單）、伺服器時間偏移、SMTP 設定、報表排程設定等全站單一資料列。
- **RegistrationAllowlist（註冊白名單）**：`SystemSettings` 中的 Email 陣列欄位。

## 成功標準 *(mandatory)*

### Measurable Outcomes

- **SC-001**：第一次造訪的訪客可在 90 秒內完成註冊、登入並抵達儀表板（含填寫電子郵件、密碼兩次、提交）。
- **SC-002**：已擁有 Passkey 的使用者從登入頁到抵達儀表板的平均時間不超過 5 秒。
- **SC-003**：在正式環境中，100% 的登入事件（成功與失敗）都必須有對應的稽核紀錄。
- **SC-004**：系統必須在任何時刻保有至少一位管理員；以隨機模擬 1,000 次「嘗試刪除最後管理員」的情境中，必須全數被拒絕。
- **SC-005**：NTP 校正 P95 延遲不超過 3 秒；4 個 fallback 來源任一可達即回傳。
- **SC-006**：以自動化掃描工具檢查 `/api/auth/*` 端點回應，不得出現揭露「帳號不存在」與「密碼錯誤」差異的情況。
- **SC-007**：註冊政策切換後，訪客註冊行為立即生效——後端無記憶體快取 `systemSettings`，每次 `/api/auth/register` 皆重讀 DB；以工具每 10 秒連打一次註冊請求觀察，自政策切換至首次收到變更結果的時間必須 ≤ 60 秒（包含傳輸與 DB 寫入延遲）。
- **SC-008**：刪除使用者後，以資料庫直接查詢驗證，該 User ID 在所有業務資料表（交易、帳戶、分類、預算、固定收支、股票相關、Passkey、Google 綁定）中不得再出現任何紀錄；登入稽核表中僅允許保留 `success = 0` 且 `user_id IS NULL` 的匿名化失敗紀錄。
- **SC-009**：登入稽核清除作業每日執行至少一次，超過 90 天的紀錄數在每日清理後必須為 0；以連續模擬 180 天登入事件驗證，資料表筆數上限不得超過該 90 天內的實際登入次數。

## 假設 *(Assumptions)*

- 「第三方登入」在本功能範圍內僅含 Google；Facebook、Apple、Line、GitHub 等不在此規格內。
- 「雙因素認證（2FA／TOTP）」刻意不實作；Passkey 視為等效或更強的替代方案。
- 「帳號鎖定策略」（例如連續 N 次失敗鎖定 M 分鐘）刻意不實作；以速率限制取代。
- 使用者電子郵件在註冊後**不可變更**，顯示名稱可變更。
- 所有時間顯示與排程判斷預期以「伺服器採用時間」為準；前端僅負責呈現。
- WebAuthn 前端資源皆由伺服器本地提供，不依賴任何外部 CDN。
- 系統至少部署於 HTTPS 環境（`Secure` Cookie 的前提）；HTTP-only 部署不在支援範圍。
- 本規格假設資料庫為單節點 SQLite（sql.js），不考慮多節點一致性問題。
