# 功能規格：前端路由與頁面（Frontend Routing & Pages）

**Feature Branch**: `008-frontend-routing`
**Created**: 2026-04-27
**Status**: Draft
**Input**: 使用者描述：「2.8 前端路由與頁面 — URL 與畫面一一對應、SPA 路由（history.pushState）、伺服器 catch-all、靜態檔白名單、側邊欄導航、情境式 FAB、外觀模式（淺／深／跟隨系統）跨裝置同步、12 種 Modal、設計系統（金額／日期／顏色／動畫／無障礙）；不做 PWA、不做 i18n、不做自訂主題色」

## Clarifications

### Session 2026-04-27

- Q: 一般使用者（非管理員）直接以網址列輸入 `/settings/admin` 或其他僅限管理員之路徑時，前端 UI 應如何呈現？ → A: 顯示「404 — 找不到頁面」訊息頁，與不存在路由一致；URL 保留原樣，不額外揭露該路徑「存在但無權限」之資訊（最大化資訊保密；後端 API 仍回 403／無資料不變）
- Q: Modal 與瀏覽器「上一頁」的互動如何實作？ → A: 開啟 Modal 時 `pushState` 一筆「Modal 開啟中」歷史條目；按瀏覽器上一頁觸發 `popstate` 即關閉 Modal；以 hash（如 `#modal-transaction`）區分各 Modal，使重整或分享時可選擇性還原開啟狀態（不強制每個 Modal 都實作分享，但機制可用）
- Q: 首次直接打開深層連結時 `app.js` 尚未載入的過渡視覺？ → A: `index.html` 內聯極簡載入指示器（中央旋轉圈 + 應用程式 logo），SPA 掛載後立刻覆蓋；不額外請求資源、不引入 skeleton 維護成本
- Q: 頁面切換的效能預算？ → A: 雙層指標 — (1) 客戶端路由切換（URL 更新 + 主內容區換頁框架可見）P95 ≤ 100ms；(2) 完整內容渲染（含資料 fetch 完成）P95 ≤ 1000ms；分離量測以利排查瓶頸（路由 vs 資料）
- Q: 使用中 session／JWT 過期（API 回 401）時的路由行為？ → A: 偵測到 401 後立刻將當前 URL（path + query + hash）寫入 `?next=` 並導向 `/login`，同時顯示 Toast「您的登入已過期，請重新登入」；與 FR-006 共用相同 next 合法性檢查；重新登入完成後依 `?next=` 跳回原頁面
- Q: 路由與權限事件的稽核日誌範圍？ → A: 管理員可自選範圍，預設僅記錄高訊號安全事件（一般使用者命中管理員專屬路徑、`?next=` open redirect 攔截）；管理員可於系統設定頁切換為「擴充模式」（追加 401、path traversal）或「最小模式」（停止寫入路由相關事件）；不記常規 popstate／pushState 與 404（雜訊高）
- Q: Modal 開啟時的 body 捲動鎖定行為？ → A: Modal 開啟時 MUST 鎖定 body 捲動（背景內容固定不動）；Modal 內容若超出視窗高度，由 Modal 自身內部捲動；行為對 12 種 Modal 一致（共用基底元件強制）；含 iOS Safari 滾動穿透防護
- Q: Modal 堆疊行為（最多可同時開幾層、history 與捲動鎖如何互動）？ → A: 允許單層疊加，且**僅限 `modalConfirm` 疊在其他 Modal 上**（典型：編輯 Modal 內按刪除→疊出 confirm）；其他任何組合 MUST NOT 多開（開新 Modal 前 MUST 先關閉現有 Modal）。疊加時 history 推 2 筆、捲動鎖維持鎖定（不重複套用、不解除）、z-index 順序為「上層 confirm > 下層 modal > FAB」；按瀏覽器上一頁／ESC MUST 先關閉 confirm，再按一次才關閉下層 Modal
- Q: 路徑正規化規則（trailing slash／大小寫／連續斜線）？ → A: 嚴格正規化 — 路由 MUST 為小寫、無 trailing slash（根路徑 `/` 除外）、無連續斜線；前端 router 遇到不合規 URL（如 `/Dashboard`、`/dashboard/`、`/finance//transactions`）MUST 以 `replaceState` 改寫為正規形式（不推 history、不污染上一頁）；後端 catch-all 對受保護路由列表的比對亦 MUST 以正規化後字串進行；FR-032 稽核日誌中的路徑欄位 MUST 記錄正規化後形式以利集中分析；超過正規化能力的變體（如純 URL-encoded `%2F` 注入）一律 404
- Q: 後端如何認知「admin-only 路徑」以寫 `route_admin_path_blocked` 稽核？ → A: 後端維護獨立的 admin-only 路徑常數陣列（程式碼層級，例如 `server.js` 或路由模組內定義 `ADMIN_ONLY_PATHS = ['/settings/admin']`），與前端路由表（FR-002）**手動同步**並由 code review 把關一致性；catch-all 收到請求時若使用者非管理員且正規化後路徑命中此陣列則寫入 `route_admin_path_blocked`。新增 admin-only 頁時 MUST 同時更新前端路由表與後端常數陣列（單次 PR 內），否則視為缺陷
- Q: 登入後 theme preference 抓取期間的初始畫面策略（FOUC 防範）？ → A: 雙層策略 — (1) 後端 `/api/auth/login` 與 `/api/users/me` 回應 MUST 在同一 response 直接夾帶 `theme` 欄位（值域：`system`／`light`／`dark`），前端在掛載 SPA 主畫面前即可採用；(2) 前端 MUST 將每次成功取得的 theme 寫入 localStorage（key 例：`theme_pref`），下次登入完成後優先採用 localStorage 值「樂觀渲染」，API 回應到達時若與快取不同則切換並覆寫 localStorage；(3) 首次登入、localStorage 缺值或值非合法值時 fallback 至 `prefers-color-scheme`（與 FR-021 公開頁邏輯一致）。此策略消除登入瞬間的主題閃爍
- Q: 側邊欄當前頁面（active item）視覺狀態規範？ → A: 三件式呈現 — (1) 項目左側 4px 主色（`#6366f1`）直條；(2) 項目文字為主色；(3) 項目背景為主色 8% 透明度。非 active 項目為預設灰階文字 + 透明背景；hover 為灰階 4% 背景（與 active 的主色 8% 背景在色相與彩度皆可區分）。鍵盤 focus-visible 為主色 2px 焦點環，與 active 狀態視覺正交、可同時呈現（active + 焦點環並存）。三件式設計確保色盲或低對比情境下任一退化仍可辨識當前頁
- Q: `?next=` 內部 URL 合法性驗證的具體演算法？ → A: 嚴格白名單 — (1) 必須以單一 `/` 開頭；(2) 不得以 `//` 或 `/\` 開頭（防 protocol-relative URL）；(3) 經 FR-010a 正規化後 pathname 部分 MUST 命中 FR-001 + FR-002 路由表中的已知 path（管理員專屬路徑亦放行，跳回後再由 FR-014 把關權限）；(4) 不通過任一條件即 fallback 至 `/dashboard`，並寫入 `route_open_redirect_blocked` 稽核（FR-032）；query 與 hash 部分允許保留並原樣帶回
- Q: 使用者主動登出後的導向目的地？ → A: 登出後 MUST 導向 `/login`，並清除任何殘留的 `?next=` 參數與 localStorage `theme_pref` 條目；登出後若使用者點擊「登入」可重新走 FR-021a 三層 fallback 取得新 theme（與 FR-021a 對齊；避免帳號間殘留偏好）
- Q: 瀏覽器最低支援版本（含相容性 polyfill 決策依據）？ → A: Evergreen 最近 2 個主版本 — Chrome / Edge / Firefox 採最新 stable 與前一版（latest 2 majors）；Safari 16+（含 macOS Safari 與 iOS Safari）；Android Chrome 最近 2 個版本。涵蓋約 95% 真實流量；本規格用到的 API（History API、`prefers-color-scheme`、`overscroll-behavior`、focus-visible、`tabular-nums`、`position: fixed` scroll lock）皆原生支援，不需 polyfill

## 使用情境與測試 *(mandatory)*

<!--
  本功能由六條使用旅程構成，覆蓋「URL = 畫面」「主導航」「情境化操作」「外觀偏好」「視覺一致性」「資料安全邊界」核心目標：
  1. 路由系統與深層連結（P1）   — 任何人都能用 URL 直達、分享、書籤、上一頁／下一頁、重整不掉頁
  2. 主應用程式導航（P1）       — 側邊欄／漢堡選單在所有受保護頁之間切換
  3. 情境式 FAB 快速新增（P2）  — 在對的頁面顯示對的「新增」按鈕
  4. 外觀模式跨裝置同步（P2）   — 淺／深／跟隨系統三選一，登入後其他瀏覽器自動套用
  5. 統一設計系統（P3）         — 金額、日期、顏色、動畫、無障礙在每個頁面一致
  6. 靜態資源白名單（P3）       — 任何不在白名單上的檔案皆不可被未認證請求取得

  實作 P1 兩條（US1 + US2）即構成可用 MVP：使用者能輸入 URL 直達任一頁面、能在頁面間切換。
-->

### User Story 1 — 任何人都能用 URL 直達／分享／書籤／重整任意頁面（Priority: P1）

使用者把 `/finance/budget` 加入瀏覽器書籤；下次直接點開書籤、或從 LINE 收到別人分享的 `/stocks/transactions` 連結、或在儀表板按「下一頁／上一頁」切換時，瀏覽器網址列與主畫面內容**永遠一致**。即便重整頁面（F5），使用者仍停留在原本的頁面上，而不是被一律踢回儀表板。未登入使用者在直接打開 `/finance/transactions` 時系統先導向登入頁；登入完成後自動跳回原本想去的 `/finance/transactions`，而非預設儀表板。

**Why this priority**：URL 對應到畫面是 SPA 體驗的全部根基。如果這條不成立，分享連結、書籤、瀏覽器歷史紀錄全部失效，使用者每次重整就要重新導航一次，整個產品的「網頁感」立刻消失。任何後續導航、FAB、設計系統都建立在 URL 路由可信任的前提上，因此屬最高優先 P1。

**Independent Test**：在六個受保護頁與四個公開頁分別執行：(a) 直接從網址列輸入該 URL，畫面正確載入；(b) 將該 URL 複製貼到無痕視窗開啟，畫面正確載入（公開頁直接顯示，受保護頁先導向登入再回到原頁）；(c) 在該頁按 F5 重整，畫面仍為該頁；(d) 在多個頁面之間切換後，瀏覽器「上一頁」「下一頁」按鈕能正確還原到先前畫面。

**Acceptance Scenarios**：

1. **Given** 已登入使用者在 `/dashboard`，**When** 點選側邊欄「股票交易紀錄」連結切換至 `/stocks/transactions`，**Then** 網址列更新為 `/stocks/transactions`、主畫面切換為股票交易頁、瀏覽器歷史新增一筆紀錄；按「上一頁」可回到 `/dashboard`，網址列與畫面同步還原。
2. **Given** 已登入使用者位於 `/finance/budget` 並按 F5，**When** 頁面重整完成，**Then** 主畫面仍為預算管理頁（不是儀表板）；網址列保持 `/finance/budget`。
3. **Given** 未登入訪客在無痕視窗直接輸入 `/stocks/portfolio`，**When** 系統判定未認證，**Then** 自動導向 `/login` 並記住原始 URL；登入成功後自動跳轉至 `/stocks/portfolio` 而非預設儀表板。
4. **Given** 訪客在無痕視窗直接輸入 `/privacy` 或 `/terms`，**When** 頁面載入，**Then** 不需登入即可看到對應的法律文件頁，網址列為原 URL。
5. **Given** 使用者在 `/finance/accounts` 與 `/finance/categories` 之間切換三次，**When** 連按瀏覽器「上一頁」三次，**Then** 依序回到先前頁面，每一步畫面與網址列皆同步。
6. **Given** 使用者直接輸入完全不存在的路徑 `/foo/bar/baz`，**When** 伺服器回應與前端解析完成，**Then** 顯示專屬 404 頁（含「返回首頁」按鈕），網址列保留 `/foo/bar/baz`，瀏覽器歷史不被汙染為儀表板。

---

### User Story 2 — 已登入使用者用側邊欄／漢堡選單在主應用程式內切換頁面（Priority: P1）

桌面使用者在左側看到固定常駐的側邊欄，列出所有可用頁面（儀表板、收支管理、股票投資、API、設定）；點擊任一項即在主內容區切換頁面、URL 同步更新。手機使用者預設不顯示側邊欄，按右上角漢堡圖示後從左側滑入；點選任一項後選單自動收合並切到對應頁。一般使用者看不到「管理員面板」入口；管理員登入後則於設定群組看到該入口。

**Why this priority**：使用者要有方式在受保護頁面之間切換，否則只能靠手動改網址列。這是除了路由本身之外、讓 URL 路由實際被「用」起來的最低必要條件，與 US1 並列 P1。

**Independent Test**：以一般使用者登入桌面瀏覽器（≥ 1024px），驗證側邊欄常駐並列出 11 個受保護頁入口（不含管理員面板）；逐一點擊每一項，主內容區與 URL 同步切換。將瀏覽器寬度縮至 < 768px，確認側邊欄收合、出現漢堡按鈕，點擊展開、點選項目後自動收合並切頁。再以管理員身分重複，確認多出「管理員面板」入口。

**Acceptance Scenarios**：

1. **Given** 一般使用者於桌面瀏覽器登入後，**When** 主畫面載入，**Then** 左側顯示常駐側邊欄，包含：儀表板、交易記錄、統計報表、預算管理、帳戶管理、分類管理、固定收支、持股總覽、股票交易紀錄、股票股利紀錄、股票實現損益紀錄、API 使用與授權、帳號設定、資料匯出匯入；不顯示「管理員面板」。
2. **Given** 管理員登入相同畫面，**When** 主畫面載入，**Then** 設定群組多一項「管理員面板」連結（指向 `/settings/admin`）。
3. **Given** 一般使用者在網址列直接輸入 `/settings/admin`，**When** 系統解析路由，**Then** 前端顯示與不存在路由相同的「404 — 找不到頁面」訊息頁；URL 保留 `/settings/admin` 不被改寫；後端 API 對應請求 MUST 仍回 403／無資料（不依此 UI 表現而異）。
4. **Given** 使用者於 < 768px 螢幕載入主畫面，**When** 頁面渲染完成，**Then** 側邊欄預設收合，右上角顯示漢堡圖示；點擊後側邊欄從左側滑入並覆蓋主內容；點選任一項目後自動收合並切換頁面。
5. **Given** 使用者目前位於 `/finance/transactions`，**When** 點擊側邊欄「交易記錄」（已選中項），**Then** 維持當前頁面、不重複新增瀏覽器歷史（避免「上一頁」陷在同一頁不停回退）。

---

### User Story 3 — 在對的頁面上看到對的「快速新增」浮動按鈕（Priority: P2）

使用者進入收支管理區塊任一頁（交易記錄、統計報表、預算管理、帳戶管理、分類管理、固定收支）時，畫面右下角出現「新增交易」浮動按鈕（FAB）；點擊即開啟新增交易 Modal。當使用者切到股票相關頁（`/stocks` 含子分頁）時，FAB 自動切換為「新增股票交易紀錄」，點擊開啟對應 Modal。儀表板、設定、API 使用頁不顯示 FAB，避免無關操作干擾。

**Why this priority**：FAB 是「最常用操作」的快速入口（使用者在交易頁待最久、最常新增交易）。沒有它使用者每次新增都得從側邊欄繞兩步；但即使沒有 FAB，使用者仍可透過頁內「+」按鈕完成新增，因此屬 P2 而非 P1。

**Independent Test**：依序進入儀表板、`/finance/transactions`、`/finance/reports`、`/finance/budget`、`/finance/accounts`、`/finance/categories`、`/finance/recurring`、`/stocks`、`/stocks/transactions`、`/stocks/dividends`、`/stocks/realized`、`/api-credits`、`/settings/account`、`/settings/export` 共 14 頁，記錄每頁右下角是否顯示 FAB 與顯示的標籤；對照下表驗證一致：

| 頁面 | FAB 顯示 | 標籤 | 點擊後開啟 |
| ---- | -------- | ---- | ---------- |
| `/dashboard` | 否 | — | — |
| `/finance/*` 全部 | 是 | 新增交易 | `modalTransaction` |
| `/stocks` 與 `/stocks/*` 全部 | 是 | 新增股票交易紀錄 | `modalStockTx` |
| `/api-credits` | 否 | — | — |
| `/settings/*` | 否 | — | — |

**Acceptance Scenarios**：

1. **Given** 使用者位於 `/finance/categories`，**When** 主畫面載入完成，**Then** 右下角出現「新增交易」FAB；點擊後開啟 `modalTransaction` Modal。
2. **Given** 使用者位於 `/stocks/dividends`，**When** 主畫面載入完成，**Then** 右下角出現「新增股票交易紀錄」FAB；點擊後開啟 `modalStockTx` Modal。
3. **Given** 使用者從 `/finance/budget` 切換到 `/dashboard`，**When** 切換完成，**Then** FAB 消失（不顯示任何浮動按鈕）。
4. **Given** 使用者從 `/finance/budget` 切換到 `/stocks/portfolio`，**When** 切換完成，**Then** FAB 圖示／文字／點擊行為由「新增交易」切換為「新增股票交易紀錄」，不需重新整理。
5. **Given** 使用者已開啟一個 Modal（例如 `modalTransfer`），**When** 視覺檢查 FAB 區域，**Then** FAB 不擋在 Modal 之上（z-index 順序應為 FAB < Modal 遮罩）。

---

### User Story 4 — 在任一裝置切換外觀模式，登入其他瀏覽器自動套用（Priority: P2）

使用者在「帳號設定」可選擇三種外觀模式之一：「跟隨系統」（依作業系統 prefers-color-scheme 動態切換）、「強制淺色」、「強制深色」。選擇後立刻套用至當前畫面（無需重整）；偏好同步寫入後端使用者資料。同帳號於另一台筆電登入時自動套用相同偏好；登入前的登入頁則依瀏覽器系統偏好渲染，不影響無障礙對比度。

**Why this priority**：深色模式是現代產品的基本要求（夜間使用、OLED 省電、視覺偏好），「跨瀏覽器同步」則避免使用者每次換裝置都要重設。但此功能不阻擋核心記帳流程，屬 P2。

**Independent Test**：以同一帳號於 Chrome 與 Firefox 各登入一次；於 Chrome 切換為「強制深色」並重整，確認畫面為深色；切到 Firefox 重整，無需手動切換，畫面也應為深色。再切回「跟隨系統」並調整作業系統主題，畫面依系統偏好即時切換。

**Acceptance Scenarios**：

1. **Given** 使用者登入後外觀為「跟隨系統」且作業系統為深色，**When** 主畫面初始渲染，**Then** 整個應用程式以深色主題呈現，所有文字／背景對比度皆通過 WCAG AA（≥ 4.5:1）。
2. **Given** 使用者於設定頁切換為「強制淺色」，**When** 點擊套用，**Then** 畫面立即切換為淺色（不需重整）；偏好寫入後端。
3. **Given** 使用者切換完成後 5 秒內於另一裝置登入同帳號，**When** 主畫面初始渲染，**Then** 直接以「強制淺色」呈現，無需手動再選一次。
4. **Given** 作業系統由淺色切換為深色，**When** 使用者目前外觀模式為「跟隨系統」，**Then** 應用程式畫面動態切換為深色，不需重新整理；若目前為「強制淺色／深色」則不受系統切換影響。
5. **Given** 使用者啟用 `prefers-reduced-motion`，**When** 切換主題或開啟 Modal，**Then** 動畫降級為瞬時切換或極簡淡入，不出現 spring 彈性效果。

---

### User Story 5 — 全站統一的金額、日期、顏色、互動與無障礙呈現（Priority: P3）

不論使用者位於哪一頁，金額一律顯示為 `NT$ 1,234`（千分位逗號＋ tabular-nums 等寬數字），日期一律 `YYYY-MM-DD`；收入綠、支出紅、轉帳藍、主色調紫（`#6366f1`）；所有 Toast 通知一律「成功綠／錯誤紅」；所有刪除動作一律出現相同樣式的二次確認 Modal；按鈕、Modal、頁面切換動畫採 spring 風格；分段控件採 iOS 風格；鍵盤焦點皆有 focus-visible 焦點環；深色模式下對比度達 WCAG AA。

**Why this priority**：視覺一致性是產品成熟度的指標，但缺少時並不會阻擋使用者完成任何記帳工作；屬於累積性的 P3 品質要求。

**Independent Test**：抽查 10 個畫面（儀表板、交易記錄、預算、報表、持股總覽、API 頁、設定頁、登入頁、隱私頁、404 頁），逐項目視覺檢查：金額格式、日期格式、Toast 顏色、刪除確認 Modal 樣式、焦點環、深色模式對比度；製作偏差清單回饋給設計團隊，每一項都有明確 pass/fail 標準。

**Acceptance Scenarios**：

1. **Given** 使用者開啟交易記錄頁，**When** 列表渲染完成，**Then** 所有金額皆以 `NT$ 1,234.56` 格式（千分位逗號、最多兩位小數）並用等寬數字字型顯示；日期皆為 `YYYY-MM-DD`。
2. **Given** 使用者點擊任一刪除按鈕（不論是交易、分類、帳戶、預算、固定收支、股票），**When** 確認 Modal 出現，**Then** 採用相同的 `modalConfirm` 元件樣式（同色彩、同按鈕配置、同動畫），絕不出現原生 `confirm()` 對話框。
3. **Given** 任何 Toast 顯示，**When** 視覺檢查，**Then** 成功訊息為綠底（或綠色強調）、錯誤訊息為紅底（或紅色強調），主色 hex 落在指定範圍。
4. **Given** 使用者以鍵盤 Tab 在頁面間移動，**When** 焦點落到任一可互動元素，**Then** 元素上呈現可見焦點環（focus-visible 樣式），不依賴滑鼠 hover 才看見。
5. **Given** 應用程式切換到深色模式，**When** 任意畫面渲染，**Then** 主要文字與其背景色之對比度 ≥ 4.5:1（隨機抽查 10 處皆通過 WCAG AA）。

---

### User Story 6 — 任何不在白名單內的檔案都無法透過 HTTP 取得（Priority: P3）

開發者誤把 `.env`、`config.json`、SQLite 資料庫檔、`server.js` 放在公開靜態目錄時，使用者直接以 URL 請求這些檔案的回應一律為 404（或被 catch-all 接走後回到 SPA），絕不洩漏實際內容。系統僅將指定的公開資源（`index.html`、`app.js`、`style.css`、`favicon.svg`、`logo.svg`、`changelog.json`、`privacy.html`、`terms.html` 等）列入靜態檔白名單。

**Why this priority**：靜態檔白名單是防止敏感檔意外洩漏的最後一道防線；理應與 catch-all 同層存在。即便其他層皆失守，白名單仍能擋下絕大多數誤外洩風險。屬重要安全基線；但一般使用者不會直接感知，故列為 P3。

**Independent Test**：對伺服器以 HTTP `GET` 嘗試取得：
- 應為 200 + 實際內容：`/`, `/index.html`, `/app.js`, `/style.css`, `/favicon.svg`, `/logo.svg`, `/changelog.json`, `/privacy.html`, `/terms.html`
- 應**非**回傳實際內容（404 或被 catch-all 導回 SPA HTML，**絕不**回傳檔案 raw bytes）：`/.env`, `/config.json`, `/server.js`, `/package.json`, `/data.db`, `/node_modules/express/package.json`, `/.git/config`, `/specs/008-frontend-routing/spec.md`, `/CLAUDE.md`

**Acceptance Scenarios**：

1. **Given** 攻擊者直接 GET `/.env`，**When** 伺服器處理請求，**Then** 不回傳檔案實際內容；回應為 SPA 的 `index.html` 或 404，且 `Content-Type` 不為 `text/plain`／`application/json`／`application/octet-stream`。
2. **Given** 攻擊者嘗試 path traversal `/static/../server.js` 或 `/%2e%2e/server.js`，**When** 伺服器處理，**Then** 不回傳 `server.js` 內容，回應為 404 或 SPA index。
3. **Given** 開發者新增 `/public/avatar.png` 但未加入白名單，**When** 使用者請求 `/avatar.png`，**Then** 該檔不可被讀取（被 catch-all 導向 SPA），需顯式加入白名單後才能對外服務。
4. **Given** 使用者以 GET 請求 `/changelog.json`，**When** 伺服器處理，**Then** 回傳 200 與該 JSON 檔內容（白名單明確允許）。
5. **Given** 任何 `index.html`、`app.js` 等白名單資源，**When** 使用者請求，**Then** 設定適當的 `Cache-Control` header，避免敏感更新無法即時生效（細節見 FR-028）。

---

### Edge Cases

- **路由切換期間網路中斷**：使用者點擊側邊欄項目後伺服器資料 fetch 失敗，URL 應回滾至前一頁或停留原頁並顯示錯誤 Toast，不可呈現「網址已換、畫面為空」的中間狀態。
- **同時開啟多個分頁切換不同主題**：A 分頁設「強制深色」、B 分頁設「強制淺色」幾乎同時送出，後到的請求覆蓋前者；兩個分頁皆在各自下次重整時對齊到後端最終值（最後寫入者勝出，不嘗試多分頁即時同步）。
- **POSTBack／反按瀏覽器**：使用者在 Modal 開啟狀態按瀏覽器「上一頁」，應先關閉 Modal 而非直接退出當前頁（除非使用者再按一次）。
- **未登入訪客直接打開 `/login` 已登入後再造訪**：若已登入使用者誤入 `/login`，自動導向 `/dashboard`，避免出現「我都登入了還在看登入頁」的困惑。
- **`/stocks` 與 `/stocks/portfolio` 雙別名**：兩者皆指向同一頁面；當使用者於 `/stocks` 重整時 URL 維持 `/stocks` 不偷偷改寫成 `/stocks/portfolio`（避免污染分享連結）。
- **權限變更但 session 仍存活**：管理員身分被移除後，使用者於下一個受保護頁切換或重整時應重新校驗角色；若不再具管理員資格，原本可見的「管理員面板」連結應消失，已開啟頁面則導向 `/settings/account`。
- **使用中 session 突然失效**：使用者在頁面操作中收到 401（例如：被管理員強制登出、JWT 超過有效期、token_version 不符），系統依 FR-007a 立刻導向 `/login?next=<原 URL>` 並顯示 Toast；不可在原頁面殘留可能 stale 的資料畫面。
- **超寬／超窄螢幕**：> 1920px 時側邊欄不無限拉寬（保持上限固定寬度）；< 320px 時漢堡選單仍可正常開合不溢出。
- **網址列含 hash／query string**：例如 `/finance/transactions?month=2026-04#topic-tag`，路由解析應只用 path 配對頁面；query 與 hash 由各頁自行解讀，不可導致路由判定錯誤。
- **改 URL 但 JS 尚未載入**：第一次直接打開深層連結時若 `app.js` 還在下載，`index.html` MUST 內聯一個極簡載入指示器（中央旋轉圈 + 應用程式 logo），讓使用者看到品牌而非全白；SPA 掛載後該載入指示器 MUST 立刻被覆蓋並渲染目標頁面。內聯資產不得發出額外網路請求（圖示以 inline SVG 或 CSS 動畫實作）。

## 需求 *(mandatory)*

### 功能需求

#### 路由與深層連結（US1）

- **FR-001**：系統 MUST 公開以下無需登入的路由：`/`（網站介紹首頁／Public Home）、`/login`（登入／註冊）、`/privacy`（隱私權政策）、`/terms`（服務條款）。其餘路由皆需登入。
- **FR-002**：系統 MUST 對已登入使用者提供以下受保護路由與對應頁面：

  | URL | 頁面 |
  |-----|------|
  | `/dashboard` | 儀表板 |
  | `/finance/transactions` | 交易記錄 |
  | `/finance/reports` | 統計報表 |
  | `/finance/budget` | 預算管理 |
  | `/finance/accounts` | 帳戶管理（含匯率設定） |
  | `/finance/categories` | 分類管理 |
  | `/finance/recurring` | 固定收支 |
  | `/stocks`、`/stocks/portfolio` | 持股總覽（兩 URL 為同一頁） |
  | `/stocks/transactions` | 股票交易紀錄 |
  | `/stocks/dividends` | 股票股利紀錄 |
  | `/stocks/realized` | 股票實現損益紀錄 |
  | `/api-credits` | API 使用與授權 |
  | `/settings/account` | 帳號設定（含個人登入稽核） |
  | `/settings/admin` | 管理員面板（限管理員） |
  | `/settings/export` | 資料匯出匯入 |

- **FR-003**：前端 MUST 以瀏覽器 History API（`history.pushState` / `popstate`）實作 SPA 路由；點擊內部連結與側邊欄項目時 MUST 以 `pushState` 切換而非整頁重載；使用者按瀏覽器「上一頁／下一頁」時 MUST 觸發 `popstate` 並讓主畫面與網址列同步。
- **FR-004**：伺服器 MUST 對任何未匹配 API（`/api/*`）與靜態檔白名單（FR-026）的 GET 請求回傳 `index.html`（catch-all），讓使用者直接輸入深層連結也能正確初始化 SPA。
- **FR-005**：應用程式初始化時 MUST 依當前 `window.location.pathname` 決定要渲染哪一頁；重整 F5 後 MUST 留在原本路由（不一律導向儀表板）。
- **FR-006**：未登入訪客請求受保護路由時，系統 MUST 將原始 URL（path + query + hash）以安全方式記住（例：URL query `?next=` 或 sessionStorage），完成登入後 MUST 自動導向該原始 URL；若原始 URL 為外部連結或不在 FR-001／FR-002 列表內，MUST 回退至 `/dashboard` 以避免 open redirect。
- **FR-006a**：`?next=` 合法性檢查 MUST 採嚴格白名單演算法（FR-006、FR-007、FR-007a 共用）：
  1. 解碼 `next` 後 MUST 以單一 `/` 開頭；
  2. MUST NOT 以 `//`、`/\`（含 URL-encoded 等價如 `%2F%2F`、`/%5C`）或任何含 `://` 的字串開頭，避免 protocol-relative 與絕對 URL 注入；
  3. 取出 pathname 部分（去除 query 與 hash）後 MUST 經 FR-010a 正規化（小寫、折疊連續斜線、去尾端斜線），結果 MUST 命中 FR-001 + FR-002 路由表中的已知 path（管理員專屬路徑亦放行；跳回後再由 FR-014 進行權限驗證並決定是否顯示 404）；
  4. 任一條件不通過即 MUST fallback 至 `/dashboard`，並寫入 `route_open_redirect_blocked` 稽核事件（FR-032，metadata 含原始 next 值）；
  5. 通過驗證後 MUST 將完整 next（含 query 與 hash 部分）原樣套用為跳轉目標。
- **FR-007**：已登入使用者主動或被動造訪 `/login` 時，系統 MUST 自動導向 `/dashboard`（或 `?next=` 指定的內部路徑，受 FR-006 同樣的合法性檢查）。
- **FR-007a**：使用中 session／JWT 過期時（API 任何端點回 401，包含被管理員強制登出、token_version 不符、超過有效期），前端路由層 MUST 立刻將當前 URL（path + query + hash）寫入 `?next=` 並導向 `/login`，同時透過 Toast 顯示「您的登入已過期，請重新登入」（錯誤紅樣式，依 FR-025）。`?next=` 的合法性檢查 MUST 與 FR-006 / FR-006a 共用同一邏輯，避免 open redirect。重新登入完成後 MUST 依 `?next=` 跳回原頁面。
- **FR-007b**：使用者主動登出（點擊登出按鈕、`/api/auth/logout` 成功回應後）時，前端 MUST 導向 `/login`，並 MUST 清除：(a) 當前 URL 中任何殘留的 `?next=` 查詢參數；(b) localStorage `theme_pref`（FR-021a）；(c) 其他與帳號相關的 localStorage／sessionStorage 條目（避免跨帳號殘留偏好）。登出後若使用者點擊「登入」MUST 重新走 FR-021a 三層 fallback 重新取得 theme。登出 MUST NOT 顯示 Toast「登入已過期」（與 FR-007a 區分）；可顯示成功綠樣式 Toast「已成功登出」（依 FR-025）。
- **FR-008**：路徑完全不存在於 FR-001 + FR-002 列表的請求（例：`/foo/bar`）MUST 由前端顯示專屬「404 — 找不到頁面」訊息頁，提供「返回首頁」與「返回儀表板（已登入時）」按鈕；網址列保留原 URL 不被改寫；HTTP 回應由後端 catch-all 給 200（內容為 SPA index）。
- **FR-009**：點擊已選中的側邊欄項目（與目前 URL 相同）MUST NOT 重複新增瀏覽器歷史紀錄（避免「上一頁」陷在同一頁回退）。
- **FR-010**：路由解析 MUST 僅以 pathname 為依據，query string 與 hash MUST 不影響路由配對（兩者由各頁自行解讀）。
- **FR-010a**：路徑正規化 — 所有路由 MUST 為小寫、不含 trailing slash（根路徑 `/` 除外）、不含連續斜線（`//`、`///` 等）。前端 router 啟動與每次 `popstate`／`pushState` 時 MUST 對 `window.location.pathname` 執行正規化：(a) 全轉小寫；(b) 折疊連續斜線為單一斜線；(c) 去除尾端斜線（除 `/`）。若正規化前後不一致，MUST 以 `history.replaceState` 改寫為正規形式（不推 history、不污染上一頁／下一頁堆疊）後再進行路由配對。後端 catch-all 對受保護路由列表（FR-002）與管理員路徑（FR-014）的比對 MUST 以正規化後字串進行；FR-032 稽核日誌寫入的路徑欄位 MUST 為正規化後形式。任何含 URL-encoded 斜線（`%2F`、`%2f`）或編碼後仍含 `..` 的請求一律比照 FR-027 路徑遊走攔截。

#### 主導航與權限分流（US2）

- **FR-011**：桌面斷點（≥ 768px）下側邊欄 MUST 常駐顯示於主畫面左側；行動斷點（< 768px）下 MUST 預設收合並改以右上角漢堡圖示展開／收合。
- **FR-012**：側邊欄項目 MUST 依「儀表板 → 收支管理（交易／報表／預算／帳戶／分類／固定收支）→ 股票投資（持股／交易紀錄／股利／實現損益）→ API 使用 → 設定（帳號／資料匯出匯入／管理員面板）」分組顯示；同群組內以邏輯關係排序。
- **FR-013**：「管理員面板」入口 MUST 僅在使用者具管理員身分時於側邊欄顯示；一般使用者畫面上完全看不到該連結。
- **FR-014**：一般使用者（非管理員）直接以網址列輸入 `/settings/admin` 或其他僅限管理員之路徑時，前端 MUST 呈現與 FR-008 相同的「404 — 找不到頁面」訊息頁（含「返回首頁」與「返回儀表板」按鈕）；URL 保留原樣不被改寫；前端 MUST NOT 揭露該路徑「存在但無權限」之資訊（與不存在路由的回應形式完全一致，以最大化資訊保密）。後端對應 API MUST 一律回傳 403 / 無資料，不依此 UI 表現而異。
- **FR-015**：手機漢堡選單展開後 MUST 以遮罩覆蓋主內容；點選任一項後 MUST 自動收合並切換頁面；點擊遮罩或按 ESC MUST 關閉選單。
- **FR-015a**：側邊欄目前頁面（active item）視覺狀態 MUST 採三件式呈現：(a) 項目左側 4px 寬的主色（`#6366f1`）垂直直條；(b) 項目文字以主色顯示；(c) 項目背景為主色 8% 透明度（淺色與深色模式皆同）。非 active 項目 MUST 為預設灰階文字搭配透明背景；hover 狀態 MUST 為灰階 4% 背景（與 active 的主色 8% 在色相與彩度皆可區分）。鍵盤 focus-visible MUST 為主色 2px 焦點環（依 FR-025 設計系統），與 active 視覺正交、可同時呈現。active 狀態 MUST 由前端 router 依正規化後 pathname 與路由表（FR-002）配對自動套用，不需各頁手動指定。手機漢堡選單展開時 active 視覺規則完全相同。

#### 情境式 FAB（US3）

- **FR-016**：FAB MUST 依當前路由情境顯示／隱藏與切換內容：
  - 收支管理頁（`/finance/transactions`、`/finance/reports`、`/finance/budget`、`/finance/accounts`、`/finance/categories`、`/finance/recurring`）：顯示「新增交易」FAB，點擊開啟 `modalTransaction`。
  - 股票相關頁（`/stocks`、`/stocks/portfolio`、`/stocks/transactions`、`/stocks/dividends`、`/stocks/realized`）：顯示「新增股票交易紀錄」FAB，點擊開啟 `modalStockTx`。
  - 其他頁（`/dashboard`、`/api-credits`、`/settings/*`、公開頁）：MUST NOT 顯示 FAB。
- **FR-017**：FAB 的 z-index MUST 低於任何已開啟 Modal 的遮罩，避免遮蓋 Modal 內容或攔截點擊。

#### 外觀模式（US4）

- **FR-018**：使用者 MUST 可於「帳號設定」頁從以下三選一切換外觀模式：「跟隨系統」（依瀏覽器 `prefers-color-scheme` 動態切換）、「強制淺色」、「強制深色」。
- **FR-019**：偏好 MUST 持久化於後端使用者偏好資料中（不僅存於 localStorage），使同帳號於不同瀏覽器登入時自動套用相同偏好。
- **FR-020**：模式切換 MUST 立即套用至當前畫面，無需手動重整；「跟隨系統」模式下作業系統主題改變時應用程式 MUST 跟隨更新。
- **FR-021**：登入頁與其他公開頁未取得使用者偏好前 MUST 依瀏覽器 `prefers-color-scheme` 決定淺／深色，不固定為其中一種。
- **FR-021a**：登入完成後的初始主題渲染 MUST 採三層 fallback 順序以消除 FOUC：(1) 後端 `/api/auth/login` 與 `/api/users/me` 回應 MUST 在 response body 直接夾帶 `theme` 欄位（值域 `system`／`light`／`dark`），前端 MUST 於掛載 SPA 主畫面前讀取並套用至 `<html data-theme>`；(2) 前端 MUST 將每次成功取得的 `theme` 值寫入 localStorage（key：`theme_pref`），下次登入或重整時優先採用 localStorage 值進行「樂觀渲染」（在 API 回應到達前先呈現），API 回應到達後若與快取不一致 MUST 切換並覆寫 localStorage；(3) 首次登入、localStorage 缺值或值非合法值時 MUST fallback 至 `prefers-color-scheme`（與 FR-021 公開頁邏輯一致）。登出時 MUST 清除 `theme_pref` localStorage 條目以避免帳號間殘留偏好。

#### Modal 規範（US3 + US5）

- **FR-022**：應用程式 MUST 提供以下 12 種 Modal，每一種皆使用相同基底元件（共用遮罩、動畫、關閉行為），不得使用瀏覽器原生 `alert()`／`confirm()`／`prompt()`：

  | Modal            | 用途                              |
  | ---------------- | --------------------------------- |
  | modalTransaction | 新增／編輯交易記錄                |
  | modalTransfer    | 新增轉帳記錄                      |
  | modalCategory    | 新增／編輯分類（含上層分類選擇） |
  | modalAccount     | 新增／編輯帳戶                    |
  | modalBudget      | 新增／編輯預算                    |
  | modalRecurring   | 新增／編輯固定收支                |
  | modalBatchChange | 批次變更（分類／帳戶／日期）     |
  | modalConfirm     | 刪除確認                          |
  | modalStock       | 新增／編輯股票持倉（含 TWSE 查詢）|
  | modalStockTx     | 新增／編輯股票交易（含費用試算） |
  | modalStockDiv    | 新增／編輯股票股利                |
  | modalPriceUpdate | 批次更新股價（含 TWSE 批次取得） |

- **FR-023**：所有刪除操作 MUST 透過 `modalConfirm` 二次確認後才實際送出；不得無確認直接刪除。
- **FR-023a**：Modal 開啟時 MUST 鎖定 `<body>` 捲動（背景內容固定不動）；Modal 內容高度超過視窗時 MUST 由 Modal 自身內部捲動，不得讓背景產生捲動。鎖定行為 MUST 包含 iOS Safari 之滾動穿透防護（例如 `position: fixed` + 還原 scrollTop，或 `overscroll-behavior: contain` + `touch-action` 規範）。所有 12 種 Modal 共用此行為，不允許各自關閉。
- **FR-024**：Modal 開啟期間使用者按瀏覽器「上一頁」MUST 優先關閉 Modal 而非離開當前頁；若 Modal 已關閉再按「上一頁」才退到前一個 URL。實作上 MUST 於 Modal 開啟時以 `pushState` 推一筆「Modal 開啟中」歷史條目（hash 形式建議為 `#modal-<modalId>`，例：`#modal-transaction`），於 `popstate` 觸發時關閉對應 Modal；Modal 透過 ESC 或關閉按鈕主動關閉時 MUST 同步呼叫 `history.back()` 以避免歷史殘留多餘條目。重整時若 hash 對應到既有 Modal id，可選擇還原該 Modal（非必要；各 Modal 視需求自行決定是否支援深層連結）。
- **FR-024a**：Modal 堆疊規則 — 預設 MUST NOT 同時開啟多個 Modal（開新 Modal 前 MUST 先關閉既有 Modal）；唯一例外為「`modalConfirm` 疊在其他 Modal 之上」（典型情境：使用者於 `modalTransaction`／`modalAccount` 等編輯型 Modal 內按刪除按鈕，疊出 `modalConfirm` 二次確認）。疊加時：(a) history MUST 再推一筆 `#modal-confirm` 條目（共 2 筆 modal 條目）；(b) 背景捲動鎖（FR-023a）MUST 維持鎖定，不重複套用 `position: fixed` 也不於上層關閉時誤解除；(c) z-index 順序 MUST 為「上層 `modalConfirm` > 下層編輯 Modal > FAB > 主內容」；(d) 使用者按瀏覽器「上一頁」或 ESC MUST 僅關閉最上層 `modalConfirm` 並回到下層 Modal 互動狀態，再按一次才關閉下層 Modal。任何超過此單層疊加的組合（例如 confirm 上再疊 confirm、或兩個編輯型 Modal 疊加）MUST 由共用基底元件直接拒絕並 console.warn。

#### 設計系統與無障礙（US5）

- **FR-025**：全站 MUST 套用以下視覺規範：
  - 金額：`NT$ 1,234`／`NT$ 1,234.56` 格式（千分位逗號、最多兩位小數），以等寬數字字型（`tabular-nums`）顯示。
  - 日期：`YYYY-MM-DD` ISO 8601 格式（與 007 規格對齊）。
  - 顏色：收入綠、支出紅、轉帳藍、主色調紫（`#6366f1`）；Toast 通知成功綠、錯誤紅；主色調 MUST 鎖定不開放使用者自訂。
  - 動畫：spring 動畫、iOS 風格分段控件、focus-visible 焦點環；MUST 支援 `prefers-reduced-motion`，啟用時動畫降級為瞬時或極簡淡入。
  - 對比度：深色與淺色模式下，主要文字／背景對比度 MUST ≥ 4.5:1（WCAG AA）。

#### 靜態檔安全白名單（US6）

- **FR-026**：伺服器 MUST 維護靜態檔白名單，僅允許以下檔案以原始內容回傳：`index.html`、`app.js`、`style.css`、`favicon.svg`、`logo.svg`、`changelog.json`、`privacy.html`、`terms.html`，以及未來明確加入此清單的公開資產。任何不在白名單上的檔案 MUST NOT 以 raw bytes 回傳，請求路徑 MUST 走 catch-all（FR-004）回傳 SPA `index.html`。
- **FR-027**：白名單檢查 MUST 拒絕路徑遊走（path traversal）：任何含 `..` 或 URL-encoded 等價形式（如 `%2e%2e`、`%252e%252e`）的請求 MUST 回 404 而不解析。
- **FR-028**：白名單資源 MUST 設定合適的 `Cache-Control` 標頭：`index.html` 設為 `no-cache` 或極短 max-age（避免使用者卡在舊版本）；`app.js`／`style.css` 採內容指紋（檔名含 hash）後可設長期 cache，未指紋版本則設短 max-age。

#### 不做什麼（明確排除）

- **FR-029**：本功能 MUST NOT 包含 PWA、Service Worker 或離線模式；保留至未來版本獨立規劃。
- **FR-030**：本功能 MUST NOT 包含多語系（i18n）／國際化機制；全站使用者介面文字 MUST 統一為繁體中文。
- **FR-031**：本功能 MUST NOT 提供使用者自訂主題色或主色調切換；主色調紫（`#6366f1`）為系統常數。

#### 路由與權限稽核日誌（跨 US2 + US6）

- **FR-032**：系統 MUST 將下列路由相關安全事件寫入 audit log（沿用既有 `data_operation_audit_log` 表或等價結構，欄位含 user_id、role、action、ip_address、user_agent、timestamp、metadata）：
  - **`route_admin_path_blocked`**：一般使用者（非管理員）命中 `/settings/admin` 或其他僅限管理員之路徑（前端僅顯示 404 但後端 API 回 403 時觸發；FR-014）。
  - **`route_open_redirect_blocked`**：`?next=` 參數被合法性檢查攔下為外部連結或非合法內部路徑（FR-006、FR-007、FR-007a）。
  - **`static_path_traversal_blocked`**：靜態檔白名單偵測到 `..` 或 URL-encoded 等價形式並拒絕（FR-027）。
- **FR-032a**：後端 MUST 維護「admin-only 路徑」常數陣列（程式碼層級，例如於 `server.js` 或路由模組內定義 `ADMIN_ONLY_PATHS = ['/settings/admin']`），作為 `route_admin_path_blocked` 偵測的單一比對來源。catch-all 收到請求時若使用者非管理員且正規化後（FR-010a）路徑命中此陣列，MUST 寫入該稽核事件後再回傳 SPA `index.html`（讓前端依 FR-014 渲染 404）。本陣列與前端路由表（FR-002）**手動同步**並以 code review 把關一致性；新增任何 admin-only 路徑時 MUST 於同一 PR 內同時更新前端路由表與後端常數陣列，否則視為實作缺陷。
- **FR-033**：管理員 MUST 可於系統設定頁切換稽核範圍模式：
  - **`security`（預設）**：僅 FR-032 列出的高訊號安全事件。
  - **`extended`**：追加記錄 401（使用中 session 失效，FR-007a）。
  - **`minimal`**：停止寫入本功能定義的路由相關事件（仍保留 001／007 既有的稽核行為）。
  
  常規 `popstate` / `pushState` 切換與 404 命中 MUST NOT 寫入稽核（雜訊過高），不論模式為何。

### 主要實體 *(本功能涉及極少資料)*

- **路由定義（Route Definition）**：每筆路由由「路徑樣式（path pattern）、是否需登入（is_protected）、是否需管理員（require_admin）、對應頁面元件名」組成。整體路由表為 FR-001 + FR-002 之內容；MUST 在前端與後端 catch-all 規則上保持一致（後端不需逐路由認知，但 API 與靜態白名單之外的路徑統一交由 SPA 處理）。
- **使用者外觀偏好（Theme Preference）**：屬於使用者帳號設定的一個欄位，值域為 `system` | `light` | `dark`，預設 `system`；持久化於使用者偏好 JSON（與既有偏好欄位共用），登入後同步至前端。
- **靜態白名單（Static Asset Whitelist）**：伺服器啟動時讀入的固定檔名集合（FR-026），開發者新增公開資產時 MUST 同時更新此清單。
- **路由稽核設定（Routing Audit Setting）**：屬於系統全域管理員設定，值域為 `security` | `extended` | `minimal`（FR-033），預設 `security`；持久化於管理員設定（與 007 既有 audit log 設定同層）；切換後立即生效，不需重啟。

## 成功標準 *(mandatory)*

### 可衡量結果

- **SC-001**：使用者可在三個受保護頁、兩個公開頁分別執行「複製 URL → 貼到無痕視窗 → 看到正確頁面（公開頁直接顯示，受保護頁先導向登入再回到原頁）」測試，5 / 5 通過率達成深層連結可分享性目標。
- **SC-002**：使用者於任一受保護頁按 F5 重整，頁面停留在原 URL 的成功率 ≥ 99%（不被誤導向儀表板）；登入後依原始 URL 導航的成功率亦 ≥ 99%。
- **SC-003**：在 14 個主應用程式頁面（FR-002 全集）逐一進入並切換，FAB 顯示／隱藏／標籤／點擊行為與 US3 表格 100% 對齊。
- **SC-004**：使用者於一台裝置切換外觀模式後，於另一台已開啟分頁重整載入時 90% 以內請求即可看到偏好同步生效（從後端取得偏好的 P95 載入時間 ≤ 500ms）。
- **SC-005**：使用 axe-core 或同等無障礙掃描工具掃描全部 14 個受保護頁與 4 個公開頁的淺色＋深色模式（共 36 個畫面），WCAG AA 對比度違規數量為 0；focus-visible 焦點環在每個可互動元素上皆可被鍵盤偵測。
- **SC-006**：靜態檔白名單測試覆蓋（FR-026 + FR-027）：對 9 條合法白名單路徑與 9 條黑名單路徑（含 `.env`、`server.js`、`data.db`、`.git/config`、含 `..` 與 `%2e%2e` 的 path traversal）逐一發 GET 請求，合法路徑 9 / 9 回 200 與檔案內容；黑名單路徑 0 / 9 回傳實際內容（皆為 SPA index 或 404）。
- **SC-007**：跨瀏覽器與手機執行 US1 + US2 完整 Acceptance Scenarios，每平台通過率 100%；瀏覽器「上一頁／下一頁」於三個以上頁面之間切換的還原成功率 100%。支援矩陣為 evergreen 最近 2 個主版本：Chrome／Edge／Firefox 採最新 stable 與前一版（latest 2 majors）、Safari 16+（含 macOS／iOS）、Android Chrome 最近 2 個版本；本規格用到的 API（History API、`prefers-color-scheme`、`overscroll-behavior`、focus-visible、`tabular-nums`、`position: fixed` scroll lock）於上述支援矩陣均原生支援，不引入 polyfill。
- **SC-008**：頁面切換效能（雙層量測）— (a) 客戶端路由切換（從點擊側邊欄／FAB／內部連結到 URL 更新 + 主內容區換頁框架可見）P95 ≤ 100ms；(b) 完整內容渲染（含資料 fetch 完成、表格／圖表／清單已可互動）P95 ≤ 1000ms。量測涵蓋至少 14 個受保護頁的切換樣本，每頁不少於 50 次取樣。

## 假設

- **路由表為設計階段固定常數**：本功能假設路由清單於設計階段確定（如 FR-001 + FR-002），不需提供動態註冊機制；新功能加入新路由時更新此規格與前端設定即可。
- **沿用既有認證機制**：未登入導向 `/login`、登入後寫入 session／cookie 等流程沿用 001-user-permissions 的實作；本功能僅在路由層整合 `?next=` 與返回邏輯（FR-006、FR-007），不重新設計認證。
- **使用者偏好欄位已存在或可擴充**：外觀模式（FR-019）寫入既有的使用者偏好 JSON 欄位（與其他偏好同處），不需新建獨立資料表；若該結構尚未存在，由 plan 階段補設計。
- **靜態白名單由後端啟動時靜態載入**：FR-026 假設白名單為原始碼層級常數，新增公開資產需修改原始碼後重新部署；不提供管理介面動態管理白名單。
- **Modal 元件由本功能提供共用基底，內容由各功能規格負責**：FR-022 的 12 種 Modal 共用一組基底元件（遮罩／動畫／鍵盤行為），各 Modal 內容由其原功能規格（001~007）負責；本規格僅約束「必須存在且互相一致」。
- **行動斷點固定為 768px**：與目前主流框架慣例一致；plan 階段若採用不同斷點需更新此假設。
- **404 由前端 SPA 渲染、不引入額外 403 頁**：依 FR-008 與 FR-014，不採傳統伺服器端 4xx HTML 模板；前端僅實作一支 404 訊息頁；無權限路徑（FR-014）視覺上與不存在路徑（FR-008）共用同一頁，以最大化資訊保密。HTTP 狀態碼由後端 API 回應正確設置（401／403／404），catch-all 為 200 + SPA HTML 由前端切換到對應錯誤頁。
