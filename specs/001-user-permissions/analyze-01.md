# Specification Analysis Report — 001-user-permissions（第四輪）

**Date**：2026-04-24
**Feature**：001-user-permissions
**Scope**：`spec.md`、`plan.md`、`tasks.md`、`contracts/auth.openapi.yaml`、`quickstart.md`、`data-model.md`、`research.md`
**Baseline**：第三輪報告（同檔前版）已處置 2 HIGH + 4 MEDIUM + 11 LOW + 4 drift；本輪重新掃描，發現第三輪修正 F3（user_id NULL → '' + SHA-256）時**未完整傳播**至三個下游文件。

---

## 0. 第三輪處置狀態（回顧）

17 條基線項全數閉合（15 closed + 1 accepted [localhost] + 1 deferred [I2 spawn_task]）；
4 項 post-remediation drift（D1–D4）於同輪批次閉合。**累積至第四輪所有前置項均已 closed**。

---

## 1. 本輪新發現（F3 修正未完整傳播）

第二輪 F3 將「`user_id = NULL`」改為「`user_id = ''` + SHA-256」，但**僅更新了 spec.md FR-035（L190）與 data-model.md §2.4**；spec.md 內部的 Clarification 摘要、plan.md 的 Summary、research.md 的 Q9 決策表與開放議題討論仍保留舊語義。這造成同一份功能包內多處自我矛盾，屬 Inconsistency 類 MEDIUM（同一 spec 內部矛盾）+ LOW（下游文件陳述矛盾）。

| ID | 類別 | 等級 | 位置 | 摘要 | 建議 |
|---|---|---|---|---|---|
| **F6** | Inconsistency | **MEDIUM** | [spec.md](./spec.md):23（Q9 Clarification） | Q9 摘要寫「僅將 `user_id` 置 NULL、Email 以雜湊表示」，但 FR-035（L190）已改為「user_id 清為空字串、Email 改 SHA-256 雜湊」。同一文件內 Clarification 與 FR 條文互相矛盾——讀者可能先看 Clarification 相信 NULL 而實作錯誤。 | 改為「僅將 `user_id` 清為空字串（`''`）、Email 以 SHA-256 雜湊表示」並保留 FR-035 的權威引用。 |
| **F7** | Inconsistency | LOW | [plan.md](./plan.md):23（Summary 第 6 點） | 計畫摘要仍寫 `user_id = NULL`，與現行 spec.md FR-035 / data-model.md §2.4 衝突。 | 改為 `user_id = ''（空字串）、email = SHA-256(email)`。 |
| **F8** | Inconsistency | LOW | [research.md](./research.md):78（Q9 決策表） | 決策表 SQL 仍寫 `SET user_id = NULL`，與 data-model.md §2.4 的 `DEFAULT ''` 與 tasks.md T035 的 `SET user_id = ''` 衝突。 | SQL 改為 `UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0`。 |
| **F9** | Inconsistency | LOW | [research.md](./research.md):103-106（§4 開放議題第 2 點） | 開放議題仍把「NULL vs 空字串」列為「措辭不同」的待解議題；但本項已於 spec FR-035 + data-model §2.4 明確定案為空字串 + SHA-256，不再屬開放議題。 | 將該段改寫為「已解決：見 FR-035 與 data-model §2.4；程式層一律以空字串表示匿名」，或整段刪除。 |

---

## 2. 其他掃描結果（無新增問題）

### 2.1 契約層
- `openapi: 3.2.0` 字面值保留 ✅
- `info.version: 0.2.0` 對應 CT-1 三組路徑 rename ✅
- `npx @redocly/cli@2.29.2 lint` = 1 warning（`localhost:{port}`，刻意保留）✅
- 所有 auth 端點帶 `security`；公開端點以 `security: []` 明示 ✅

