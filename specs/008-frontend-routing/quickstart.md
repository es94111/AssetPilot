# Quickstart 驗證劇本：前端路由與頁面（008-frontend-routing）

**Date**: 2026-04-27
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)
**作用**：實作完成後依本劇本逐步驗證 6 個 user story 與 8 個 SC 全部達成；無自動化測試框架，採手動 + DevTools。

---

## 0. 前置準備

1. **環境**：本機 dev 啟動：
   ```bash
   npm start
   # 預期見：AssetPilot 伺服器已啟動: http://localhost:3000
   #         [startup] AssetPilot v4.29.0 / feature 008-frontend-routing ready
   ```
2. **資料**：使用既有 `database.db`（含至少一個一般使用者帳號 + 一個管理員帳號）。
3. **瀏覽器**：Chrome 最新版（主驗證），Firefox 最新版（跨瀏覽器抽驗），Safari 最新版（iOS Safari 模擬抽驗）。
4. **DevTools**：開啟 Console 與 Network 面板；Console 不應出現任何 `[ModalBase] 違反堆疊規則` 警告（除非刻意測試疊加違規）。
5. **無痕視窗**：用於未登入測試。

---

## 1. US1 — URL 直達／分享／書籤／重整任意頁面（P1）

### 1.1 直接開啟受保護頁（重整測試）— FR-005、SC-002

| 步驟 | 預期 |
| --- | --- |
| 已登入；直接於網址列輸入 `http://localhost:3000/finance/budget` 並按 Enter | 載入後主畫面為「預算管理頁」；網址列為 `/finance/budget`；側邊欄「預算管理」項為 active 狀態 |
| 按 F5 重整 | 仍為預算管理頁；網址列保持 `/finance/budget`（**不**被導向 `/dashboard`） |
| 在預算管理頁按 F5 重整 10 次 | 10 / 10 次皆停留於原 URL（成功率 100%，達成 SC-002 ≥ 99%） |

### 1.2 公開頁無需登入直達 — FR-001

| 步驟 | 預期 |
| --- | --- |
| 無痕視窗，直接輸入 `http://localhost:3000/privacy` | 顯示隱私權政策內容；無重定向；網址列為 `/privacy` |
| 同上輸入 `/terms` | 顯示服務條款 |
| 同上輸入 `/login` | 顯示登入頁 |
| 同上輸入 `/`（空 path） | 顯示首頁／網站介紹（page-public-home） |

### 1.3 未登入訪客打開受保護頁 → 登入後跳回 — FR-006、FR-006a、SC-001

| 步驟 | 預期 |
| --- | --- |
| 無痕視窗，輸入 `http://localhost:3000/stocks/portfolio` | 自動導向 `http://localhost:3000/login?next=%2Fstocks%2Fportfolio`；登入頁顯示 |
| 完成登入 | 自動跳回 `/stocks/portfolio`；持股總覽頁渲染 |
| 重複 5 次（不同受保護頁） | 5 / 5 通過（達成 SC-001） |

### 1.4 `?next=` 開放重定向防護 — FR-006a

| 步驟 | 預期 |
| --- | --- |
| 無痕視窗，輸入 `http://localhost:3000/login?next=https%3A%2F%2Fevil.com` | 登入後 fallback 至 `/dashboard`；不被導向 evil.com |
| 同上 `?next=%2F%2Fevil.com` | 登入後 fallback 至 `/dashboard`（protocol-relative 攔下） |
| 同上 `?next=%2F%5Cevil.com` | 同上（`/\` 攔下） |
| 同上 `?next=%2Funknown%2Fpath` | 同上（unknown-path 攔下） |
| 同上 `?next=%2Fdashboard%2F` | 經正規化後命中 `/dashboard`，登入後跳至 `/dashboard`（trailing slash 經正規化通過） |
| 同上 `?next=%2F%E5%92%E1` | malformed-uri → fallback 至 `/dashboard` |
| 後端 `data_operation_audit_log` 表查詢 | 上述 5 條失敗案例皆寫入 `route_open_redirect_blocked` 一筆，metadata 含 `reason` 欄位 |

### 1.5 完全不存在路徑 → 404 訊息頁 — FR-008

| 步驟 | 預期 |
| --- | --- |
| 已登入，輸入 `http://localhost:3000/foo/bar/baz` | 顯示「404 — 找不到頁面」訊息頁；含「返回首頁」「返回儀表板」按鈕；網址列保留 `/foo/bar/baz`（不被改寫） |
| 點擊「返回儀表板」 | 跳至 `/dashboard` |
| 瀏覽器歷史「上一頁」 | 回到 `/foo/bar/baz` 之前的頁面（不被儀表板汙染） |

