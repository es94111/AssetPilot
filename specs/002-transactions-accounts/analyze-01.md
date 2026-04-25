# Specification Analysis Report — 002-transactions-accounts (Re-run #3)

**Run date**：2026-04-25（第三次跑，N1 修復之後）
**Previous run**：HIGH=0 / MEDIUM=1（N1）/ LOW=8
**Artifacts analysed**：
- `specs/002-transactions-accounts/spec.md`
- `specs/002-transactions-accounts/plan.md`
- `specs/002-transactions-accounts/tasks.md`（80 tasks）
- `.specify/memory/constitution.md` v1.1.0

**Mode**：Read-only。

---

## 修復成效驗證（前次 N1 + 順手修 N2 / N3）

| 前次 ID | 嚴重度 | 狀態 | 驗證點 |
|---------|--------|------|--------|
| **N1** lib/ 同構 vs server-only 矛盾 | MEDIUM | ✅ **已修復** | plan.md L238-245 lib 樹標註明確；L262-274 Structure Decision §2 改為「混合策略」；L92-98 Primary Dependencies 加 decimal.js CDN；tasks.md T002 加 CDN 與同構雛型；T016 完整 UMD export pattern；T044 / T122 / T123 / T125 全部呼叫 `window.moneyDecimal.*` |
| **N2** T125 並行未明示 | LOW | ✅ **已修復** | T125 含 `Promise.all(currencies.map(c => fetch(...)))` 描述 |
| **N3** ¥ 符號硬寫死 | LOW | ✅ **已修復** | T125 tooltip 改用 `formatForDisplay(amount, account.currency)` 動態符號 |
| **N4** 前後端公式漂移風險 | LOW | ✅ **已修復**（連帶） | T016 明示「禁止前端重寫一份簡化版本」、T123 明示「嚴禁於 app.js 重寫造成漂移」、所有前端任務統一呼叫 `window.moneyDecimal.*` |

**HIGH=0、MEDIUM=0** 連續兩輪維持。

---

## 本次新偵測 Findings

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| N5 | Inconsistency | LOW | plan.md:266（Structure Decision §2 同構模組說明） | 文中寫「server.js / T035 / T113 / **T035** 須採同套 decimal.js 公式」——`T035` 出現兩次，第二個顯然是手誤；正確應為 `T037`（PATCH /api/transactions/:txId）或 `T072`（統計 SQL）。 | 將「T035 / T113 / T035」改為「T035 / T037 / T113」。 |
| N6 | Inconsistency | LOW | plan.md:235（檔案樹 index.html 註解） | 樹狀註解只寫「補 jsQR fallback CDN（SRI）」，沒提 decimal.js CDN。實際 T002(b) 已要求同檔加入 decimal.js CDN；plan.md 註解未更新與 T002 對齊。 | 改為「補 jsQR fallback + decimal.js CDN（皆 SRI）」。 |

---

## 殘留 LOW 議題（前次以來未要求修復、本次仍存在）

| ID | Category | Location(s) | Summary |
|----|----------|-------------|---------|
| I5 | Inconsistency | tasks.md T011 ↔ data-model.md §3.2 A | T011 migration `CASE account_type WHEN '銀行' THEN 'bank'` 隱含現存 `accounts.account_type` 欄位但 plan / data-model 未記錄其值域 |
| I6 | Inconsistency | tasks.md T132 | 「左碼前 38 字元」與財政部 e-invoice 實際左碼長度（約 77 字元）不符 |
| A1 | Ambiguity | spec.md US2 Acceptance #5 | 「明顯區分『已排除』」措辭用「例如」弱化規範力 |
| C6 | Coverage Gap | tasks.md T022 | 假設依賴 001 預設分類但無 task 驗證 |
| D1 | Duplication | spec.md L185-197 (Edge Cases) ↔ FR sections | 多條 Edge Case 重述 FR-013 / FR-014 / FR-022a / FR-014a |

---

## Coverage Summary（與前次無變化，全綠）

- **FR**：38 / 38 = **100%** 完整覆蓋（無 partial）
- **SC buildable**：8 / 8 = **100%**（T150 涵蓋 SC-002~005）

---

## Constitution Alignment Issues

無 CRITICAL 違規。

- **Principle I（zh-TW）**：✅ PASS
- **Principle II（OpenAPI 3.2.0）**：✅ PASS

---

## Unmapped Tasks

無：80 個任務全部對應 FR / user story / 憲章原則。

---

## Metrics

- **Total FRs**：38（34 base + 4 sub-FR）
- **Total SCs**：8
- **Total Tasks**：80
- **FR Coverage（完整）**：38 / 38 = **100%**
- **SC buildable Coverage**：8 / 8 = **100%**
- **Total findings**：7（**前次：9**；下降 22%）
  - **CRITICAL**：0
  - **HIGH**：0
  - **MEDIUM**：0（前次 1 N1 → 已修復）
  - **LOW**：7（前次 8 → 修復 4 + 新增 2 = 7）
- **Ambiguity Count**：1（A1）
- **Duplication Count**：1（D1）
- **Inconsistency Count**：3（I5 + I6 + N5）
- **Coverage Gap Count**：1（C6）
- **Style/typo Count**：1（N6）

---

## 三次 /speckit.analyze 趨勢

| Run | HIGH | MEDIUM | LOW | Total | 主要動作 |
|-----|------|--------|-----|-------|----------|
| #1 (initial) | 3 | 5 | 5 | 13 | 偵測 |
| 修復後 #2 | 0 | 1 | 8 | 9 | 修 9 條（前次 HIGH+MEDIUM）+ 引入 N1/N2/N3/N4 微觀議題 |
| **#3（本次）** | **0** | **0** | **7** | **7** | 修 N1/N2/N3/N4 + 引入 N5/N6 typo |

**規格品質連續兩輪保持 HIGH=0**，MEDIUM 已歸零。

---

## Next Actions

🟢 **直接進入 `/speckit.implement`**。

理由：
1. **零 HIGH / 零 MEDIUM**——無阻擋型缺陷。
2. **FR / SC 雙 100% 覆蓋**——所有規格項目都有對應任務。
3. **憲章 0 違規**——zh-TW + OpenAPI 3.2.0 雙 gate 通過。
4. 殘留 7 條 LOW（typo、措辭、註解對齊）皆可於 PR review 階段一併修飾，**不影響任務驗收**。

建議路徑：

```bash
# 選項 A：直接 implement（推薦）
/speckit.implement
# → 按 Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 US1 → ... → Phase 9 Polish

# 選項 B：先 commit 規格修正再 implement
/speckit-git-commit
# → 把 spec / plan / tasks 修正打包成單一 docs commit
/speckit.implement

# 選項 C：可選的 5 分鐘清掃 LOW（追求完美）
# 手動修 N5、N6 的 plan.md 兩處 typo / 註解
# 手動修 I5（data-model.md 補 account_type 欄位定義）
# 手動修 I6（T132 修正字元長度為 77）
# 然後 /speckit.implement
```

---

## Offer Remediation

7 條 LOW 是否需要我產出具體 diff？或直接進入 `/speckit.implement`？

- 回覆 **「修 N5+N6」** → 我修 plan.md 兩處 typo / 註解（最快 2 分鐘）
- 回覆 **「全清 LOW」** → 我把 7 條 LOW 全部修掉（約 10 分鐘，會動到 spec.md / plan.md / tasks.md / data-model.md）
- 回覆 **「直接 implement」** → 跳過 LOW 不管，進入實作階段（推薦——LOW 不阻擋任何任務）
