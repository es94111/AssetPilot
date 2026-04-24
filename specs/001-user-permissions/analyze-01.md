# Specification Analysis Report — 001-user-permissions

**功能**：使用者與權限（Users & Permissions）
**分析時間**：2026-04-24
**模式**：`/speckit.analyze`（READ-ONLY，未修改任何檔案）
**Artifacts**：[spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)、[contracts/auth.openapi.yaml](./contracts/auth.openapi.yaml)
**Constitution**：[.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.1.0（Principle I：zh-TW 文件；Principle II：OpenAPI 3.2.0 字面值）

---

## 1. Findings Table

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| **F1** | Inconsistency | **HIGH** | tasks.md T030 / T042 / T070；contracts/auth.openapi.yaml vs server.js | 契約定義的路徑與既有實作三組不一致（`/api/admin/system-settings` vs `/api/admin/settings`、`/api/admin/login-audit*` vs `/api/admin/login-logs*`、`/api/server-time*` vs `/api/admin/server-time*`）；tasks 以「對齊契約**或反之**」留做實作時決定，決策推遲將阻擋 Phase 4 / 5 / 8 起步。Principle II 規則 #2 要求 handler 與 `paths.*` 必須匹配，懸而未決即違憲。 | 於 `/speckit.plan` 或 `/speckit.specify` 再補一輪決策；我傾向**對齊契約**（路徑 naming 符合 REST 慣例）並於 plan.md Complexity Tracking 記錄 server.js 既有路由的 rename migration（T030 301/307 轉導 1 個版本）。決策後更新 tasks.md 把「對齊或反之」改為單一執行指令。 |
| **C1** | Coverage Gap | **HIGH** | spec.md FR-060/FR-061/FR-062/FR-063/FR-064；research.md §1 | 五項安全基線 FR 於 research.md §1 標記「已實作」，但 tasks.md 內**無任何任務**重新驗證其存在（既無驗收、也無 regression guard）。若日後重構誤刪 `helmet`、CSP、SRI integrity 或 `.env` 權限，本規格交付時不會察覺。 | 於 Phase 9 Polish 追加一個「安全基線回歸檢查」任務：實際 curl 一次拿 headers 驗 `helmet` 啟用、`grep integrity=` 於 `index.html`、`stat -c '%a' .env` 驗 `0o600`（非 Windows 環境）、confirm `.gitignore`／`.dockerignore` 含 `*.db*`。 |
| **F2** | Inconsistency | **MEDIUM** | tasks.md T030 | T030 建議以 HTTP 301 轉導 `/api/admin/settings` → `/api/admin/system-settings`。301 為永久快取、瀏覽器會記住；對 API 路徑而言 307／308 更合適（保留 method + body、避免永久快取）。 | 改為 307（暫時）或 308（永久但保留 method）；或直接 rename 不轉導，同 PR 把 `app.js` 內所有呼叫點一次改完。 |
| **F3** | Inconsistency | **MEDIUM** | spec.md FR-035 vs data-model.md §2.4 / tasks.md T035 | spec FR-035 敘述「`user_id` 置 **NULL**」；data-model §2.4 與 T035 則以 `user_id = ''`（空字串）實作；research.md §4 備註語意等價。spec 與實作文字不一致，讀者會誤解。 | 更新 spec FR-035 把「置 NULL」改為「匿名化（user_id 清為空字串、email 改為 SHA-256 雜湊）」，並以 data-model.md §2.4 為權威；或反之把欄位改 NULLable。 |
| **C2** | Coverage Gap | **MEDIUM** | spec.md SC-006；tasks.md T027 / T020 | SC-006「不得揭露帳號不存在」只由 T027 的通用錯訊字串涵蓋；**時序側通道**（bad_password 比 no_such_user 快 ~100ms，因為後者未走 bcrypt）在 tasks 無對應任務。自動化掃描很容易量到時間差。 | 於 Phase 3 或 Phase 9 追加任務：「登入不存在帳號時仍執行一次 dummy bcrypt（固定 hash）補齊時間，使成功／失敗／無此帳號三條路徑時間差 < 20ms」。 |
| **I1** | Inconsistency | **MEDIUM** | spec.md FR-064；plan.md Technical Context | FR-064「`.env` 權限必須為 `0o600`」在 Windows（Primary working directory 的開發環境）無法 enforce（NTFS ACL 不是 POSIX mode）；plan 也未說明 Windows fallback。 | spec FR-064 補上「於 POSIX 檔案系統；Windows 開發環境以 NTFS ACL 限制 Users/Authenticated Users 寫入權限為等效替代」；或在 plan Technical Context 新增一段 OS-specific 備註。 |
| **C3** | Coverage Gap | **MEDIUM** | spec.md SC-004；tasks.md T034 | SC-004 要求「隨機模擬 1,000 次『嘗試刪除最後管理員』必須全數被拒絕」。T034 實作單次檢查，但沒有壓力／fuzz 測試任務。驗收文件（quickstart.md §3.3）亦只有單次案例。 | 追加任務：於 quickstart.md §3.3 附一段 bash for loop 跑 1000 次 DELETE + 統計回應碼，期望 1000/1000 回 400；或於測試欄目明示「驗收時以腳本執行一次，紀錄於 commit 註解」。 |
| **A1** | Ambiguity | **LOW** | spec.md SC-007 | SC-007「註冊政策切換後，訪客註冊行為最多在 60 秒內生效（含快取失效）」——「快取」指哪一層未明示（服務端記憶體、Cloudflare edge、瀏覽器）。 | 明示快取層：「後端記憶體中的 `systemSettings` 緩存 TTL ≤ 60 秒」或「切換時立即失效並下次請求重讀 DB」；若無記憶體快取則把本句刪為「立即生效」。 |
| **A2** | Ambiguity | **LOW** | spec.md FR-062 | 「啟用 CSP、HSTS、X-Content-Type-Options、Referrer-Policy **等**安全標頭」——「等」是開放列表，測試難以通/不過。 | 列出完整清單（含 `X-Frame-Options: DENY`、`Permissions-Policy` 等）或寫成「至少包含下列 N 項；多於此清單視為加分」。 |
| **D1** | Duplication | **LOW** | tasks.md T015 / T033 / existing server.js:2947 / server.js:3988 | T015（Foundational）驗證兩處既有 `token_version +1`；T033（US2）再驗證 admin reset 分支的同一行程；語義高度重疊。 | 把 T033 的 token_version 檢查條款刪除，只留 FR-037「新舊密碼不同」驗證；T015 已是權威。 |
| **I2** | Inconsistency | **LOW** | plan.md Project Structure；倉庫根 `backend/`、`frontend/` | plan 明示「早期實驗性拆分，本功能不納入範圍」；但相應目錄仍存在於倉庫，新貢獻者易誤改。 | 非本功能任務；建議開 spawn task 檢討是否刪除 `backend/`、`frontend/`、`SRS copy.md`、`asset_openapi.yaml` 等殘留。 |
| **I3** | Inconsistency | **LOW** | tasks.md T094 | T094 說「`currentVersion` bump」但未指定目標版號。本功能包含 migration、新路由、行為變更——屬 minor bump（4.22.0），非 patch。現行 `currentVersion` 為 4.21.1。 | T094 描述補「bump 至 4.22.0（minor：新增 2 桶 rate limiter、redirect_uri 白名單、Email 正規化 migration、90 天稽核清除、混合刪除策略）」。 |
| **F4** | Inconsistency | **LOW** | spec.md FR-044；tasks.md T046 | FR-044「顯示上次同步時間」沒指定資料來源；T046 用 localStorage。若使用者換瀏覽器則看不到上次時間。 | spec 明示「上次同步時間以 localStorage 紀錄，為該瀏覽器本地值」；或改存 server 端 `system_settings.last_sync_at`。 |
| **A3** | Ambiguity | **LOW** | spec.md FR-046；tasks.md T014 | FR-046「清除作業頻率至少每日一次」；T014 以 `setInterval(24h)` 實作。若伺服器每天重啟一次、每次啟動立即跑一次，其實頻率 ≥ 1 次/日 ✓；但若排程漂移（如啟動時間每天晚 1 分鐘）18 個月後可能錯過一天。 | 改為 cron-style 固定 UTC 時間（或 `serverTimeNow()` 基準）；或 spec 補「無須嚴格 24h 週期，僅要求 `max(interval) < 48h`」。 |
| **C4** | Coverage Gap | **LOW** | spec.md Edge Case「Passkey 註冊時裝置不支援 WebAuthn」；tasks.md T064/T065 | Edge Case 要求「前端以清楚訊息告知使用者」；tasks 未顯式涵蓋 fallback UX（如隱藏按鈕／顯示提示）。 | T065 描述補一行：「若 `!window.PublicKeyCredential` 則按鈕變灰 + hover 提示『本瀏覽器不支援 WebAuthn』，不影響頁面載入」。 |
| **F5** | Inconsistency | **LOW** | tasks.md T001 / .env.example | T001 只描述新增 `JWT_EXPIRES` 與 `GOOGLE_OAUTH_REDIRECT_URIS`，但 spec 出現的其他環境變數（`RESEND_API_KEY`、`RESEND_FROM_EMAIL`、`APP_URL` 等）之既有敘述未驗證是否仍同步。 | T001 描述補「同步確認 `.env.example` 與實際程式讀取的 `process.env.*` 一致，以 `grep -o 'process\\.env\\.[A-Z_]*' server.js` 對照」。 |

### Overflow

找到 15 個 finding，未達 50 條上限；無 overflow。

---

## 2. Coverage Summary Table（FR → Tasks）

| Requirement | Has Task? | Task IDs | Notes |
|-------------|-----------|----------|-------|
| FR-001（Email 正規化） | ✅ | T010, T011, T020 | migration + runtime 雙軌 |
| FR-002（強密碼） | ✅ | T022 | |
| FR-003（預設分類/帳戶） | ✅ | T022（經 `createDefaultsForUser`） | FR-003 全文權威於 spec |
| FR-004（JWT 7d / persistent cookie） | ✅ | T024 | |
| FR-005（token_version 遞增） | ✅ | T015, T026, T033, T055 | |
| FR-006（currentLogin） | ✅ | T025 | |
| FR-007（2 桶 rate limit） | ✅ | T013, T091 | |
| FR-010（Google 按鈕條件渲染） | ✅ | T056 | |
| FR-011（redirect_uri 白名單） | ✅ | T050, T051, T052 | |
| FR-012（Google 首次建帳） | ✅ | T053 | |
| FR-013（補設本機密碼） | ✅ | T055 | |
| FR-020（Passkey 註冊） | ✅ | T061, T063 | |
| FR-021（usernameless） | ✅ | T060, T065 | |
| FR-022（origin 白名單） | ✅ | T062 | |
| FR-023（WebAuthn 本地資源） | ✅ | T064 | |
| FR-030（首位使用者追認） | ✅ | T023 | |
| FR-031（切換公開註冊） | ✅ | T031 | |
| FR-032（白名單 `*@domain`） | ✅ | T012, T021, T031 | |
| FR-033（全關時僅管理員建帳） | ✅ | T020, T032 | |
| FR-034（admin CRUD 使用者） | ✅ | T032, T033, T034 | |
| FR-035（混合刪除策略） | ✅ | T035, T036 | 見 F3：spec 措辭需對齊 |
| FR-036（至少 1 位管理員） | ✅ | T034 | 見 C3：未含 1,000 次 fuzz |
| FR-037（重設密碼 ≠ 舊密碼） | ✅ | T033 | |
| FR-040（每次登入稽核） | ✅ | T040 | |
| FR-041（CF-IPCountry fallback） | ✅ | T041 | |
| FR-042（使用者 100 筆） | ✅ | T043, T047 | |
| FR-043（管理員 200／500） | ✅ | T044 | |
| FR-044（單刪／批次刪／同步） | ✅ | T045, T046 | 見 F4 |
| FR-045（無主鍵備援刪除） | ✅ | T045 | |
| FR-046（90 天保留） | ✅ | T014 | 見 A3 |
| FR-050（伺服器時間面板） | ✅ | T075 | |
| FR-051（2 種偏移輸入） | ✅ | T071 | |
| FR-052（±10 年 bounds） | ✅ | T071 | |
| FR-053（NTP fallback 3s） | ✅ | T074 | |
| FR-054（預覽模式） | ✅ | T072 | |
| FR-055（NTP host 白名單） | ✅ | T073 | |
| FR-060（HTML escape） | ⚠️ | — | research.md §1 標「已實作」但無 regression task（C1） |
| FR-061（色碼 hex 驗證） | ⚠️ | — | 同上（C1） |
| FR-062（安全標頭） | ⚠️ | — | 同上（C1）+ 見 A2 |
| FR-063（CDN SRI integrity） | ⚠️ | — | 同上（C1） |
| FR-064（.env 權限／gitignore） | ⚠️ | — | 同上（C1）+ 見 I1 |
| FR-065（通用錯誤訊息） | ✅ | T027 | 見 C2（時序側通道） |

**FR 覆蓋率**：37/42 FR 有對應任務（88.1%）；5 項 FR-06x 被 research.md §1 認定為「已實作」但缺 regression task（C1）。

---

## 3. Coverage Summary Table（SC → Tasks）

| Success Criterion | Has Task? | Task IDs | Notes |
|---|---|---|---|
| SC-001（90 秒完成註冊） | ✅ | US1 Phase 3 全體 | UX 時序由 quickstart §2 驗證 |
| SC-002（Passkey → dashboard ≤ 5s） | ⚠️ | T060–T065 | 無顯式效能量測任務 |
| SC-003（100% 登入稽核） | ✅ | T040 | |
| SC-004（1,000 次阻擋最後 admin） | ⚠️ | T034 | 單次實作；fuzz 缺（C3） |
| SC-005（NTP P95 ≤ 3s） | ✅ | T074 | |
| SC-006（不揭露帳號存在） | ⚠️ | T027 | 缺時序側通道（C2） |
| SC-007（政策 60 秒內生效） | ⚠️ | T030–T031 | 快取層未明確（A1） |
| SC-008（刪除後 DB 零殘留） | ✅ | T035 + quickstart §3.2 | |
| SC-009（90 天後刪除 0 筆） | ✅ | T014 + quickstart §6 | |

**SC 覆蓋率**：6/9 完整覆蓋，3/9 部分覆蓋（SC-002/SC-004/SC-006/SC-007）。

---

## 4. Unmapped Tasks

所有 62 個任務皆可映射到 FR／SC／Foundational／Constitution。**無未映射任務**。

頂層關係：
- Phase 1 Setup（T001–T003）→ 環境變數／常量支援 FR-004、FR-007、FR-011、FR-046
- Phase 2 Foundational（T010–T016）→ 跨 Story 共用能力
- Phase 9 Polish（T090–T097）→ quickstart 驗收 + 憲章與版本紀律

---

## 5. Constitution Alignment Issues

| Principle | Compliance | Notes |
|---|---|---|
| **I. 繁體中文文件** | ✅ PASS | spec / plan / tasks / research / data-model / quickstart / contracts 全為 zh-TW；識別字與環境變數英文屬例外條款。 |
| **II. OpenAPI 3.2.0 字面值** | ⚠️ 條件 PASS | contracts/auth.openapi.yaml 已宣告 literal `3.2.0`、根 openapi.yaml 已存在；T016／T092／T093 有驗證任務。**但** F1 的路徑不匹配如未解決將違反規則 #2（handler 必 match paths）。 |
| **Development Workflow** | ✅ PASS | 功能分支 `001-user-permissions` 已建；T094／T095 涵蓋版本紀律；T096 承諾 zh-TW migration 說明。 |

---

## 6. Metrics

| 指標 | 值 |
|---|---|
| Total Functional Requirements | 42 |
| Total Success Criteria | 9 |
| Total User Stories | 6 |
| Total Tasks | 62 |
| Phases | 9（Setup + Foundational + 6 Story + Polish） |
| FR Coverage（≥1 task） | 37/42（88.1%） |
| FR 覆蓋但未含 regression task | 5（FR-060 ~ FR-064） |
| SC 覆蓋（完整） | 6/9（66.7%） |
| Unmapped Tasks | 0 |
| Ambiguity Count | 3（A1, A2, A3） |
| Duplication Count | 1（D1） |
| Inconsistency Count | 6（F1, F2, F3, F4, F5, I1, I2, I3）——F 系列 5 + I 系列 3 = 8，但與 F3/I1 部份重疊，去重後 6 |
| Coverage Gaps | 4（C1, C2, C3, C4） |
| Constitution Violations（當下） | 0（但 F1 若不解決會觸發 Principle II 違規） |
| **CRITICAL** | **0** |
| **HIGH** | **2**（F1, C1） |
| **MEDIUM** | **4**（F2, F3, C2, I1, C3）——C3 計入 MEDIUM，共 5 |
| **LOW** | **8**（A1, A2, D1, I2, I3, F4, A3, C4, F5）——去重 8 |

---

## 7. Next Actions

### 無 CRITICAL 但有 2 項 HIGH，建議在 `/speckit.implement` 之前處理：

1. **解決 F1 路徑不匹配**（阻塞 Phase 4／5／8 起步）
   - 以一次 `/speckit.plan` 或直接編輯 plan.md + tasks.md 定案「對齊契約」或「對齊既有 server.js」
   - 建議對齊契約（REST-idiomatic）並將 server.js 路由 rename 列入 T030／T042／T070；`app.js` 呼叫點同 PR 一起改
   - 更新 tasks.md 把所有「對齊 ... 或反之」改為單一指令

2. **補上 C1 安全基線 regression task**
   - 於 Phase 9 追加一個 T098「安全基線回歸檢查」：curl 驗 headers、grep SRI、stat .env 權限、confirm gitignore／dockerignore

### MEDIUM（建議同一 PR 帶上，不阻擋）：

- F2：把 T030 301 → 307/308 或直接 rename（採後者較乾淨）
- F3：更新 spec FR-035 措辭與 data-model.md §2.4 對齊
- C2：Phase 3 或 Phase 9 補「bcrypt dummy hash 時序對齊」任務
- I1：spec FR-064 加 POSIX vs Windows fallback；或 plan Technical Context 增 OS 備註
- C3：quickstart §3.3 附 1,000 次 fuzz 腳本

### LOW：可於實作過程或下一版 PR 處理；不阻擋本次交付。

### 建議指令序列

```text
# 方式 A：進行定案（不走 speckit，直接編輯）
編輯 plan.md Complexity Tracking + tasks.md T030/T042/T070 + spec.md FR-035 + spec.md FR-064

# 方式 B：以 speckit 再推一輪
/speckit.plan "路徑命名以契約為權威，server.js 既有路由 rename + app.js 同步；於 Complexity Tracking 記錄 migration。"
/speckit.tasks "依 plan 定案更新 T030/T042/T070；追加 Phase 9 T098 安全基線回歸檢查；追加 T099 bcrypt dummy hash 時序對齊。"
/speckit.analyze   # 重跑驗證 HIGH 已清
/speckit.implement # 開始動手
```

---

## 8. Remediation Offer

是否要我針對 top HIGH／MEDIUM（F1、C1、F2、F3、C2、I1、C3）產出**具體的**修訂 diff 建議（spec.md／plan.md／tasks.md）？

- 若要，請回「remediate」或指定特定 finding ID（如 `remediate F1 C1 F3`）
- 若暫不需，告訴我可直接進入 `/speckit.implement` 或其他後續步驟

報告結束。
