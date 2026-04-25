# Specification Analysis Report — 003-categories（Round 2）

**Generated**: 2026-04-25（重跑於方案 C 微調完成後）
**Feature**: 分類系統（Category System）
**Branch**: `003-categories`
**Artifacts analyzed**: [spec.md](./spec.md)、[plan.md](./plan.md)、[tasks.md](./tasks.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml)、[quickstart.md](./quickstart.md)
**Constitution**: [.specify/memory/constitution.md](../../.specify/memory/constitution.md) v1.2.0
**Mode**: STRICTLY READ-ONLY — 本報告不修改任何檔案。

---

## 與 Round 1 的差異總覽

Round 1 共識別 10 LOW + 1 INFO。方案 C 已實際修正其中 5 項：A1／A2／C1／C2／I3。本輪重跑後：

| Round 1 ID | 主題 | Round 2 狀態 |
|---|---|---|
| C1 | FR-025／SC-004 顏色跨頁面一致驗證薄弱 | ✅ **CLEARED** — quickstart §11 第 11 點明確 5/5 比對 |
| C2 | SC-002 90 秒 UX 時序無量測指引 | ✅ **CLEARED** — quickstart §11 第 1 點補上「秒錶量測」 |
| C3 | SC-007 P95 量測含網路 RTT | ⚠️ **REMAINS** — 未動，已在 quickstart §10 加註「補建本身應 < 0.2 s」可接受 |
| I1 | FR-011b tuple 描述 vs colon 字串落實 | ⚠️ **REMAINS** — 屬合理具體化，無需修正 |
| I2 | DeletedDefaultRegistry / deleted_defaults / 中文敘述三層命名 | ⚠️ **REMAINS** — 三層分離合理，維持現狀 |
| I3 | SC 編號順序錯位（SC-007 在 SC-006 之前） | ✅ **CLEARED** — 已對調 |
| A1 | T012 登入流程行號未指明 | ✅ **CLEARED** — 已加上 `grep -n "jwt.sign\|setAuthCookie\|res.cookie.*authToken"` 等識別命令 |
| A2 | FR-014 字面允許 sortOrder vs T015 禁止 | ✅ **CLEARED** — FR-014 改寫為「sortOrder 不由 PUT 處理」、T015 改為「靜默忽略」 |
| A3 | research.md §3 為實作真實依據 | ⚠️ **REMAINS** — tasks T007 已正確引用，無風險 |
| D1 | 移動子分類規則出現於 4 處 | ⚠️ **REMAINS** — 各角度互補，非實質重複 |
| Const1 | Constitution v1.2.0 三條 Principle PASS | ✅ **PASS（不變）** |

5 項已收斂、5 項屬「設計合理且不需修正」、1 項 Constitution 持續 PASS。

---

## Findings Table（本輪）

