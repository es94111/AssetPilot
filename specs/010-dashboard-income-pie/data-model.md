# Data Model: 儀表板收入分類圓餅圖

**功能**: 010-dashboard-income-pie
**日期**: 2026-05-03

## 資料庫層

**無任何 schema 變更。** 本功能不新增資料表、欄位或索引。

收入交易資料已存於現有 `transactions` 資料表（`type = 'income'`），分類資訊存於 `categories` 資料表。本功能僅是在查詢層新增一條以 `type = 'income'` 為條件的彙整查詢。

---

## API 回應層

### `GET /api/dashboard` 回應新增欄位

現有回應結構：
```json
{
  "yearMonth": "YYYY-MM",
  "income": 50000,
  "expense": 30000,
  "net": 20000,
  "todayExpense": 500,
  "catBreakdown": [ /* CategoryAggregateNode[] — 支出分類 */ ],
  "recent": [ /* 最近 5 筆交易 */ ]
}
```

**新增欄位** `incomeCatBreakdown`：

```json
{
  "yearMonth": "YYYY-MM",
  "income": 50000,
  "expense": 30000,
  "net": 20000,
  "todayExpense": 500,
  "catBreakdown": [ /* 支出分類（不變） */ ],
  "incomeCatBreakdown": [ /* 收入分類（新增） */ ],
  "recent": [ /* 不變 */ ]
}
```

### `CategoryAggregateNode`（既有結構，收入分類共用）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `categoryId` | `string \| null` | 子分類 ID；`null` 表示為「（其他）」虛擬節點 |
| `name` | `string` | 子分類名稱 |
| `color` | `string` | 子分類顏色（hex） |
| `parentId` | `string` | 父分類 ID |
| `parentName` | `string` | 父分類名稱 |
| `parentColor` | `string` | 父分類顏色（hex） |
| `total` | `number` | 金額（該子分類在本月的收入合計） |
| `isOtherGroup` | `boolean` | 是否為虛擬「（其他）」節點 |

此結構由現有 `buildCategoryAggregateNodes(rows)` 函式產生，收入分類直接以 `type = 'income'` 查詢後傳入，無需修改函式本身。

---

## 前端狀態層

### 新增 localStorage 鍵

| 鍵名 | 值 | 說明 |
|------|-----|------|
| `dashDualPieIncome` | `'1'` \| 不存在 | 收入圓餅圖雙環模式偏好 |

### `dashDualPie` 物件新增欄位

```javascript
let dashDualPie = {
  expense: localStorage.getItem(DASH_DUAL_EXPENSE_KEY) === '1',
  asset:   localStorage.getItem(DASH_DUAL_ASSET_KEY)   === '1',
  income:  localStorage.getItem(DASH_DUAL_INCOME_KEY)  === '1',  // 新增
};
```
