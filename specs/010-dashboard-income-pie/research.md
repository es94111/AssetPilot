# Research: 儀表板收入分類圓餅圖

**功能**: 010-dashboard-income-pie
**日期**: 2026-05-03

## 決策一：後端資料提供方式

**決策**: 擴充現有 `GET /api/dashboard` 端點，在回應中新增 `incomeCatBreakdown` 欄位，不建立新端點。

**理由**:
- 現有端點已同時計算 `income`、`expense`、`catBreakdown`，收入分類聚合僅需複用同一查詢邏輯並改 `type = 'income'`，單次 HTTP 往返即可取得全部儀表板資料。
- 避免增加前端額外的 API 呼叫，維持儀表板一次載入完成的行為。

**替代方案考量**: 建立新端點 `/api/dashboard/income-breakdown` → 否決，因為增加了網路往返次數，且違反 Assumption（不新增端點）。

---

## 決策二：前端渲染策略

**決策**: 新增 `renderDashIncomePie()`、`renderDashIncomeTop5()`、`drawDashboardIncomeDualPie()` 三個函式，完全鏡射（mirror）現有支出圓餅圖的對應函式（`renderDashPie`、`renderDashExpenseTop5`、`drawDashboardExpenseDualPie`）。

**理由**:
- 現有支出圓餅圖的函式已是成熟且經過測試的實作，鏡射做法將差異最小化，僅改變：chart instance 名稱（`charts.dashIncomePie`）、canvas/container DOM id、localStorage key、點擊時傳入的 `type: 'income'`。
- 不引入任何新函式庫或抽象層，符合「使用現有技術」原則。

**替代方案考量**: 重構共用函式（將 expense/income 合併為通用 pie renderer）→ 否決，屬於不必要的重構，違反 Brownfield 開發紀律（Principle V）。

---

## 決策三：圖表實例管理

**決策**: 在現有 `charts` 物件中新增 `dashIncomePie` 鍵，與 `dashPie`、`dashAssetPie` 並列。

**理由**: 與現有模式一致，`renderDashIncomePie` 執行時先 `if (charts.dashIncomePie) charts.dashIncomePie.destroy()` 以避免重複初始化。

---

## 決策四：localStorage 鍵名

**決策**: 新增 `DASH_DUAL_INCOME_KEY = 'dashDualPieIncome'`，並在 `dashDualPie` 物件加入 `income` 欄位。

**理由**: 與現有 `dashDualPieExpense`、`dashDualPieAsset` 命名完全一致。

---

## 決策五：版本號更新

**決策**: 新功能，版本從 4.35.1 → 4.36.0（MINOR）。

**理由**: 依照專案語意版本慣例，新功能累加次版本號；本變更無破壞性改動。

---

## 無需研究的事項

| 項目 | 原因 |
|------|------|
| 色彩生成演算法 | 直接複用 `buildParentAccentColor` / `buildChildVariantColor`，無需變動 |
| 資料聚合邏輯 | 直接複用 `buildCategoryAggregateNodes`，已支援任意交易類型 |
| 行動版 CSS | 現有 `.dashboard-grid` 在行動版已為單欄，新增卡片自動適應，無需額外 CSS |
| 跳轉邏輯 | 直接複用 `navigateToTransactions`，傳入 `type: 'income'` 即可 |