### 1.6 路徑正規化 — FR-010a

| 輸入 URL | 期待 URL（replaceState 改寫後） |
| --- | --- |
| `/Dashboard` | `/dashboard` |
| `/dashboard/` | `/dashboard` |
| `/finance//transactions` | `/finance/transactions` |
| `/FINANCE/Transactions/` | `/finance/transactions` |
| `/dashboard/?month=2026-04` | `/dashboard?month=2026-04`（query 保留） |
| `/dashboard#topic` | `/dashboard#topic`（hash 保留） |

對每條測試：
- 網址列在頁面渲染後 MUST 為「期待 URL」。
- 瀏覽器歷史 MUST 不含正規化前的條目（`replaceState` 改寫，不推 history）。

### 1.7 上一頁／下一頁切換 — FR-003、FR-009、SC-007

| 步驟 | 預期 |
| --- | --- |
| 依序訪問 `/dashboard` → `/finance/transactions` → `/finance/budget` → `/stocks/portfolio` | 4 個頁面切換；每次切換網址列同步、主畫面同步、側邊欄 active 同步 |
| 連按瀏覽器「上一頁」3 次 | 依序回到 `/finance/budget`、`/finance/transactions`、`/dashboard`；每次都正確還原；捲動位置還原 |
| 在 `/finance/budget` 連按側邊欄「預算管理」項 5 次 | URL 與畫面不變；瀏覽器歷史不增加新條目（FR-009） |

### 1.8 捲動位置還原 — FR-010c

| 步驟 | 預期 |
| --- | --- |
| 進入 `/finance/transactions`；捲動至底部；點選側邊欄「預算管理」 | 切換至 `/finance/budget`；捲至頂端 |
| 按瀏覽器「上一頁」 | 回到 `/finance/transactions`；捲動位置還原至底部（**FR-010c 第 3 點**） |
| 在 Safari／iOS 模擬器重複以上 | 行為一致（手動 scrollRestoration 統一行為） |

---

## 2. US2 — 主應用程式導航（P1）

### 2.1 桌面側邊欄常駐 — FR-011

| 步驟 | 預期 |
| --- | --- |
| 桌面瀏覽器（≥ 1024px 寬）登入 | 左側側邊欄常駐顯示，無漢堡按鈕 |
| 視窗縮至 < 768px | 側邊欄收合，右上角顯示漢堡按鈕 |
| 視窗縮至 320px 寬 | 漢堡按鈕仍可正常開合，不溢出 |

### 2.2 14 + 1 個項目 — FR-002、FR-012、FR-013

| 步驟 | 預期 |
| --- | --- |
| 一般使用者登入；展開側邊欄 | 14 個項目依下列順序：儀表板 → 交易記錄／統計報表／預算管理／帳戶管理／分類管理／固定收支 → 持股總覽／股票交易紀錄／股票股利紀錄／股票實現損益紀錄 → API 使用與授權 → 帳號設定／資料匯出匯入；**不顯示「管理員面板」** |
| 管理員登入；展開側邊欄 | 多 1 項「管理員面板」（位於設定群組） |
| 一般使用者直接輸入 `/settings/admin` | 顯示 404 訊息頁（與不存在路由完全一致）；URL 保留 `/settings/admin`；後端 `data_operation_audit_log` 寫入 1 筆 `route_admin_path_blocked`，metadata 含 `path: '/settings/admin'` |