| ID | Category | Severity | Location(s) | Summary | Recommendation |
|----|----------|----------|-------------|---------|----------------|
| C3 | Coverage Gap | LOW | [spec.md:203（SC-007）](./spec.md)／[quickstart.md:295](./quickstart.md) | 補建 P95 量測使用「`time` curl + 含網路 RTT」，與 SC-007「補建程序的延遲」不完全等價。已加註但未實際分離量測。 | 可接受。如要更嚴謹，可在 `backfillDefaultsForUser` 內加 `console.time/timeEnd('backfill')` 直接記錄補建本身延遲，但屬增益、非必要。 |
| I1 | Inconsistency | LOW | [spec.md:138（FR-011b）](./spec.md)／[data-model.md:46](./data-model.md) | FR-011b 用 tuple 描述（`(type, parent_default_name, default_name)`），data-model 用冒號字串（`"<type>:<parent>:<name>"`）落實 PK。 | 屬 spec 規範語意 → data-model 規範表現的合理具體化；無需修正。 |
| I2 | Terminology | LOW | spec.md／plan.md／data-model.md | `DeletedDefaultRegistry`（邏輯實體名）／`deleted_defaults`（表名）／「已刪除預設項清單」（中文敘述） 三層稱呼並存。 | 三層分離（PascalCase 邏輯／snake_case 物理／zh-TW 敘述）符合憲章 Principle I 例外條款；維持。 |
| A3 | Ambiguity | LOW | [research.md §3](./research.md)／[spec.md:113（FR-008）](./spec.md) | FR-008 條列 56 個子分類；research.md §3 提供完整 const 定義；implementer 必須引用 research.md 而非 spec FR-008 才不會漏項。 | tasks.md T007 已明確引用 [research.md §3](./research.md)；無漏。 |
| D1 | Duplication | LOW | spec.md FR-014a/b/d、data-model.md §4.3、contracts schema、tasks T016 | 「移動子分類」規則在 4 處出現，每處角度不同（規範／流程／請求格式／實作）。 | 維持；各角度互補。 |
| Const1 | Constitution Alignment | INFO | constitution.md v1.2.0 Principle I／II／III | 全部 PASS — 文件 zh-TW、契約 OpenAPI 3.2.0、API 路徑全部斜線形式。 | ✅ |
| **N1** | **Cross-feature Dependency** | **LOW**（本輪新發現） | [quickstart.md:337（§11.11）](./quickstart.md)／[spec.md:200（SC-004）](./spec.md)／[spec.md:213（Assumptions）](./spec.md) | SC-004 顏色一致性的人工驗收依賴「儀表板／報表」頁面存在；spec Assumptions 已明示此為「後續或既有功能」，但 003 實作驗收時若 dashboard 尚未上線，§11.11 將無法執行。 | 可接受。建議於 quickstart §11.11 加註：「若儀表板／報表尚未實作（屬其他規格），本步驟改為比對分類管理頁與『新增交易頁』的下拉色點即可滿足 003 範疇驗收；SC-004 全頁面一致性留待儀表板規格實作時驗收」。**非阻擋**——可在 implement 階段補上。 |

> 共 7 項 finding（含 1 項 INFO）：6 LOW + 1 INFO；無 CRITICAL／HIGH／MEDIUM。

---

## Coverage Summary Table（更新）

下表標記符號：
- ✅ 完全覆蓋（FR + 對應 task + quickstart 驗收）
- 🟢 設計足夠（屬 Non-Goal 或自然由 schema 保證、無需 task）
- ⚠️ 軟覆蓋（依賴跨規格／人工定性）

