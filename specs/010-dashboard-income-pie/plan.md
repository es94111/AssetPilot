# Implementation Plan: 儀表板收入分類圓餅圖

**Branch**: `010-dashboard-income-pie` | **Date**: 2026-05-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/010-dashboard-income-pie/spec.md`

## Summary

在儀表板新增「收入分類」圓餅圖卡片，讓使用者無需離開儀表板即可看到當月各收入來源的佔比。實作策略：擴充現有 `/api/dashboard` 回應加入 `incomeCatBreakdown`，前端鏡射支出圓餅圖函式組建立收入版，不引入任何新技術或新端點。

## Technical Context

**Language/Version**: Node.js（server.js） + Vanilla JS（app.js）+ HTML/CSS
**Primary Dependencies**: Chart.js（圓餅圖，已安裝）、better-sqlite3（DB，已安裝）
**Storage**: SQLite（現有 transactions + categories 資料表，不變動 schema）
**Testing**: 手動測試（參見 quickstart.md）
**Target Platform**: 現有 Web SPA（index.html + app.js + server.js 單體架構）
**Performance Goals**: 收入分類查詢與現有支出查詢同一個 HTTP 往返內完成（SC-002: 1 秒內更新）
**Constraints**: 不新增新端點；不修改現有套件版本；不引入新套件
**Scale/Scope**: 單一儀表板頁面，影響範圍：server.js（1 處）、app.js（4 處新增 + 3 處修改）、index.html（1 處新增）、openapi.yaml（1 處修改）

## Constitution Check

- **[I] 繁體中文文件規範 Gate**: ✅ 本計畫及所有衍生產出（spec.md、research.md、data-model.md、quickstart.md、contracts/）皆以繁體中文撰寫；原始碼識別字（函式名、變數名）維持英文。
- **[II] OpenAPI 3.2.0 契約 Gate**: ✅ 本功能修改現有 `/api/dashboard` 端點回應（新增 `incomeCatBreakdown` 欄位），必須在同一 PR 更新根目錄 `openapi.yaml`（同步新增 `incomeCatBreakdown` schema）。per-feature 契約片段已建立於 `contracts/dashboard-income-pie.openapi.yaml`（宣告 `openapi: 3.2.0`）。
- **[III] Slash-Style HTTP Path Gate**: ✅ 無新增路徑；僅修改現有 `/api/dashboard` 端點的回應欄位。
- **Development Workflow Gate**: ✅ 功能分支 `010-dashboard-income-pie`；需同步更新 `changelog.json`（4.35.1 → 4.36.0）與 `SRS.md`；本變更為非破壞性（回應新增欄位，舊客戶端忽略即可）。

## Project Structure

### Documentation (this feature)

```text
specs/010-dashboard-income-pie/
├── plan.md              ← 本檔
├── spec.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── dashboard-income-pie.openapi.yaml
└── checklists/
    └── requirements.md
```

### Source Code (affected files)

```text
server.js          ← 後端：擴充 /api/dashboard 回應
app.js             ← 前端：新增收入圓餅圖函式、更新 renderDashboard
index.html         ← 前端：新增收入分類卡片 HTML
openapi.yaml       ← 根目錄：同步更新 /api/dashboard schema
changelog.json     ← 版本：4.35.1 → 4.36.0
SRS.md             ← 需求文件：版本更新
```

## Implementation Steps

### T01：後端 — 擴充 `/api/dashboard` 回應

**檔案**: `server.js`，位於現有 `catBreakdown` 查詢之後（約 line 8541）

**新增**：
```javascript
const incomeRows = queryAll(`
  SELECT t.category_id, t.amount,
         c.name as cat_name, c.color as cat_color,
         c.parent_id as cat_parent_id,
         p.name as cat_parent_name, p.color as cat_parent_color
  FROM transactions t
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN categories p ON c.parent_id = p.id
  WHERE t.user_id = ? AND t.type = 'income' AND t.date LIKE ? AND t.exclude_from_stats = 0
`, [req.userId, month + '%']);
const incomeCatBreakdown = buildCategoryAggregateNodes(incomeRows);
```

**修改回應**（約 line 8552）：
```javascript
// 原本
res.json({ yearMonth: month, income, expense, net: income - expense, todayExpense, catBreakdown, recent });
// 改為
res.json({ yearMonth: month, income, expense, net: income - expense, todayExpense, catBreakdown, incomeCatBreakdown, recent });
```

**驗證**: `curl /api/dashboard | jq '.incomeCatBreakdown'` 回傳陣列。

---

### T02：前端 HTML — 新增收入分類卡片

**檔案**: `index.html`，插入於「支出分類」卡片（約 line 458）之後、「資產配置」卡片（約 line 459）之前。

**新增**：
```html
<div class="card">
  <div class="dashboard-card-header">
    <h3>收入分類</h3>
    <label class="checkbox-inline dashboard-dual-toggle" for="dashIncomeDualPie">
      <input type="checkbox" id="dashIncomeDualPie">
      <span>雙圓餅圖</span>
    </label>
  </div>
  <div class="chart-container-sm"><canvas id="dashIncomePieChart"></canvas></div>
  <div class="dash-top5-section" id="dashIncomeTop5"></div>