### 2.2 D1–D4 第三輪 drift 閉合驗證
- **D1** [plan.md:219-224](./plan.md)：已列出 FR-062 的 6 項 header（CSP／HSTS／XCTO／Referrer-Policy／X-Frame-Options／Permissions-Policy）✅
- **D2** [tasks.md:155](./tasks.md)：T046 已明列 `assetpilot.audit.lastSyncAt`、null→「尚未同步」、成功 fetch 以 `Date.now()` 覆寫 ✅
- **D3** [tasks.md:246](./tasks.md)：T094 release notes (j) SC-004 1000 次壓測通過 ✅
- **D4** [quickstart.md:22,27](./quickstart.md)：兩處 `app.example.com` → `app.your-domain.tld` ✅

### 2.3 既有閉合項的跨文件一致性抽檢
- FR-062 6 項 header：spec.md（L215-223）／plan.md（L219-224）／tasks.md T098（L251）三處一致 ✅
- FR-064 POSIX + Windows NTFS：spec.md（L225-229）／plan.md（L227-240）／tasks.md T098（L253）一致 ✅
- FR-044 `assetpilot.audit.lastSyncAt`：spec.md（L200）／tasks.md T046（L155）一致 ✅
- FR-046 `max(interval) < 48h`：spec.md（L202）／tasks.md T014 的 24h 週期滿足 `<48h` ✅
- T099 SC-004 1000 次壓測：tasks.md（L258）／quickstart.md §3.3.1（L144-162）／T094 (j)（L246）三處一致 ✅

### 2.4 零個 Unmapped Tasks
65 個 task（T001–T003、T010–T016、T020–T029、T030–T037、T040–T047、T050–T056、T060–T065、T070–T075、T090–T099）全數對應至 ≥ 1 項 FR／SC／CT。

---

## 3. Constitution Alignment（憲章 v1.1.0）

- **Principle I（zh-TW）**：✅ PASS — 所有 spec-kit 文件皆為繁體中文；識別字例外合規。
- **Principle II（OpenAPI 3.2.0）**：✅ PASS — 規則 #1–#5 全數符合；handler↔paths CT-1 原子翻轉後一致；`info.version` 依破壞性變更規則 bump。

---

## 4. Metrics

| 指標 | 值 |
|---|---|
| Total Requirements（FR） | 42 |
| Total Success Criteria（SC） | 9 |
| Total Tasks | 65 |
| Requirement Coverage | 100%（42/42） |
| Ambiguity Count | 0 |
| Duplication Count | 0 |
| **CRITICAL** | **0** |
| **HIGH** | **0** |
| **MEDIUM（新增 F6）** | **1** |
| **LOW（新增 F7／F8／F9）** | **3** |

---

## 5. Next Actions

- **MEDIUM F6 建議合併修復**：雖非阻擋，但因屬「同一份 spec 自我矛盾」，於 `/speckit.implement` 之前先解決可避免實作者誤讀 Clarification 摘要。
- **LOW F7／F8／F9**：建議與 F6 一起以**單一 commit** 清齊，commit message 建議：
  ```
  docs(spec): 傳播 FR-035 user_id='' 語義至 Q9 摘要／plan 摘要／research 決策與開放議題
  ```
- **其他路徑**：如果你想先進 `/speckit.implement`，F6 屬「文件層」矛盾、不影響實作（T035 已以空字串明確落地）；但強烈建議先清理以維持 spec-kit 文件鏈的權威性。

---

## 6. Remediation Offer

本報告保持**唯讀**。如需直接修補本輪 4 項發現（F6 MEDIUM + F7／F8／F9 LOW），可回覆「直接修補 F6~F9」。

---

**Summary**：第四輪掃描確認 D1–D4 已全部閉合；但發現**第二輪 F3 修正未完整傳播**至 spec.md Clarification Q9 摘要、plan.md Summary、research.md Q9 決策表與開放議題——4 處仍保留 `user_id = NULL` 的舊語義，與權威條文（spec FR-035、data-model §2.4）衝突。此次找到 1 MEDIUM（spec 內部自我矛盾）+ 3 LOW，建議同一 commit 清齊後再進入實作。