### 2.3 三件式 active 視覺 — FR-015a

| 步驟 | 預期 |
| --- | --- |
| 進入 `/finance/transactions` | 側邊欄「交易記錄」項：(a) 左側 4px 主色直條；(b) 文字主色（`#6366f1`）；(c) 背景主色 8% 透明度 |
| Tab 鍵聚焦至「交易記錄」項 | focus-visible 主色 2px 焦點環；與 active 同時呈現（不互斥） |
| 切換到淺色／深色模式 | active 三件式視覺於兩個模式下皆可辨識（對比度 ≥ 4.5:1） |

### 2.4 圖示 + 文字並列 — FR-015b

| 步驟 | 預期 |
| --- | --- |
| 視覺檢查 14 個項目 | 每項皆為「20×20px 圖示 + 12px 間距 + 文字標籤」結構；項目高度 40px |
| active 狀態 | 圖示色 = 文字色（主色） |
| 開啟 DevTools 檢查 SVG | 圖示為 inline SVG，`stroke="currentColor"`；無外部 fetch 載入字型／圖示套件 |

### 2.5 側邊欄三段式佈局 — FR-015c

| 步驟 | 預期 |
| --- | --- |
| 視窗高度縮至 600px（低於 14 項目所需總高） | 上段（logo）固定；下段（使用者區）固定；中段主清單可獨立捲動 |
| 主清單捲動 | logo 與下段不動；主清單捲動順暢；無 body 連動捲動 |
| 開啟任一 Modal（如新增交易）| 側邊欄主清單仍可獨立捲動（不受 body 鎖影響）；但實務上不會發生此情境（Modal z-index 高於側邊欄）|

### 2.6 漢堡選單行為 — FR-015

| 步驟 | 預期 |
| --- | --- |
| < 768px 寬，點漢堡按鈕 | 側邊欄從左滑入，遮罩覆蓋主內容 |
| 點選任一項 | 自動切換頁面 + 漢堡選單收合 |
| 開啟後點遮罩 | 收合 |
| 開啟後按 ESC | 收合 |

---

## 3. US3 — 情境式 FAB（P2）

### 3.1 FAB 對照表 — FR-016、SC-003

依序進入 14 + 4 個頁面，記錄 FAB 是否顯示與標籤；對照下表（必須 100% 對齊）：

| URL | FAB 顯示？ | 標籤 | 點擊後開啟 |
| --- | --- | --- | --- |
| `/dashboard` | 否 | — | — |
| `/finance/transactions` | 是 | 新增交易 | modalTransaction |
| `/finance/reports` | 是 | 新增交易 | modalTransaction |
| `/finance/budget` | 是 | 新增交易 | modalTransaction |
| `/finance/accounts` | 是 | 新增交易 | modalTransaction |
| `/finance/categories` | 是 | 新增交易 | modalTransaction |
| `/finance/recurring` | 是 | 新增交易 | modalTransaction |
| `/stocks` | 是 | 新增股票交易紀錄 | modalStockTx |
| `/stocks/portfolio` | 是 | 新增股票交易紀錄 | modalStockTx |
| `/stocks/transactions` | 是 | 新增股票交易紀錄 | modalStockTx |
| `/stocks/dividends` | 是 | 新增股票交易紀錄 | modalStockTx |
| `/stocks/realized` | 是 | 新增股票交易紀錄 | modalStockTx |
| `/api-credits` | 否 | — | — |
| `/settings/account` | 否 | — | — |
| `/settings/admin` | 否（且為管理員） | — | — |
| `/settings/export` | 否 | — | — |
| `/login` | 否 | — | — |
| `/privacy` | 否 | — | — |