</div>
```

**驗證**: 儀表板第二列左側顯示「收入分類」標題與圓餅圖 canvas。

---

### T03：前端 JS — 新增 localStorage 常數與狀態

**檔案**: `app.js`，位於 `DASH_DUAL_ASSET_KEY` 定義之後（約 line 514）

**新增常數**：
```javascript
const DASH_DUAL_INCOME_KEY = 'dashDualPieIncome';
```

**修改 `dashDualPie` 物件**（約 line 515-518）：
```javascript
let dashDualPie = {
  expense: localStorage.getItem(DASH_DUAL_EXPENSE_KEY) === '1',
  asset:   localStorage.getItem(DASH_DUAL_ASSET_KEY)   === '1',
  income:  localStorage.getItem(DASH_DUAL_INCOME_KEY)  === '1',
};
```

---

### T04：前端 JS — 更新 `renderDashboard()`

**檔案**: `app.js`，位於 `renderDashBudget` 呼叫區塊（約 line 2100-2103）

**修改**（在現有兩行 render 呼叫之間插入）：
```javascript
await renderDashBudget(data.expense);
renderDashPie(data.catBreakdown, !!dashDualPie.expense);
renderDashIncomePie(data.incomeCatBreakdown, !!dashDualPie.income);  // 新增
await renderDashAssetAllocationPie(!!dashDualPie.asset);
renderDashRecent(data.recent);
```

同時在函式頂部新增 income toggle 初始化（仿 expenseToggle/assetToggle 模式，約 line 2054-2057）：
```javascript
const incomeToggle = el('dashIncomeDualPie');
if (incomeToggle) incomeToggle.checked = !!dashDualPie.income;
```

---

### T05：前端 JS — 更新 `bindDashboardDualPieControls()`

**檔案**: `app.js`（約 line 2106-2127）

**新增 income toggle 綁定**（在 `assetToggle.addEventListener` 之後插入）：
```javascript
const incomeToggle = el('dashIncomeDualPie');
if (incomeToggle) {
  incomeToggle.addEventListener('change', () => {
    dashDualPie.income = !!incomeToggle.checked;
    if (dashDualPie.income) localStorage.setItem(DASH_DUAL_INCOME_KEY, '1');
    else localStorage.removeItem(DASH_DUAL_INCOME_KEY);
    renderDashboard();
  });
}
```

---

### T06：前端 JS — 新增 `renderDashIncomePie()`

**檔案**: `app.js`，插入於 `renderDashExpenseTop5()` 結尾之後（約 line 2239）

```javascript
function renderDashIncomePie(incomeCatBreakdown, useDualPie = false) {
  if (charts.dashIncomePie) charts.dashIncomePie.destroy();
  const ctx = el('dashIncomePieChart').getContext('2d');
  const top5Container = el('dashIncomeTop5');
  if (top5Container) top5Container.innerHTML = '';
  if (!incomeCatBreakdown || incomeCatBreakdown.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    if (top5Container) top5Container.innerHTML = '<p class="empty-hint">本月無收入記錄</p>';
    return;
  }

  if (useDualPie) {
    drawDashboardIncomeDualPie(ctx, incomeCatBreakdown);
    renderDashIncomeTop5(incomeCatBreakdown);
    return;
  }

  const sorted = buildSortedCategoryRows(incomeCatBreakdown);
  if (sorted.parentRows.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  const parentColorMap = new Map();
  sorted.parentRows.forEach((parent, idx) => {
    parentColorMap.set(parent.parentKey, buildParentAccentColor(parent.parentColor, idx, sorted.parentRows.length));
  });

  const labels = sorted.parentRows.map(r => r.parentName);
  const data = sorted.parentRows.map(r => r.total);
  const colors = sorted.parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8');
  const meta = sorted.parentRows.map(r => ({ parentId: r.parentId, parentName: r.parentName }));

  charts.dashIncomePie = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 10 } } },
      onClick: (evt, items) => {
        if (!items.length) return;
        const seg = meta[items[0].index];
        if (!seg) return;
        const monthEnd = (() => {
          const [y, m] = dashMonth.split('-').map(Number);
          const d = new Date(y, m, 0);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        navigateToTransactions({
          categoryId: seg.parentId,
          type: 'income',
          from: dashMonth + '-01',
          to: monthEnd,
        });
      },
    },
  });

  renderDashIncomeTop5(incomeCatBreakdown);
}

