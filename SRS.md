# 資產管理 系統規格說明書 (SSD)

**版本：** 4.23.0
**日期：** 2026-04-24
**狀態：** 已實作

---

## 目錄

1. [文件定位與術語](#1-文件定位與術語)
2. [模組規格](#2-模組規格)
   - 2.1 [使用者與權限](#21-使用者與權限)
   - 2.2 [交易與帳戶](#22-交易與帳戶)
   - 2.3 [分類系統](#23-分類系統)
   - 2.4 [預算與固定收支](#24-預算與固定收支)
   - 2.5 [統計報表](#25-統計報表)
   - 2.6 [股票投資](#26-股票投資)
   - 2.7 [資料匯出匯入](#27-資料匯出匯入)
   - 2.8 [前端路由與頁面](#28-前端路由與頁面)
3. [技術附錄](#3-技術附錄)
   - 3.1 [非功能需求](#31-非功能需求)
   - 3.2 [資料模型](#32-資料模型)
   - 3.3 [API 端點](#33-api-端點)
4. [版本歷程](#4-版本歷程)

---

## 1. 文件定位與術語

### 1.1 文件定位

本文件為「資產管理」網頁應用程式的系統規格說明書（System Specification Document, SSD），採按模組分段的敘述式寫法（narrative SSD），替代舊版以 IEEE-830 逐條編號列舉的軟體需求規格書（SRS）。核心目的是讓讀者從「這個模組要解決什麼問題、怎麼運作、哪些事情刻意不做」的角度理解系統，而非羅列 FR 條款。

本文件與 `.specify/memory/constitution.md`（憲章）及 `CLAUDE.md`（開發指引）構成專案的三份主要治理文件：
- 憲章制定原則性不可破壞規則（例如：所有規格必須以繁體中文撰寫）
- 本文件描述每個功能模組的實際行為與邊界
- `CLAUDE.md` 提供給 AI 協作工具（Claude Code、Copilot）的上下文提示

### 1.2 系統概觀

本系統為獨立的網頁應用程式，使用者透過瀏覽器即可使用。採前後端一體化架構，後端以 Node.js + Express 提供 API 與靜態檔服務，前端為原生 HTML / CSS / JavaScript 單頁應用程式（SPA），資料持久化使用 SQLite（透過 sql.js）。支援桌面與行動裝置瀏覽，單一部署單位即可自帶資料庫與介面運作，不依賴外部資料庫服務。

### 1.3 技術棧

| 層級     | 技術                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------- |
| 前端     | 原生 HTML / CSS / JavaScript（SPA）、Chart.js、Font Awesome 6                                     |
| 後端     | Node.js 24+、Express                                                                              |
| 資料庫   | SQLite（透過 sql.js，記憶體執行 + 檔案持久化）                                                    |
| 驗證     | JWT（httpOnly Cookie，`JWT_EXPIRES` 控制有效期）、bcryptjs、Passkey（WebAuthn）、Google SSO（選配）|
| 外部 API | TWSE OpenAPI、exchangerate-api.com、ipinfo.io、Google Identity Services、Resend、SMTP             |
| 部署     | 原生 Node.js 或 Docker；CI 自動從 `changelog.json.currentVersion` 推導 Docker tag 與 git tag      |

### 1.4 使用者角色

| 角色       | 說明                                                                 |
| ---------- | -------------------------------------------------------------------- |
| 管理員     | 系統首位註冊者自動成為管理員。可管理註冊政策、白名單與全站使用者帳號 |
| 一般使用者 | 註冊後使用所有記帳、股票與報表功能                                   |
| 訪客       | 未登入狀態，僅可瀏覽登入／註冊、隱私權政策、服務條款、公開首頁       |

### 1.5 名詞定義

| 名詞     | 定義                                                                 |
| -------- | -------------------------------------------------------------------- |
| 交易記錄 | 一筆收入、支出或轉帳的資料                                           |
| 分類     | 交易記錄的類別（如餐飲、交通），支援一層子分類                       |
| 子分類   | 隸屬於父分類的細項分類（如餐飲 > 早餐）                              |
| 帳戶     | 資金來源（如現金、銀行帳戶、信用卡、虛擬錢包）                       |
| 預算     | 使用者設定的月度支出上限，支援整月總預算或分類預算                   |
| 固定收支 | 週期性自動產生的交易記錄                                             |
| 轉帳     | 帳戶間的資金移轉，產生一對 `transfer_out` + `transfer_in` 配對記錄   |
| 批次操作 | 一次對多筆交易進行刪除或變更分類／帳戶／日期                         |
| 股票持倉 | 使用者持有的股票資產，數量與成本一律由交易紀錄動態計算               |
| 股票交易 | 股票買入或賣出的交易記錄                                             |
| 股票股利 | 股票的現金股利或股票股利，日期欄位為除息日期                         |
| FIFO     | 先進先出法，用於計算股票成本基礎與實現損益                           |
| TWSE     | 臺灣證券交易所（Taiwan Stock Exchange）                              |

### 1.6 作業環境

- **前端：** 現代瀏覽器（Chrome、Firefox、Safari、Edge 最新版本）
- **後端：** Node.js 24+
- **部署：** 本地伺服器或雲端容器；預設 port 3000；支援 Docker（AMD64 + ARM64）

### 1.7 系統邊界

- 系統預設貨幣為新台幣（TWD），但支援多幣別交易與帳戶
- 不提供銀行對帳、券商匯入等自動整合
- 單一使用者帳號不支援多人共用（共享帳本為未來規劃）
- 股票投資僅支援台股（上市 + 上櫃）

---

## 2. 模組規格

### 2.1 使用者與權限

我們的核心目標，是讓使用者以最低的摩擦取得一個安全且可追蹤的身分，並讓系統擁有者能清楚掌握「誰在什麼時候、從哪裡登入了」。

#### 註冊與首次登入

使用者可以用電子郵件與密碼建立帳號。我們不做社群帳號之外的第三方登入，目前僅提供 Google SSO 作為選配。若管理員在伺服器端設定了 `GOOGLE_CLIENT_ID`，登入頁會出現 Google 按鈕；否則完全隱藏，不影響帳號密碼登入。Google SSO 採 OAuth Authorization Code Flow，前端先向後端取得一次性 state，隨授權請求送出並於回呼時比對，後端只接受具有效 state 的授權碼。

註冊表單要求電子郵件格式正確、密碼符合強密碼規則（至少 8 字元且含大小寫字母、數字、特殊符號），並且該電子郵件尚未被使用。送出成功後系統會自動登入、建立預設分類（含子分類）與預設帳戶（現金），使用者可立即開始記帳。Google SSO 若遇到新帳號會同樣自動建立（含預設資料），密碼欄位填入隨機雜湊，意味著該帳號之後只能透過 Google 登入；之後使用者仍可在帳號設定補設本機密碼以恢復帳密登入能力。

登入成功會發放 JWT Token，存於 httpOnly Cookie（防 XSS 竊取），搭配 `SameSite=Strict` 屬性（防 CSRF），有效期由 `JWT_EXPIRES` 環境變數統一控制。登出會呼叫後端 `/api/auth/logout` 清除 Cookie，並在資料庫端觸發 `token_version` 更新以撤銷該 Token。登入 API 回傳 `currentLogin`，讓前端立即顯示本次登入資訊。

#### Passkey（WebAuthn）

使用者可在帳號設定註冊 Passkey（指紋、Face ID、PIN 碼、硬體安全金鑰），之後可在登入頁用 Passkey 一鍵無密碼登入。同一個帳號支援多組 Passkey，每組可命名並獨立刪除。後端有 origin 白名單防 rebinding。WebAuthn 前端模組由伺服器本地提供（不走 CDN），以避開外部失效風險。

#### 管理員身分與註冊政策

系統建立的第一個使用者自動成為管理員；若資料庫升級時尚無任何管理員，最早建立的使用者會被追認升級。這條規則沒有例外，目的是確保系統**永遠至少有一位管理員**。

管理員可以控制註冊政策，包含：是否開放公開註冊、以及一份 Email 白名單。白名單非空時，只有白名單上的 Email 可以註冊（一般註冊與 Google 首次註冊都適用）；白名單為空且公開註冊關閉時，訪客無法自行註冊，只能由管理員直接建立帳號。管理員建立帳號時可指定是否授與管理員身分，可重設任一使用者的密碼，刪除帳號會一併刪除該使用者的所有關聯資料（交易、帳戶、分類、預算、股票等）。**管理員不可刪除自己，也不可讓系統剩餘的管理員歸零** — 這兩條規則對自刪與被刪皆適用。

#### 登入稽核

每一次登入成功都會寫入稽核紀錄，欄位包含登入時間、IP 位址、登入方式（password / google / passkey）、以及本次登入是否以管理員身分進行；失敗登入（帳號不存在、密碼錯誤、缺少憑證、暫時鎖定）也會記錄，且註明失敗原因。IP 的國家代碼優先取自 Cloudflare 的 `CF-IPCountry` 標頭，退回時才查 ipinfo.io；內網位址標記為 `LOCAL`。

一般使用者只能在「帳號設定」看自己最近的 100 筆登入紀錄。管理員另可在管理介面看自己作為管理員身分登入的最近 200 筆、以及全站的最近 500 筆（含失敗嘗試）。管理員的兩種紀錄都支援單筆刪除、多選批次刪除、手動同步，並顯示上次同步時間；即使舊資料缺少主鍵，也必須能透過備援識別（例如時間戳）刪除單筆。

#### 伺服器時間與 NTP 校正

管理員面板有「伺服器時間」區塊，用以解決部署環境時區與時鐘偏移問題（例如：Zeabur / Docker 預設 UTC，但排程應以台灣時間判斷）。此區塊顯示伺服器實際時間、時區、目前採用時間（含偏移）、啟動後偏移量與 uptime；可填目標時間或毫秒偏移量調整 `SERVER_TIME_OFFSET`（系統時鐘本身不動，僅影響排程檢查），偏移持久化於 `system_settings`，上限 ±10 年。

校正來源可選外部 NTP 伺服器（預設依序嘗試 `tw.pool.ntp.org`、`pool.ntp.org`、`time.google.com`、`time.cloudflare.com`）。實作為原生 dgram UDP 的 SNTP v3 client（RFC 4330），3 秒逾時 fallback；校正時扣除單趟網路延遲提升精準度，支援「查詢（不套用）」預覽。NTP host 參數僅允許 IPv4 或 FQDN（擋 IPv6、私有網段、IPv4-mapped、link-local 等 SSRF 風險目標）。

#### 安全基線

- 密碼強度：至少 8 字元，含大寫、小寫、數字、特殊符號；管理員重設密碼時新舊密碼不可相同
- `/api/auth/login`、`/api/auth/register`、`/api/auth/google` 套用速率限制（每 IP 每 15 分鐘 20 次）
- `/privacy`、`/terms` 亦套用速率限制
- 所有使用者輸入經 `escHtml()` 跳脫後插入 DOM；分類顏色僅允許 `#RRGGBB` 格式（雙端驗證）
- 啟用 CSP、HSTS、X-Content-Type-Options、Referrer-Policy；停用 `X-Powered-By`
- 外部 CDN 腳本加 SRI `integrity` 屬性
- `.env` 檔案權限 `0o600`；資料庫備份排除於 `.gitignore` 與 `.dockerignore`

#### 不做什麼

- 不做社群帳號登入除 Google 外的第三方（不支援 Facebook、Apple、Line 等）
- 不做雙因素認證（2FA）；Passkey 已取代此需求
- 不做帳號鎖定策略（連續失敗 N 次鎖定 M 分鐘），僅靠速率限制

---

### 2.2 交易與帳戶

核心目標：讓使用者以最低的摩擦記錄每一筆資金流向，並清楚掌握每個帳戶的當下餘額。

#### 帳戶

帳戶是資金的容器。使用者可自由新增帳戶並指定名稱、初始餘額、圖示、帳戶類別（銀行／信用卡／現金／虛擬錢包）與幣別。新使用者註冊時系統會自動建立一個「現金」帳戶，讓他第一筆交易就能立刻記下來。帳戶管理頁支援以類別分頁（Tab）切換、分組顯示，並對信用卡帳戶提供銀行分組與一鍵還款捷徑。

每個帳戶還有一個「是否計入總資產」開關，排除的帳戶會顯示專屬標籤，並在總資產卡上明示已排除（例如：公司發薪帳戶、朋友代管帳戶）。

帳戶可編輯、可刪除；但若該帳戶已被某筆交易引用則不允許刪除，使用者必須先處理那些交易或把它們移到其他帳戶。帳戶餘額永遠即時由交易紀錄計算而來，公式為 `初始餘額 + 收入 - 支出 + 轉入 - 轉出`。我們不另外儲存一個「目前餘額」欄位，避免資料飄移。

#### 交易

交易有三種類型：收入、支出、轉帳。收入與支出需要金額、日期、分類、帳戶，選填備註（最多 200 字），分類下拉以 optgroup 顯示父子階層。金額禁止為 0 或負數，日期則允許未來日期以供預先規劃（顯示時會加上「未來」標籤與歷史交易區分）。編輯時僅記錄最後修改時間，不保留版本歷史。刪除需二次確認 Modal；轉帳交易刪除時自動同步刪除另一半。

轉帳是一組對稱的 `transfer_out` + `transfer_in` 記錄，透過 `linked_id` 互相關聯。典型情境：信用卡消費時記為該信用卡帳戶的「支出」讓餘額呈現負值，繳款時記為「從銀行帳戶轉帳到信用卡」的轉帳，轉入金額中和負值 — 支出只被認列一次，繳款不會重複計入統計。

支援外幣交易：選擇非 TWD 幣別時，系統會自動從匯率 API 取得當下即時匯率並填入欄位；若是信用卡支出，還會加上海外刷卡手續費（預設 1.5%，可手動調整費率與金額）。交易儲存後，當下採用的匯率會與交易綁定，確保歷史報表不因日後匯率變動而飄移。匯率清單為跨使用者共用（5 分鐘 in-flight deduplication + 30 分鐘 server-level 快取）。

單筆交易可標記為「不計入統計」，以排除特定一次性大額事件（如巨額退稅、帳戶整併）對儀表板、分類統計、預算進度的汙染。

電子發票支援：交易新增 Modal 可開啟相機或上傳圖片掃描財政部電子發票 QRCode，系統自動解析金額、日期、店家資訊並填入表單。

#### 批次操作

當使用者需要一次處理很多筆交易時，表格支援 checkbox 多選（全選、半選、取消全選都支援）。勾選後出現紫色批次操作列，可執行：批次刪除（轉帳會連帶刪除另一半）、批次變更分類、批次變更帳戶、批次變更日期。每一種變更都是單次選單操作，不必一筆筆打開 Modal。批次變更分類的下拉選單採用自訂元件（含色點與分區結構），避免 `<optgroup>` 嵌套時部分瀏覽器渲染不全。

#### 篩選與分頁

交易列表預設按日期新到舊排序。頂端篩選列支援日期範圍、類型（收入／支出／轉帳／未來交易／全部）、分類、帳戶、關鍵字搜尋（匹配備註欄）；每頁筆數可選 10 / 20 / 50 / 100 或自訂輸入任意數字。類型以色彩標籤顯示：支出紅、收入綠、轉帳藍。

#### 不做什麼

- 不做自動銀行對帳／券商匯入。交易只能由使用者手動、固定收支排程或 CSV 匯入
- 不做多幣別報表切換。統計一律以 TWD 等值為準；個別交易原幣金額僅於列表顯示
- 不保留交易修改歷史。僅記「最後修改時間」

---

### 2.3 分類系統

核心目標：讓使用者用最符合自己直覺的方式組織收支，並讓報表能以有意義的維度彙整。

#### 階層

分類支援兩層：父分類與子分類。不提供三層以上的孫分類 — 這是刻意的限制，避免使用者陷入「我要建幾層才夠」的糾結。每個分類有名稱、類型（收入／支出，強制 CHECK 約束）、顏色、是否為預設分類、是否隱藏、排序順序。子分類的類型必須跟父分類一致，同一個父分類下名稱不可重複。子分類僅能隸屬於一個父分類。

#### 預設資料

新使用者註冊時會自動建立完整的預設分類樹：

- **支出父分類：** 餐飲、交通、購物、娛樂、居住、醫療、教育、其他
- **預設子分類範例：**
  - 餐飲 → 早餐、午餐、晚餐、飲料、點心
  - 交通 → 公車/捷運、計程車/Uber、加油、停車費、高鐵/火車
  - 購物 → 日用品、服飾、3C產品、家電
  - 娛樂 → 電影/影音、遊戲、旅遊、運動健身
  - 居住 → 房租/房貸、水電費、網路費、管理費
  - 醫療 → 掛號費、藥品、保健食品
  - 教育 → 學費、書籍、線上課程
- **收入分類：** 薪資、獎金、投資、兼職、其他

舊使用者在系統升級後若缺少任一預設子分類，會在登入時被自動補建。

#### 畫面

父分類顯示完整寬度，帶 `+`（新增子分類）與編輯按鈕；子分類以網格佈局縮排顯示，帶左側藍色邊框和箭頭圖示。整棵分類樹的色彩配色與儀表板、報表的圖例完全一致。

#### 約束

- 分類下若有交易記錄則不可刪除
- 刪除父分類時，若任一子分類下有交易，整棵樹都不可刪除；否則連帶刪除所有子分類
- 顏色僅允許 `#RRGGBB` 格式，後端會驗證；這是為了防止 CSS 注入
- 編輯父分類時不可將其改為某分類的子分類（避免形成循環）

#### 不做什麼

- 不做 AI 自動分類或分類建議；留給未來版本
- 不做跨使用者的共用分類模板庫；使用者想要套用他人範本只能透過 CSV 匯入匯出

---

### 2.4 預算與固定收支

核心目標：讓使用者能事先規劃消費上限與週期性的進出，並在當下快速看到自己離目標多遠。

#### 預算

使用者可設定月度預算，分兩種粒度：整月總支出預算（不選分類）或分類預算（選單支援子分類群組顯示）。每個月每個分類只能有一筆預算 — 一個月內不允許多組同分類的預算並存。設定後儀表板即時顯示進度條：已用金額／預算、百分比、剩餘可用金額，超支時進度條變紅。預算不強制使用者遵守，僅作為視覺提示。

#### 固定收支

固定收支是一份「配方」，描述某筆交易會以什麼週期重複發生。設定欄位：類型（收入／支出）、金額、分類、帳戶、備註、起始日期、週期（每日／每週／每月／每年）、幣別（可選外幣並設定匯率）。

系統每次使用者登入或背景排程觸發時，會掃描所有啟用中的固定收支，比對 `last_generated` 欄位推算出應該產生的交易日期，直到今日為止一次全部產出。若 `last_generated` 為空（首次執行），會以 `start_date` 當作首次產生日期而非「`start_date` 的下一個週期」 — 讓起始日設在今天能正確觸發當日交易。

外幣固定收支在自動產生交易時，會帶入設定當下的匯率；使用者也可以手動改。

固定收支列表每一筆卡片顯示：起始日、上次產生日、下次產生日。若啟用且下次產生日已經到期，會以警示色加上「（待執行）」提醒。備註也會直接顯示在卡片上。編輯現有固定收支時，若原分類或帳戶已被刪除，下拉選單會插入「（原分類已刪除）」或「（原帳戶已刪除）」佔位項目，避免 `select.value` 靜默被清空。

#### 不做什麼

- 不做智慧偵測（自動辨識某筆交易該轉為固定收支），留給未來版本
- 不做超支推播／email 通知，僅在儀表板視覺提示

---

### 2.5 統計報表

核心目標：讓使用者用多種維度檢視自己的收支狀況，找出隱藏的消費模式。

#### 儀表板

登入後的首頁。顯示本月收入、本月支出、淨收支三張 KPI 卡；下方有「支出分類圓餅圖」（支援雙圓餅圖切換：內圈父分類、外圈子分類）、「資產配置圓餅圖」（含股票市值與帳戶餘額，同樣支援雙圓餅圖）、當月預算進度條、最近 5 筆交易摘要。若使用者有持股，資產配置會新增「持股前 5 名」與「帳戶前 5 名」兩欄列表。

支出分類圓餅圖內圈顯示父分類，外圈顯示子分類，並列出前 5 名排行。圖例與 tooltip 皆顯示金額與佔比百分比。

#### 統計報表頁

統計報表頁專注在「深度分析」：分類統計圓餅圖（同樣可切父子雙圓餅）、每日趨勢折線圖、每日消費長條圖。所有圖表共享頂端的「期間選擇器」與「類型切換器」：

- **期間預設：** 本月、上月、近 3 個月、近 6 個月、今年
- **自訂期間：** 選擇「自訂時間」後出現起始／結束日期輸入；僅填起始日時結束日預設為今天，僅填結束日時起始日預設為當月 1 日
- **類型：** 支出或收入
- 切換即時重繪，不需按「套用」

排序規則：圖例與圓餅區塊的順序一律是「父分類總額由高到低」，同一父分類下「子分類總額由高到低」。這個規則不可由使用者調整 — 讓不同時間的同一份報表放在一起比對時能保持一致的視覺錨點。

#### 信件排程報表

管理員可在排程設定對指定使用者自動寄送「資產統計信件」。信件頻率有每日／每週／每月三種，寄送前會自動更新該使用者所有持股的最新股價（走與即時查價一致的三段策略）。信件本身是 HTML + table-based 排版（為了相容 Outlook Desktop 的 Word 渲染引擎），內含三色漸層英雄區、3 欄 KPI 含上月對比（▲▼ pill）、儲蓄率進度條、分類顏色長條、近 5 筆交易摘要、CTA 按鈕。

信件中「交易紀錄」區塊會依頻率切換：
- 每日：昨日交易明細
- 每週：Mon-Sun 每日彙總，多顯示「區間收入／支出／淨額」三欄總覽卡，週末日期紫色標示
- 每月：上月每天彙總

「股票投資」區塊顯示 4 列：成本、市值、未實現損益、報酬率（含彩色 ± 符號）。寄信服務優先使用 SMTP（可於管理員 UI 設定），若未設定則退回 Resend（走 `RESEND_API_KEY` + `RESEND_FROM_EMAIL`）；兩者皆未設定則回 503。排程檢查以台灣時間（UTC+8，無 DST）為基準，使用 `twParts()` 輔助函式確保部署在 UTC 主機上仍能正確觸發。

#### 不做什麼

- 不做多幣別報表切換。所有金額一律以 TWD 等值計算
- 不做使用者自訂儀表板版位排序／隱藏，留給未來版本
- 不做週／月報 PDF 匯出

---

### 2.6 股票投資

核心目標：讓使用者記錄台股買賣與股利，自動計算手續費／證交稅／FIFO 損益，並能隨時掌握持股市值與報酬率。

#### 持倉

每檔持股代表一個「股票代號」加一個「類型」（一般股票／ETF／權證）。類型影響賣出時的證交稅稅率（一般 0.3%、ETF/權證 0.1%）。持有股數、平均成本、損益等數值一律由系統從交易紀錄動態計算，不額外儲存 — 確保帳目永遠跟交易一致。

投資組合總覽卡顯示總市值、總成本、總損益、報酬率；個股卡片顯示代號與名稱、持有股數、平均成本、目前股價、市值、損益與報酬率。獲利綠色（▲）虧損紅色（▼）。

#### TWSE 整合

新增股票（或在交易／股利 Modal 輸入代號）時，系統會自動呼叫 TWSE 代理 API 查名稱與股價。價格採三段策略，依「當下台灣時間」判斷：

1. **盤中**（週一至五 09:00–13:30）：`mis.twse.com.tw` 即時成交價，快取 1 分鐘
2. **盤後**（週一至五 13:30 後）：TWSE `STOCK_DAY` 當日收盤價，快取 5 分鐘
3. **非交易日／盤前**：`STOCK_DAY_ALL`（T+1 資料），快取 10 分鐘

支援上市（TSE）與上櫃（OTC）。查詢成功在輸入欄旁顯示「✓ 股票名稱 價格類型 $xxx（時間/日期）」綠色提示並自動填入欄位；失敗顯示「找不到此股票代號」紅色提示。前端輸入有 500ms 防抖以避免打爆 API。TWSE 代號有格式驗證（僅允許數字 + 少數字母），防止注入。

#### 交易與股利

股票交易記錄買入或賣出；欄位包括日期、股數（強制整數，`Number.isInteger` 檢查）、每股價格、手續費、交易稅、帳戶、備註。手續費預設自動計算 `Math.floor(成交金額 × 0.1425%)`，整股最低 20 元（零股最低 1 元）；證交稅僅賣出時計算 `Math.floor(成交金額 × 稅率)`，最低 1 元。輸入股數或價格時即時顯示費用摘要（成交金額、手續費、交易稅、總成本／淨收入），讓使用者在送出前就看到確切金額。買入／賣出按鈕切換時顏色即時變化（買入綠、賣出紅）。

若輸入的股票代號尚未建立持倉，送出交易時自動新增股票（從 TWSE 取得名稱與股價）。股利同樣支援；現金股利或股票股利至少填一項，股票股利會增加持有股數。日期欄位統一叫「除息日期」（ex-dividend date），因為這是決定投資人是否有資格領股利的法定基準，而非實際入帳日（通常在除息日後 1–2 週才匯入現金）。

交易紀錄與股利紀錄頁支援：依股票代號或名稱的下拉式搜尋篩選、checkbox 多選批次刪除、每頁筆數可選（含自訂）、伺服器端分頁（`GET /api/stock-transactions?page=1&pageSize=20` 回傳 `{ data, total, page, totalPages }`）。

#### 定期定額

使用者可設定某檔股票的定期定額：每期預算、週期、起始日、證券帳戶、備註、啟用／停用。系統在每次登入時檢查是否有該產生的排程，依「每期預算 ÷ 當前股價」計算可買股數（無法買 1 股時略過）並產生買進交易。

若排程日遇週末或 TWSE 休市日則自動順延到下一個交易日；排程日本身仍以原日期推算保持週期節奏，交易紀錄的日期寫入實際交易日，備註附「原排程 YYYY-MM-DD 順延」。休市日快取 24 小時，來源為 TWSE `/v1/holidaySchedule/holidaySchedule` OpenAPI，並過濾掉「開始交易／最後交易」等特別交易日。

#### 自動同步除權息

股利紀錄頁有「同步除權息」按鈕。按下後，後端依使用者最早交易日期到今日，按年分段查 TWSE `TWT49U` 除權息列表，僅處理使用者已持有的股票代號，計算每個除息日當下的持股數（若持股為 0 則跳過）。純現金股利直接取 `權值+息值`；含股票股利者查 `TWT49UDetail` 明細取每股現金與每千股配股數。最終：

- 現金股利 = 持股數 × 每股現金股利（四捨五入）
- 股票股利 = 持股數 × 每千股配股數 ÷ 1000

同日期同股票若已存在股利紀錄則不重複新增；自動新增的備註會標示「TWSE自動同步（每股$X.XX）」。除權息 API 快取 30 分鐘。

#### 實現損益

獨立 Tab 呈現每筆賣出交易的 FIFO 實現損益。頂部彙總卡顯示總實現損益、整體報酬率、今年實現損益、已實現筆數。表格列出賣出日期、股票、股數、賣出均價、成本均價（FIFO）、手續費+稅、實現損益、報酬率。

FIFO 邏輯：買入批次依時間序進入佇列（手續費分攤至成本）；每筆賣出依序從最早批次扣除，算出該筆賣出的成本基礎；實現損益 = 賣出收入（股數 × 賣出價 - 手續費 - 證交稅）- FIFO 成本基礎；報酬率 = 實現損益 ÷ FIFO 成本基礎 × 100%。未賣出部位的平均成本以 FIFO 剩餘批次計算。

#### 批次更新股價

Modal 列出所有持股與目前股價輸入框，支援「從證交所取得最新股價」一鍵批次拉 TWSE 最新收盤價（顯示每檔的價格來源：即時／收盤／T+1 與取得時間），也允許手動調整個別股價；確認後一次寫回。

#### 不做什麼

- 不提供海外股票（美股、港股等），僅限台股（上市＋上櫃）
- 不做現股當沖證交稅減半；預設皆以完整稅率計算，留給未來版本
- 不做股利再投資（DRIP）自動追蹤
- 不做歷史股價圖表

---

### 2.7 資料匯出匯入

核心目標：讓使用者能自由把自己的資料帶走／帶回來，不被系統綁架。

#### 交易記錄

匯出 CSV（UTF-8 BOM，欄位：日期、類型、分類「父分類 > 子分類」格式、金額、帳戶、備註），可選日期範圍。匯入同樣是 CSV，第一行為標題自動跳過；支援拖曳或點擊上傳；匯入前顯示前 10 筆預覽。類型支援支出、收入、轉出、轉入；分類比對支援「父分類 > 子分類」格式。轉出與轉入依日期+金額自動配對建立 `linked_id` 關聯。匯入時若偵測到缺少的分類或帳戶，會詢問是否自動建立。匯入完成顯示成功／略過／錯誤筆數。受限於 body size，CSV 匯入端點上限 25MB 與 20000 筆。

CSV 內容經過 Formula Injection 防護處理（以 `=`、`+`、`-`、`@` 開頭的儲存格值會被轉義），避免匯入後在 Excel 開啟觸發公式執行。

#### 分類結構

匯出 CSV 欄位：類型、分類名稱、上層分類、顏色。父分類的上層欄位為空；子分類填入父分類名稱。匯入時先建父後建子，已存在分類自動略過。

#### 股票交易／股利

分別為獨立 CSV 檔。

- **交易欄位：** 日期、股票代號、股票名稱、類型（買進／賣出，亦接受英文 buy/sell）、股數、成交價、手續費、交易稅、帳戶、備註
- **股利欄位：** 日期、股票代號、股票名稱、現金股利、股票股利、備註

匯入的股票代號若未建立持倉則自動新增股票；若已存在但名稱為代號（不正確），會以 CSV 中的名稱自動更新 — 修正舊資料最省力的方式就是再匯入一次。

#### 資料庫備份（管理員專用）

管理員可匯出整個未加密的 SQLite 檔案作為完整備份。匯入時系統自動驗證檔案格式與必要資料表結構，並在覆寫前自動備份現有資料庫。這是災難復原用途，一般使用者不應接觸。資料庫備份檔案排除於 `.gitignore` 與 `.dockerignore`。

#### 全球匯率自動更新

匯率設定頁可串接全球即時匯率 API（exchangerate-api.com），基礎貨幣固定為 TWD。使用者可自訂 3 碼幣別代碼並存入個人匯率清單；可開關自動更新；可手動按「立即取得即時匯率」即時同步。前端顯示上次取得時間（精確到秒）。跨使用者的匯率快取 30 分鐘共用，有 `is_manual` 欄位區分手動／自動匯率。支援免費版 API（無需 key）或付費版（`EXCHANGE_RATE_API_KEY` 環境變數）。

#### API 使用與授權資訊頁

側邊欄獨立頁面，集中列出系統使用的所有外部 API、用途、來源連結與授權注意事項：

- 全球即時匯率：`https://www.exchangerate-api.com/`（支援免費版與付費版）
- IPinfo：`https://ipinfo.io/lite`（授權標示 `IP address data is powered by IPinfo`）
- TWSE：`https://openapi.twse.com.tw/`、`https://www.twse.com.tw/`
- Google Identity Services、Resend 等

#### 不做什麼

- 不做 Excel (.xlsx) 匯出／匯入，僅提供 CSV
- 不做 OFX/QIF 等銀行對帳格式匯入
- 不做自動雲端同步（Google Drive、Dropbox 等）

---

### 2.8 前端路由與頁面

核心目標：讓 URL 跟畫面一一對應，使用者可以直接分享連結、按上一頁／下一頁，或把瀏覽器書籤當捷徑用。

#### 路由

**公開（無需登入）：**

- `/` — 網站介紹首頁（Public Home）
- `/login` — 登入／註冊頁
- `/privacy` — 隱私權政策
- `/terms` — 服務條款

**主應用程式（需登入）：**

| URL | 頁面 |
|-----|------|
| `/dashboard` | 儀表板 |
| `/finance/transactions` | 交易記錄 |
| `/finance/reports` | 統計報表 |
| `/finance/budget` | 預算管理 |
| `/finance/accounts` | 帳戶管理（含匯率設定） |
| `/finance/categories` | 分類管理 |
| `/finance/recurring` | 固定收支 |
| `/stocks`、`/stocks/portfolio` | 持股總覽（預設） |
| `/stocks/transactions` | 股票交易紀錄 |
| `/stocks/dividends` | 股票股利紀錄 |
| `/stocks/realized` | 股票實現損益紀錄 |
| `/api-credits` | API 使用與授權 |
| `/settings/account` | 帳號設定（含個人登入稽核） |
| `/settings/admin` | 管理員面板（含全站登入稽核、SMTP、排程、伺服器時間） |
| `/settings/export` | 資料匯出匯入 |

#### 實作

- 前端以 `history.pushState` 實作 SPA 路由，支援瀏覽器上一頁／下一頁（`popstate` 事件）
- 伺服器端有 catch-all 路由，對任何未知路徑都回傳 `index.html`，讓使用者直接輸入 URL 也能正確導航
- 靜態檔僅允許白名單公開資源（`index.html`、`app.js`、`style.css`、`favicon.svg`、`logo.svg`、`changelog.json`、`privacy.html`、`terms.html` 等），避免專案根目錄敏感檔案外洩
- 登入後依當前 URL 自動導航至對應頁面（不是一律跳儀表板），確保頁面重整時使用者還在原本的地方

#### 介面設計原則

- 側邊欄為主要導航，桌面常駐、手機漢堡選單展開
- 金額統一格式 `NT$ 1,234`（千分位逗號）搭配 tabular-nums；日期統一 `YYYY-MM-DD`
- 色彩系統：收入綠、支出紅、轉帳藍、主色調紫（`#6366f1`）
- 所有 Toast 通知：成功綠色、錯誤紅色
- 刪除一律二次確認 Modal
- 動畫：spring 動畫、iOS 風格分段控件、focus-visible 無障礙焦點環
- 無障礙：prefers-reduced-motion 支援、深色模式下所有對比度通過 WCAG AA（≥ 4.5:1）

#### 右下角快速新增按鈕（情境式）

浮動 FAB（Floating Action Button）依頁面情境顯示：

- 收支管理相關頁（`transactions` / `reports` / `budget` / `accounts` / `categories` / `recurring`）：顯示「新增交易」，點擊開 `modalTransaction`
- 股票相關頁（`stocks` 含子分頁）：顯示「新增股票交易紀錄」，點擊開 `modalStockTx`
- 其他頁面（儀表板、設定、API 使用與授權）：不顯示

#### 外觀模式

使用者可在設定切換三種外觀：跟隨系統、強制淺色、強制深色。偏好同步跨瀏覽器儲存於後端（JSON 欄位），登入後自動套用。

#### Modal 一覽

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

#### 不做什麼

- 不做 PWA／離線模式，留給未來版本
- 不做多語系（i18n），全站僅支援繁體中文
- 不做使用者自訂主題色，主色調鎖定紫色

---

## 3. 技術附錄

### 3.1 非功能需求

#### 效能

| 項目         | 要求                         |
| ------------ | ---------------------------- |
| 頁面載入時間 | 首頁 ≤ 3 秒（一般網路環境） |
| API 回應時間 | 單筆 CRUD 操作 ≤ 500ms      |
| 大量匯入     | 支援 20000 筆 / 25MB 一次匯入 |
| JSON body    | 預設上限 5MB；CSV 匯入端點 25MB |
| DB 寫入      | 非阻塞（in-flight + pending 合併 + tmp/rename 原子寫） |

#### 安全

- 密碼 bcryptjs 加密；強密碼規則統一（大寫、小寫、數字、特殊符號、≥ 8 字元）
- JWT Token 存 httpOnly + `SameSite=Strict` Cookie，由 `JWT_EXPIRES` 控制有效期
- `token_version` 欄位支援 Token 撤銷
- 所有 API 端點（除 auth 相關與 `/api/config`）套用 authMiddleware
- 系統更新與管理員 API 僅允許 admin 身分呼叫
- 輸入資料進行 HTML 跳脫（XSS）；分類顏色格式雙端驗證；TWSE 代號格式驗證
- IDOR 防護：驗證 `accountId`、`categoryId`、`stockId` 擁有者
- CSV Formula Injection 防護
- CSP、HSTS、X-Content-Type-Options、Referrer-Policy；停用 `X-Powered-By`
- 外部 CDN 腳本 SRI `integrity` 屬性
- `/api/auth/login`、`/api/auth/register`、`/api/auth/google`、`/privacy`、`/terms` 套用速率限制
- CORS 可透過 `ALLOWED_ORIGINS` 限制允許來源
- `.env` 檔案權限 `0o600`
- 靜態檔白名單（僅允許指定公開資源）

#### 可用性

- 響應式設計（RWD），支援手機、平板、桌面
- 支援繁體中文介面（本系統不支援多語系）
- 操作流程直覺化：新增一筆記錄不超過 3 個步驟
- 重要操作提供 Toast 通知回饋
- 刪除操作需二次確認（確認 Modal）
- 深色模式對比度通過 WCAG AA（≥ 4.5:1）

#### 可靠性

- SQLite 資料庫即時儲存（每次寫入後 `saveDB()`）
- 異常情況提供友善錯誤 Toast 訊息
- body 過大統一回 JSON 413
- 伺服器時間可透過 `SERVER_TIME_OFFSET` 調整，支援 NTP 校正

---

### 3.2 資料模型

#### 實體關係圖

```
使用者 (User)
├── 1:N → 交易記錄 (Transaction)
├── 1:N → 分類 (Category)
│         └── 自關聯 parent_id → 子分類
├── 1:N → 帳戶 (Account)
├── 1:N → 預算 (Budget)
├── 1:N → 固定收支 (RecurringTransaction)
├── 1:N → 登入稽核 (LoginAuditLog)
├── 1:N → 股票持倉 (Stock)
│         ├── 1:N → 股票交易 (StockTransaction)
│         └── 1:N → 股票股利 (StockDividend)

交易記錄 (Transaction)
└── 自關聯 linked_id → 轉帳配對記錄
```

#### User（使用者）

| 欄位         | 型態    | 說明       | 必填 |
| ------------ | ------- | ---------- | ---- |
| id           | TEXT PK | 主鍵       | 是   |
| email        | TEXT    | 電子郵件   | 是   |
| password     | TEXT    | 加密後密碼 | 是   |
| display_name | TEXT    | 顯示名稱   | 否   |
| created_at   | TEXT    | 建立時間   | 否   |

#### LoginAuditLog（登入稽核）

| 欄位           | 型態    | 說明                                  | 必填 |
| -------------- | ------- | ------------------------------------- | ---- |
| id             | TEXT PK | 主鍵                                  | 是   |
| user_id        | TEXT    | 外鍵 → User                           | 是   |
| email          | TEXT    | 登入當下帳號 Email                    | 是   |
| login_at       | INTEGER | 登入時間（timestamp）                 | 是   |
| ip_address     | TEXT    | 客戶端 IP 位址                        | 是   |
| login_method   | TEXT    | 登入方式（password / google / passkey）| 是   |
| is_admin_login | INTEGER | 是否以管理員身份登入（1/0）           | 是   |

#### Transaction（交易記錄）

| 欄位        | 型態    | 說明                                          | 必填 |
| ----------- | ------- | --------------------------------------------- | ---- |
| id          | TEXT PK | 主鍵                                          | 是   |
| user_id     | TEXT    | 外鍵 → User                                  | 是   |
| type        | TEXT    | income / expense / transfer_out / transfer_in | 是   |
| amount      | REAL    | 金額                                          | 是   |
| date        | TEXT    | 交易日期（YYYY-MM-DD）                        | 是   |
| category_id | TEXT    | 外鍵 → Category                              | 否   |
| account_id  | TEXT    | 外鍵 → Account                               | 是   |
| note        | TEXT    | 備註                                          | 否   |
| linked_id   | TEXT    | 轉帳配對的交易 ID                             | 否   |
| created_at  | INTEGER | 建立時間（timestamp）                         | 是   |
| updated_at  | INTEGER | 更新時間（timestamp）                         | 是   |

#### Category（分類）

| 欄位       | 型態    | 說明                            | 必填 |
| ---------- | ------- | ------------------------------- | ---- |
| id         | TEXT PK | 主鍵                            | 是   |
| user_id    | TEXT    | 外鍵 → User                    | 是   |
| name       | TEXT    | 分類名稱                        | 是   |
| type       | TEXT    | income / expense（CHECK 約束）  | 是   |
| color      | TEXT    | 顏色色碼（預設 #6366f1）        | 否   |
| is_default | INTEGER | 是否為預設分類（1/0）           | 是   |
| is_hidden  | INTEGER | 是否隱藏（1/0）                 | 是   |
| sort_order | INTEGER | 排序順序                        | 是   |
| parent_id  | TEXT    | 父分類 ID（空字串表示頂層分類） | 否   |

#### Account（帳戶）

| 欄位            | 型態    | 說明                                   | 必填 |
| --------------- | ------- | -------------------------------------- | ---- |
| id              | TEXT PK | 主鍵                                   | 是   |
| user_id         | TEXT    | 外鍵 → User                           | 是   |
| name            | TEXT    | 帳戶名稱                               | 是   |
| initial_balance | REAL    | 初始餘額（預設 0）                     | 是   |
| icon            | TEXT    | 圖示名稱（預設 fa-wallet）             | 否   |
| category        | TEXT    | 帳戶類別（銀行／信用卡／現金／虛擬錢包）| 否   |
| excluded        | INTEGER | 是否排除計入總資產（1/0）              | 否   |
| created_at      | TEXT    | 建立時間                               | 否   |

#### Budget（預算）

| 欄位        | 型態    | 說明                       | 必填 |
| ----------- | ------- | -------------------------- | ---- |
| id          | TEXT PK | 主鍵                       | 是   |
| user_id     | TEXT    | 外鍵 → User               | 是   |
| category_id | TEXT    | 外鍵 → Category（可為空） | 否   |
| amount      | REAL    | 預算金額                   | 是   |
| year_month  | TEXT    | 適用年月（如 2026-03）     | 是   |

#### RecurringTransaction（固定收支）

| 欄位           | 型態    | 說明                              | 必填 |
| -------------- | ------- | --------------------------------- | ---- |
| id             | TEXT PK | 主鍵                              | 是   |
| user_id        | TEXT    | 外鍵 → User                      | 是   |
| type           | TEXT    | income / expense                  | 是   |
| amount         | REAL    | 金額                              | 是   |
| category_id    | TEXT    | 外鍵 → Category                  | 否   |
| account_id     | TEXT    | 外鍵 → Account                   | 是   |
| frequency      | TEXT    | daily / weekly / monthly / yearly | 是   |
| start_date     | TEXT    | 起始日期                          | 是   |
| note           | TEXT    | 備註                              | 否   |
| is_active      | INTEGER | 是否啟用（1/0）                   | 是   |
| last_generated | TEXT    | 最後產生日期                      | 否   |

#### Stock（股票持倉）

| 欄位          | 型態    | 說明                                      | 必填 |
| ------------- | ------- | ----------------------------------------- | ---- |
| id            | TEXT PK | 主鍵                                      | 是   |
| user_id       | TEXT    | 外鍵 → User                              | 是   |
| symbol        | TEXT    | 股票代號（如 2330）                       | 是   |
| name          | TEXT    | 股票名稱（如 台積電）                     | 是   |
| stock_type    | TEXT    | 類型：stock / etf / warrant（預設 stock） | 否   |
| current_price | REAL    | 目前股價                                  | 否   |
| updated_at    | TEXT    | 更新時間                                  | 否   |

#### StockTransaction（股票交易）

| 欄位       | 型態    | 說明             | 必填 |
| ---------- | ------- | ---------------- | ---- |
| id         | TEXT PK | 主鍵             | 是   |
| user_id    | TEXT    | 外鍵 → User     | 是   |
| stock_id   | TEXT    | 外鍵 → Stock    | 是   |
| type       | TEXT    | buy / sell       | 是   |
| date       | TEXT    | 交易日期         | 是   |
| shares     | REAL    | 股數（整數）     | 是   |
| price      | REAL    | 每股價格         | 是   |
| fee        | REAL    | 手續費（預設 0） | 否   |
| tax        | REAL    | 交易稅（預設 0） | 否   |
| note       | TEXT    | 備註             | 否   |
| created_at | TEXT    | 建立時間         | 否   |

#### StockDividend（股票股利）

| 欄位                  | 型態    | 說明                  | 必填 |
| --------------------- | ------- | --------------------- | ---- |
| id                    | TEXT PK | 主鍵                  | 是   |
| user_id               | TEXT    | 外鍵 → User          | 是   |
| stock_id              | TEXT    | 外鍵 → Stock         | 是   |
| date                  | TEXT    | 除權息日期            | 是   |
| cash_dividend         | REAL    | 現金股利（元）        | 否   |
| stock_dividend_shares | REAL    | 股票股利（股）        | 否   |
| account_id            | TEXT    | 外鍵 → Account       | 否   |
| note                  | TEXT    | 備註                  | 否   |
| created_at            | INTEGER | 建立時間（timestamp） | 否   |

---

### 3.3 API 端點

API 路徑統一以 `/api/` 為前綴。所有需認證的路由自動套用 authMiddleware（排除 `/api/auth/`、`/api/config`）；管理員專用路由另套用 adminMiddleware。

#### 認證

| 方法 | 端點                     | 說明                                        |
| ---- | ------------------------ | ------------------------------------------- |
| GET  | /api/config              | 取得前端設定（Google Client ID 等）         |
| POST | /api/auth/register       | 使用者註冊                                  |
| POST | /api/auth/login          | 使用者登入（回傳 `currentLogin`）           |
| POST | /api/auth/logout         | 登出（清除 Cookie）                         |
| GET  | /api/auth/me             | 取得當前使用者資訊                          |
| POST | /api/auth/google         | Google SSO 登入（驗證授權碼並簽發 JWT）     |
| GET  | /api/account/login-logs  | 取得目前使用者登入稽核紀錄（最近 100 筆）   |
| PUT  | /api/account/password    | 使用者自助修改密碼                          |

#### Passkey（WebAuthn）

| 方法   | 端點                                          | 說明                     |
| ------ | --------------------------------------------- | ------------------------ |
| POST   | /api/account/passkeys/registration/options    | 產生 Passkey 註冊 options |
| POST   | /api/account/passkeys/registration/verify     | 驗證 Passkey 註冊         |
| POST   | /api/auth/passkeys/authentication/options     | 產生 Passkey 登入 options |
| POST   | /api/auth/passkeys/authentication/verify      | 驗證 Passkey 登入         |
| GET    | /api/account/passkeys                         | 取得使用者 Passkey 列表   |
| DELETE | /api/account/passkeys/:id                     | 刪除指定 Passkey          |

#### 分類

| 方法   | 端點                | 說明                        |
| ------ | ------------------- | --------------------------- |
| GET    | /api/categories     | 取得所有分類（含 parentId） |
| POST   | /api/categories     | 新增分類（支援 parentId）   |
| PUT    | /api/categories/:id | 更新分類名稱與顏色          |
| DELETE | /api/categories/:id | 刪除分類（連帶刪除子分類）  |

#### 帳戶

| 方法   | 端點              | 說明                       |
| ------ | ----------------- | -------------------------- |
| GET    | /api/accounts     | 取得所有帳戶（含計算餘額） |
| POST   | /api/accounts     | 新增帳戶                   |
| PUT    | /api/accounts/:id | 更新帳戶                   |
| DELETE | /api/accounts/:id | 刪除帳戶                   |

#### 交易記錄

| 方法   | 端點                           | 說明                               |
| ------ | ------------------------------ | ---------------------------------- |
| GET    | /api/transactions              | 取得交易列表（分頁、篩選）         |
| POST   | /api/transactions              | 新增交易記錄                       |
| PUT    | /api/transactions/:id          | 更新交易記錄                       |
| DELETE | /api/transactions/:id          | 刪除交易記錄（含 linked 關聯刪除） |
| POST   | /api/transactions/batch-delete | 批次刪除多筆交易                   |
| POST   | /api/transactions/batch-update | 批次更新多筆交易（分類/帳戶/日期） |
| POST   | /api/transactions/import       | 匯入 CSV 交易記錄                  |
| POST   | /api/transactions/transfer     | 新增轉帳記錄（產生配對）           |

#### 預算

| 方法   | 端點             | 說明     |
| ------ | ---------------- | -------- |
| GET    | /api/budgets     | 取得預算 |
| POST   | /api/budgets     | 新增預算 |
| PUT    | /api/budgets/:id | 更新預算 |
| DELETE | /api/budgets/:id | 刪除預算 |

#### 固定收支

| 方法   | 端點                      | 說明               |
| ------ | ------------------------- | ------------------ |
| GET    | /api/recurring            | 取得固定收支列表   |
| POST   | /api/recurring            | 新增固定收支       |
| PUT    | /api/recurring/:id        | 更新固定收支       |
| DELETE | /api/recurring/:id        | 刪除固定收支       |
| PATCH  | /api/recurring/:id/toggle | 切換啟用/停用      |
| POST   | /api/recurring/process    | 處理到期的固定收支 |

#### 股票

| 方法   | 端點                                 | 說明                                             |
| ------ | ------------------------------------ | ------------------------------------------------ |
| GET    | /api/stocks                          | 取得所有股票持倉（含 FIFO 損益計算）             |
| POST   | /api/stocks                          | 新增股票（含 stockType：stock / etf / warrant）  |
| PUT    | /api/stocks/:id                      | 更新股票資訊（含 stockType）                     |
| DELETE | /api/stocks/:id                      | 刪除股票（連帶刪除交易與股利記錄）               |
| POST   | /api/stocks/batch-price              | 批次更新股價                                     |
| GET    | /api/stock-realized                  | 取得實現損益紀錄（FIFO 逐筆，支援 stockId 篩選） |
| GET    | /api/stock-transactions              | 取得股票交易記錄（支援 stockId 篩選、分頁）      |
| POST   | /api/stock-transactions              | 新增股票交易                                     |
| PUT    | /api/stock-transactions/:id          | 更新股票交易                                     |
| DELETE | /api/stock-transactions/:id          | 刪除股票交易                                     |
| POST   | /api/stock-transactions/batch-delete | 批次刪除多筆股票交易                             |
| POST   | /api/stock-transactions/import       | 匯入股票交易記錄 CSV（自動建立不存在的股票）     |
| GET    | /api/stock-dividends                 | 取得股票股利記錄（支援 stockId 篩選、分頁）      |
| POST   | /api/stock-dividends                 | 新增股票股利                                     |
| PUT    | /api/stock-dividends/:id             | 更新股票股利                                     |
| DELETE | /api/stock-dividends/:id             | 刪除股票股利                                     |
| POST   | /api/stock-dividends/batch-delete    | 批次刪除多筆股票股利                             |
| POST   | /api/stock-dividends/import          | 匯入股票股利記錄 CSV（自動建立不存在的股票）     |
| POST   | /api/stock-dividends/sync            | 從 TWSE 除權息公告自動同步股利紀錄               |
| GET    | /api/stock-recurring                 | 取得股票定期定額清單                             |
| POST   | /api/stock-recurring                 | 新增股票定期定額                                 |
| PUT    | /api/stock-recurring/:id             | 更新股票定期定額                                 |
| DELETE | /api/stock-recurring/:id             | 刪除股票定期定額                                 |
| PATCH  | /api/stock-recurring/:id/toggle      | 切換股票定期定額啟用狀態                         |
| POST   | /api/stock-recurring/process         | 執行股票定期定額排程並產生買進交易               |

#### TWSE 證交所代理

| 方法 | 端點                    | 說明                                                                          |
| ---- | ----------------------- | ----------------------------------------------------------------------------- |
| GET  | /api/twse/stock/:symbol | 查詢股票名稱與股價（`?realtime=1` 即時 / `?date=` 盤後 / 無參數備援）         |
| GET  | /api/twse/search        | 搜尋股票代號或名稱（query 參數，回傳前 10 筆）                                |

#### 報表

| 方法 | 端點           | 說明           |
| ---- | -------------- | -------------- |
| GET  | /api/dashboard | 儀表板摘要資料 |
| GET  | /api/reports   | 統計報表資料   |

#### 匯率設定

| 方法 | 端點                         | 說明                              |
| ---- | ---------------------------- | --------------------------------- |
| GET  | /api/exchange-rates          | 取得匯率清單與自動更新設定        |
| PUT  | /api/exchange-rates          | 手動儲存匯率表                    |
| PUT  | /api/exchange-rates/settings | 更新是否啟用匯率自動更新          |
| POST | /api/exchange-rates/refresh  | 從全球即時匯率 API 立即同步匯率   |

#### 管理員

| 方法   | 端點                                     | 說明                                                      |
| ------ | ---------------------------------------- | --------------------------------------------------------- |
| GET    | /api/admin/settings                      | 取得註冊策略（公開註冊、白名單）                          |
| PUT    | /api/admin/settings                      | 更新註冊策略（公開註冊、白名單）                          |
| GET    | /api/admin/users                         | 取得使用者清單                                            |
| POST   | /api/admin/users                         | 建立使用者（可指定是否管理員）                            |
| DELETE | /api/admin/users/:id                     | 刪除指定使用者（不可刪除自己或最後管理員）                |
| PUT    | /api/admin/users/:id/password            | 為任一使用者重設密碼                                      |
| GET    | /api/admin/login-logs                    | 取得管理員登入紀錄與全站使用者登入稽核（含失敗事件）      |
| DELETE | /api/admin/login-logs/admin/:id          | 刪除單筆管理員登入紀錄                                    |
| POST   | /api/admin/login-logs/admin/batch-delete | 批次刪除管理員登入紀錄（`{ ids: [...] }`）                |
| DELETE | /api/admin/login-logs/all/:id            | 刪除單筆全站使用者登入紀錄                                |
| POST   | /api/admin/login-logs/all/batch-delete   | 批次刪除全站使用者登入紀錄（`{ ids: [...] }`）            |
| GET    | /api/admin/smtp-settings                 | 取得 SMTP 設定（密碼遮蔽）                                |
| PUT    | /api/admin/smtp-settings                 | 更新 SMTP 設定                                            |
| POST   | /api/admin/test-email                    | 寄送 SMTP 測試信                                          |
| GET    | /api/admin/report-schedule               | 取得資產統計信件排程設定                                  |
| PUT    | /api/admin/report-schedule               | 更新資產統計信件排程設定                                  |
| POST   | /api/admin/report-schedule/run-now       | 立即寄送一次                                              |
| GET    | /api/admin/server-time                   | 取得伺服器時間與偏移量                                    |
| PUT    | /api/admin/server-time                   | 設定伺服器時間偏移量                                      |
| POST   | /api/admin/server-time/ntp-sync          | 從 NTP 同步時間                                           |
| GET    | /api/admin/db/export                     | 匯出資料庫備份（未加密 SQLite）                           |
| POST   | /api/admin/db/import                     | 匯入資料庫備份（覆寫前自動備份）                          |

---

## 4. 版本歷程

### 4.1 使用案例摘要

| 編號   | 使用案例                  | 主要角色 |
| ------ | ------------------------- | -------- |
| UC-001 | 註冊帳號                  | 訪客     |
| UC-002 | 登入系統                  | 使用者   |
| UC-003 | 新增支出/收入記錄         | 使用者   |
| UC-004 | 新增轉帳記錄              | 使用者   |
| UC-005 | 批次刪除交易記錄          | 使用者   |
| UC-006 | 批次變更交易分類          | 使用者   |
| UC-007 | 檢視當月收支              | 使用者   |
| UC-008 | 設定月度/分類預算         | 使用者   |
| UC-009 | 檢視統計報表              | 使用者   |
| UC-010 | 管理分類與子分類          | 使用者   |
| UC-011 | 帳戶間轉帳                | 使用者   |
| UC-012 | 設定固定收支              | 使用者   |
| UC-013 | 匯出交易記錄 CSV          | 使用者   |
| UC-014 | 匯入交易記錄 CSV          | 使用者   |
| UC-015 | 匯出/匯入分類結構         | 使用者   |
| UC-016 | 新增股票持倉（TWSE 查詢） | 使用者   |
| UC-017 | 記錄股票買賣交易          | 使用者   |
| UC-018 | 記錄股票股利              | 使用者   |
| UC-019 | 批次更新股價（TWSE）      | 使用者   |
| UC-020 | 檢視投資組合損益          | 使用者   |
| UC-021 | 匯出股票交易/股利紀錄 CSV | 使用者   |
| UC-022 | 匯入股票交易/股利紀錄 CSV | 使用者   |
| UC-023 | 檢視實現損益紀錄          | 使用者   |
| UC-024 | 自動同步除權息股利        | 使用者   |
| UC-025 | Google SSO 登入           | 訪客     |
| UC-026 | 批次刪除股票交易紀錄      | 使用者   |
| UC-027 | 批次刪除股利紀錄          | 使用者   |
| UC-028 | 調整公開註冊策略          | 管理員   |
| UC-029 | 管理 Email 註冊白名單     | 管理員   |
| UC-030 | 建立使用者帳號            | 管理員   |
| UC-031 | 刪除使用者帳號            | 管理員   |
| UC-032 | 查詢個人登入紀錄          | 使用者   |
| UC-033 | 查詢全站登入稽核          | 管理員   |
| UC-034 | 修改顯示名稱              | 使用者   |
| UC-035 | 設定股票定期定額          | 使用者   |

### 4.2 版本歷程

| 版本 | 日期 | 變更說明 |
| --- | --- | --- |
| 4.23.0 | 2026-04-25 | 002-transactions-accounts 落地：①CT-1 schema migration（`accounts` 補 `category` / `overseas_fee_rate` / `updated_at`、`transactions` 補 `to_account_id` / `twd_amount`、`amount` / `initial_balance` REAL→INTEGER 幣別最小單位、`fx_rate` REAL→TEXT decimal、`exchange_rates` 拆 per-user + global 跨使用者 30 分鐘共用快取、新增 `user_settings.pinned_currencies` JSON）；②新增 dependency `decimal.js ^10.4.3`（後端 + 前端 CDN 同版本）並抽出同構模組 `lib/moneyDecimal.js` / `lib/taipeiTime.js` / `lib/exchangeRateCache.js`；③9 群端點 — `/api/accounts` GET/POST、`/api/accounts/{id}` GET/PATCH/DELETE、`/api/transactions` GET/POST、`/api/transactions/{id}` GET/PATCH/DELETE、`/api/transactions:batch-update` / `:batch-delete`、`/api/transfers` POST、`/api/exchange-rates/{currency}` GET、`/api/user/settings/pinned-currencies` GET/PUT；④FR-014a 樂觀鎖（PATCH/DELETE 接受 `expected_updated_at` 不符 409）、FR-060 IDOR 防線（`ownsResource(table,idColumn,idValue,userId)` 統一介面 + `requireOwnedAccount` / `requireOwnedTransaction`，非自己資源一律 404 不洩漏）、FR-015 同幣別轉帳 transfer 對 + 跨幣別 422、FR-016 / FR-017 統計過濾 `type IN ('income','expense') AND exclude_from_stats = 0`、FR-021 信用卡海外手續費（千分點）、FR-042 / FR-044 / FR-045 批次操作上限 500 筆 + BEGIN/COMMIT/ROLLBACK + 樂觀鎖、FR-007a 全程 Asia/Taipei 時區、FR-030 / FR-031 / FR-032 BarcodeDetector + 貼上文字 fallback；⑤a11y：批次操作列 `aria-live="polite"` + checkbox `aria-checked="mixed"`；⑥啟動 log `[startup] AssetPilot v4.23.0 / feature 002-transactions-accounts ready` |
| 4.21.1 | 2026-04-24 | 升級 `resend` 6.1.3 → 6.12.2 對齊 npm latest（13 個直接相依全對齊）；`emails.send()` 物件回傳 API 未變更，`sendStatsEmail()` 無須調整，`node --check server.js` 通過；`specs/001-user-permissions/research.md` §5 同步標記 ✅，並新增 §5.1 記錄 `resend → svix → uuid<14` 鏈上 GHSA-w5hq-g745-h8pq 3 筆 moderate 漏洞（本專案未以 `buf` 參數呼叫 `uuid`，CVSS 0，不受影響；`fixAvailable` 建議降級為誤判，決策維持 6.12.2） |
| 4.21.0 | 2026-04-24 | SRS 全面改寫為敘述式 SSD（System Specification Document）：按模組（使用者與權限、交易與帳戶、分類、預算與固定收支、統計報表、股票投資、匯出匯入、前端路由）分段，每個模組含核心目標敘述與「不做什麼」邊界；舊 IEEE-830 逐條 FR 結構轉為技術附錄保留；新增 Spec-Kit 憲章 `.specify/memory/constitution.md` v1.0.0（Principle I：所有規格與使用者文件必須為繁體中文，NON-NEGOTIABLE） |
| 4.20.5 | 2026-04-21 | 深色模式對比度修正：①`--text-muted` 由 `#6b7280`（surface 上 3.77:1，未達 WCAG AA）提亮為 `#8b94a3`（5.75:1），影響股票卡片標籤、空白狀態文字、表格次要欄位等共 21 處；②側邊欄 `.sidebar-version` 文字 alpha .4 → .6（3.80→7.27:1）；③`.sidebar-legal-link` alpha .3 → .6（2.61→7.27:1）；④`.sidebar-legal-sep` 分隔點 alpha .2 → .45（1.80→4.52:1） |
| 4.20.4 | 2026-04-21 | 外幣固定收支編輯失敗修正：refreshRecFxUi() 內仍殘留 fmtNum(twd) 呼叫（v4.20.3 僅修了列表 render），外幣記錄開啟編輯 Modal 即 throw「fmtNum is not defined」；改用 Number(twd).toLocaleString('zh-TW') |
| 4.20.3 | 2026-04-21 | 固定收支頁載入失敗修正：v4.20.2 外幣顯示誤用不存在的 fmtNum()，整頁 throw「fmtNum is not defined」；改用 Number(...).toLocaleString('zh-TW') 直接格式化 |
| 4.20.2 | 2026-04-21 | 固定收支列表 UX：①新增詳細明細區塊（起始日、上次產生日、下次產生日，啟用且下次產生日 ≤ 今日時以警示色標記「待執行」），備註一併顯示；②外幣固定收支顯示原幣金額與 TWD 換算；③編輯時若原分類/帳戶已刪除，下拉插入「（原分類已刪除）/（原帳戶已刪除）」佔位選項避免 select.value 靜默清空；④編輯時 type 非 expense/income 時不再 crash，回退為 expense |
| 4.20.1 | 2026-04-21 | 排程寄送資產統計報表修正：先前 shouldRunSchedule() 與 formatTwTime() 直接用 Date#getHours() / #getDate() / #getDay()，伺服器跑在非 Asia/Taipei 時區（例：Zeabur / Docker 預設 UTC）時會以 UTC 判斷觸發時間，導致設定 0 時寄送實際在 UTC 0 點（台灣 08:00）才觸發。新增 twParts()（固定 UTC+8 無 DST）與 twStartOfDayMs()，排程觸發時/週/日比對與 lastRun periodStart 一律以台灣時間為準 |
| 4.20.0 | 2026-04-21 | 股票定期定額強化：①遇 TWSE 休市日或週末自動順延到下一個交易日（排程日仍以原日期推算維持週期節奏，交易紀錄日期為實際交易日，備註附「原排程 YYYY-MM-DD 順延」）；②新增 TWSE 休市日快取（/v1/holidaySchedule/holidaySchedule OpenAPI，24h TTL），過濾「開始交易/最後交易」特別交易日；③/api/stock-recurring/process 回傳新增 postponed 欄位；④股票交易股數限整數：前端 input min/step 0.0001 → 1，後端 POST/PUT/CSV import 皆加 Number.isInteger 檢查 |
| 4.19.5 | 2026-04-21 | 固定收支修正：①/api/recurring/process 與 /api/stock-recurring/process 原先以 getNextDate(start_date) 當首次生成日期，導致起始日為今天時跳過當日；現 last_generated 為空時改以 start_date 本身作為首次日期；②編輯固定收支（或交易）時，若分類為帶有子分類的父層，下拉無對應 option 導致 recCategory 被清空、表單無法送出；buildCategoryOptions() 於父分類 optgroup 最前方加入「父分類名稱（全部）」可選項 |
| 4.19.4 | 2026-04-20 | Copilot Review v4.19.3 修正 + NTP 功能簡化：①NTP 同步限制僅支援 IPv4 與 FQDN 網域，IPv6 位址與 AAAA 紀錄一律拒絕；②queryNtp() 改寫為 async function，移除 async Promise executor anti-pattern；③resolveHostToPublicIpv4() 改用 dns.lookup({family:4, all:true})，dgram socket 固定 udp4；④移除 parseIPv6Groups() 與 IPv6 私有網段判斷分支（zone id / 6to4 / IPv4-mapped/compatible 展開邏輯一併簡化） |
| 4.19.3 | 2026-04-20 | Copilot Review v4.19.2 修正：①isPrivateOrReservedIp() 改用 net.isIP() + 自訂 IPv6 展開器：link-local 改判 fe80::/10、ULA fc00::/7、multicast ff00::/8、IPv4-mapped 完整展開形式、IPv4-compatible ::a.b.c.d、6to4 2002::/16 內嵌私有 IPv4 皆擋；②queryNtp() 送出前 dns.lookup({all:true}) 解析 FQDN 逐一檢查，防 DNS rebinding；送 UDP 用解析後字面 IP 避免 TOCTOU；③依解析結果切換 udp4/udp6（原固定 udp4 導致 IPv6 必敗）；④IPv4 補判 CGNAT 100.64.0.0/10；NTP API 回應加上 resolvedIp 方便稽核 |
| 4.19.2 | 2026-04-20 | Copilot Review v4.19.1 修正：①runScheduledReportNow() 內 startedAt/finishedAt 改用 serverNow()，與 shouldRunSchedule() 同一時間基準，避免 offset ≠ 0 時每 5 分鐘重複觸發；②NTP host 參數新增嚴格驗證（擋 private/loopback/link-local/ULA/multicast/IPv4-mapped、localhost/.local/.internal、格式 + 長度 253），降低 SSRF 風險；③伺服器時間區塊新增 uptime 欄位；④loadAdminServerTime() 成功時無條件清空狀態訊息 |
| 4.19.1 | 2026-04-20 | 伺服器時間新增 NTP 自動校正：以原生 dgram/UDP 實作 SNTP v3 client（RFC 4330），3 秒逾時 fallback；預設依序嘗試 tw.pool.ntp.org / pool.ntp.org / time.google.com / time.cloudflare.com；支援「查詢（不套用）」預覽；校正時扣除單趟網路延遲提升精準度；新增 POST /api/admin/server-time/ntp-sync API |
| 4.19.0 | 2026-04-20 | 管理員頁面新增「伺服器時間」區塊：顯示伺服器實際時間、時區、目前採用時間（含偏移）、啟動後偏移量；可填目標時間或毫秒偏移量設定 SERVER_TIME_OFFSET，套用於 checkAndRunSchedule() 排程檢查（系統時鐘本身不動）；偏移持久化於 system_settings.server_time_offset、上限 ±10 年；新增 GET/PUT /api/admin/server-time API |
| 4.18.4 | 2026-04-18 | Copilot Review v4.18.2 修正：①完成分支 report_schedule_last_run 改寫 startedAt 取代 finishedAt，避免長執行跨過下個 periodStart 時 shouldRunSchedule() 將下一期誤判為已執行而跳過（完成時間改放 summary）；②PUT /api/admin/report-schedule 硬編 100 上限改用 REPORT_SCHEDULE_MAX_TARGETS 常數，錯誤訊息亦由常數衍生 |
| 4.18.3 | 2026-04-18 | Copilot Review v4.18.1 修正：信件 sectionTitle 改用外層 `<table>` + `<td padding>` 包裹內層標題 table 取代 table margin；Outlook（Word 引擎）會忽略 table 上的 margin，原本 26px/10px 上下間距在 Outlook Desktop 會消失 |
| 4.18.2 | 2026-04-18 | Copilot Review v4.17.0 修正：①runScheduledReportNow() 統一回傳結構，skipped 一律為數字、新增 status 欄位（already_running/no_targets/no_email_service/completed）；②未指定對象/寄信服務未設定的略過分支補上 report_schedule_last_run 更新，避免同一 period 內背景每 5 分鐘重複觸發；③targetIds 統一去重（Set）+ 上限 100 筆；④管理員寄送對象標題列移除巢狀 `<label>`（改 `<div>`）；⑤前端執行結果改依 status 判斷顯示 |
| 4.18.1 | 2026-04-18 | Copilot Review 修正：①getReportPeriod('monthly') 改用 `new Date(y, m, 0)` 推算上月最後一天，避免硬編 86400000ms 在 DST/時區轉換偏移；②todayStr() 改呼叫 ymd(new Date())，移除重複格式化邏輯；③信件 sectionTitle 區塊標題改用 table 佈局取代 flex/gap，提升 Outlook Desktop 等郵件用戶端相容性 |
| 4.18.0 | 2026-04-17 | 信件「交易紀錄」區塊改為依排程頻率切換：daily → 昨日交易明細、weekly → 上週 7 天每日收支彙總（Mon-Sun）、monthly → 上月每天收支彙總；週/月彙總多顯示「區間收入/支出/淨額」三欄總覽卡，週末日期紫色標示；信件視覺美化（三色漸層 hero、卡片陰影、節標題色塊、CTA 陰影、品牌標記） |
| 4.17.0 | 2026-04-17 | 合併「寄送資產統計報表」與「排程自動寄送」成單一卡片：管理員勾選使用者 + 頻率 → 排程指定對象自動寄送（或「立即寄送一次」）；寄送前自動更新該使用者所有持股最新報價（盤中即時 → STOCK_DAY → TPEx 三段策略），信件「股票投資」區塊改顯示 4 列（成本/市值/未實現損益/報酬率含彩色 ±）；system_settings 加入 report_schedule_user_ids 欄位；移除 POST /api/admin/send-stats-report（功能合併） |
| 4.16.2 | 2026-04-17 | 修正排程設定儲存後 reload 會失效的 bug：①admin 表單加上 action="javascript:void(0);" + method="post" 防止 listener race window 期間 submit 觸發預設 GET 導航導致資料丟失；②修正後端 hour=0（午夜）/ weekday=0（週日）被 `\|\|` 當 falsy 重設為 default 的 bug，改用 Number.isFinite + clampInt；③前端 form 改用 dataset.bound flag 確保 listener 只綁一次，儲存成功後立即 GET 一次並 re-render 表單確認 DB 真的持久化 |
| 4.16.1 | 2026-04-17 | 文件補齊 + 信件「近 5 筆交易」幣別顯示修正：先前誤把 transactions.currency 當前綴，導致 USD 標記的交易顯示成 USD（實際 amount 已是 TWD 等值）；改為一律 TWD 顯示與 dashboard 一致。README.md「Docker 環境變數」與「環境變數完整清單」補上 RESEND_API_KEY / RESEND_FROM_EMAIL / APP_URL 並註明 SMTP 改走管理員 UI；.env.example 補上 APP_URL；SRS.md 版本歷程補齊 4.14.0 ~ 4.16.1 |
| 4.16.0 | 2026-04-17 | 排程自動寄送統計報表 + 信件大改版：system_settings 加入 report_schedule_freq/hour/weekday/day_of_month/last_run/last_summary 6 欄；背景 setInterval 5 分鐘檢查；GET/PUT /api/admin/report-schedule + POST /run-now；信件版面重新設計（漸層 hero、3 欄 KPI 含上月對比 ▲▼ pill、儲蓄率進度條、分類顏色長條、近 5 筆交易、CTA 按鈕需設 APP_URL）；table-based 排版兼容 Outlook |
| 4.15.0 | 2026-04-17 | SMTP 寄信支援 + 失敗原因 UI 顯示：system_settings 加入 smtp_host/port/secure/user/password/from 欄位；GET/PUT /api/admin/smtp-settings（密碼遮蔽 hasPassword:bool，空字串視為保留）；POST /api/admin/test-email；統一 sendStatsEmail() 入口（SMTP > Resend > 503）；前端新增 SMTP 設定卡片 + 寄測試信按鈕；寄送失敗/略過原因改 UI 直接顯示 |
| 4.14.0 | 2026-04-17 | 管理員寄送個人資產統計報表（Resend）：新增 RESEND_API_KEY/RESEND_FROM_EMAIL 環境變數；POST /api/admin/send-stats-report（自動計算各幣別餘額、本月收支、前 5 大支出分類、股票持倉成本，輸出 HTML 信件）；前端新增「寄送資產統計報表」卡片（多選使用者一鍵寄送）；單次最多 100 位、間隔 600ms 避開 Resend 速率限制 |
| 4.13.1 | 2026-04-17 | 資安強化（續）：Google-only 刪帳號改要求 fresh id_token 驗證（audience + sub + exp）；express.json 全局 limit 50MB→5MB，CSV 匯入端點 25MB + 20000 rows 上限；body 過大統一回 JSON 413；saveDB() 改非阻塞（in-flight + pending 合併 + tmp/rename 原子寫） |
| 4.13.0 | 2026-04-17 | 資安強化：修補儲存型 XSS（normalizeDate 嚴格驗證 + 前端 escHtml）、IDOR（驗證 accountId/categoryId/stockId 擁有者）、JWT 無法撤銷（新增 token_version）、Passkey origin 白名單、CSV Formula Injection 防護、股票正數驗證、TWSE symbol 格式驗證、統一強密碼規則、.env 權限 0o600、.gitignore/.dockerignore 排除 DB 備份 |
| 4.12.2 | 2026-04-14 | 所有密碼欄位新增顯示/隱藏切換按鈕（登入、註冊、修改密碼、刪除帳號確認、管理員建立使用者、管理員重設密碼） |
| 4.12.1 | 2026-04-13 | 修正 Passkey 登入紀錄顯示為「密碼」而非「Passkey」；補充 Passkey 失敗原因中文翻譯 |
| 4.12.0 | 2026-04-13 | 新增資料庫匯出匯入備份功能（僅管理員）：匯出未加密 SQLite 檔案、匯入時自動驗證格式與資料表結構、自動備份現有資料庫 |
| 4.11.0 | 2026-04-13 | 新增海外刷卡手續費計算：外幣 + 信用卡 + 支出時自動計算手續費（預設 1.5%），支援手動調整金額與費率，顯示摘要合計；後端新增 fx_fee 欄位 |
| 4.10.3 | 2026-04-13 | 修正正式環境登入紀錄國家欄位空白：優先使用 Cloudflare CF-IPCountry header，fallback 至 ipinfo.io |
| 4.10.2 | 2026-04-13 | 修正 Passkey 驗證 counter 路徑錯誤；登入頁 Google/Passkey 按鈕移至帳密下方；登入紀錄新增分頁與每頁筆數選擇;移除登入頁版本更新按鈕 |
| 4.10.1 | 2026-04-13 | 修正 Passkey 前端模組從 CDN 載入失敗，改為伺服器本地提供；更新 OpenAPI 規格至 v4.10.0 |
| 4.10.0 | 2026-04-13 | 新增 Passkey (WebAuthn) 無密碼登入：登入頁支援指紋/Face ID/PIN 碼快速登入；帳號設定可管理多組 Passkey（註冊、命名、刪除）；後端新增 passkey_credentials 資料表與 6 支 API 端點 |
| 4.9.3 | 2026-04-13 | 密碼強度規則升級：需含大寫、小寫、數字與特殊符號；管理員重設密碼新增新舊密碼相同檢查；註冊表單新增前端即時驗證 |
| 4.9.2 | 2026-04-13 | 修正批次變更分類嵌套 optgroup 導致分類顯示不全；改為自訂下拉選單含色點與分區結構；允許刪除預設分類；修正匯率輸入 step 驗證過嚴；更新 OpenAPI 規格 |
| 4.9.1 | 2026-04-11 | 新增使用者修改密碼功能：帳號設定卡片支援自助修改密碼（驗證目前密碼、防止新舊相同）；Google-only 帳號可設定本機密碼；管理員 → 使用者列表新增「重設密碼」按鈕與 Modal，可直接為任一使用者設定新密碼；新增 PUT /api/account/password 與 PUT /api/admin/users/:id/password 端點，密碼強度需 8 字元含英數 |
| 4.9.0 | 2026-04-11 | 移除 Cloudflare-issued Client Certificates（mTLS）功能：完整刪除後端 mtlsMiddleware / /api/admin/certs/mtls* 端點 / MTLS_* 環境變數 / SSL_MTLS_* 路徑 / HTTPS+mTLS 直連啟動模式、前端 isMtlsError / 警示卡 / renderAdminCerts mTLS UI 綁定、index.html 三個 mTLS admin 區塊、style.css .mtls-notice* 樣式、Dockerfile SSL/mTLS 目錄、.env / README mTLS 設定範例；管理員面板簡化為僅 Origin Certificate；建議搭配 Tailscale 或 Cloudflare Access 取代裝置層級身份驗證 |
| 4.8.x | 2026-04-11 | mTLS 相關錯誤處理、救援路徑、藥丸分段控制器、Cloudflare Managed Transform 標頭相容、登入紀錄分頁 UI 等多輪迭代（4.8.1 ~ 4.8.9） |
| 4.7.x | 2026-04-11 | SSL/TLS 憑證管理介面、mTLS 支援、openapi.yaml（Cloudflare API Shield Schema，88 端點）、多幣別相關修正等（4.7.0 ~ 4.7.9） |
| 4.6.x | 2026-04-07 ~ 10 | 認證 Token 改存 httpOnly Cookie + SameSite=Strict、logout API、JWT_EXPIRES 統一控制、外幣自動匯率、隱私權/服務條款公開頁、幣別下拉改用 CURRENCY_LABELS 完整對照、全頁 RWD 優化（4.6 ~ 4.6.9） |
| 4.5 | 2026-04-05 | 登入紀錄 country 欄位持久化至 DB，重啟後不重查；登入時 fire-and-forget 回寫 |
| 4.4 | 2026-04-05 | 全球匯率 API 改為 server-level 快取（TTL 5分鐘）+ in-flight deduplication，跨使用者共用 |
| 4.3 | 2026-04-05 | 新增交易「不計入統計」功能，可標記單筆不影響報表、儀表板、預算計算 |
| 4.2 | 2026-04-02 | 首頁視覺翻新（Plus Jakarta Sans 字型、英雄數據列、彩色圖示、橙色 CTA） |
| 4.1 | 2026-04-02 | 信用卡銀行分組與一鍵還款 |
| 4.0.x | 2026-03-25 ~ 31 | 全站 UI 現代化重設計：Inter 字體、新色彩系統、柔和陰影、毛玻璃、spring 動畫、iOS 風格分段控件、focus-visible、prefers-reduced-motion；多幣別支援擴充至 150 種、帳戶類別欄位（銀行/信用卡/現金/虛擬錢包）、排除計入總資產開關、儀表板支出分類改父分類 + 前 5 名、統計報表雙圓餅預設（4.0 ~ 4.0.10） |
| 3.6x ~ 3.4x | 2026-03-25 ~ 23 | 信用卡繳費操作指引、匯率更新冷卻期、股票定期定額、股利日期欄位統一為除息日期、全球匯率更新移除冷卻期、全站配色系統一致化、圓餅圖配色與圖例順序統一、儀表板與統計報表雙圓餅圖、全站使用者登入紀錄手動同步、IP 國家查詢、修改顯示名稱、未來交易等 |
| 3.3x ~ 3.1x | 2026-03-21 ~ 22 | 分類管理/固定收支移至收支管理、匯率設定移至收支管理、登入稽核紀錄支援刪除與批次刪除、快速新增按鈕依頁面情境顯示、全站登入紀錄納入失敗事件、Google 登入轉跳卡住修復、OAuth state、XSS/防護策略強化、公開首頁與登入路徑調整、管理員模式與註冊控管、API 使用與授權頁、全球即時匯率自動更新、備份下載上傳與自訂排程、主題切換同步、多幣別支援與匯率換算、電子發票 QRCode 自動輸入、深色模式、儀表板資產配置圓餅圖、股票交易計算設定、Google SSO GIS Redirect、Docker 一鍵更新、版本資訊一鍵更新、收支管理子選單整合、版本資訊手動重新檢查、全面依賴升級、遠端版本更新檢查、股票紀錄子頁面路由、Google SSO 授權碼流程、股票紀錄排序、TWSE 股利同步、上櫃股票報價、Docker 密鑰持久化、股票管理優化 |
| 3.0x | 2026-03-19 ~ 20 | 股票投資管理模組上線；TWSE 除權息自動同步、實現損益紀錄、股票 CSV 匯出匯入與類型管理、股票自動建立與搜尋篩選、Google SSO 登入與批次操作、安全性強化、環境變數與資料庫加密、TWSE 除權息自動同步、刪除帳號介面美化、帳號管理與版本資訊優化 |
| 2.0 | 2026-03-19 | 完整記帳功能 |
| 1.0 | 2026-03-18 | 初版發布 |

### 4.3 未來擴充方向

- 共享帳本（家庭／情侶記帳）
- PWA 離線記帳功能
- 多語系支援
- Excel (.xlsx) 匯出格式
- 股票歷史股價圖表
- 股利再投資（DRIP）追蹤
- 現股當沖證交稅減半計算
- AI 智慧分類建議（依摘要與歷史紀錄自動推薦分類）
- 自動預算建議與超支預警（依過去消費趨勢產生建議）
- 固定收支智慧偵測（自動辨識可轉為固定收支的交易）
- 發票載具與雲端發票自動匯入整合
- 銀行/券商對帳匯入（CSV/OFX）與對帳差異提示
- 多幣別報表（依帳戶幣別與基準幣別切換檢視）
- 自訂儀表板小工具（可拖曳排序、顯示/隱藏卡片）
- 目標儲蓄與還款計畫（目標追蹤與進度提醒）
- 行事曆視圖（按日檢視收支、股利、固定收支排程）
- 推播通知（帳單到期、預算超標、股利發放提醒）
- 權限分級共享（可編輯／唯讀）與操作稽核紀錄
- API Token 與 Webhook（第三方自動化整合）
- 附件上傳（交易憑證／發票影像）與 OCR 自動帶入
- 測試與品質提升：E2E 測試、視覺回歸測試、無障礙檢測

---