### 3.2 FAB z-index — FR-017

| 步驟 | 預期 |
| --- | --- |
| 在 `/finance/transactions` 開啟 modalTransfer Modal | FAB 不擋在 Modal 之上；z-index FAB < Modal 遮罩 < Modal 內容 |
| 同上開啟疊加的 modalConfirm | z-index 為「modalConfirm 內容 > modalConfirm 遮罩 > 下層 Modal 內容 > 下層 Modal 遮罩 > FAB」 |

---

## 4. US4 — 外觀模式跨裝置同步（P2）

### 4.1 三選一 — FR-018、FR-020

| 步驟 | 預期 |
| --- | --- |
| 進入 `/settings/account`；切換至「強制深色」 | 立即套用深色（無重整）；後端 `users.theme_mode` 寫入 `'dark'` |
| 切換至「強制淺色」 | 立即淺色 |
| 切換至「跟隨系統」；作業系統切換深色 | 應用程式跟隨切換深色（不重整） |
| `prefers-reduced-motion` 啟用 | 切換動畫降級為瞬時；無 spring 彈性 |

### 4.2 跨裝置同步 — FR-019、FR-021a、SC-004

| 步驟 | 預期 |
| --- | --- |
| 裝置 A（Chrome）切換為「強制深色」 | 立即生效 |
| 裝置 B（Firefox）登入同帳號 | 直接渲染為深色（不需重整） |
| 裝置 B 重整 | 仍為深色；DevTools Network 顯示 `/api/auth/me` 回應 `themeMode: 'dark'`，P95 ≤ 500ms（達 SC-004） |
| 裝置 B localStorage 檢查 | `theme_pref` 為 `'dark'`（樂觀渲染快取） |

### 4.3 登入頁主題（FOUC 防範）— FR-021、FR-021a

| 步驟 | 預期 |
| --- | --- |
| 無痕視窗開啟 `/login`（從未登入） | 依瀏覽器 `prefers-color-scheme` 渲染（無快取可用） |
| 完成登入 | 主畫面渲染瞬間採 `themeMode`；無「淺→深」短暫閃爍 |
| 無痕視窗第二次（同瀏覽器）打開 `/login` | 不應從上次登入「殘留」深色；登入頁仍依當下 `prefers-color-scheme` |

### 4.4 登出清理 — FR-007b

| 步驟 | 預期 |
| --- | --- |
| 在「強制深色」狀態下登出 | 跳至 `/login`；URL 不含 `?next=`；localStorage `theme_pref` 已被清除 |
| 重新點「登入」 | 登入頁依 `prefers-color-scheme` 渲染（不延續登出前主題） |

---

## 5. US5 — 統一設計系統（P3）

### 5.1 金額／日期格式 — FR-025

| 步驟 | 預期 |
| --- | --- |
| 進入交易記錄；視覺檢查 | 金額為 `NT$ 1,234` / `NT$ 1,234.56`（千分位、最多兩位小數）；等寬數字（`tabular-nums`） |
| 同上日期 | `YYYY-MM-DD` ISO 8601 格式 |

### 5.2 Toast 與刪除確認 — FR-022、FR-023、FR-025

| 步驟 | 預期 |
| --- | --- |
| 觸發成功操作（如新增交易） | Toast 為綠色強調 |
| 觸發錯誤（如未填必填欄位） | Toast 為紅色強調 |
| 點擊任一刪除按鈕（交易／分類／帳戶／預算） | 全部開啟相同樣式的 `modalConfirm`；無原生 `confirm()` |

### 5.3 Modal 行為 — FR-022 ~ FR-024b

#### 5.3.1 捲動鎖（FR-023a）