| Requirement Key | Round 1 | Round 2 | 備註 |
|---|---|---|---|
| FR-001（兩層） | ✅ | ✅ | T003 / T014 |
| FR-002（屬性、無 is_hidden） | ✅ | ✅ | T003 / T013 |
| FR-003（type CHECK） | ✅ | ✅ | T003 schema |
| FR-004（子分類 type 一致父） | ✅ | ✅ | T014 / T016 |
| FR-005（同父下不重名） | ✅ | ✅ | T014 |
| FR-005a（父分類唯一鍵） | ✅ | ✅ | T014 |
| FR-006（子僅一父） | ✅ | ✅ | T003 schema |
| FR-007（預設樹） | ✅ | ✅ | T009 |
| FR-008（預設子分類完整） | ✅ | ✅ | T007 / T009 / T010 |
| FR-009（is_default + 預設色） | ✅ | ✅ | T007 / T009 |
| FR-009a（旗標純資訊） | 🟢 | 🟢 | 無特殊 task；無條件分支即達成 |
| FR-010（登入時補建） | ✅ | ✅ | T010 / T011 / T012 |
| FR-010a（P95 ≤ 200 ms） | ✅ | ✅ | T010 + quickstart §10 |
| FR-010b（補建失敗仍登入） | ✅ | ✅ | T012 try/catch |
| FR-011（不覆寫客製化） | ✅ | ✅ | T010 |
| FR-011a（補建鍵） | ✅ | ✅ | T010 |
| FR-011b（registry 維護） | ✅ | ✅ | T004 / T025 |
| FR-011b1（連帶刪除對稱寫入） | ✅ | ✅ | T025 |
| FR-011c（補建跳過 registry） | ✅ | ✅ | T010 |
| FR-011d（還原預設） | ✅ | ✅ | T026 |
| FR-011e（非破壞性） | ✅ | ✅ | T026 |
| FR-011f（UI 文案） | ✅ | ✅ | T027 |
| FR-012（新增父分類） | ✅ | ✅ | T014 |
| FR-013（新增子分類） | ✅ | ✅ | T014 |
| FR-013a（leaf-only） | ✅ | ✅ | T018 |
| **FR-014（編輯欄位）** | ⚠️ | **✅** | **A2 修正後 spec／task 已對齊；name + color 經 PUT；sortOrder 經 reorder** |
| FR-014a（移動子分類） | ✅ | ✅ | T016 |
| FR-014b（移動後交易不變） | ✅ | ✅ | T016 |
| FR-014c（type 不可變） | ✅ | ✅ | T015 / T022 |
| FR-014d（移動後 sort_order 末端） | ✅ | ✅ | T016 |
| FR-015（防循環） | ✅ | ✅ | T015 / T016 |
| FR-016（編輯時重新驗證） | ✅ | ✅ | T015 / T016 |
| FR-017（有交易拒刪） | ✅ | ✅ | T025 |
| FR-018（樹下任一子有交易拒刪） | ✅ | ✅ | T025 |
| FR-019（連帶刪除） | ✅ | ✅ | T025 |
| FR-020（#RRGGBB 嚴格） | ✅ | ✅ | T006 |
| FR-021（後端驗證） | ✅ | ✅ | T006 |
| FR-022（父列） | ✅ | ✅ | T020 / T024 |
| FR-022a（雙區塊） | ✅ | ✅ | T020 / T024 |
| FR-023（子分類網格） | ✅ | ✅ | T020 / T024 |
| FR-024（依 sort_order） | ✅ | ✅ | T020 |
| FR-024a（拖曳排序） | ✅ | ✅ | T021 / T017 |
| FR-024b（同層拖曳） | ✅ | ✅ | T021 / T017 |
| **FR-025（顏色跨頁面一致）** | ⚠️ | **⚠️→✅\*** | **C1 修正後 quickstart §11.11 加上 5/5 比對；\*仍依賴儀表板存在（見 N1）** |
| FR-026（移除 hidden） | ✅ | ✅ | T003 / T013 |
| FR-027（no AI） | 🟢 | 🟢 | Non-Goal |
| FR-028（no template） | 🟢 | 🟢 | Non-Goal |
| SC-001（新使用者立即看到完整樹） | ✅ | ✅ | T009 + quickstart §3 |
| **SC-002（90 秒內）** | ⚠️ | **✅** | **C2 修正後 quickstart §11.1 加「秒錶量測」** |
| SC-003（違反約束 100% 拒絕） | ✅ | ✅ | T006 / T014 / T015 / T016 / T025 + quickstart §4 §8 |
| **SC-004（顏色 100% 一致）** | ⚠️ | **⚠️→✅\*** | **C1 修正同 FR-025；\*仍依賴儀表板存在（見 N1）** |
| SC-005（升級冪等） | ✅ | ✅ | T010 / T011 + quickstart §5 |
| SC-006（階層辨識） | ✅ | ✅ | T024 + quickstart §11 |
| SC-007（補建 P95 ≤ 200 ms） | ✅ | ✅ | T010 + quickstart §10 |

**Coverage 統計（Round 2）**：

- 47 FR + 7 SC = 54 個項目
- ✅ 完全覆蓋：48（88.9%）
- 🟢 設計足夠（Non-Goal／schema 保證）：4（7.4%）
- ⚠️ 軟覆蓋（跨規格依賴）：2（3.7%）— FR-025、SC-004，皆依賴儀表板
- **實質覆蓋率**：48 / (54 - 4 Non-Goal) = **96.0%**（Round 1 為 90.7%）