function renderDashIncomeTop5(incomeCatBreakdown) {
  const container = el('dashIncomeTop5');
  if (!container) return;

  const sorted = buildSortedCategoryRows(incomeCatBreakdown);
  const parentRows = sorted.parentRows;
  if (parentRows.length === 0) { container.innerHTML = ''; return; }

  const grandTotal = parentRows.reduce((s, r) => s + r.total, 0);
  const top5 = parentRows.slice(0, 5);

  let html = '<div class="dash-top5-group">';
  html += '<div class="dash-top5-title"><i class="fas fa-tags"></i>收入分類前 5 名</div>';
  html += '<ul class="dash-top5-list">';
  top5.forEach((row, idx) => {
    const pct = grandTotal > 0 ? ((row.total / grandTotal) * 100).toFixed(1) : '0.0';
    html += `<li>
      <span class="dash-top5-rank">${idx + 1}</span>
      <span class="dash-top5-name">${escHtml(row.parentName)}</span>
      <span class="dash-top5-value">${fmt(row.total)}<span class="dash-top5-pct">${pct}%</span></span>
    </li>`;
  });
  html += '</ul></div>';
  container.innerHTML = html;
}
```

---

### T07：前端 JS — 新增 `drawDashboardIncomeDualPie()`

**檔案**: `app.js`，插入於 `drawDashboardExpenseDualPie()` 結尾之後（約 line 3567）

完全鏡射 `drawDashboardExpenseDualPie`，唯一差異：
- `charts.dashPie` → `charts.dashIncomePie`

```javascript
function drawDashboardIncomeDualPie(ctx, incomeCatBreakdown) {
  const sorted = buildSortedCategoryRows(incomeCatBreakdown);
  const parentRows = sorted.parentRows;
  const childRows = sorted.childRows;
  if (parentRows.length === 0 || childRows.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  const parentColorMap = new Map();
  parentRows.forEach((row, idx) => {
    parentColorMap.set(row.parentKey, buildParentAccentColor(row.parentColor, idx, parentRows.length));
  });

  childRows.forEach(row => {
    const parentColor = parentColorMap.get(row.parentKey) || '#94a3b8';
    row.color = buildChildVariantColor(parentColor, row.childIndex, row.siblingCount);
  });

  charts.dashIncomePie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: childRows.map(r => r.label),
      datasets: [
        {
          label: '父分類',
          data: parentRows.map(r => r.total),
          backgroundColor: parentRows.map(r => parentColorMap.get(r.parentKey) || '#94a3b8'),
          borderColor: '#ffffff',
          borderWidth: 2,
          radius: '62%',
          cutout: '34%',
          segmentLabels: parentRows.map(r => r.parentName),
        },
        {
          label: '子分類',
          data: childRows.map(r => r.total),
          backgroundColor: childRows.map(r => r.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          radius: '95%',
          cutout: '66%',
          segmentLabels: childRows.map(r => r.label),
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 10,
            generateLabels(chart) {
              const ds = chart.data.datasets[1] || { data: [], backgroundColor: [] };
              return (chart.data.labels || []).map((label, i) => {
                const bg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[i] : ds.backgroundColor;
                return { text: String(label || ''), fillStyle: bg, strokeStyle: bg, lineWidth: 0, hidden: false, index: i };
              });
            },
          },
        },
        tooltip: {
          callbacks: {
            title(items) {
              if (!items || items.length === 0) return '';
              const item = items[0];
              const ds = item.dataset || {};
              const labels = ds.segmentLabels || [];
              return labels[item.dataIndex] || item.label || '';
            },
            label(context) {
              const ds = context.dataset || {};
              const labels = ds.segmentLabels || [];
              const label = labels[context.dataIndex] || context.label || '';
              const value = Number(context.raw) || 0;
              return `${ds.label}：${label} ${fmt(value)}`;
            },
          },
        },
      },
    },
  });
}
```

---

### T08：更新根目錄 `openapi.yaml`

**檔案**: `openapi.yaml`（主 worktree，`C:/Users/hongyu/SynologyDrive/網頁/記帳網頁/openapi.yaml`）

在 `/api/dashboard` 的 `200` 回應 schema 中，於 `catBreakdown` 之後新增：

```yaml
incomeCatBreakdown:
  type: array
  description: 收入分類彙整（010 新增）；結構與 catBreakdown 相同，資料為當月收入交易
  items:
    type: object
    properties:
      categoryId: { type: [string, "null"] }
      name: { type: string }
      color: { type: string }
      parentId: { type: string }
      parentName: { type: string }
      parentColor: { type: string }
      total: { type: number }
      isOtherGroup: { type: boolean }
```

同時更新 `summary` 欄位：
```yaml
summary: 儀表板資料彙整（005 補 yearMonth query 與 catBreakdown 結構升級；010 新增 incomeCatBreakdown）
```

---

### T09：版本更新

**檔案**: `changelog.json` + `SRS.md`

- 版本：4.35.1 → **4.36.0**
- changelog 新增條目（繁體中文，type: `feat`）

---

## Complexity Tracking

> 無 Constitution 違反項目，本表空白。

## 風險與注意事項

| 項目 | 說明 |
|------|------|
| `openapi.yaml` 位於主 worktree | 需對 `C:/Users/hongyu/SynologyDrive/網頁/記帳網頁/openapi.yaml` 操作，不在 worktree 內 |
| 合併順序 | 實作完成後先合併至 main，再清除 worktree |
| 行動版版面 | `.dashboard-grid` 在行動版已是單欄 CSS，新增卡片自動排入，無需額外 CSS |