| 步驟 | 預期 |
| --- | --- |
| 在交易記錄頁捲動至中段；開啟 modalTransaction | 背景固定不動；Modal 內若超出視窗高度，由 Modal 自身內部捲動 |
| iOS Safari 上同上 | 滾動穿透防護生效（背景不滾動） |
| 關閉 Modal | 背景捲動位置還原至開啟前 |

#### 5.3.2 Modal + 上一頁（FR-024）

| 步驟 | 預期 |
| --- | --- |
| 開啟 modalTransfer | 網址列出現 `#modal-transfer`；history 條目 +1 |
| 按瀏覽器「上一頁」 | Modal 關閉；網址列回到開啟前 hash（如原為空則為空） |
| 不再按上一頁 | 停留於當前頁，不退出至前一頁 |
| 再按一次「上一頁」 | 退出至前一頁 |

#### 5.3.3 Modal 堆疊（FR-024a）

| 步驟 | 預期 |
| --- | --- |
| 開啟 modalTransaction → 點刪除按鈕 → 疊出 modalConfirm | 兩層 Modal 同時可見；網址列為 `#modal-confirm`；history 條目 +2 |
| z-index 順序檢查 | modalConfirm > modalTransaction > FAB > 主內容 |
| 按上一頁一次 | 僅關閉 modalConfirm；下層 modalTransaction 仍開啟 |
| 再按上一頁一次 | 關閉 modalTransaction；網址列還原至開啟前 hash |
| 嘗試開啟 modalAccount 時 modalTransaction 仍開啟 | Console 出現 `[ModalBase] 違反堆疊規則：modalAccount`；modalAccount 不開啟 |

#### 5.3.4 焦點管理（FR-024b）

| 步驟 | 預期 |
| --- | --- |
| Tab 至某按鈕；按 Enter 開啟 Modal | 焦點移至 Modal 內第一個可互動元素；focus-visible 焦點環可見 |
| 在 Modal 內反覆按 Tab 與 Shift+Tab | 焦點僅在 Modal 內可互動元素環圈循環；不外洩至背景表格／FAB／側邊欄 |
| 按 ESC 關閉 Modal | 焦點還原至開啟前的觸發按鈕 |
| 疊加 modalConfirm 後關閉 | 焦點還原至下層 Modal 內觸發疊加之按鈕 |

### 5.4 焦點環與深色對比 — FR-025、SC-005

| 步驟 | 預期 |
| --- | --- |
| 鍵盤 Tab 在頁面任一可互動元素 | 焦點環可見（focus-visible） |
| axe-core 掃描淺色模式 14 + 4 = 18 個畫面 | WCAG AA 違規 0 |
| axe-core 掃描深色模式 18 個畫面 | WCAG AA 違規 0；總計 36 個畫面通過率 100%（達 SC-005） |

### 5.5 兩階段 title — FR-010b

| 步驟 | 預期 |
| --- | --- |
| 點選「交易記錄」側邊欄項 | URL 更新瞬間 `document.title` = `交易記錄 — 記帳網頁`（第一階段） |
| 篩選為 2026-04 | 資料 fetch 完成後 `document.title` = `2026-04 交易記錄 — 記帳網頁`（第二階段） |
| 切換至 `/dashboard` | `document.title` = `儀表板 — 記帳網頁`（無第二階段） |
| 直接輸入不存在路徑 | `document.title` = `找不到頁面 — 記帳網頁` |

### 5.6 SR live region 公告 — FR-010e

| 步驟 | 預期 |
| --- | --- |
| 啟用 NVDA／VoiceOver iOS；切換側邊欄項 | 螢幕閱讀器讀出「已切換至 交易記錄」 |
| 篩選月份（第二階段 title 變更） | SR **不**重複公告（避免冗長） |
| 開啟 Modal | SR **不**透過此 live region 公告 |
| 視覺檢查 DOM | `#sr-route-status` 為 visually-hidden（screen reader-only） |

### 5.7 進度條 + 200ms 延遲 — FR-010d

