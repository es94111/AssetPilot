# Specification Analysis Report — 001-user-permissions（第三輪，post-remediation）

**Date**：2026-04-24
**Feature**：001-user-permissions
**Scope**：`spec.md`、`plan.md`、`tasks.md`、`contracts/auth.openapi.yaml`、`quickstart.md`、`data-model.md`、`research.md`
**Baseline**：第二輪報告（同檔前版）列出的 2 HIGH（F1／C1）、4 MEDIUM（F3／C2／I1／C3）、11 LOW，共 17 條；本輪於同 PR 已全數處置，並重新掃描是否衍生新漂移。

---

## 0. 上輪處置結果總表（驗證）

| 上輪 ID | 等級 | 處置路徑 | 現況檔案：行 | 狀態 |
|---|---|---|---|---|
| F1（HIGH） | Inconsistency | [plan.md](./plan.md) CT-1（3 案決策表）；[tasks.md](./tasks.md) T030／T042／T070 單向翻轉 | plan.md:161-206；tasks.md:114,145,221 | ✅ closed |
| C1（HIGH→MEDIUM） | Constitution | [plan.md](./plan.md) CT-2；[tasks.md](./tasks.md) T098（6 項）、[changelog.json](../../changelog.json) 紀錄 | plan.md:207-242；tasks.md:250-257 | ✅ closed |
| F3（MEDIUM） | Inconsistency | `user_id = NULL` → `user_id = ''` + SHA-256 | spec.md:190（FR-035）、data-model.md:104,120 | ✅ aligned |
| C2（MEDIUM） | Constitution | 新增 T029（DUMMY_HASH 時序對齊） | tasks.md:95 | ✅ closed |
| I1（MEDIUM） | Inconsistency | FR-064 補 Windows NTFS ACL fallback | spec.md:225-229；plan.md:224-228,235-237 | ✅ closed |
| C3（MEDIUM） | Coverage | 新增 quickstart.md §3.3.1（1000-fuzz）+ T099 | quickstart.md:144-162；tasks.md:258 | ✅ closed |
| A1（LOW） | Ambiguity | SC-007「60 秒」補「無記憶體快取」語意 | spec.md:251 | ✅ closed |
| A2（LOW） | Ambiguity | FR-062 列出 6 項 header | spec.md:215-223 | ✅ closed |
| A3（LOW） | Ambiguity | FR-046 補 `max(interval) < 48h` | spec.md:202 | ✅ closed |
| D1（LOW） | Duplication | T033 移除 token_version 重複 | tasks.md:117 | ✅ closed |
| I2（LOW） | Inconsistency | 以 `spawn_task` chip 轉獨立 PR | 另起 session | ⏭️ deferred |
| I3（LOW） | Inconsistency | T094 補 9 項 release notes（含 CT-1／CT-2） | tasks.md:246 | ✅ closed |
| F4（LOW） | Inconsistency | FR-044 指定鍵名 `assetpilot.audit.lastSyncAt` | spec.md:200 | ✅ closed |
| C4（LOW） | Coverage | T065 補 WebAuthn 不支援 fallback UX | tasks.md:203 | ✅ closed |
| F5（LOW） | Inconsistency | T001 加入 `grep -oE 'process\.env\.[A-Z_]+'` 同步檢查 | tasks.md:42 | ✅ closed |
| I5（LOW） | Inconsistency | ~~localhost server URL~~（屬刻意保留，redocly 仍 1 warning） | contracts/auth.openapi.yaml:22 | ✅ accepted |
| A4（LOW） | Ambiguity | （上輪判定不構成新風險，納入 A1 語意釐清同批處置） | — | ✅ folded |

**契約層 redocly 狀態**：1 warning（`localhost:{port}` 本機 server；已於 plan.md 明確標記為刻意保留）。

---

## 1. 本輪新發現（post-remediation drift）

本輪重新掃描是否因處置動作引入新的不一致；共發現 **4 條 LOW** 漂移，無 HIGH／MEDIUM／CRITICAL。

| ID | 類別 | 等級 | 位置 | 摘要 | 建議 |
|---|---|---|---|---|---|
| **D1** | Drift | LOW | [plan.md](./plan.md):221 | CT-2 驗收項 #1 仍寫「四個 header 均存在（FR-062；A2 列於 LOW 未阻擋）」，但 FR-062 已擴充至 6 項，T098 同步更新至 6 項；plan.md 這段文字未同步。 | 將「四個 header」改為「六個 header」，並移除「A2 列於 LOW 未阻擋」括號（A2 已於本輪 closed）。 |
| **D2** | Drift | LOW | [tasks.md](./tasks.md):155（T046） | spec.md FR-044 已指定 localStorage 鍵名為 `assetpilot.audit.lastSyncAt`，但 T046 僅寫「localStorage 快取」，未引用鍵名。實作時讀寫不同 key 將造成 regression。 | T046 增補：「localStorage 鍵名 `assetpilot.audit.lastSyncAt`（與 FR-044 權威同步）」。 |
| **D3** | Drift | LOW | [tasks.md](./tasks.md):246（T094） | T094 release notes 已列 (a)–(i) 9 項含 CT-1／CT-2，但本輪新增的 T099（SC-004 1000-fuzz 壓測）未納入 release notes 清單。 | 於 (i) 後追加 (j)「SC-004 最後管理員保護 1000 次壓測通過（C3／T099）」。 |
| **D4** | Drift | LOW | [quickstart.md](./quickstart.md):22,26 | §1.1 `.env` 範例仍用 `APP_HOST=app.example.com`、`GOOGLE_OAUTH_REDIRECT_URIS=https://app.example.com/...`，但 contracts/auth.openapi.yaml 已改為 `app.your-domain.tld`（配合 redocly `no-server-example.com` rule）。若維護者 copy-paste quickstart，部署環境的白名單又會是 `app.example.com` → 與契約範例不一致。 | 將 §1.1 兩處 `app.example.com` 改為 `app.your-domain.tld`，或註解為「請替換為實際網域」。 |