---

## Constitution Alignment Issues

無違反；3 條 Principle 持續全 PASS：

- **Principle I（Traditional Chinese Documentation — NON-NEGOTIABLE）**：✅ spec／plan／research／data-model／quickstart／tasks／contracts 皆 zh-TW；保留識別字（`parent_id`／`sort_order`／`deleted_defaults`／`default_key`／`reorder`／`restore-defaults`）、套件名（`sql.js`／`Express`）、HTTP 狀態碼為英文／符號，符合例外條款。
- **Principle II（OpenAPI 3.2.0 Contract — NON-NEGOTIABLE）**：✅ 根目錄 [openapi.yaml](../../openapi.yaml) 與 [contracts/categories.openapi.yaml](./contracts/categories.openapi.yaml) 皆 `openapi: 3.2.0`；新端點同 PR 同步（T031）；共用 schema 透過 `components.schemas` + `$ref`；所有端點宣告 `security: [{ cookieAuth: [] }]`。
- **Principle III（Slash-Style HTTP Path Convention — NON-NEGOTIABLE）**：✅ 全功能僅有斜線路徑（`/api/categories/reorder`、`/api/categories/restore-defaults`）；無 `:verb` 殘留；多字動詞 kebab-case；Express 路由參數 `/:id` 屬規格允許之例外。

---

## Unmapped Tasks

無。全部 36 個 task 仍對應至少一個 FR 或 SC（與 Round 1 同）。

---

## Metrics

- **Total Functional Requirements**：47
- **Total Success Criteria**：7（順序已修正為 SC-001…SC-007 遞增）
- **Total Tasks**：36
- **Coverage % (Round 1)**：90.7% → **Coverage % (Round 2)**：**96.0%**
- **Ambiguity Count**：1（A3，Round 1 為 3）
- **Duplication Count**：1（D1，與 Round 1 同）
- **Inconsistency Count**：2（I1、I2，Round 1 為 3 — I3 已修）
- **Coverage Gap Count**：1（C3，Round 1 為 3 — C1／C2 已修）
- **新發現**：N1（跨規格依賴，LOW）
- **CRITICAL Issues**：0
- **HIGH Issues**：0
- **MEDIUM Issues**：0
- **LOW Issues**：6（Round 1 為 10）
- **INFO**：1（Const1，與 Round 1 同）

---

## Next Actions

無 CRITICAL／HIGH／MEDIUM 問題；本輪僅剩 6 個 LOW，皆屬「設計合理且不需強制修正」。

**建議直接進入 `/speckit.implement` 開始實作**。

如要進一步收斂剩餘 LOW finding：

| Finding | 動作建議 | 是否阻擋實作 |
|---|---|---|
| N1（跨規格依賴） | 在 quickstart §11.11 加一句「若儀表板尚未實作則改比對分類管理頁與新增交易頁下拉色點」 | 否（implement 階段補即可） |
| C3（P95 量測） | 於 `backfillDefaultsForUser` 加 `console.time` 量測補建本身延遲 | 否（屬量測精準度增益，現行驗收方式已含「補建本身 < 0.2 s」附註） |
| I1／I2／A3／D1 | 維持現狀；皆屬合理分層 | 否 |

---

## Offer Remediation

是否需要我針對 N1（跨規格依賴）進行微調？這是本輪唯一新發現的 finding，影響 quickstart §11.11 可執行性。

- 方案 X（推薦）：在 [quickstart.md §11.11](./quickstart.md) 加上一句「若儀表板／報表尚未上線，本步驟改為比對分類管理頁與新增交易頁下拉色點」。**1 處編輯**。
- 方案 Y：完整跨規格依賴註記，新增 quickstart §0.1 段落明列「外部依賴」清單。**2 處編輯**。
- 方案 Z：略過——直接 `/speckit.implement`，於實作 PR review 階段補。

請告知選擇方案；本命令僅產出分析，不會自動修改任何檔案。