| 步驟 | 預期 |
| --- | --- |
| 切換至載入較快的頁（< 200ms 完成）| 進度條完全不顯示 |
| 切換至載入較慢的頁（> 200ms）| 200ms 後出現頂部 2px 主色 indeterminate 進度條；資料完成後淡出 |
| `prefers-reduced-motion` 啟用 | 進度條為靜態淺色橫條（無左右循環動畫）|
| 視覺檢查 | 殼立刻可見（標題列、表頭、空圖表畫布）；無置中 spinner |

---

## 6. US6 — 靜態檔白名單（P3）

### 6.1 白名單合法路徑 — FR-026、SC-006

對下列 9 條 GET 請求驗證回傳 200 + 預期內容：

```bash
curl -i http://localhost:3000/                    # 200 + index.html
curl -i http://localhost:3000/index.html          # 200 + index.html（直接命中）
curl -i http://localhost:3000/app.js              # 200 + JS 內容
curl -i http://localhost:3000/style.css           # 200 + CSS 內容
curl -i http://localhost:3000/favicon.svg         # 200 + SVG 內容
curl -i http://localhost:3000/logo.svg            # 200 + SVG 內容
curl -i http://localhost:3000/changelog.json      # 200 + JSON 內容
curl -i http://localhost:3000/privacy.html        # 200 + HTML 內容（raw）
curl -i http://localhost:3000/terms.html          # 200 + HTML 內容（raw）
```

#### Cache-Control 驗證 — FR-028

```bash
curl -I http://localhost:3000/changelog.json | grep -i cache-control  # no-cache
curl -I http://localhost:3000/style.css       | grep -i cache-control  # public, max-age=300
curl -I http://localhost:3000/app.js          | grep -i cache-control  # public, max-age=300
```

### 6.2 白名單外路徑（黑名單）— FR-026、FR-027、SC-006

對下列 9 條 GET 請求驗證 **絕不**回傳實際內容：

```bash
curl -i http://localhost:3000/.env                          # 應為 SPA index.html 或 404
curl -i http://localhost:3000/server.js                     # 同上
curl -i http://localhost:3000/package.json                  # 同上
curl -i http://localhost:3000/database.db                   # 同上
curl -i http://localhost:3000/CLAUDE.md                     # 同上
curl -i http://localhost:3000/.git/config                   # 同上
curl -i http://localhost:3000/specs/008-frontend-routing/spec.md  # 同上
curl -i http://localhost:3000/static/../server.js           # 同上 + 後端 audit log 寫入 static_path_traversal_blocked
curl -i http://localhost:3000/%2e%2e/server.js              # 同上 + audit log
```

驗證標準：
- `Content-Type` MUST 為 `text/html; charset=utf-8`（SPA index.html）。
- response body MUST 為 `index.html` 內容，**絕不**為 `.env` / `server.js` / `database.db` 等之 raw bytes。
- 9 / 9 不洩漏（達 SC-006 100% 通過）。

### 6.3 路徑遊走稽核 — FR-027、FR-032

| 步驟 | 預期 |
| --- | --- |
| 上述兩條含 `..` 與 `%2e%2e` 的請求發送 | 後端 `data_operation_audit_log` 寫入 2 筆 `static_path_traversal_blocked`，`metadata.pattern` 分別為 `'literal'` 與 `'percent-encoded'` |
| `route_audit_mode = 'minimal'` 模式下重複 | 不寫入稽核（minimal 模式靜默） |

---

## 7. 路由稽核日誌驗證 — FR-032、FR-033

### 7.1 三種稽核事件覆蓋

| 觸發 | 預期 audit log entry |
| --- | --- |
| 一般使用者輸入 `/settings/admin` | `route_admin_path_blocked`，`metadata.path = '/settings/admin'` |
| `/login?next=https://evil.com` | `route_open_redirect_blocked`，`metadata.reason = 'protocol-relative'` |
| `/static/../server.js` | `static_path_traversal_blocked`，`metadata.pattern = 'literal'` |