**備註**：以上 4 條皆屬「文字同步」級 drift，不阻擋合併；建議單一後續 commit 一次修齊。

---

## 2. 需求覆蓋率（保持 100%）

**Total FR**：42；**有 ≥ 1 個 task 對應**：42；**Coverage**：100%。
**Total SC**：9；**buildable SC（SC-003–SC-009）覆蓋**：9/9（SC-004 本輪新增 T099、SC-007 新增 A1 語意釐清後仍由既有 T031 DB 重讀路徑覆蓋）。

| 新／變更項 | 來源 | 對應 Task | 狀態 |
|---|---|---|---|
| FR-035（user_id='' + SHA-256） | 本輪 F3 | T035、T036 | ✅ |
| FR-044（鍵名 `assetpilot.audit.lastSyncAt`） | 本輪 F4 | T046（建議補鍵名，見 D2） | ⚠️ drift |
| FR-046（max(interval) < 48h） | 本輪 A3 | T014（現行 24h 週期已滿足 `< 48h`） | ✅ |
| FR-062（6 項 header） | 本輪 A2 | T098（已同步） | ✅ |
| FR-064（Windows NTFS ACL fallback） | 本輪 I1 | T098 第 3 項（已同步） | ✅ |
| SC-004（1000 次壓測） | 本輪 C3 | T099、quickstart §3.3.1 | ✅ |
| 時序對齊（bcrypt DUMMY_HASH） | 本輪 C2 | T029 | ✅ |

---

## 3. Constitution Alignment（憲章 v1.1.0）

- **Principle I（zh-TW）**：✅ PASS
  spec.md／plan.md／tasks.md／research.md／data-model.md／quickstart.md／contracts/**
  皆為 zh-TW；保留識別字（`token_version`、`JWT_EXPIRES`、`DUMMY_HASH` 等）為英文。
- **Principle II（OpenAPI 3.2.0）**：✅ PASS
  - `contracts/auth.openapi.yaml` 首行 `openapi: 3.2.0`（字面值字串）。
  - `info.version: 0.2.0`（因 CT-1 三組路徑 rename 屬 breaking，已由 0.1.0 bump 至 0.2.0）。
  - 所有 auth 端點帶 `security`；公開端點以 `security: []` 明示 opt-out。
  - `npx @redocly/cli@2.29.2 lint` 回 `Your API description is valid. 🎉`（僅 1 個 localhost 警告，屬刻意保留）。
  - handler ↔ paths 映射：以 CT-1 原子翻轉後 server.js 與契約一致。

---

## 4. Unmapped Tasks（零個）

所有 65 個 task（T001–T003、T010–T016、T020–T029、T030–T037、T040–T047、T050–T056、T060–T065、T070–T075、T090–T099）皆可追溯至至少一項 FR／SC 或 CT。

---

## 5. Metrics

| 指標 | 值 |
|---|---|
| Total Requirements（FR） | 42 |
| Total Success Criteria（SC） | 9 |
| Total Tasks | 65 |
| Requirement Coverage | 100%（42/42） |
| Ambiguity Count | 0（上輪 3 項 A1/A2/A3 皆已釐清） |
| Duplication Count | 0（D1 去重後無新重複） |
| **CRITICAL** | **0** |
| **HIGH** | **0** |
| **MEDIUM** | **0** |
| **LOW**（新發現 drift） | **4** |

---

## 6. Next Actions

- **無阻擋項**。可進入 `/speckit.implement`。
- **建議（非阻擋）**：於實作開始前以**單一 commit** 清齊本輪 4 項 LOW drift（plan.md 四/六 header 文字、T046 localStorage 鍵名、T094 release notes 第 (j) 項、quickstart.md `.env` 範例網域）；commit message 建議：
  ```
  docs(spec): 同步 FR-044／FR-062／T099 至 plan/tasks/quickstart（post-remediation drift）
  ```
- **I2 後續**：`backend/`／`frontend/`／`SRS copy.md`／`asset_openapi.yaml` 殘留清理已以 `spawn_task` 轉獨立 session／PR；本功能不阻擋。

---

## 7. Remediation Offer

本報告保持**唯讀**；如需直接修補本輪 4 項 LOW drift，可回覆「直接修補 D1~D4」。

---

**Summary**：本 spec 已於第二輪同 PR 內處置 2 HIGH + 4 MEDIUM + 11 LOW（含 CT-1／CT-2 兩項 Complexity Tracking 決策）。第三輪僅發現 4 項文字級 drift（LOW），無任何阻擋合併的項目。契約層 redocly lint 通過（1 個 localhost 警告刻意保留）。憲章 Principle I／II 均 PASS。可進入實作階段。