### 7.2 稽核模式切換 — FR-033

| 切換至 | 預期 |
| --- | --- |
| `extended`（管理員設定頁）| 上述 3 條照寫；額外 401（session 過期）也寫入 |
| `minimal` | 3 條皆不寫入；007 既有的匯出／匯入／備份／還原稽核仍照寫 |
| `security`（預設） | 3 條照寫；不寫 401 |

### 7.3 settings 端點 — `/api/admin/system-settings` 擴欄

```bash
# GET
curl -b "token=<admin-jwt>" http://localhost:3000/api/admin/system-settings
# 預期 response 含 "routeAuditMode": "security"

# PUT 切換
curl -b "token=<admin-jwt>" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"routeAuditMode": "extended"}' \
  http://localhost:3000/api/admin/system-settings
# 預期 200 + body 含 "routeAuditMode": "extended"

# PUT 非法值
curl -b "token=<admin-jwt>" -X PUT \
  -H "Content-Type: application/json" \
  -d '{"routeAuditMode": "invalid"}' \
  http://localhost:3000/api/admin/system-settings
# 預期 400 + error message
```

---

## 8. 效能驗證 — SC-008

### 8.1 客戶端路由切換 P95 ≤ 100ms — SC-008a

對 14 個受保護頁逐一切換 50 次（從點擊側邊欄到 URL 更新 + 殼可見）：
- DevTools Performance 面板量測
- 計算每頁 P95 切換時間
- 14 / 14 頁皆 ≤ 100ms

### 8.2 完整內容渲染 P95 ≤ 1000ms — SC-008b

同上對 14 頁，但量測點為「資料 fetch 完成 + 表格／圖表已可互動」：
- 14 / 14 頁皆 ≤ 1000ms

---

## 9. 跨瀏覽器 + 行動驗證 — SC-007

| 平台 | 必跑項目 | 通過率目標 |
| --- | --- | --- |
| Chrome 最新 stable | US1 + US2 全 Acceptance Scenarios | 100% |
| Chrome 前一版 | 同上 | 100% |
| Edge 最新 stable | 同上 | 100% |
| Firefox 最新 stable | 同上 | 100% |
| Safari 16+（macOS） | 同上 | 100% |
| Safari iOS（模擬器或實機 16+） | 同上 + Modal iOS 滾動穿透防護 | 100% |
| Android Chrome 最新 | 同上 | 100% |

---

## 10. 完成標準 Checklist

- [ ] 18 條 URL 路徑（4 公開 + 14 受保護）皆可直達、重整、書籤
- [ ] 5 條 `?next=` 開放重定向攻擊全部攔下並寫稽核
- [ ] 14 + 1（管理員）側邊欄項目顯示正確；admin 入口僅管理員可見
- [ ] 三件式 active + 圖示 + 三段式佈局視覺通過
- [ ] FAB 對照表 18 / 18 行為一致
- [ ] 主題切換立即生效；跨裝置 P95 ≤ 500ms 同步
- [ ] 12 種 Modal 共用基底；捲動鎖、history 整合、堆疊規則、焦點 trap 全部運作
- [ ] axe-core 36 畫面 WCAG AA 違規 0
- [ ] 9 / 9 黑名單路徑不洩漏；2 條 traversal 寫稽核
- [ ] 3 種路由稽核事件正確寫入；3 種模式切換生效
- [ ] 客戶端路由切換 P95 ≤ 100ms（14 / 14 頁達標）
- [ ] 完整內容渲染 P95 ≤ 1000ms（14 / 14 頁達標）
- [ ] 7 個瀏覽器／平台 100% 通過 US1 + US2
- [ ] 既有 007 稽核行為不受影響（minimal 模式驗證）

---

**驗證完成後**：將本 quickstart 對照結果寫入 PR 描述；任一項目失敗應於同 PR 修正後再次驗證。
