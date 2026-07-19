# 資產管理 系統規格說明書 (SSD)

**版本：** 4.84.3
**日期：** 2026-07-01
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
| 外部 API | TWSE OpenAPI、exchangerate-api.com、ipinfo.io、Google Identity Services、SMTP（Nodemailer）、Zeabur Email（ZSend）、Resend、MEGA S4 Object Storage |
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

登入成功會發放 JWT Token，存於 httpOnly Cookie（防 XSS 竊取），搭配 `SameSite=Strict` 屬性（防 CSRF），有效期由 `JWT_EXPIRES` 環境變數統一控制。登出會呼叫後端 `/api/auth/logout` 清除目前裝置的 Cookie，不影響其他裝置的登入狀態；修改密碼與管理員重設密碼才會透過 `token_version` 更新撤銷既有 Token。登入 API 回傳 `currentLogin`，讓前端立即顯示本次登入資訊。

#### Passkey（WebAuthn）

使用者可在帳號設定註冊 Passkey（指紋、Face ID、PIN 碼、硬體安全金鑰），之後可在登入頁用 Passkey 一鍵無密碼登入。同一個帳號支援多組 Passkey，每組可命名並獨立刪除。後端有 origin 白名單防 rebinding。WebAuthn 前端模組由伺服器本地提供（不走 CDN），以避開外部失效風險。

#### 管理員身分與註冊政策

系統建立的第一個使用者自動成為管理員；若資料庫升級時尚無任何管理員，最早建立的使用者會被追認升級。這條規則沒有例外，目的是確保系統**永遠至少有一位管理員**。

管理員可以控制註冊政策，包含：是否開放公開註冊、以及一份 Email 白名單。白名單非空時，只有白名單上的 Email 可以註冊（一般註冊與 Google 首次註冊都適用）；白名單為空且公開註冊關閉時，訪客無法自行註冊，只能由管理員直接建立帳號。管理員建立帳號時可指定是否授與管理員身分，可重設任一使用者的密碼，刪除帳號會一併刪除該使用者的所有關聯資料（交易、帳戶、分類、預算、股票等）。**管理員不可刪除自己，也不可讓系統剩餘的管理員歸零** — 這兩條規則對自刪與被刪皆適用。

#### 登入稽核

每一次登入成功都會寫入稽核紀錄，欄位包含登入時間、IP 位址、登入方式（password / google / passkey）、以及本次登入是否以管理員身分進行；失敗登入（帳號不存在、密碼錯誤、缺少憑證、暫時鎖定）也會記錄，且註明失敗原因。IP 的國家代碼優先取自 Cloudflare 的 `CF-IPCountry` 標頭，退回時才查 ipinfo.io；內網位址標記為 `LOCAL`。

一般使用者只能在「帳號設定」看自己最近的 100 筆登入紀錄。管理員另可在管理介面看自己作為管理員身分登入的最近 200 筆、以及全站的最近 500 筆（含失敗嘗試）。管理員的兩種紀錄都支援單筆刪除、多選批次刪除、手動同步，並顯示上次同步時間；即使舊資料缺少主鍵，也必須能透過備援識別（例如時間戳）刪除單筆。

帳號設定頁會列出目前有效登入裝置，欄位包含裝置名稱、登入時間、登入 IP 與單一裝置「登出」操作。一般登出與單一裝置登出只撤銷該 session；修改密碼與管理員重設密碼仍會遞增 `token_version` 並撤銷所有既有 session，確保高風險帳號變更後舊裝置失效。

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

分類支援兩層：父分類與子分類。不提供三層以上的孫分類 — 這是刻意的限制，避免使用者陷入「我要建幾層才夠」的糾結。每個分類有名稱、類型（收入／支出，強制 CHECK 約束）、顏色、是否為預設分類、排序順序。子分類的類型必須跟父分類一致，同一個父分類下名稱不可重複。子分類僅能隸屬於一個父分類。**分類類型一經建立永久不可變更**，避免歷史交易語意混亂。**交易僅能指派至子分類**（leaf-only），父分類僅作為組織節點不直接承載交易（後端強制）。

#### 預設資料

新使用者註冊時會自動建立完整的預設分類樹（13 個父分類 + 56 個子分類）：

- **支出父分類（8）：** 餐飲、交通、購物、娛樂、居住、醫療、教育、其他
- **預設子分類：**
  - 餐飲 → 早餐、午餐、晚餐、飲料、點心
  - 交通 → 大眾運輸、計程車、加油、停車費、高鐵/火車
  - 購物 → 日用品、服飾、3C 用品、家電、美妝保養
  - 娛樂 → 電影/影音、遊戲、旅遊、運動健身、訂閱服務
  - 居住 → 房租/房貸、水電費、瓦斯費、網路費、管理費
  - 醫療 → 掛號費、藥品、保健食品、牙科、健檢
  - 教育 → 學費、書籍、線上課程、補習費
  - 其他 → 雜支、禮金/紅包、捐款、罰款
- **收入父分類（5）：** 薪資、獎金、投資、兼職、其他
  - 薪資 → 月薪、加班費
  - 獎金 → 年終獎金、績效獎金、節日禮金
  - 投資 → 股利、利息、資本利得
  - 兼職 → 接案、家教、打工
  - 其他 → 退稅、贈與/紅包、雜項

舊使用者在系統升級後若缺少任一預設項，會在登入時被自動補建（P95 < 200 ms）；補建會跳過使用者主動刪除過的預設項（透過 `DeletedDefaultRegistry` 追蹤），不會復活已刪除的預設項。

#### 畫面

分類管理頁採雙區塊：上半段「支出」、下半段「收入」。父分類顯示完整寬度，帶 `+`（新增子分類）、編輯與刪除按鈕；子分類以 CSS Grid 網格縮排顯示，帶左側 4px 藍色邊框和箭頭圖示。整棵分類樹支援 **HTML5 原生拖曳排序**（同層）：父列拖曳重排該 type 的所有父分類；子分類在同一父分類底下拖曳重排，跨父歸屬調整則透過編輯 modal 內的「上層分類」下拉。色彩配色與儀表板、報表的圖例完全一致。

頁首提供「補回過去刪除的預設分類」按鈕：點擊後清空 `DeletedDefaultRegistry` 並執行一次補建；這是非破壞性操作，**不修改任何現有分類**。

#### 約束

- 分類下若有交易記錄則不可刪除
- 刪除父分類時，若任一子分類下有交易，整棵樹都不可刪除；否則連帶刪除所有子分類；連帶刪除的預設子分類會對稱寫入 `DeletedDefaultRegistry`，避免下次登入又被自動補回
- 顏色僅允許嚴格 `#RRGGBB` 6 碼 hex，後端會驗證；這是為了防止 CSS 注入（不接受 `#RGB` 縮寫或 `#RRGGBBAA` alpha 形式）
- 分類類型（收入／支出）一經建立永久不可變更
- 編輯父分類時不可將其改為某分類的子分類（避免形成循環）

#### 不做什麼

- 不做 AI 自動分類或分類建議；留給未來版本
- 不做跨使用者的共用分類模板庫；使用者想要套用他人範本只能透過 CSV 匯入匯出
- 不做「是否隱藏」屬性：分類只能新增、編輯、刪除，沒有第四種狀態

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

「股票投資」區塊顯示 4 列：成本、市值、未實現損益、報酬率（含彩色 ± 符號）。寄信通道（v4.30.0 起）一律由環境變數設定，支援三種：SMTP（Nodemailer）、Zeabur Email（ZSend HTTP API）、Resend；以 `EMAIL_PROVIDER_PRIMARY` 與 `EMAIL_PROVIDER_FALLBACK`（值：`smtp` / `zeabur` / `resend` / 留空）指定主要與備用通道，primary 執行期失敗時若 fallback 已設定才自動退回，不重試不補寄；兩者皆未設定則回 503（沿用 005 FR-021）。寄件人顯示名稱可透過 `EMAIL_SENDER_NAME`（v4.30.1 起）為三通道統一指定，採 RFC 5322 quoted-string 包裝為 `"<name>" <email>`；若各通道 FROM 變數已是 `Name <email>` 格式則不覆寫，保留 per-provider override 能力。排程檢查以台灣時間（UTC+8，無 DST）為基準，使用 `twParts()` 輔助函式確保部署在 UTC 主機上仍能正確觸發。

#### 不做什麼

- 不做多幣別報表切換。所有金額一律以 TWD 等值計算
- 不做使用者自訂儀表板版位排序／隱藏，留給未來版本
- 不做週／月報 PDF 匯出

---

### 2.6 股票投資

核心目標：讓使用者記錄台股買賣與股利，自動計算手續費／證交稅／FIFO 損益，並能隨時掌握持股市值與報酬率。

#### 持倉

每檔持股代表一個「股票代號」加一個「類型」（一般股票／ETF／權證）。類型影響賣出時的證交稅稅率（一般 0.3%、ETF/權證 0.1%）。持有股數、平均成本、損益等數值一律由系統從交易紀錄動態計算，不額外儲存 — 確保帳目永遠跟交易一致。

投資組合總覽卡顯示總市值、總成本、總損益、整體報酬率（金額加權公式：`totalPL / totalCost × 100`；`totalCost = 0` 時顯示「—」）；個股卡片顯示代號與名稱、持有股數、平均成本、目前股價、市值、損益與報酬率，並補「最後查價時間」標記（> 24 小時以橘色 ⚠ 警示）、價格來源（即時／收盤／T+1／凍結）、已下市 badge。三段式損益顯色：獲利綠色（▲）／損益 0 灰色／虧損紅色（▼）。

`GET /api/stocks` response 為 `{ stocks: [...], portfolioSummary: { totalMarketValue, totalCost, totalPL, totalReturnRate } }`；FIFO 計算改用 `lib/moneyDecimal.js` 內共用 `calcFifoLots()` helper（decimal.js 全精度，僅最終 response 階段取整以滿足 SC-004 ≤ 1 元誤差）。

`stocks.delisted INTEGER DEFAULT 0` 欄位記錄使用者於批次更新股價 Modal 手動標記的下市旗標；下市股票凍結價格、跳過 TWSE 查價、priceSource 固定為 `'frozen'`。

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

使用者可設定某檔股票的定期定額：每期預算、週期、起始日、證券帳戶、備註、啟用／停用。系統在每次登入時 server-side 非同步（`setImmediate` fire-and-forget）觸發 `processStockRecurring(userId)` 補產生流程，補產生迴圈每期使用該期應觸發日的 TWSE STOCK_DAY 歷史收盤價計算可買股數（無法買 1 股時略過）並產生買進交易。

`stock_transactions` 表新增 `recurring_plan_id` / `period_start_date` 兩欄並建立 partial unique index `idx_stock_tx_recurring_idem`（`(user_id, recurring_plan_id, period_start_date)` 三元組僅一筆），配合 `INSERT OR IGNORE` 達成多裝置同時登入觸發 race 下不重複扣款。

若排程日遇週末或 TWSE 休市日則自動順延到下一個交易日；排程日本身仍以原日期推算保持週期節奏，交易紀錄的日期寫入實際交易日，備註附「原排程 YYYY-MM-DD 順延」。休市日快取 24 小時，來源為 TWSE `/v1/holidaySchedule/holidaySchedule` OpenAPI，並過濾掉「開始交易／最後交易」等特別交易日。

#### 自動同步除權息

股利紀錄頁有「同步除權息」按鈕。按下後，後端依使用者最早交易日期到今日，按年分段查 TWSE `TWT49U` 除權息列表，僅處理使用者已持有的股票代號，計算每個除息日當下的持股數（若持股為 0 則跳過）。純現金股利直接取 `權值+息值`；含股票股利者查 `TWT49UDetail` 明細取每股現金與每千股配股數。最終：

- 現金股利 = 持股數 × 每股現金股利（四捨五入）
- 股票股利 = 持股數 × 每千股配股數 ÷ 1000

同日期同股票若已存在股利紀錄則不重複新增；自動新增的備註會標示「TWSE自動同步（每股$X.XX）」。除權息 API 快取 30 分鐘。`POST /api/stock-dividends/sync?year=YYYY` 支援單年同步；前端「同步除權息」按鈕觸發阻擋式 Modal + 進度條 + 取消按鈕，從最早交易年份逐年呼叫並累計 `新增 N / 跳過 M / 失敗 K` 顯示於完成 toast。

#### 股票股利合成交易

新增或同步含 `stockDividendShares > 0` 的股利時，系統於 `stock_transactions` 同步寫入一筆合成 `$0` buy 交易（`note` 以 `[SYNTH] 股票股利配發` 唯一前綴開頭），讓 FIFO 佇列自然納入這批 $0 cost lot。刪除股利紀錄時連動刪除對應合成交易（依 `stock_id + date + price=0 + note 前綴` 匹配，容差 0.001 股）；股票交易批次刪除拒絕含合成股票股利交易的選取，必須透過刪除股利紀錄處理。

#### 實現損益

獨立 Tab 呈現每筆賣出交易的 FIFO 實現損益。`GET /api/stock-realized-pl` response shape 為 `{ entries: [...], summary: { totalRealizedPL, overallReturnRate, ytdRealizedPL, count } }`，整體報酬率採金額加權公式（`totalRealizedPL / totalCost × 100`，`totalCost = 0` 時為 `null`）。頂部彙總卡顯示總實現損益、整體報酬率、今年實現損益、已實現筆數。表格列出賣出日期、股票、股數、賣出均價、成本均價（FIFO）、手續費+稅、實現損益、報酬率，皆套用三段式顯色。

FIFO 邏輯：買入批次依時間序進入佇列（手續費分攤至成本）；每筆賣出依序從最早批次扣除，算出該筆賣出的成本基礎；實現損益 = 賣出收入（股數 × 賣出價 - 手續費 - 證交稅）- FIFO 成本基礎；報酬率 = 實現損益 ÷ FIFO 成本基礎 × 100%。未賣出部位的平均成本以 FIFO 剩餘批次計算。

#### 批次更新股價

Modal 列出所有持股與目前股價輸入框，每列附「標為已下市」checkbox（凍結價格 + 後續查價跳過），支援「從證交所取得最新股價」一鍵批次拉 TWSE 最新收盤價（透過 `POST /api/stocks/batch-fetch` 並發查價，受 `TWSE_MAX_CONCURRENCY` 環境變數控制，預設 5；失敗時指數退避重試 2 次，間隔 1s/2s）。`POST /api/stocks/batch-price` 接受 `{ updates: [{ stockId, currentPrice, delisted? }] }`；省略 `delisted` 時保留向後兼容（沿用 baseline 行為僅更新價格）。也允許手動調整個別股價；確認後一次寫回。

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
- Google Identity Services
- 寄信服務：SMTP（Nodemailer）、Zeabur Email（ZSend，`https://zeabur.com/docs/en-US/email/quick-start`）、Resend
- MEGA S4 Object Storage：`https://mega.io/zh-hant/objectstorage`（管理員手動上傳完整 SQLite 備份時使用；S3 相容端點預設 `https://s3.<region>.s4.mega.io`）

#### 交易照片附件

新增交易時可附加最多 5 張照片，每張預設上限 10 MB。使用者可在新增 Modal 中選擇照片儲存位置：Server 本機儲存或 S3 相容物件儲存；S3 未設定時該選項停用。手機網頁需提供「拍照」與「選擇圖片」兩個入口，前者使用 `capture="environment"` 呼叫相機，後者允許從相簿或檔案上傳。LINE 新增記錄 wizard 中可於確認前傳送照片，系統先暫存 LINE image message id，確認新增後透過 LINE message content API 下載並附到該筆交易；LINE 端使用 `TRANSACTION_PHOTO_DEFAULT_STORAGE` 決定本機或 S3。系統新增 `transaction_attachments` metadata 表，實際檔案不放 public 目錄，讀取照片需經 `/api/transactions/{txId}/attachments/{attachmentId}/file` 驗證交易與附件皆屬於目前使用者。本機儲存預設位於 `uploads/transaction-photos`，S3 設定可使用 `TRANSACTION_PHOTO_S3_*`，未設定時可 fallback 使用 `MEGA_S4_*`。

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
| `/settings/admin` | 管理員面板（含全站登入稽核、寄信通道狀態、排程、伺服器時間） |
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
- `/api/auth/login`、`/api/auth/register`、`/api/auth/google` 套用較嚴格速率限制（每 IP 每 15 分鐘 20 次）；`/privacy`、`/terms` 沿用既有靜態頁桶
- 全域 `/api` 速率限制：每 IP 每 15 分鐘 600 次（v4.31.0 新增；CodeQL `js/missing-rate-limiting`）
- CSRF 防護：對所有狀態變更請求（POST/PUT/PATCH/DELETE）若使用 Cookie 登入，必須附帶來源於 `ALLOWED_ORIGINS` 白名單的 `Origin` 或 `Referer`；Bearer Token 流程不受影響（v4.31.0 新增；CodeQL `js/missing-token-validation`）
- 路由轉址參數 `?next=` 在後端 `normalizeRoutePath` 內限制最大長度 2048 字元（v4.31.0 新增；CodeQL `js/polynomial-redos`）
- 資料庫匯入端點 `/api/database/import` 嚴格收斂 `req.body` 為 `Buffer`（CodeQL `js/type-confusion-through-parameter-tampering`）
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
├── 1:N → 登入裝置 (LoginSession)
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

#### LoginSession（登入裝置）

| 欄位        | 型態    | 說明                         | 必填 |
| ----------- | ------- | ---------------------------- | ---- |
| id          | TEXT PK | session 主鍵                 | 是   |
| user_id     | TEXT    | 外鍵 → User                  | 是   |
| token_hash  | TEXT    | JWT 雜湊值                   | 是   |
| device_name | TEXT    | 由 User-Agent 推導的裝置名稱 | 是   |
| ip_address  | TEXT    | 登入 IP                      | 是   |
| user_agent  | TEXT    | 登入 User-Agent              | 否   |
| login_at    | INTEGER | 登入時間（timestamp）        | 是   |
| revoked_at  | INTEGER | 撤銷時間；0 表示有效         | 是   |

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
| POST | /api/auth/logout         | 登出目前裝置（撤銷目前 session 並清除 Cookie） |
| GET  | /api/auth/me             | 取得當前使用者資訊                          |
| POST | /api/auth/google         | Google SSO 登入（驗證授權碼並簽發 JWT）     |
| GET  | /api/account/login-logs  | 取得目前使用者登入稽核紀錄（最近 100 筆）   |
| GET  | /api/account/sessions    | 取得目前有效登入裝置                         |
| DELETE | /api/account/sessions/:id | 登出指定登入裝置                           |
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
| GET    | /api/admin/email-providers               | 取得寄信通道狀態（primary/fallback + 各通道是否設定）     |
| POST   | /api/admin/test-email                    | 寄送測試信（驗證寄信通道設定）                            |
| GET    | /api/admin/report-schedule               | 取得資產統計信件排程設定（**deprecated**，005 起改用 /api/admin/report-schedules 複數）|
| PUT    | /api/admin/report-schedule               | 更新資產統計信件排程設定（**deprecated**；同步寫入 report_schedules 表）|
| POST   | /api/admin/report-schedule/run-now       | 立即寄送一次（**deprecated**；改為迴圈所有 enabled=1 schedules）|
| GET    | /api/admin/report-schedules              | 列出多筆報表排程（005，FR-016 / Round 2 Q2）              |
| POST   | /api/admin/report-schedules              | 新增單筆排程（不檢查 (user_id, freq) 唯一性）             |
| PUT    | /api/admin/report-schedules/{id}         | 更新單筆排程（hour/weekday/day_of_month/enabled）         |
| DELETE | /api/admin/report-schedules/{id}         | 刪除單筆排程                                              |
| POST   | /api/admin/report-schedules/{id}/run-now | 立即執行單筆排程（FR-017 / FR-021；503 時回 no_email_service）|
| GET    | /api/admin/server-time                   | 取得伺服器時間與偏移量                                    |
| PUT    | /api/admin/server-time                   | 設定伺服器時間偏移量                                      |
| POST   | /api/admin/server-time/ntp-sync          | 從 NTP 同步時間                                           |
| GET    | /api/admin/db/export                     | 匯出資料庫備份（未加密 SQLite）                           |
| POST   | /api/admin/db/import                     | 匯入資料庫備份（覆寫前自動備份）                          |

### 3.X 007-data-export-import 新增端點（v4.28.0）

| 方法   | 路徑                                       | 說明                                                       |
| ------ | ------------------------------------------ | ---------------------------------------------------------- |
| GET    | /api/transactions/export                   | 匯出交易記錄 CSV（伺服端 stream，UTF-8 BOM）                |
| GET    | /api/categories/export                     | 匯出分類結構 CSV（父分類在前 / 子分類在後）                 |
| POST   | /api/categories/import                     | 匯入分類結構 CSV（原子化、互斥鎖、唯一鍵 type+name 略過）   |
| GET    | /api/stock-transactions/export             | 匯出股票交易 CSV                                            |
| GET    | /api/stock-dividends/export                | 匯出股票股利 CSV（帳戶欄位反查）                            |
| GET    | /api/imports/progress                      | 查詢目前匯入進度（short polling，1s 一次）                  |
| GET    | /api/admin/backups                         | 列出 backups/ 目錄內備份檔（管理員）                        |
| DELETE | /api/admin/backups/:filename               | 手動刪除備份檔（管理員，path.basename + regex 防遍歷）      |
| GET    | /api/admin/data-audit                      | 列出全部稽核日誌（管理員，支援 user / action / 時間過濾）   |
| GET    | /api/user/data-audit                       | 列出我的操作紀錄（一般使用者，後端強制覆寫 user_id）        |
| GET    | /api/admin/data-audit/export               | 匯出稽核日誌為 CSV（管理員）                                |
| POST   | /api/admin/data-audit/purge                | 清空稽核日誌（管理員）                                      |
| GET    | /api/admin/data-audit/retention            | 讀取稽核日誌保留天數設定（管理員）                          |
| PUT    | /api/admin/data-audit/retention            | 更新保留天數（30/90/180/365/forever）                       |
| GET    | /api/external-apis                         | API 使用與授權清單（公開端點，無需登入）                    |

**新增資料表**：
- `data_operation_audit_log`（10 欄 + 3 索引）— 資料操作稽核紀錄。
- `system_settings.audit_log_retention_days`（新增欄位）— 稽核日誌保留期。
- `backups/`（執行期子目錄）— 還原前自動備份檔，保留最近 5 份且 ≤ 90 天。

**端點行為強化**：
- `POST /api/transactions/import`、`/api/stock-transactions/import`、`/api/stock-dividends/import`：互斥鎖（重入回 409）+ 全 DB transaction 原子化 + 進度回饋每 500 筆 + ISO 8601 嚴格 + 重複偵測（六欄 / 四欄）+ CSV 額外欄位 silent drop + 寫入稽核日誌。
- `GET /api/database/export`：檔名格式改為 `assetpilot-backup-{YYYYMMDDHHmmss}.db`。
- `POST /api/database/import`：必要表加入 stocks；通過驗證後寫入 `backups/before-restore-{ts}.db`；替換失敗自動回滾（422 RESTORE_FAILED_ROLLED_BACK）；雙重失敗回 500 RESTORE_FAILED_DB_UNKNOWN 含可用備份檔清單；保留 5 份 + 90 天清理。
- `PUT /api/exchange-rates`、`GET /api/exchange-rates/:currency`：新增 ISO 4217 白名單前置驗證。

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
| 4.93.1 | 2026-07-19 | 修正固定收支 `exclude_from_stats`（及其他布林旗標欄位如 `is_active`/`needs_attention`）讀取時被誤判的問題。根因：`lib/db.ts` 的 `translateDdlTypes()` 在 `CREATE TABLE`/`ALTER TABLE` 時會把 schema 中所有 `INTEGER` 欄位（含布林旗標）改建為 PostgreSQL `BIGINT`（原意是避免毫秒時間戳欄位溢位 `int4`），但 `node-postgres` 對 `BIGINT`（OID 20）預設以字串回傳查詢結果；`app/api/recurring/route.ts` 的 `GET` 端點以 `!!r.exclude_from_stats` 轉布林，字串 `"0"` 為 truthy，導致無論實際存的是 0 或 1，回傳一律為 `true`（不計入統計）。PR #192（commit `02691038`）修正的是請求 body 欄位命名不一致（`includeInStats`/`excludeFromStats`）的另一個問題，未觸及此讀取端 bug，故該次修正後問題仍未解決。修法：在 `lib/pgSyncWorker.cjs` 建立 `Pool` 前呼叫 `types.setTypeParser(20, (value) => parseInt(value, 10))`，將 BIGINT 欄位統一解析回 JS number（本專案所有 BIGINT 欄位皆為 0/1 旗標或毫秒時間戳，均在安全整數範圍內），一次性修正所有透過 `!!row.someIntColumn` 讀取布林旗標的既有程式碼路徑，無需逐一修改各 API 路由。 |
| 4.93.0 | 2026-07-19 | 新增「排程現金展望」與「儲蓄情境試算」兩個 Dashboard 模組。新增 `lib/recurringSchedule.ts`：從 `lib/recurringHelpers.ts` 抽出 `getNextRecurringDate()`（新增嚴格日曆驗證，輸入日期若非真實存在的西曆日期則回傳 `null`，避免如 2 月 30 日等不存在日期被 `Date.UTC` 自動進位成錯誤的下個月日期）、新增 `addDaysToIsoDate()`、`listRecurringDatesInWindow()`（依 `startDate`/`lastGenerated`/`frequency` 列舉指定日期區間內的所有發生日，處理 daily/weekly/monthly（含月底夾附）/yearly（含閏年 2/29）、逾期排程與 `maxOccurrences` 上限防護）；`lib/recurringHelpers.ts` 改為 re-export 以維持既有呼叫相容。新增 `lib/dashboardForecast.ts`：`getScheduledAccountImpactTwd()` 以 Decimal 計算單筆固定收支對連結帳戶幣別的影響金額（處理台幣/外幣、既有匯率快照與目前匯率、手續費換算，匯率非正數或缺漏回傳 `null` 視為不可估算）；`buildScheduledCashOutlook()` 為純函式，輸入今日日期、銀行帳戶餘額、帳戶數與已標準化的排程清單，輸出 `ScheduledCashOutlook`（`available`/`unavailableReason`（`invalidDate`/`noBankAccounts`/`noSchedules`/`noCoveredSchedules`）/期間起訖/起始餘額/收支總額/期末估算餘額/期間最低估算餘額與日期/首次現金可能低於零的日期與金額/已涵蓋與未涵蓋排程數/`upcomingEvents`（最多 100 筆，依日期/類型/備註/ID 穩定排序））。`app/api/dashboard/route.ts` 的 `GET` 新增 `cashOutlook` 可加性欄位：彙總目前使用者已納入（`included=true`）的銀行帳戶餘額作為起始餘額，篩選 `is_active=1` 且 `needs_attention=0`、已連結帳戶且該帳戶為銀行類型並納入計算的固定收支，逐筆以 `getScheduledAccountImpactTwd()` 換算為 TWD 後交給 `buildScheduledCashOutlook()`；未連結帳戶、非銀行帳戶、未納入、`needs_attention=1`、找不到匯率的排程計入 `uncoveredScheduleCount` 而非靜默排除，維持既有 `dataStatus`/`assets`/`comparison`/`portfolioHealth` 欄位與 `user_id` 範圍查詢不變。`lib/dashboardPreferences.ts` 的 `DASHBOARD_MODULE_IDS` 新增 `cashOutlook`/`savingsScenario` 兩個模組 ID，`DashboardLayoutPreference`/`DEFAULT_DASHBOARD_LAYOUT`/`normalizeDashboardLayout()` 的 `version` 由 `1` 提升為 `2`（既有已儲存排版仍可正規化、缺漏的新模組 ID 會補齊到清單尾端）。`app/dashboard/page.tsx` 新增「排程現金展望」區塊（顯示起始餘額、預計收支、期末估算、最低估算與日期、已涵蓋/未涵蓋排程數、即將發生的排程列表、可能現金短缺的提醒與導向固定收支/帳戶設定的連結）與新增用戶端元件 `app/dashboard/components/SavingsScenario.tsx`（「儲蓄情境試算」：使用者輸入每月調整金額並以按鈕/鍵盤選擇 6/12/24 個月期間，累積差額 = 每月金額 × 月數，即時計算不呼叫 API，含 `aria-live` 精簡播報與清楚標示為簡易試算而非投資報酬預測的免責文字）；`app/dashboard/components/DashboardPersonalization.tsx` 補上這兩個新模組的排序/顯示標籤鍵。新增 `tests/lib/dashboardForecast.test.ts`（純 Node 測試，覆蓋 daily/weekly/monthly 月底夾附/yearly 閏年排程、逾期排程、幣別換算、無帳戶/無排程/無涵蓋排程/日期無效的不可用狀態、現金低於零的判定與排序穩定性），新增 `npm run test:dashboard-forecast` 並納入 `npm test`。新增 10 語言 Web 字典（`dashboard.cashOutlook.*`、`dashboard.scenario.*`、`dashboard.personalize.modules.cashOutlook`/`savingsScenario`）與對應 shared/mobile ARB 並重新產生輸出。驗證：`npm run typecheck`、`npm test`（含新增 7 項排程現金測試）、`npm run check:i18n`（10 語言 1,217 鍵值一致）、`git diff --check`、`npm run build` 全數通過（Windows sandbox 外執行）。 |
| 4.92.0 | 2026-07-18 | 新增可個人化排序的 Dashboard、月度收支變化解讀與投資組合成本健診。新增 `lib/dashboardPreferences.ts`：固定 `DASHBOARD_MODULE_IDS` allowlist（`assets`/`attention`/`whyChanged`/`spending`/`portfolioHealth`/`incomeRecent`），`normalizeDashboardLayout()`/`parseDashboardLayout()` 過濾非法模組 ID 並補齊缺漏順序。`lib/db.ts` 對 `user_settings` 新增可加性欄位 `dashboard_layout TEXT DEFAULT '{}'`、`dashboard_layout_updated_at INTEGER DEFAULT 0`（既有表以 `alterIgnore` 相容升級）。新增 `app/api/user/settings/dashboard/route.ts`：`GET` 回傳目前排版與版本戳；`PUT` 以 `WHERE COALESCE(dashboard_layout_updated_at,0) = ?` 條件式 `UPSERT` 做樂觀鎖，版本不符時回傳 `409 OptimisticLockConflict`。新增 `app/dashboard/components/DashboardPersonalization.tsx`：鍵盤可操作的排序/隱藏對話框，含重設預設值。`lib/dashboardInsights.ts` 新增 `getDashboardComparisonWindow(selectedMonth, today)`：當月採「當月至今 vs 上月同天數」對齊比較（`monthToDate`），歷史月份採「完整月 vs 上一個完整月」（`fullMonth`），未來月份回傳 `null`；`buildDashboardChangeDrivers()` 依收入/支出分類彙總計算 Top 3 淨變化驅動因子（`netContribution` 依收入/支出反向計號、`isNew` 標示上期無資料的新分類）。`app/api/dashboard/route.ts` 的 `GET` 新增 `preferences`（讀取並正規化 `dashboard_layout`）、`comparison`（依 `getDashboardComparisonWindow()` 查詢當期/前期收支分類彙總並計算 `buildDashboardChangeDrivers()`，前期無交易時 `available=false`）、`portfolioHealth`（`getStockPortfolioStatus()` 擴充：以現有 FIFO 成本與目前市值比較，回傳 `unrealizedGrossPL`/`costReturnRate`/`largestHolding`/`unavailableReason`，`noHoldings`/`missingPrices`/`mixedCurrencies` 明確狀態取代虛構百分比，非追蹤大盤或年化報酬率指標）三組可加性欄位，維持 `user_id` 範圍查詢與既有欄位不變。`components/ui/dialog.tsx` 關閉按鈕定位由 `right-2` 改為邏輯屬性 `end-2`，修正 RTL 語言下位置錯誤。新增 `tests/lib/dashboardPreferences.test.ts` 與擴充 `tests/lib/dashboardInsights.test.ts`（比較期間跨年/跨月邊界、驅動因子正負號與穩定排序），`test:dashboard-preferences` 已納入 `npm test`；新增 10 語言 Web 字典與對應 mobile ARB 的個人化/比較/投資健診文案鍵值並重新產生輸出。驗證：`npm run typecheck`、`npm test`、`npm run check:i18n`、`git diff --check`、`npm run build` 全數通過。 |
| 4.91.0 | 2026-07-18 | 新增可執行的 Dashboard 待辦/驅動因子與交易頁行動裝置卡片化，附加測試與翻譯。新增 `lib/dashboardInsights.ts`（純函式，無 `@/lib/*` 別名依賴，供純 Node 測試載入）：`getHoldingMarketContribution(totalShares, currentPrice)` 判斷持股是否「已持有但無正向現價」（`unpriced`），`buildDashboardDrivers()` 由既有收入/支出分類彙總算出本月金額最高的前三名驅動因子（含 `share` 佔比）。`app/api/dashboard/route.ts` 的 `GET` 回應新增可加性欄位：`dataStatus.generatedAt`（查詢時間戳）、`dataStatus.unpricedHoldingCount`（`getStockPortfolioStatus()` 取代原 `getStockMarketValue()`，回傳 `{ marketValue, unpricedHoldingCount }`）、`attention.recurringNeedsAttentionCount`（`recurring.needs_attention=1 AND is_active=1` 計數）、`attention.uncategorizedTransactionCount`/`uncategorizedAmount`（當月 `category_id IS NULL OR ''` 的收入/支出交易），皆維持 `user_id` 範圍查詢、無 schema 變更。`app/dashboard/page.tsx` 新增「待辦提醒」（最多 3 項，含週期扣款/未分類交易/持股缺現價，導向對應目的地，未分類項目走 `categoryId=__uncategorized__` 篩選）與「本月收支排行」（Top 3 驅動因子）兩個 section，並顯示 `dataStatus.generatedAt` 的在地化查詢時間。`components/features/transactions/TransactionsClient.tsx`：`md` 以下改用完整欄位卡片列表取代表格（狀態、備註、附件、轉帳/外幣/週期/排除旗標、編輯/刪除、多選皆與桌面版等價），篩選面板在行動裝置收合為可展開面板並顯示已套用篩選數（`activeFilterCount`），桌面版篩選維持常駐；新增浮動快速新增按鈕與多選時的固定式批次操作列（行動裝置）；搜尋輸入改為 300ms 防抖（`searchDraft` state），並以 `latestLoadId` ref 忽略過期的 `load()` 回應避免舊資料覆蓋新結果；新增/編輯表單優先呈現類型/金額/分類/帳戶，日期等欄位收合於 `advancedOpen` 控制的「更多欄位」，表單驗證失敗時自動展開對應區塊；`app/api/transactions/route.ts` 新增 `categoryId=__uncategorized__` 查詢條件支援。新增 `tests/lib/dashboardInsights.test.ts`（`npm run test:dashboard-insights`，已納入 `npm test`）覆蓋 Top 3 驅動因子與持股估值（含零/負現價）情境；新增 10 語言 Web 字典與 12 語言 mobile ARB 的 Dashboard 待辦/驅動因子文案鍵值並重新產生對應輸出。驗證：`npm run typecheck`、`npm test`、`npm run check:i18n`、`git diff --check`、`npm run build`（147/147 靜態頁、exit 0）全數通過。 |
| 4.90.0 | 2026-07-18 | 已登入 Web 殼層與 `/dashboard` 使用者導向重新設計，並同步強化 Flutter App 的無障礙與視覺一致性，未變更任何財務計算或 API 契約。Web：`/dashboard` 改為單一月度現金流 hero + 可展開的收入/支出/帳戶/投資組合明細卡片，新增 `?action=add` 一次性參數讓 CTA 直接開啟既有新增交易對話框（`TransactionsClient.tsx` 處理後即從 URL 移除）；新增 `components/layout/MobileNav.tsx` 手機版底部四頁籤導覽（lg 以上隱藏，保留完整側邊欄）；`Sidebar.tsx`／`StocksTabNav.tsx` 由 `<button onClick=router.push>` 改為語意化 `<Link>` 並加上 `aria-current`；側邊欄新增 focus trap／entry／restore、Escape 關閉、背景 `inert`、RTL（`start`/`end` 邏輯屬性取代 `left`/`right`）；`AppLayout.tsx` 新增翻譯後的跳至主要內容連結與唯一 `main`/`h1` landmark；`Modal.tsx` 改為包裝 Base UI `Dialog` 以取得一致的焦點管理；`globals.css` 拆分深色模式文字強調色與純色主要按鈕色，並提高淺色模式語意色對比（primary/income/expense/success/danger 均加深），月份切換按鈕加大至 44px。Mobile：新增 `mobile/lib/theme.dart`（`AssetPilotTheme` ThemeExtension，income/expense/profit/loss/warning/stale 語意色，明暗主題各自定義）並在 `app.dart` 套用、統一按鈕最小 48x48 觸控範圍；`widgets.dart` 的 `AsyncView` 重新整理時若已有資料不再閃回 loading spinner、錯誤訊息改用 `_safeErrorMessage()` 依 `ApiException.statusCode`（401 / 連線失敗 / 一般失敗）分類且不洩漏底層例外內容、`EmptyState` 新增 title/action、`toast()` 新增 isError/isSuccess 語意配色，並全面加上 Semantics/liveRegion 供螢幕報讀器使用；`format.dart` 的 `money()` 修正貨幣代碼未 trim/uppercase 的顯示問題並改用 `NumberFormat.currency(name:)`、`signed()` 改用正確負號字元並以絕對值格式化。Web 與 Mobile 共用 i18n 新增 `shell.skipToContent` 翻譯鍵（9 語言 Web 字典 + 12 語言 mobile ARB 同步）。 |
| 4.89.3 | 2026-07-17 | 修正 App 端因後端瞬斷（504/521 閘道逾時、連線中斷、header 未接收完整）被誤判為使用者可見錯誤的問題：`ApiClient._send` 對 GET 請求的暫時性重試範圍從 502/503/504 擴大到含 521，並新增對連線層例外（`ClientException`／`TimeoutException`／`SocketException`）的單次重試（排除一次性 nonce/state 端點以免重放攻擊面問題）；同時關閉 `SentryFlutterOptions.captureFailedRequests`，避免已由 API client 處理並記錄為結構化 warn log 的失敗又被 `SentryHttpClient` 重複建立 error event。對應 Sentry issue ASSETPILOT-APP-A/B/E/F/G/H/J/K/M/N。新增對應單元測試（`mobile/test/widget_test.dart`）驗證重試判斷邏輯與 Sentry 設定。 |
| 4.89.2 | 2026-07-15 | 修正 4.89.1 新增 WorkManager 後 Android release build（R8 開啟）開啟即閃退：R8 預設規則會移除 WorkManager 內部 Room 資料庫實作類別 `WorkDatabase_Impl` 的無參數建構子，導致 `androidx.startup.InitializationProvider` 初始化 `WorkManagerInitializer` 時丟出 `NoSuchMethodException`，在 `Application`/`MainActivity` 建立前就使整個 process crash（實機 logcat 確認：Samsung Android 16，`appErrorCount=10`）。新增 `mobile/android/app/proguard-rules.pro` 保留該建構子與 `RoomDatabase` 子類別，並在 `build.gradle.kts` release buildType 明確接上 `proguardFiles`；已在 emulator 以 release build 驗證全新安裝與覆蓋安裝皆可正常啟動。 |
| 4.89.1 | 2026-07-15 | 修正 Android 桌面小工具在 Flutter App 關閉後不再更新：新增 WorkManager 定期工作，以 `flutter_secure_storage` 原生端相同設定讀取 `authCookie`，在連網時重新取得 Dashboard 快照並更新月度總覽、今日支出、資產與近期交易小工具；加入登出 generation guard、401/403 清除，以及依已安裝小工具排程／取消。交易新增、編輯、刪除後亦立即重抓 Dashboard，並新增 Kotlin JSON 解析與格式化單元測試。 |
| 4.89.0 | 2026-07-14 | 交易表單幣別欄位由固定下拉選單改為自由輸入 + 建議清單（web: `TransactionsClient.tsx` 的 `<datalist>`；mobile: `transaction_form_screen.dart` 的 `Autocomplete<String>`），並新增送出前的 `^[A-Z]{3}$` 格式驗證，格式不符時擋下儲存並顯示錯誤訊息。 |
| 4.88.5 | 2026-07-09 | 相依套件例行升級：`next` `^16.2.9` → `^16.2.10`、`resend` `^6.16.0` → `^6.17.2`、`@types/node` `^26.1.0` → `^26.1.1`；`package-lock.json` 以 `npm install` 同步重生（105 個套件變動，0 個已知漏洞）。Node 24 環境下 `npm run typecheck`／`npm run build`／`npm test`（`test:tz`/`test:photo-crypto`/`test:info-board`/`check:iso`）驗證通過。 |
| 4.88.4 | 2026-07-09 | 將開發相依套件 `typescript` 從 `^6.0.3` 升級至 `^7.0.2`。TypeScript 7 不再提供 `typescript/lib/typescript.js`，但 Next.js 16.2.9 仍會檢查該路徑以載入 `tsconfig` 的 `paths` 並執行內建型別驗證，因此 `next.config.ts` 的 `typescript.ignoreBuildErrors` 改為 `true`（跳過 Next 內建型別驗證），改由明確的 `npm run typecheck`（新增 `tsconfig.typecheck.json`，`extends` 主設定並排除尚未安裝 `@playwright/test` 的 `tests/e2e`）在 `next build` 前把關；`package.json` 的 `build` script 改為 `npm run typecheck && next build --webpack`。因 Next 16 的 webpack 設定無法透過 TS7 的新版 JS API 讀取 `tsconfig.paths`，`next.config.ts` 的 webpack `config.resolve` 新增明確的 `@` alias 指向 `PROJECT_ROOT` 以維持既有 `@/*` 路徑別名運作。另新增 `@typescript/native-preview@7.0.0-dev.20260707.2` 作為 Next 16 相容性訊號，避免建置時嘗試自動安裝舊版 `typescript`；實際型別檢查仍由 `typescript@7.0.2` 執行。過程中曾誤將 `compilerOptions.baseUrl` 加入 tsconfig 作為別名修法，但 TypeScript 7 已移除 `baseUrl`（`TS5102`），已改回改用 webpack alias，教訓記錄於 `tasks/lessons.md`「2026-07-09 TypeScript 7 Removed baseUrl」。 |
| 4.88.3 | 2026-07-07 | 修正 `/finance/info-board`（滿月資訊版）在目前月份之後的月份仍顯示帳戶餘額、股票市值、收支或現金股利數字的問題。根因：`lib/fullMoonInfoBoard.ts` 的帳戶／股票餘額查詢一律以 `monthEnd(year, 11)`（12 月）為上限彙總，收支與股利查詢則以 `${year}-12-31` 為上限，與「今天」無關，導致當年度 8-12 月（尚未到達）仍被計入交易餘額與統計；頁面渲染也把未來月份的合計、淨資產、月增率顯示為 0 而非留白。修法：新增 `lib/fullMoonInfoBoardCutoff.ts` 提供 `visibleThroughMonthIndexForToday()`（依使用者時區今天算出可見月份索引）、`blankMonthsAfter()`、`isFutureMonthIndex()`；`getFullMoonInfoBoardData()` 改為 `currentPeriodForUser()` 同時回傳 `year` 與 `visibleThroughMonthIndex`，所有帳戶/股票/收支/股利彙總函式改以此索引為查詢與陣列上限；`FullMoonInfoBoardData` 新增 `visibleThroughMonthIndex` 欄位供頁面使用；`app/finance/info-board/page.tsx` 的 `change()`/`growth()`/`rowTotal()`/`sectionTotal()`/`sectionPercent()`/`rowPercent()` 改接受 `visibleThroughMonthIndex` 上限，未來月份的合計、淨資產、月增率欄位改為留白（非 0）。新增 `tests/lib/fullMoonInfoBoard.test.ts` 並納入 `npm run test:info-board`／`npm test`。 |
| 4.88.2 | 2026-07-07 | 修正 `/api/dashboard` 與 `/finance/info-board` 在既有 PostgreSQL 環境下因 `accounts`/`transactions`/`recurring`/`stocks` 資料表缺少 `currency` 欄位而 500 的問題（`column "currency" does not exist"`，Zeabur runtime log 顯示 `/api/dashboard` 連續多次報錯，對應 `getBankBalanceTwd()` 逐帳戶呼叫 `calcBalance()` 時對每個帳戶各報一次錯）。根因：這四張表的 `CREATE TABLE` 定義皆含 `currency TEXT DEFAULT 'TWD'`，但既有表 ALTER 相容清單從未補上這個欄位，導致既有資料庫（非全新建表）持續缺欄位，與前一版 `avg_cost` 同一類缺漏。修法：`lib/db.ts` `_runMigrations()` 新增 `accounts`/`transactions`/`recurring`/`stocks` 四張表的 `alterIgnore("ALTER TABLE ... ADD COLUMN currency TEXT DEFAULT 'TWD'")` 相容遷移，補齊既有表。 |
| 4.88.1 | 2026-07-07 | 修正 `/finance/info-board` 在既有 PostgreSQL 環境下因 `stocks` 資料表缺少 `avg_cost` 欄位而 500 的問題（`column "avg_cost" does not exist`，Zeabur runtime log 2026-07-07T04:18:18Z）。根因：`lib/db.ts` 的 `CREATE TABLE stocks` 已含 `avg_cost`，但既有表 ALTER 相容清單只補了 `current_price`/`stock_type`/`delisted`，漏了 `avg_cost`，導致既有資料庫（非全新建表）缺這個欄位。修法：`lib/db.ts` `_runMigrations()` 新增 `alterIgnore("ALTER TABLE stocks ADD COLUMN avg_cost REAL DEFAULT 0")` 補齊既有表；同時 `lib/fullMoonInfoBoard.ts` 的 `buildStockRows()` 移除未使用的 `avg_cost` 欄位查詢（股票市值運算本就只用 `current_price`/`stock_transactions`/`currency`，不依賴 `avg_cost`），改用最小欄位集合避免同類欄位缺漏再次觸發整頁 500。 |
| 4.88.0 | 2026-07-07 | 新增 `/finance/info-board`「滿月資訊版」頁面：以電子表格式版面（月份為欄、分類為列）呈現全年資產市值、收入、負債、支出，並算出個人淨值與月成長率，版面設計參考 `docs/跟著柴鼠減加乘-滿月記帳法.xlsx` 的欄位配置。新增 `lib/fullMoonInfoBoard.ts` 的 `getFullMoonInfoBoardData(userId)` 聚合當前使用者本年度資料：資產＝非信用卡帳戶月底餘額（依 `accounts`/`transactions` 逐月重算並套匯率換算）+ 持股市值（`stocks` 現價 × `stock_transactions` 累積股數）；收入＝依分類彙總的收入交易 + `stock_dividends` 現金股利；負債＝信用卡帳戶月底應繳餘額；支出＝依分類彙總的支出交易，比對分類/項目名稱含「投資、股票、基金、ETF」關鍵字標記 `investment` tone。年度依使用者時區（`todayInUserTz`）當前年份決定。原頁面（前次提交）為固定示範數字，本次移除示範陣列改為即時查詢，`page.tsx` 收斂為純呈現層。導覽選單新增 `infoBoard`（顯示文字「資訊版」）多語系鍵值。 |
| 4.87.0 | 2026-07-02 | Android 桌面小工具第二批 + 尺寸規格統一。新增三個 `AppWidgetProvider`（`mobile/android/.../AssetPilotWidgets.kt`）：`TodayExpenseLargeWidgetProvider`（今日花費大版，4×4，共用 `readDashboard()` 的 `todayExpense`/`period`/`updatedAt`）、`RecentTransactionsWidgetProvider`（近期交易，4×4，最多 5 列 title/subtitle/amount，tone 上色綠/紅/灰）、`RecurringBillReminderWidgetProvider`（週期帳單提醒，4×4，最多 5 列 title/detail/amount/date，status 上色逾期/三天內/之後），皆加入 `updateAllWidgets()`；對應新增 layout、xml provider-info、`strings.xml` 與 AndroidManifest `<receiver>`。資料流：近期交易沿用既有 `updateDashboard` 通道，`AppWidgetSync.updateDashboard()` 追加 `recentCount`/`recentTitle$i` 等欄位（取 `Dashboard.recent` 前 5 筆）；週期帳單提醒新增 MethodChannel method `updateRecurringReminders`（`MainActivity` handler + `writeRecurringReminders`/`readRecurringReminders`），Dart 端 `AppWidgetSync.updateRecurringReminders()` 由 `Recurring`（active+expense，`_nextRecurringDate` 依 daily/weekly/monthly/yearly 推算下次扣款）與 `Account`（credit_card 未繳金額 `_creditCardPaymentReminder`）合併排序後寫入，於 `DashboardScreen._load()` 與 `RecurringScreen._load()` 觸發。尺寸規格統一：8 個 provider-info 一律規範為 2×2（`minWidth/minHeight=110dp`）或 4×4（`250dp`），並補 `targetCellWidth/Height`（API 31+ 格線吸附）；`widget_today_expense_info.xml` 由不規則 2×1（`minHeight=56dp`、`resizeMode=horizontal`）改正規 2×2，`widget_today_expense.xml` 還原被壓縮的字級/內距與副標可見性。 |
| 4.86.0 | 2026-07-02 | Android 桌面小工具（App Widget）第一批：新增 `MonthlyOverviewWidgetProvider`（本月收支總覽，2×2，含 income/expense/net 與支出占收入比例 ProgressBar）、`QuickTransactionWidgetProvider`（快速記帳，「＋記一筆」+ 餐飲/交通/購物捷徑）、`TodayExpenseWidgetProvider`（今日花費，2×1，顯示 Dashboard.todayExpense）三個 `AppWidgetProvider`（`mobile/android/.../AssetPilotWidgets.kt`），對應 layout/drawable/xml provider-info 與 `strings.xml`、AndroidManifest `<receiver>`。資料流：Dart 端 `mobile/lib/app_widget_sync.dart` 的 `AppWidgetSync` 透過 MethodChannel `assetpilot/widgets` 將 `Dashboard` 快照（含 twd 格式化字串、支出進度、更新時間）寫入原生 SharedPreferences（`assetpilot_widgets`），由 `MainActivity` handler 寫入並刷新所有 widget；`DashboardScreen._load()`、`TransactionFormScreen._refreshDashboardWidgets()` 儲存交易後同步，`ApiClient._clearAuth()` 登出時 `clearDashboard()` 清快照。快速記帳走 `assetpilot://transaction/new?category=<food\|transport\|shopping>&source=widget` deep link（Manifest 新增 host=transaction pathPrefix=/new intent-filter），`app.dart` `_handleIncomingLink` 帶入 `TransactionFormScreen(initialType:'expense', initialCategoryShortcut:...)`，`_applyInitialCategoryShortcut()` 依捷徑對應父/子分類。Review 修正：`transaction_form_screen.dart` `_type = initialType!`（Dart 不因 `==` 字面值比較收窄 nullability 的 invalid_assignment 編譯錯誤）；`app.dart` 深連結去重由長存 SharedPreferences 改為 `await` 前同步設定的記憶體旗標 `_openingDeepLink`，修正同分類捷徑取消後於同一 widget 更新週期內無法重複點擊記帳的問題。 |
| 4.85.0 | 2026-07-01 | Turnstile 人機驗證擴大覆蓋範圍：`app/api/auth/google/route.ts`、`app/api/auth/line/authorize/route.ts`、`app/api/auth/line/state/route.ts`、`app/api/auth/passkey/login/route.ts` 皆新增 `getTurnstileSiteKey()` + `verifyTurnstileToken()` 檢查（原僅 `app/api/auth/login/route.ts` 密碼登入有此防護）。`lib/lineOAuthState.ts` 的 `issueLineOAuthState()`/`consumeLineOAuthState()` 改為 `consumeLineOAuthStateEntry()`，state entry 附帶 `flow` 與 `turnstileVerified` 欄位，於 `/api/auth/line` callback 消費 state 時強制檢查 `turnstileVerified`（僅 login flow，避免帳號連結 link flow 誤擋），防止繞過 authorize/state 端點的驗證直接呼叫 callback。前端 `app/login/page.tsx`、`app/app/passkey-login/page.tsx` 與行動端 `mobile/lib/{api_client,google_auth,line_auth,passkey_auth}.dart`、`mobile/lib/screens/login_screen.dart` 同步傳遞 turnstile token。另升級相依套件：`lucide-react` `1.22.0→1.23.0`、`@types/node` `24.13.2→26.1.0`（大版本更新，`tsc --noEmit` 驗證無新增錯誤；`engines.node` 仍鎖定 `>=24.0.0 <25`，型別與 runtime 版本不完全一致但無相容性問題）。`mobile/pubspec.yaml` 的 `intl` 因 `flutter_localizations` SDK 鎖定 `0.20.2`，維持不變。 |
| 4.84.3 | 2026-07-01 | 行動版 `api_client.dart` 的 `_send()` 對 GET 請求新增一次性重試：遇 502/503/504 閘道逾時時延遲 2 秒重試一次（見 Sentry ASSETPILOT-APP-A/B/C/D：`/api/config`、`/api/dashboard`、`/api/auth/google\|line/state` 等端點瞬斷），非 GET 或重試後仍失敗則維持原行為。同時升級 npm（`adm-zip` `0.5.17→0.5.18`、`lucide-react` `1.21.0→1.22.0`、`nodemailer` `9.0.1→9.0.3`、`sharp` `0.35.2→0.35.3`、`tailwindcss`/`@tailwindcss/postcss` `4.3.1→4.3.2`、`postcss` `8.5.15→8.5.16`）與 Flutter（`fl_chart` `0.69.2→1.2.0`、`app_links` `6.3.2→7.2.0`、`flutter_secure_storage` `9.2.2→10.3.1`、`package_info_plus` `8.3.1→10.2.0`）相依套件至最新相容版本。 |
| 4.84.2 | 2026-06-28 | 行動 App 套件相容性維護：`mobile/pubspec.lock` 於既有 constraints 內升級 app_links_platform_interface 2.0.2 → 2.0.3、path_provider_linux 2.2.1 → 2.2.2、path_provider_platform_interface 2.1.2 → 2.1.3、shared_preferences_android 2.4.25 → 2.4.26、webview_flutter 4.13.1 → 4.14.0；未調整 direct dependency constraints，major candidates 保留人工評估。 |
| 4.84.1 | 2026-06-28 | 登入頁 Turnstile 多語化與 UX 修正：`app/login/page.tsx` 新增 `turnstileLanguage`（從 `useT().locale` 衍生）並傳入 `window.turnstile.render()` 的 `language` 選項；useEffect 補 cleanup 函式（`turnstile.remove` + reset token），防止頁籤切換後 widget 殘留；提交時驗證失敗改以 `scrollIntoView` 提示使用者；登入按鈕 `disabled` 移除 `turnstileEnabled && !turnstileToken` 條件，改在 submit handler 做驗證。`app/api/auth/login/route.ts` 將 `isTurnstileConfigured()` 改為 `getTurnstileSiteKey()`；引入 `localeFromAcceptLanguage` + `getTranslator`，Turnstile 驗證失敗錯誤訊息改依 `Accept-Language` header 回傳本地化文字。 |
| 4.84.0 | 2026-06-28 | login_audit_logs / login_attempt_logs / login_sessions 三個資料表新增 device_id TEXT DEFAULT '' 欄位（alterIgnore migration）；recordLoginAudit / recordLoginAttempt 從 X-AssetPilot-Device-Id header 提取 device ID 寫入 device_id 欄；createLoginSession 同步寫入 device_id；listLoginSessions 回傳 deviceId 欄位；GET /api/user/login-audit 回傳 deviceId；data_safety_export.csv PSL_DEVICE_ID 的 PSL_APP_FUNCTIONALITY 更新為 true。 |
| 4.83.0 | 2026-06-28 | i18n 單一來源化（Shared i18n Source of Truth）：新增 `shared/i18n/locales.json`（locale 元資料：id、arbLocale、tsFile、htmlLang、dir、label、androidTag、flutter、matchPrefixes）與 10 個 ARB 字典（`shared/i18n/app_*.arb`）為唯一來源；`tools/generate-shared-i18n.mjs` 負責產出：(1) `lib/i18n/generated/config.ts`（GENERATED_LOCALES、GENERATED_HTML_LANG、GENERATED_HTML_DIR、GENERATED_LOCALE_LABELS、GENERATED_LOCALE_PREFIX_ALIASES、GENERATED_DEFAULT_LOCALE）、(2) `mobile/lib/generated/app_locales.dart`（kSupportedAppLocales、kAppLocaleLabels、kDefaultAppLocale、kLocalePrefixAliases）、(3) `mobile/lib/generated/shared_translations.dart`（各 locale 翻譯常數）。`lib/i18n/config.ts` 改 import generated config；`mobile/lib/l10n.dart` 改 import generated constants，`normalizeAppLocale` 改為 alias table 驅動。新增 `mobile/l10n.yaml`，flutter gen-l10n 讀 shared/i18n/*.arb 產出 `mobile/lib/generated/`。`package.json` 新增 `i18n:generate` 指令（`generate-shared-i18n.mjs && flutter gen-l10n`）與 `check:i18n` 加 `--check` 旗標。CI `i18n-check.yml` 擴展：setup Flutter → `npm run i18n:generate`（重生） → `git diff --exit-code` drift check → 靜態 Web key check（`t('...')` in app/components/lib） → 靜態 Flutter key check（`trKey('...')` in mobile/lib） → flutter gen-l10n 驗證。 |
| 4.82.0 | 2026-06-27 | i18n 品質防護：新增 `tools/check-i18n-parity.ts` CI gate（(A) 9 本字典 vs zh-TW leaf 鍵集對齊 —— 缺鍵/多鍵皆 fail；(B) 掃 app/components/lib 靜態 `t('字面值')` 驗證存在於 zh-TW，模板字串略過）；串進 `npm test` 與新 workflow `.github/workflows/i18n-check.yml`（零 npm install）。`lib/i18n/translate.ts` 新增 `I18nKey = DotPath<Dictionary>`，`TranslateFn` 改成 `I18nKey | (string & {})` 給 IDE 靜態鍵補全同時保留動態鍵相容。 |
| 4.81.0 | 2026-06-27 | i18n 擴展至 10 種語言（zh-TW、zh-CN、en、es、ar、fr、hi、pt-BR、ru、ko）。新增 `lib/i18n/dictionaries/` 下 ar/es/fr/hi/ko/pt-BR/ru/zh-CN 八個字典檔；`lib/i18n/config.ts` 擴充 `LOCALES`、`HTML_LANG`、`HTML_DIR`（阿拉伯文 RTL）、`LOCALE_LABELS`、`normalizeLocale`；新增 `lib/i18n/localeTag.ts`；新增 `tools/check-i18n-coverage.mjs`。行動端：`mobile/lib/l10n.dart` 新增 `supportedAppLocales`、`appLocaleLabels`、`normalizeAppLocale`、`flutterLocaleFor`、`appIntlLocaleTag`、MethodChannel `assetpilot/locale` 橋接 `AppCompatDelegate.setApplicationLocales`；`pubspec.yaml` 加入 `flutter_localizations`；`app.dart` 加入 `supportedLocales`、`localizationsDelegates`；`format.dart` 改用 `appIntlLocaleTag()` 動態 locale；`settings_screen.dart` 語言選單改用 `appLocaleLabels`；`AndroidManifest.xml` 加入 `AppLocalesMetadataHolderService`（兼容 API < 33）；`locale_config.xml` 補 10 種 locale 宣告；`MainActivity.kt` 實作 `assetpilot/locale` channel。 |
| 4.80.1 | 2026-06-27 | i18n 補強：`middleware.ts` 將 `/api/i18n/locale` 加入 `PUBLIC_PATHS`，使語言偏好 API 在未登入狀態下可存取，登入頁與公開頁即可正確套用語言；`mobile/android/app/src/main/AndroidManifest.xml` 新增 `android:localeConfig="@xml/locale_config"`，並新增 `res/xml/locale_config.xml` 宣告支援 `zh-Hant-TW` 與 `en`，Android 13+ 每個應用程式語言設定生效。 |
| 4.80.0 | 2026-06-27 | 網頁版全面 i18n 支援（繁體中文 ＋ 英文）。新增 `components/i18n/PublicLanguageSwitcher.tsx`（公開頁語言切換器，寫 `/api/i18n/locale` Cookie）、`lib/i18n/publicLegalContent.ts`（隱私政策/服務條款多語內容）、`components/public/LegalDocument.tsx`（共用法律文件渲染元件）。`lib/i18n/dictionaries/en.ts` 與 `zh-TW.ts` 大幅擴充，涵蓋全部功能頁（accounts/budget/categories/data-transfer/recurring/reports/settings/stocks/transactions）、儀表板、公開頁（home/privacy/terms）及 auth 區塊的所有介面字串。所有 Client 元件改以 `useT()` hook 取翻譯；`app/layout.tsx` 改用 `generateMetadata()` 動態輸出 i18n 標題與描述；儀表板月份改以 `Intl.DateTimeFormat` 依語系格式化；`Toast.tsx` aria-label 改為 `"Close"` 以符合多語環境。`mobile/android/settings.gradle.kts` 補 gradle-daemon-jvm.properties 設定。 |
| 4.79.1 | 2026-06-27 | 行動 App 支援 Android 15（targetSdk 35）強制 edge-to-edge：main.dart 啟動時 `SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge)` 並將狀態列/導覽列設透明、關閉 systemNavigationBarContrastEnforced（取代已棄用的 setStatusBarColor/setNavigationBarColor）；各編輯用 modal bottom sheet（accounts/budgets/categories/recurring/report_schedule/stocks(含股票/股利/交易)/transactions 篩選/security 變更密碼）加入 `useSafeArea: true`，使表單底部按鈕避開系統導覽列，既有 viewInsets 鍵盤內距不重複計算。主畫面 Scaffold/AppBar/NavigationBar 與 transaction_form（已用 padding.bottom）原即正確處理 insets。 |
| 4.79.0 | 2026-06-27 | 多項強化：(1) 儀表板支出/收入分類新增父分類佔總額百分比（小數一位），WEB（app/dashboard/page.tsx 的 percentLabel）與 APP（dashboard_screen.dart 圖例）皆實作；(2) 統計報表 ReportsClient.tsx 圓餅圖加入資料指紋比對，10 秒輪詢資料未變時跳過 Chart 重建，消除閃爍；(3) 登入裝置記錄：login_audit_logs/login_attempt_logs 新增 user_agent 欄，loginHelpers.ts 新增 describeDevice() 解析 UA，admin/user login-audit API 回傳 device，AdminClient 與 AccountSettingsClient 與 mobile security_screens 顯示，mobile api_client 送出 AssetPilotApp UA；(4) 全部使用者登入紀錄前端新增 USER 與日期區間篩選；(5) 一般（唯讀）管理員：users 新增 admin_role 欄（'super'/'readonly'），requireAdmin 依 HTTP 方法擋下唯讀管理員的變更操作、新增 requireSuperAdmin 用於匯出端點（data-audit/export、database/export），serverAuth/apiHelpers 回傳 isSuperAdmin，AdminClient 依 canWrite 隱藏/停用寫入與匯出控制並提供角色指派 UI；(6) 資料稽核詳記敏感操作：auditHelpers.ts 新增 auditSensitiveAction()，於建立/刪除帳號、角色變更、重設密碼、系統設定、稽核清空、登入紀錄刪除、憑證部署/刪除、伺服器時間、帳號自助刪除/改密碼等處寫入稽核，稽核表新增詳情與 IP 欄。 |
| 4.78.2 | 2026-06-27 | 修正當頁收支統計計算錯誤：TransactionsClient.tsx 的 pageTotals reducer 原本將 transfer_in 計入 income、transfer_out 計入 expense，導致轉帳交易被誤計為收支；改為僅 type==='income' 進 income、type==='expense' 進 expense，轉帳不納入統計。 |
| 4.78.1 | 2026-06-27 | 相依套件升級至最新版（皆為同主版本 minor/patch，無破壞性變更）。`typescript` `5.9.3 → 6.0.3`、`@types/node` `22.19.17 → 24.13.2`（對齊 Node 24 runtime，連帶 `undici-types` `6.21.0 → 7.18.2`）、`next` `16.2.6 → 16.2.9`、`react`/`react-dom` `19.2.5 → 19.2.7`、`@types/react` `19.2.14 → 19.2.17`、`sharp` `0.35.0 → 0.35.2`、`pg` `8.21.0 → 8.22.0`、`resend` `6.12.2 → 6.16.0`、`lucide-react` `1.14.0 → 1.21.0`、`@base-ui/react` `1.4.1 → 1.6.0`、`tailwindcss`/`@tailwindcss/postcss` `4.2.4 → 4.3.1`、`tailwind-merge` `3.5.0 → 3.6.0`、`decimal.js` `10.4.3 → 10.6.0`、`jsonwebtoken` `9.0.2 → 9.0.3`、`@passwordless-id/webauthn` `2.3.5 → 2.4.0`、`autoprefixer` `10.5.0 → 10.5.2`、override `postcss` `8.5.14 → 8.5.15`、`uuid` `14.0.0 → 14.0.1`。`tsconfig.json` 無須調整（未用到 TS 6.0 移除的舊選項）。`package-lock.json` 以 `npm install --package-lock-only` 重生，保留 sharp 全平台 optional 二進位（linux 條目完整）。本機 tsc／Docker 不可用，型別與 build 驗證靠 CI docker-publish。 |
| 4.78.0 | 2026-06-27 | 交易清單新增當頁收支合計統計。`TransactionsClient.tsx` 加入 `pageTotals` reducer，對當頁 `txs` 陣列累計 income（type=income/transfer_in）與 expense（type=expense/transfer_out）金額，並計算 `pageNet`。UI 以三欄 `.tx-page-summary` 格線顯示當頁收入、支出、淨收支，左邊框色分別對應 `--income`/`--expense`/`--net` CSS 變數；`pageNet < 0` 時淨收支加 `−` 前綴並套 `amount-expense` 樣式。`app/globals.css` 新增 `.tx-page-summary*` 規則，手機版（max-width: 640px）改為單欄直排。 |
| 4.77.1 | 2026-06-24 | 修正股票定期定額與股票交易費用自動計算。①新增 `lib/stockRecurringHelpers.ts`，將原本僅存在於 `app/api/stock-recurring/process/route.ts` 的處理流程抽成共用 helper，手動執行端點、登入後背景觸發與 `requireAuth()` 每日檢查皆呼叫同一邏輯；`lib/apiHelpers.ts` 新增 per-user/day/version 快取與 in-flight 防重，若處理結果有 skipped 會清除快取，讓暫時查不到價格的排程可在同日下一次請求重試。②`app/api/auth/login/route.ts` 原本動態 import `lib/stockHelpers` 並呼叫不存在的 `processStockRecurring`，改為呼叫 `processStockRecurringForUser()`，補回登入後自動執行股票定期定額。③定期定額計算改用 `todayInUserTz()`，避免 UTC 日期落差；休市日維持順延至下一交易日；產生交易仍用 `recurring_plan_id + period_start_date` 唯一索引去重。④`lib/db.ts` 補齊 `stock_recurring` 現行 API 實際使用欄位（`amount`、`frequency`、`start_date`、`account_id`、`note`、`last_generated`、`updated_at`），保留舊欄位並遷移 `freq/next_date/shares*price` 至新欄位，讓新環境與舊資料庫都可建立與執行股票定期定額。⑤股票交易 POST/PUT 端點改為未提供 `fee` 時依 `stock_settings` 自動計算手續費，賣出且未提供 `tax` 時依股票類型自動計算證交稅；有提供數值則視為手動覆寫並驗證不可為負或非數字。⑥Web `StockTxClient` 空白手續費／交易稅欄位不再送成 0，placeholder 顯示「自動計算」，買進時不送隱藏的交易稅欄位。驗證：`npm test` 通過；`node node_modules/typescript/lib/tsc.js --noEmit` 仍受既有 e2e 測試缺 `@playwright/test` 型別阻擋，非本次改動造成。 |
| 4.77.0 | 2026-06-22 | 行動 App 新增完整英文在地化。新增 `mobile/lib/l10n.dart`：以 `ValueNotifier<String> appLocale`（預設 `zh-TW`）持有當前語系，`loadAppLocale()` 於啟動時讀 `SharedPreferences` 的 `appLocale` 鍵，無值時依 `PlatformDispatcher.instance.locale.languageCode` 自動判定（`en`→英文，其餘→`zh-TW`）；`setAppLocale()` 寫回偏好並更新 notifier。翻譯採「中文原文當 key」策略以利逐畫面漸進遷移：`tr(source)` 中文時直接回傳原文、英文時查 `_en` 字典，未命中再經 `_translateDynamic()` 以一組 RegExp 處理含參數字串（如 `^(\d+) 號$`、`^上次寄送 (.+)$`、`^已更新語言：(.+)$` 等），最後回退原文；另有 `trPair(zh, en)` 供行內二選一。`mobile/lib/app.dart` 的 `MaterialApp` 外層加 `ValueListenableBuilder<String>(valueListenable: appLocale)`，依語系設定 `locale: Locale('en')` 並於切換時重建整棵樹。`settings_screen.dart` 的 `_pickLanguage()` 除呼叫既有 `ApiClient.setLanguage()`（影響通知與網頁版）外，新增 `setAppLocale(picked)` 使 App UI 本身同步切換；語言列說明由「語言（影響通知與網頁版）」改為「語言（APP、通知與網頁版）」。各畫面（accounts／budgets／categories／changelog／dashboard／login／more／onboarding／recurring／register／report_schedule／reports／security／settings／stock_settings／stocks／transaction_form／transactions 等）顯示字串改以 `tr()` 包裝；多處 `const` 因 `tr()` 在執行期求值而移除。中文維持來源語言，使用者既有資料不因語系切換被改寫。本機無法編譯，驗證靠 CI android-apk。 |
| 4.76.6 | 2026-06-22 | 行動版補強 Sentry 效能監控（先前 4.76.x 僅有錯誤／崩潰擷取與 `tracesSampleRate=0.2`，但缺導覽與 HTTP 自動埋點，實質收不到效能數據）。①`mobile/lib/app.dart` 的 `MaterialApp` 加上 `navigatorObservers: [SentryNavigatorObserver()]`，為每次畫面導覽建立交易並量測 TTID／slow-frozen frames。②`mobile/lib/api_client.dart` 的 `_send` 將 `http.Client()` 以 `SentryHttpClient(client: …)` 包裝，為每個 API 請求產生 `http.client` span 與麵包屑（方法／路徑／狀態碼／耗時）；`captureFailedRequests` 預設擷取 5xx 為事件。③隱私防護：`SentryHttpClient` 預設會把 query string 記進 span（`http.query`）、麵包屑與失敗請求事件（`request.queryString`），對財務 App 屬機敏（搜尋關鍵字）。於 `mobile/lib/sentry_config.dart` 新增 `beforeBreadcrumb`（移除 http 麵包屑 `http.query`/`http.fragment`）、`beforeSendTransaction`（移除各 span `http.query`/`http.fragment`，因 span 已 finish 故直接操作 `data` 即時 map），並把既有 `beforeSend` 改為直接清 `request.queryString`/`fragment`（避免已 deprecated 的 `copyWith`）；認證 Cookie 因 `sendDefaultPii=false` 不被記錄。API 簽名對照本機 pub cache `sentry(_flutter) 9.22.0` 原始碼確認；`flutter analyze` 三檔僅餘既有 `unmask` 實驗性警告、無新增問題；CI 無 analyze 步驟、build APK 驗證。 |
| 4.76.5 | 2026-06-22 | 修補容器映像 Trivy 排程掃描失敗（CVE-2026-12151，HIGH）。Trivy 在 `usr/local/lib/node_modules/npm/node_modules/undici@6.25.0` 偵測到 undici DoS（unbounded memory，fixed in 6.27.0/7.28.0/8.5.0）；該 undici 並非本專案相依（`package-lock.json` 僅有 `undici-types`），而是 `node:24-alpine` 基底映像所附 npm 的 vendored 副本，上游 npm 尚未隨基底映像更新。Next.js standalone 入口 runner 階段僅執行 `node server.js`，執行期完全用不到 npm，故於 `Dockerfile` runner 階段 `apk upgrade` 後新增 `rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx`，徹底移除該套件與其漏洞元件、同時縮小攻擊面。`tools/*.ts` 內 `npm run` 字樣僅為 host 端入口註解，container 不依賴。本機無法 build，驗證靠 CI Trivy 重跑。 |
| 4.76.4 | 2026-06-22 | 修補 nodemailer 兩項 Dependabot 資安告警：GHSA-p6gq-j5cr-w38f（message-level `raw` 選項繞過 `disableFileAccess`/`disableUrlAccess`，可達任意本機檔案讀取與 full-response SSRF）與同源的 GHSA-wqvq-jvpq-h66f（`jsonTransport` 於訊息正規化階段同樣繞過該兩旗標）。上游於同一 commit 修復、釋出於 9.0.1。`package.json` 將 `nodemailer` 由 `^8.0.9` 升至 `^9.0.1`，`package-lock.json` 同步解析至 `9.0.1`（integrity 更新）。v9.0.0 唯一破壞性變更為「遠端內容抓取（attachment href/path）、OAuth2 token endpoint、HTTP/HTTPS proxy CONNECT」改為預設驗證 TLS 憑證；本專案唯一消費者 `lib/emailService.ts` 僅以 `createTransport({host,port,secure,auth})` + `sendMail({from,to,subject,html})` 寄信，未使用 `raw`、attachments、`jsonTransport`、OAuth2 或 proxy，故漏洞路徑原本即不可達、v9 破壞性變更亦不影響；屬預防性升級。本機 node_modules 不完整無法跑 build／tsc，驗證靠 Docker／CI。 |
| 4.76.3 | 2026-06-18 | 行動版修兩支 release-only 空值崩潰 + Session Replay 遮罩讓 App 自身圖示可見。①Sentry `ASSETPILOT-APP-2`（`TypeError: Null check operator used on a null value`，culprit `_WidgetsAppState._onUnknownRoute`）：`mobile/lib/app.dart` 的 `MaterialApp` 僅設 `home:`、無具名路由／`onGenerateRoute`／`onUnknownRoute`，OS／深層連結在背景推送未知路由時，框架走到 `_onUnknownRoute` 執行 `widget.onUnknownRoute!(settings)`，release 模式 assert 被移除故 `!` 對 null 取值崩潰。補上 `onUnknownRoute: (settings) => MaterialPageRoute(builder: (_) => const AuthGate(), settings: const RouteSettings(name: '/'))`，未知路由安全導回主畫面。②Sentry `ASSETPILOT-APP-4`（同型別錯誤，culprit `login_screen.dart:184` `_passkeySignIn` → `State.setState`）：堆疊崩潰幀為 `State.setState`（`_element!.markNeedsBuild()`，State 已 dispose 時 `_element` 為 null、release assert 被移除）。`_passkeySignIn`／`_googleSignIn`／`_lineSignIn`／`_submit` 的 `on ApiException`／`catch` 區塊呼叫 `setState` 缺 `mounted` 防護（Passkey 走外部瀏覽器 await 最長 5 分鐘，期間 LoginScreen 易被 dispose），catch 內拋出的新錯誤不被下層 `catch` 接住而逸出成 `PlatformDispatcher.onError`。於 `mobile/lib/screens/login_screen.dart` 四方法與 `mobile/lib/screens/register_screen.dart` `_register` 的各 catch 開頭加 `if (!mounted) return;`（`finally` 本就有 `if (mounted)`）。③`mobile/lib/sentry_config.dart` 遮罩顯式化：`options.privacy.maskAllText=true`、`maskAllImages=true`、`maskAssetImages=false`、`unmask<Icon>()`（新增 `import 'package:flutter/widgets.dart'`）。Flutter `Icon` 內部以 `RichText` 渲染、被 `maskAllText` 的 RichText 規則連帶打碼，導致 App 自身圖示在 replay 被黑掉；`unmask<Icon>()` 解除（Icon 為固定字型字符、無使用者資料）。release 未開 `--obfuscate`，型別名稱保留、泛型遮罩規則可靠生效。`options.privacy` 為 `SentryFlutterOptions` 公開欄位、`unmask<T>` 公開方法，皆對照 `sentry_flutter 9.22.0` 原始碼確認；本機無法編譯，靠 CI android-apk 驗證。 |
| 4.76.2 | 2026-06-17 | 行動版補上實際 Sentry Logs 埋點（先前 4.75.0 僅 `enableLogs=true` + `more_screen` debug 測試，正式版幾乎不送 log）。`mobile/lib/api_client.dart` 新增 `import sentry_flutter`、`_logPath()`（記錄端點時去除 query string，避免上傳 `?keyword=` 等搜尋字）與 `_asCount()`（容忍 num/List 兩形態）。中央 `_send()` 三個失敗點各埋 log：連線層例外 `Sentry.logger.error`（method/path/error.type）、401 `info`（path）、非 2xx `warn`（method/path/status_code）；`login()` 加連線失敗 `error`、非 200 `warn`、成功 `info`（attr `auth.method=password`，絕不記 email/密碼）；`logout()` 加 `info`；`syncStockDividends()` 改 async、成功後 `info` 記 synced/skipped/errors 筆數。隱私：僅記 method、去 query 路徑、狀態碼、例外型別與筆數，不含 body/cookie/金額/個資。API 簽名 `Sentry.logger.warn(String,{attributes:Map<String,SentryAttribute>})` 經查 `sentry 9.22.0` 原始碼確認；本機無法編譯，靠 CI android-apk 驗證。 |
| 4.76.1 | 2026-06-17 | 行動版 AAB 改為僅打包 ARM ABI，消除 Google Play 審查 x86_64 模擬器的 SIGABRT 誤報。`.github/workflows/android-apk.yml` 的 `flutter build appbundle --release` 加入 `--target-platform android-arm,android-arm64`，不再產生 x86_64 split。Sentry issue `ASSETPILOT-APP-1`（native `SIGABRT: Abort`，thread `SentryExecutorServiceThreadFactory-0`）11 筆事件全來自同一台偽報 OnePlus8Pro 的 x86_64 模擬器（288×448、2 核、archs 以 x86_64 為首），分三叢集對應 4.74.0/4.75.1/4.76.0 三次發版上傳後幾分鐘內、每 user 崩一次，無任何真實 arm64 裝置受影響；根因為 Sentry NDK 崩潰處理／Session Replay 的 MediaCodec 在 x86 模擬器上 abort。排除 x86_64 後審查改用 ARM 模擬器即不再誤報，AAB 體積亦縮小。`mobsf.yml` 的 `build apk`（僅供 MobSF 靜態掃描、不分發）維持全 ABI 不動。`sentry_config.dart`／`main.dart` 未改（Replay/NDK 設定保留）。 |
| 4.76.0 | 2026-06-17 | 行動版交易表單分類選擇改為父→子兩段式。`mobile/lib/screens/transaction_form_screen.dart`：新增狀態 `_parentCatId`（僅 UI，存後端仍為子分類 `_categoryId`）；新增 `_selectableParents`（依 `_selectableCats` 的 `parentId` 反查、保留 `_categories` 排序的父分類）與 `_childCatsOf(parentId)`；移除原 `_parentName()` 與單一「父 › 子」扁平 `DropdownButtonFormField`，改為父分類＋子分類兩個下拉（子分類於 `_parentCatId==null` 時 `onChanged:null` 停用並顯示 hint）。`_buildForm` 開頭同步：編輯時由子分類回推父分類、切換收支類型時清父子選擇、selected 值不在清單即清空（避免 Dropdown value 斷言）。收支類型 SegmentedButton 的 onChanged 一併重置 `_parentCatId`。儲存 payload（`categoryId`）與後端不變。web/`recurring` 未動（web 已用 optgroup 分組）。 |
| 4.75.1 | 2026-06-17 | 修正 4.75.0 行動版建置失敗（`bundleRelease` 編譯錯誤）。`sentry_flutter 9.x` 已移除 `SentryReplayOptions.maskAllText`/`maskAllImages`（8.x API），`mobile/lib/sentry_config.dart` 的 `options.replay.maskAllText/maskAllImages = true` 觸發 `The setter ... isn't defined for the type 'SentryReplayOptions'`，使 `:app:compileFlutterBuildRelease` 失敗。移除該兩行——9.x 預設即遮罩所有 Text/EditableText/RichText/Image（正是所需行為）；若日後要調整改用 `options.privacy.*`。保留 `replay.sessionSampleRate = kReleaseMode ? 0.0 : 1.0`、`onErrorSampleRate = 1.0`（此兩 setter 在 9.x 仍有效，原錯誤僅出在 mask 兩行）。web 4.75.0 不受影響（Docker image 已成功建置）。 |
| 4.75.0 | 2026-06-17 | 行動版 Sentry 監控擴充：Logs、Metrics、Session Replay。`mobile/lib/sentry_config.dart`：新增 `options.enableLogs=true`（結構化日誌，可用 `Sentry.logger`）；註記 Metrics 於 SDK >= 9.11.0 自動啟用、無需旗標（`Sentry.metrics.count/gauge/distribution`）；新增 Session Replay：`options.replay.sessionSampleRate = kReleaseMode ? 0.0 : 1.0`、`options.replay.onErrorSampleRate = 1.0`、`maskAllText/maskAllImages = true`（全程遮罩，正式版平時不錄、僅錯誤時回溯）。`mobile/lib/main.dart`：`runApp` 改包 `SentryWidget(child: const AssetPilotApp())`（Session Replay 擷取所需根節點）。`mobile/lib/screens/more_screen.dart`：debug 驗證項擴充為依序 `Sentry.metrics.count('verify_button_tapped',1)` + `distribution('verify_latency',187,ms)` → `Sentry.logger.fmt.info` → 丟 `StateError`，一鍵驗證 metrics/logs/error 三路徑。合規：`app/privacy/page.tsx` 第 2/7 節補上「發生錯誤時擷取去識別化（遮罩）畫面回溯、僅行動版」說明。AI Agent Monitoring 經評估不導入（全 repo 無任何 LLM/AI 呼叫，無可埋點對象）。無 `pubspec.yaml` 變更（`sentry_flutter ^9.22.0` 已滿足 logs>=9.0.0／metrics>=9.11.0／replay>=8.9.0）。 |
| 4.74.0 | 2026-06-17 | 行動版（Flutter）導入 Sentry 當機／效能監控。`mobile/pubspec.yaml` 新增 `sentry_flutter: ^9.22.0`；新增 `mobile/lib/sentry_config.dart`（DSN 以 `String.fromEnvironment('SENTRY_DSN')` 內嵌、可 `--dart-define` 覆寫，`environment` 依 `kReleaseMode` 標 production/development，`tracesSampleRate=0.2`，`sendDefaultPii=false`，`beforeSend` 清除 `authorization`/`cookie`/`set-cookie` 標頭避免上傳 JWT）；`mobile/lib/main.dart` 改用 `SentryFlutter.init(configureSentry, appRunner: …)` 包住 `ApiClient.init()`/`loadThemeMode()`/`runApp`；`mobile/lib/screens/more_screen.dart` 新增僅 `kDebugMode` 顯示的「驗證 Sentry 設定」項（丟 `StateError` 測試上報）。`release`/`dist` 由 `package_info` 自動帶入。合規同步：`data/data_safety_export.csv` 將「當機記錄」「診斷資料」標為收集（非分享、非暫時性、required，用途 App functionality + Analytics）；`app/privacy/page.tsx` 第 2/5/7 節補上 Sentry（僅行動版）說明並更新最後更新日期。CI symbol 上傳未納入（release 未開 `--obfuscate`，stack trace 可讀）。 |
| 4.73.2 | 2026-06-16 | 修補 nodemailer 三項 Dependabot 告警（#29/#30/#31）：OAuth2 token fetch 的 improper TLS certificate validation、List-* header comment 的 CRLF injection、jsonTransport 於 message normalization 繞過 `disableFileAccess`/`disableUrlAccess`。皆於 nodemailer 8.0.9 修補（#29 8.0.8、#30/#31 8.0.9）。`package.json` 由 `^8.0.6` 提升至 `^8.0.9`，`npm install nodemailer@8.0.9 --package-lock-only` 將 lockfile 鎖至 8.0.9，`npm audit` 0 vulnerabilities。寄信邏輯（`lib/`）未動。 |
| 4.73.1 | 2026-06-16 | 修復 GitHub Actions「Workflow does not contain permissions」(#60)。`.github/workflows/android-apk.yml` 先前未宣告任何 `permissions`，被 Semgrep `missing-workflow-permissions` 規則標記。於 `on:` 與 `jobs:` 之間補上 top-level `permissions: { contents: read }`（最小權限）：該 workflow 僅 checkout 程式碼，上傳 .aab／Google Play／S3 皆走專用 secrets 而非 `GITHUB_TOKEN`，無需任何 write scope。其餘 workflow 已有 top-level 或 job-level permissions（`docker-publish.yml` 為 job-level），不受影響。 |
| 4.73.0 | 2026-06-15 | 信用卡繳款改對應回所清償帳單 + 卡片改顯示上期帳單（WEB + App）。`lib/accountHelpers.ts` 新增 `creditCardPaymentWindow(closingDay, cycleEnd)`：回傳該帳單（結帳日=cycleEnd）的繳款窗口＝結帳日隔天～下一個結帳日（即 `creditCardStatementCycle(closingDay, cycleEnd+1天)`）。`GET /api/accounts/[id]/cycles` 每期 payment 改為 `transfer_in` 於該期 `creditCardPaymentWindow` 內加總（對應回清償的帳單），非落在繳款當下所在區間。`GET /api/accounts` 移除 `cyclePayment`，改回傳上期帳單欄位：`lastCycleStart/lastCycleEnd/lastCycleSpending`（最近一張已結帳帳單，以本期起日前一天推算）與 `lastCyclePayment`（其繳款窗口＝本期區間內 transfer_in 加總）。WEB `AccountsClient.tsx`：卡片「本期已繳」改為「上期帳單：消費 X / 已繳 Y（M/D–M/D）」，明細 Dialog 加說明字。App `models.dart` `Account` 以 `lastCycleSpending/lastCyclePayment/lastCycleStart/lastCycleEnd` 取代 `cyclePayment`；`accounts_screen.dart` 副標題「本期已繳」改「上期帳單 消費/已繳」、明細 Sheet 加說明。`StatementCycle.payment` 語意改為對應帳單（後端調整、model 不變）。`flutter analyze` 無新增問題；繳款窗口歸屬以腳本驗證通過。 |
| 4.72.1 | 2026-06-15 | 修正匯率管理更新匯率失敗：`exchange_rates` 缺 `is_manual` 欄位的 migration。`app/api/exchange-rates/route.ts`、`app/api/exchange-rates/[currency]/route.ts`、`lib/exchangeRateHelpers.ts` 的 INSERT/UPDATE/SELECT 皆引用 `is_manual`，但 `lib/db.ts` schema 從未加入該欄，Postgres 下報 `column "is_manual" of relation "exchange_rates" does not exist`。於 `_runMigrations()` alterIgnore 區塊補 `ALTER TABLE exchange_rates ADD COLUMN is_manual INTEGER DEFAULT 0`（PG runtime 翻譯為 BIGINT、冪等），啟動時自動補欄。 |
| 4.72.0 | 2026-06-15 | 信用卡新增「本期已繳」與「每期帳單明細」（WEB + App）。`lib/accountHelpers.ts` 新增 `creditCardStatementCycles(closingDay, todayStr, count)`：以「本期起日的前一天」逐輪往回推，回傳最近 count 期（最新在前、邊界連續不重疊，clamp ≤36）。`GET /api/accounts` 對每張信用卡加算 `cyclePayment`＝本期區間內 `type='transfer_in'` 金額加總（`CASE WHEN original_amount>0 THEN original_amount ELSE amount END`）。新增 `GET /api/accounts/[id]/cycles?count=N`（信用卡且已設結帳日，否則 400/404）：回傳 `{ id, name, currency, statementClosingDay, cycles:[{start,end,current,spending,payment}] }`，spending＝expense、payment＝transfer_in 各期加總。WEB `AccountsClient.tsx`：卡片加「本期已繳」一行（emerald）與「查看每期明細 ›」按鈕，開 Dialog 以表格列出各期消費/繳款（本期標記）。App `mobile/lib/models.dart` `Account` 加 `cyclePayment`、新增 `StatementCycle` model；`api_client.dart` 加 `accountStatementCycles(id,{count})`；`accounts_screen.dart` 副標題加「本期已繳」、卡片 trailing 加帳單明細 IconButton 開 `_StatementCyclesSheet`（FutureBuilder 列各期消費/已繳）。`flutter analyze` 無新增問題；帳單週期多期連續性以腳本驗證通過。 |
| 4.71.0 | 2026-06-15 | 信用卡結帳日 + 本期帳單消費補齊手機 App（WEB + App 一致）。`mobile/lib/models.dart` `Account` 新增 `statementClosingDay`（int?）、`cycleSpending`（num?）、`cycleStart`/`cycleEnd`（String?），新增 `_asNumOrNull`/`_asIntOrNull`/`_asStrOrNull` 解析並相容 snake_case key。`mobile/lib/screens/accounts_screen.dart` `_AccountForm` 信用卡區塊新增「結帳日（1~31）」`TextFormField`（驗證 1~31，空字串送 null），`_save()` 僅信用卡帶 `statementClosingDay`；帳戶列表 `ListTile` 改用 `_accountSubtitle()`：信用卡若有 `statementClosingDay` 與 `cycleSpending` 則於副標題加「本期消費 <money>（M/D–M/D）」一行（error 色、`isThreeLine`），`_md()` 將 ISO 日期轉 M/D。沿用既有 `createAccount`/`updateAccount` body 直送，後端 4.70.0 已支援、App 無需改 API。`flutter analyze` 無新增問題。 |
| 4.70.0 | 2026-06-15 | 信用卡新增每月結帳日 + 本期帳單消費統計（WEB）。`lib/db.ts` accounts 表新增 `statement_closing_day INTEGER DEFAULT NULL`（alterIgnore migration）。`lib/accountHelpers.ts` 新增 `normalizeStatementClosingDay()`（驗 1~31，否則 null）與 `creditCardStatementCycle(closingDay, todayStr)`：依結帳日與使用者當地今天算出「當期未出帳」區間＝上一個結帳日隔天～下一個（含今天）結帳日，端點皆含，遇月底天數不足（如 31 號遇 2 月）以 `Date.UTC(y, mo, 0)` clamp 到當月最後一天，跨月起點用 UTC date +1 天避免進位錯誤。`GET /api/accounts` 以 `auth.userTimezone` + `todayInUserTz` 對每張 `credit_card` 算區間並 `SELECT SUM(CASE WHEN original_amount>0 THEN original_amount ELSE amount END)`（type='expense' 且 date BETWEEN start AND end），回傳 `statementClosingDay/cycleSpending/cycleStart/cycleEnd`；`POST /api/accounts` 與 `PUT|PATCH /api/accounts/[id]` 接收驗證並寫入（非信用卡清空、空字串視為清除），`[id]` GET 一併回傳。前端 `components/features/accounts/AccountsClient.tsx`：新增/編輯表單於信用卡區塊加「結帳日（1~31）」欄位，卡片顯示「每月結帳日 X 號」與「本期消費 NT$X（M/D–M/D）」。本期消費含「不計入統計」交易（對齊帳單實際請款）。CSV 匯出/匯入暫未含此欄。 |
| 4.69.0 | 2026-06-15 | 手機 App 新增第一次使用引導教學。新增 `mobile/lib/screens/onboarding_screen.dart`：全螢幕 `PageView` 5 頁圖文輪播（歡迎／記帳／首頁／股票／更多），對齊底部導覽說明各功能位置；以 `shared_preferences` 旗標 `onboarding_seen_v1` 記錄是否看過，`OnboardingScreen.showIfFirstTime()` 第一次顯示後寫旗標、`show()` 供手動重看。`app.dart` `HomeShell` 於 `initState` 以 post-frame callback 呼叫 `showIfFirstTime`；`more_screen.dart` 新增「使用教學」入口呼叫 `show()`。純 Flutter 內建元件、Material 3 配色、無新增套件。另：README 美化（新增 App 螢幕截圖區塊與目錄項、修正亂碼行、標語改 Web + Android App）、`docs/screenshots/app/` 收錄 8 張手機截圖、`.gitignore` 改為 `docs/*` + `!docs/screenshots/` 使截圖可入庫 |
| 4.68.0 | 2026-06-14 | 交易記錄分類篩選支援父分類（WEB + App）。後端 `GET /api/transactions` 既有邏輯已支援：傳入父分類 `categoryId` 時會查 `categories.parent_id IN (...)` 展開為其所有子分類 id 再 `t.category_id IN (...)`，故本次僅改前端。WEB `components/features/transactions/TransactionsClient.tsx`：分類篩選下拉於每個父分類 `<optgroup>` 內新增可選的「<父分類>（全部）」`<option value={parent.id}>`。App `mobile/lib/screens/transactions_screen.dart`：`_load()` 改建「父分類後接其子分類」的有序清單（略過無子分類的父分類）供篩選下拉；`_TxnFilterSheet` 下拉父分類顯示粗體「<名稱>（全部）」並可選、子分類縮排顯示，選父分類即送出父分類 id；移除 `_TxnFilterSheet` 不再使用的 `catName` 參數 |
| 4.67.2 | 2026-06-14 | 修正 Flutter App 首頁「支出分類」圓餅圖統計邏輯，對齊 WEB。`/api/dashboard` 的 `catBreakdown` 回傳的是子分類（葉節點）層級節點、各自帶 `parentId`/`parentName`/`parentColor`（由 `lib/dashboardHelpers.ts` `buildCategoryAggregateNodes` 產生），WEB `app/dashboard/page.tsx` `groupCategoryRows()` 會依父分類彙總後再呈現；App 端 `mobile/lib/models.dart` 的 `CatNode` 先前未解析 parent 欄位，`dashboard_screen.dart` `_CategoryPie` 直接把每個子分類當成獨立扇區（取 top 8），與 WEB 不一致。修正：`CatNode` 新增 `parentId`/`parentName`/`parentColor`（fallback 規則對齊 `groupCategoryRows`），`_CategoryPie` 新增 `_groupByParent()` 依父分類彙總金額並依金額由大到小排序，扇區與圖例改為父分類層級，並移除原 top 8 截斷 |
| 4.67.1 | 2026-06-14 | 修正 Flutter App 兩項交易頁問題。**交易刪除可發現性**：原僅 `transactions_screen.dart` 的 `onLongPress` 可刪除，不易察覺；`transaction_form_screen.dart` 編輯模式 AppBar 新增刪除 `IconButton`（`_confirmDelete()` 呼叫 `deleteTransaction`，確認後 pop true），列表改以 `Dismissible`（`endToStart`，`confirmDismiss` 重用 `_delete()` 並改回傳 `Future<bool>`，刪除失敗不移除列項）支援左滑刪除，長按保留。**edge-to-edge 遮擋**：Android 15 預設 edge-to-edge，`transaction_form_screen.dart` 表單 `ListView` 底部未留安全區，致「儲存」鈕被系統導覽列遮住；底部 padding 改為 `16 + MediaQuery.padding.bottom`。`flutter analyze` 無錯誤 |
| 4.67.0 | 2026-06-14 | Flutter App 功能補齊至接近 WEB 對等，並新增使用者自助報表排程後端。**後端**：新增 `app/api/user/report-schedules/route.ts`（GET 列出本人、POST 建立）與 `[id]/route.ts`（PUT/DELETE，皆鎖 `auth.userId`），鏡像 `admin/report-schedules` 但改 `requireAuth` 並驗證擁有權，欄位含 freq/hour/minute/weekday/day_of_month/notify_email/notify_line/enabled（共用既有 `report_schedules` 表，無 schema 變更）。**App `api_client.dart`**：新增 updateRecurring、updateStock、updateStockTransaction、stock-dividends CRUD、stockSettings GET/PUT、creditCardRepayment、default/pinned currency GET/PUT、changePassword（改 raw PUT 擷取輪替後 cookie 避免本機登出）、setLanguage、sessions/revokeSession、loginAudit、passkeys/rename/delete、unlinkGoogle/Line、report-schedules CRUD；`transactions()` 補 dateFrom/dateTo/accountId/categoryId/keyword 並改送 `limit`（原誤用 `pageSize` 致只載 20 筆）。**models.dart**：`Txn.originalAmount/fxRate`、`Recurring.fxRate`、`StockTxn.stockId/note`、`Dividend.stockId/accountId/note`、`Stock.stockType`、`AppUser.googleLinked/lineLinked`，新增 StockSettings/LoginSession/LoginAuditLog/Passkey/ReportSchedule。**畫面**：`transaction_form_screen.dart` 幣別＋匯率選擇器（外幣送 originalAmount/fxRate）；`recurring_screen.dart` 支援編輯＋幣別（外幣編輯以 `amount/fxRate` 還原原幣，避免 WEB 既有雙重換算）；`transactions_screen.dart` 進階篩選 sheet＋外幣顯示改 originalAmount；`stocks_screen.dart` 持股編輯/刪除（stockType 僅變更才送，免誤觸稅額重算）、交易編輯＋選填 fee/tax（留空＝後端自動）、股利 CRUD、設定入口；新增 `stock_settings_screen.dart`、`security_screens.dart`（幣別/密碼/Passkey/綁定/裝置/登入紀錄；新增 Passkey 與帳號綁定的 ceremony 導向瀏覽器）、`report_schedule_screen.dart`；`accounts_screen.dart` 信用卡還款 sheet；`settings_screen.dart` 串接上述入口＋語言（zh-TW/en）；`dashboard_screen.dart` 外幣顯示改 originalAmount。未納入：CSV 匯入匯出、管理員後台、API Credits |
| 4.66.2 | 2026-06-13 | 修正金額輸入欄位的 `step` 限制。`TransactionsClient.tsx`（交易金額、轉帳金額）、`RecurringClient.tsx`（固定收支金額，原無 step＝預設整數）、`AccountsClient.tsx`（初始餘額）的 `<input type="number">` 由 `step="0.01"` 改為 `step="any"`，避免瀏覽器 HTML5 validity 擋下非 step 倍數的小數（如 14.115 跳「請輸入有效值，最接近的兩個有效值…」）。伺服器端依幣別進位邏輯不變；Flutter 端用十進位鍵盤無此限制 |
| 4.66.1 | 2026-06-13 | 海外手續費率單位由千分點（‰）改為百分比（%）。`lib/accountHelpers.ts` `resolveOverseasFee` 公式 `twdBase×rate/1000`→`/100`；`app/api/accounts/route.ts`、`[id]/route.ts` 驗證 `0~1000`→`0~100`、改保留 2 位小數（`Math.round(v*100)/100`）、訊息改「0~100（百分比）」。前端費用試算（`TransactionsClient.tsx`、`RecurringClient.tsx`）`/1000`→`/100`、提示 `‰`→`%`；`AccountsClient.tsx` 標籤「（千分點）」→「（%）」、卡片顯示加 `%`、輸入 `step=0.01`。App `accounts_screen.dart`/`transaction_form_screen.dart`/`recurring_screen.dart`/`models.dart` 標籤與 helper 改百分比。註：既有以千分點輸入的費率值語意改變，未自動轉換，需重新確認 |
| 4.66.0 | 2026-06-13 | 信用卡國外刷卡手續費「獨立交易」自動計算與紀錄 + 修正 App 無法設定「不計入統計」。手續費不併入原交易，而是另存為一筆 TWD 支出交易並雙向 `linked_id` 關聯。`lib/db.ts` migration：`transactions.is_fx_fee INTEGER DEFAULT 0`、`recurring.fx_fee REAL`、`recurring.exclude_from_stats INTEGER`。`lib/accountHelpers.ts` `resolveOverseasFee({userId,accountId,currency,twdBase,clientFxFee})`：client 帶 `fxFee`（含 0）→ 手動覆寫；否則「`credit_card`／`account_type='信用卡'` + 幣別≠TWD + `overseas_fee_rate>0`」時 `round(twdBase×rate/1000)`（伺服器為單一真實來源）。`lib/overseasFee.ts` `insertFeeTransaction(db,{...})`：寫入 `is_fx_fee=1`、幣別 TWD、分類同原交易、`note='國外刷卡手續費'`。`app/api/transactions/route.ts`(POST)：原交易 `fx_fee=0`/`twd_amount=base`，`type==='expense' && fxFee>0` 時建手續費列並回填 `linked_id`。`[txId]/route.ts`(PUT)：`is_fx_fee` 列回 422 `FxFeeImmutable` 禁止直接編輯；編輯原交易自動同步（建立／更新／刪除）配對手續費列。DELETE 既有 `linked_id` 連動刪除涵蓋成對刪除。list/GET 回 `isFxFee`。固定收支：`recurring` GET/POST/`[id]`PUT 收送 `fxFee`/`excludeFromStats`；`lib/recurringHelpers.ts` `processOneRecurring` 每期產生主交易 + 手續費列（同 `source_recurring_id`，無 transactions 唯一索引故可並存）。WEB `TransactionsClient.tsx`：外幣「支出」信用卡顯示可編輯「海外手續費（TWD）」（自動帶入、可覆寫 + 自動計算鈕）、手續費列標記且禁止編輯；`RecurringClient.tsx` 加「不計入統計」。App（Flutter）`models.dart`：`Account.overseasFeeRate`、`Txn.excludeFromStats`/`fxFee`/`isFxFee`、`Recurring.*`；`transaction_form_screen.dart` 加「不計入統計」開關（修復主因）+ 外幣信用卡選填手續費；`transactions_screen.dart` 手續費列點擊提示不可編輯；`recurring_screen.dart`、`accounts_screen.dart`（信用卡可設費率）同步 |
| 4.65.0 | 2026-06-12 | 多語言（i18n）基礎建設與英文介面。新增 `lib/i18n/`：`config.ts`（locale 註冊表 `['zh-TW','en']`、`normalizeLocale`、`localeFromAcceptLanguage`、`LOCALE_COOKIE`）、`dictionaries/{zh-TW,en}.ts`（zh-TW 為來源語言，型別 `Dictionary = typeof zhTW`；en 用 `DeepPartialDict<Dictionary>` 部分翻譯，缺漏鍵回退）、`translate.ts`（`createTranslator` dot-path 查詢 + `{var}` 插值，找不到回傳 key）、`getDictionary.ts`（deepMerge en 覆蓋 zh-TW 基底並快取）、`resolveLocale.ts`（cookie→Accept-Language→預設）、`userLanguage.ts`（讀寫 `user_settings.language`）。`components/i18n/I18nProvider.tsx`（client context + `useT()`）由 root `app/layout.tsx`（改 async：`resolveLocale`→`getDictionary`→設定 `<html lang>` 並注入 Provider，全站轉 dynamic render）提供；server component 可直接 `getTranslator(await resolveLocale())`。`lib/db.ts` migration `alterIgnore("ALTER TABLE user_settings ADD COLUMN language TEXT DEFAULT 'zh-TW'")`；`app/api/account/settings/language` POST（`requireAuth` → `setUserLanguage` + 寫 `locale` cookie），`components/i18n/LanguageSwitcher.tsx`（POST 後 `router.refresh()` 讓 server 重新解析）置於帳號設定頁。已英文化：登入頁 `app/login/page.tsx`（`auth.*` 含 `auth.errors.*`，全部 label/placeholder/aria/錯誤訊息 `t()`）、App 殼 `components/layout/{Sidebar,AppLayout,TopNav}.tsx`（`nav.*`/`shell.*`，模組級 `NAV_SECTIONS`/`THEME_OPTIONS`/`PAGE_TITLE_KEYS` 改用 labelKey 於 render 解析）、伺服器通知 `lib/statsEmailReport.ts`（`buildUserStatsReport`/`renderStatsEmailHtml` 新增 `locale` 參數）+ `lib/lineMessaging.ts`（`buildStatsReportFlex`/`buildExpenseReminderFlex` 新增 `locale` 參數，`notifications.*` 命名空間），由 `lib/scheduler.ts` 以 `getUserLanguage(u.id)` 帶入（排程無 request context）。純資料（金額、日期、分類名、星期字）不譯；其餘頁面內文待後續逐頁搬遷 |
| 4.64.0 | 2026-06-12 | 行動版 LINE 登入啟用 LINE auto-login + 修正 App 版本資訊頁空白，並改用單一 edit 雙軌發佈。`mobile/lib/line_auth.dart`：授權 URL 移除 `disable_auto_login=true`（改用 LINE 預設值 false），裝置已安裝/登入 LINE App 時 access.line.me 授權頁直接喚起 LINE App 一鍵授權，未安裝則 fallback 回網頁登入；`redirect_uri`（`{baseUrl}/app/line-callback`）與回呼流程不變，仍須於 LINE Developers 後台註冊 Callback URL。`Dockerfile`：runtime stage 新增 `COPY /app/changelog.json`，修正 `app/api/changelog/route.ts` 以 `readFileSync(process.cwd()/changelog.json)` 動態讀檔在 standalone 輸出不被 trace 而缺檔、加上私有 repo 令 raw.githubusercontent.com fallback 404，導致 `/api/changelog` 回 `{currentVersion:'0.0', releases:[]}`、行動端 `ChangelogScreen` 拿到空清單。`.github/workflows/android-apk.yml`：`Publish to Google Play` 由 `r0adkll/upload-google-play`（單軌）改為 `.github/scripts/play-publish.mjs`（googleapis Edits API：單一 edit 上傳 .aab 一次→指派 versionCode 至 `internal`+`alpha` 兩軌→commit 送審），`TRACKS=internal,alpha` |
| 4.63.0 | 2026-06-12 | 統計報表（Email + LINE）依週期重新設計並修正帳號刪除不完整。`lib/statsEmailReport.ts`：`periodFor('weekly')` 由「上一完整 Mon–Sun 週」改為滾動 T-7~T-1（`end=addDays(today,-1)`、`start=addDays(end,-6)`，label `過去 7 日`）；`buildUserStatsReport` 新增 `periodIncome/periodExpense/periodNet`（period 區間實際收支）、對應 `period*ChangePct`（對比 comparePeriod：日=T-2、週=T-14~T-8、月=M-2）、`sendDate`/`reportDate`/`reportWeekday`/`reportMonth`/`subject`、`periodTopCategories`（period 區間支出 Top5，月報用）。`renderStatsEmailHtml` 依 `period.kind` 分日/週/月版型：各自表頭+說明條標示涵蓋區間與寄送日，KPI 一律用 period 實際收支（lead 昨日/本週/上月）；週報加每日明細表（補滿 7 列）、日週報附本月累計、月報 Top5/交易改用報表月（M-1）資料。`lib/lineMessaging.ts` `buildStatsReportFlex` 比照（altText/表頭/banner/KPI/週每日明細/月 Top5 來源/catHeading），新增 `weekdayZh`/`addDaysYmd`。`lib/scheduler.ts` 寄信主旨改用 `stats.subject`。帳號刪除：新增 `lib/userDeletion.ts` `deleteUserCompletely(userId)`（單一可信賴流程）+ `lib/transactionAttachments.ts` `purgeUserPhotoFiles(userId)`（刪 S3 物件/本機檔 + `rm -rf uploads/transaction-photos/{userId}`）；`app/api/account/delete` 與 `app/api/admin/users/[id]` DELETE 統一改呼叫之，補齊先前兩路徑各漏的 `transaction_attachments`（含實體檔）、`login_sessions`、`line_bot_states`、`data_operation_audit_log`、`report_schedules`、`deleted_defaults`、`user_settings` 等表，並移除 `system_settings.report_schedule_user_ids` 中該使用者、`login_attempt_logs` 失敗列去識別化。後台報表排程列表新增「寄送結果」欄並於立即執行後回報成功/部分/失敗（`AdminClient.tsx`、`run-now` route 錯誤訊息強化） |
| 4.62.0 | 2026-06-12 | 交易照片靜態加密（encryption at rest，envelope/KMS 模型）：新增 `lib/photoCryptoCore.ts`（純密碼學原語，無 DB 相依、可單測）與 `lib/photoCrypto.ts`（DEK 持久化層）。主金鑰 `PHOTO_MASTER_KEY`（env，base64 32B）以 AES-256-GCM 包覆每使用者隨機 DEK，存於新表 `user_photo_keys(user_id, wrapped_dek, iv, tag, created_at)`；DEK 加密照片，密文格式 `[MAGIC "APX1" 4B][iv 12B][tag 16B][ciphertext]`。`lib/transactionAttachments.ts`：`saveLocalPhoto`/`saveS3Photo` 寫入前 `encryptPhoto`、`readTransactionAttachment` 讀出後 `decryptPhoto`（以 MAGIC 辨識、舊明文自動 fallback）、`compressExistingS3Photos` 改為 解密→`sharp` 重壓→重加密。opt-in：未設 `PHOTO_MASTER_KEY` 維持明文；備份匯出走 read（解密成明文入 ZIP）、還原走 save（重加密）天然相容；LINE webhook 上傳與帳號刪除（新增刪 `user_photo_keys`，crypto-shred）一併涵蓋。新增批次加密 `encryptExistingPhotos()` + `POST /api/admin/transaction-photos/encrypt`（`requireAdmin`、稽核），`AdminClient.tsx` 系統設定頁新增加密狀態徽章（來源 `GET /api/transactions/attachments/storage` 的 `encryptionEnabled`）與「加密既有照片」按鈕。主金鑰輪替工具 `tools/rotate-photo-master-key.ts`（npm `rotate:photo-key`，`pg` 直連、dry-run 預設、逐列驗證 unwrap 成功才寫、`BEGIN/COMMIT` 包覆、可安全重跑）。單元測試 `tests/lib/photoCryptoCore.test.ts`（12 項，含金鑰隔離與竄改偵測）併入 `npm test`。`.env.example` 登記 `PHOTO_MASTER_KEY` |
| 4.61.2 | 2026-06-11 | 行動版 OAuth 登入網頁自動關閉：`google_auth.dart`／`line_auth.dart` 的 `signIn()` 將 `launchUrl` 由 `LaunchMode.externalApplication` 改為 `LaunchMode.inAppBrowserView`（Android Custom Tab），並於 `finally` 收到回呼導回 App 後呼叫 `closeInAppWebView()` 主動關閉授權分頁（外部瀏覽器無法被程式關閉故會殘留）。另把先前只在 `google_auth.dart` 套用的 `getInitialLink()` 殘留舊回呼修正同步套到 `line_auth.dart`（啟動前記錄 `staleInitialUri`，僅當 initial link 不同時才採用），避免 LINE 登出後再登入觸發「狀態不符」。無後端變更 |
| 4.61.1 | 2026-06-11 | 修正 production build 失敗：`sharp@0.35` 的 package.json `exports` 在 `moduleResolution: bundler` 下未正確曝露型別，`lib/transactionAttachments.ts` 動態 `import('sharp')` 觸發 TS7016（找不到宣告檔）使 `npm run build` 型別檢查失敗。新增 `types/sharp.d.ts`（`declare module 'sharp';` ambient 後備，比照 `adm-zip.d.ts`/`sql.js.d.ts`）。無功能/執行期變更 |
| 4.61.0 | 2026-06-11 | 行動版隱私／安全強化（對應 Android privacy best practices）：1）移除 `AndroidManifest.xml`（main）的全域 `android:usesCleartextTraffic="true"`，改加 `android:networkSecurityConfig="@xml/network_security_config"` — 新增 `res/xml/network_security_config.xml`，`base-config cleartextTrafficPermitted="false"`，僅 `10.0.2.2`/`localhost`/`127.0.0.1` 的 `domain-config` 開放 cleartext 供本機開發。2）`application` 加 `android:allowBackup="false"` 停用雲端備份／adb backup，避免憑證外流。3）認證 JWT cookie 由明文 `SharedPreferences`（key `authCookie`）改存 `flutter_secure_storage`（`AndroidOptions(encryptedSharedPreferences: true)`，Keystore 加密）；`ApiClient.init()` 加一次性遷移（讀舊明文 → 寫入 secure storage → 移除明文，含解密失敗 try/catch 回退），`_persistCookie()` 改走 secure storage。`pubspec.yaml` 新增 `flutter_secure_storage: ^9.2.2`。無後端變更 |
| 4.60.0 | 2026-06-11 | 交易照片壓縮：行動版 `mobile/lib/screens/transaction_form_screen.dart` 的 `_pickPhotos()` 在相機 `pickImage()` 與相簿 `pickMultiImage()` 都加上 `maxWidth: 1600, maxHeight: 1600`（沿用既有 `imageQuality: 82`），由 `image_picker` 在裝置端縮圖／重編碼，行為對齊網頁版 Canvas 壓縮（最長邊 1600、JPEG 0.8）。後端新增既有 S3 照片回填壓縮：`package.json` 加入 `sharp@^0.35.0`（`next.config.ts` 設 `serverExternalPackages: ['sharp']`，`Dockerfile` runner 階段手動複製 `sharp`/`@img`/`detect-libc`/`semver`，比照 `pg`）。`lib/transactionAttachments.ts` 新增 `compressExistingS3Photos()`：掃描 `transaction_attachments` 中 `storage='s3'` 列，逐筆 `getS3Object` 取回、以 `sharp().rotate().resize(1600,1600,{fit:'inside',withoutEnlargement:true}).jpeg({quality:82})` 重編碼，僅在結果更小時 `putS3Object` 原 key 覆寫並更新 `byte_size`/`mime_type`（sharp 以動態 `import()` 延遲載入，不影響一般上傳路徑）。新增 `app/api/admin/transaction-photos/compress` POST（`requireAdmin`、`maxDuration=300`、寫操作稽核）。`AdminClient.tsx` 系統設定頁新增「壓縮 S3 既有照片」按鈕（confirm 後呼叫，回報 scanned/recompressed/skipped/failed 與節省位元組） |
| 4.59.0 | 2026-06-11 | 修正行動版 Google 登入登出後再登入失敗：`mobile/lib/google_auth.dart` 的 `signIn()` 先前在啟動瀏覽器後無條件採用 `appLinks.getInitialLink()`，而該值具持久性會回傳上一次登入殘留的回呼 URI（夾帶舊 `state`），導致第二次登入立即被舊回呼以不符的 state 完成而拋「Google 登入狀態不符，請重試」。修正為啟動前先記錄 `staleInitialUri`，啟動後僅當 initial link 與其不同（真正冷啟動回呼）才採用，否則只信任 `uriLinkStream` 的本次回呼 |
| 4.58.0 | 2026-06-11 | 行動版記帳列表標示照片張數：`mobile/lib/models.dart` 的 `Txn` 新增 `attachmentCount`（解析 API 既有的 `attachmentCount`/`attachment_count`）。`mobile/lib/screens/transactions_screen.dart` 的 `_TxnTile` 在有附件時於日期列尾顯示相片圖示與張數（主題色），與網頁版一致。後端 `/api/transactions` 本即回傳 `attachmentCount`，無後端變更 |
| 4.57.0 | 2026-06-11 | 行動版版本資訊頁：新增 `package_info_plus` 依賴讀取 App 自身 `versionName`（CI 以 `--build-name=<changelog.currentVersion>` 打包，故正式版顯示真實版號；本機 debug 顯示 pubspec 預設 1.0.0）。`mobile/lib/api_client.dart` 新增 `changelog({refresh})`（GET `/api/changelog`，`refresh:true` 帶 `?refresh=1` 強制刷新遠端分支快取）。新增 `mobile/lib/screens/changelog_screen.dart`：同時讀 `PackageInfo.fromPlatform()` 與 `/api/changelog`，以語意化版號比較（自實作 `compareVersions`）判斷 `updateAvailable`，頂部卡片顯示目前版本／可更新狀態，清單在有新版時只列高於 App 版本的 release、否則列最近 10 筆，每條變更帶中文標籤（new/improved/fixed/removed/warning），支援右上重新整理與下拉刷新（走 `refresh=1`）。`mobile/lib/screens/settings_screen.dart` 於登出上方新增「版本資訊」ListTile 導向該頁。無後端變更（沿用既有 `/api/changelog`） |
| 4.56.0 | 2026-06-11 | 行動版檢視／刪除已上傳交易照片：`mobile/lib/api_client.dart` 新增 `listTransactionAttachments(txId)`（GET `/api/transactions/{txId}/attachments`，回傳附件清單）、`deleteTransactionAttachment(txId, attachmentId)`（DELETE 同路徑下 `/{attachmentId}`），以及供 `Image.network` 載入受 Cookie 認證原圖的 `attachmentFileUrl(txId, attachmentId)` 與 `mediaHeaders()`（沿用既有 `_headers()`）。`mobile/lib/screens/transaction_form_screen.dart` 在編輯模式 `_loadRefs()` 時載入既有附件（失敗靜默略過不擋表單），於「新增照片」按鈕上方新增「已上傳照片」縮圖區：縮圖以 `Image.network`＋`mediaHeaders()` 載入，點按 `_viewExistingPhoto()` 開全螢幕 `InteractiveViewer` 檢視並可縮放、右上叉叉 `_removeExistingPhoto()` 經確認對話框呼叫 DELETE 後移除。修正先前行動版只能上傳、無法查看已上傳照片的問題。後端 list/file/delete 端點皆已存在，無後端變更 |
| 4.55.0 | 2026-06-11 | 行動版手動同步股利：`mobile/lib/api_client.dart` 新增 `syncStockDividends()`（POST `/api/stock-dividends/sync`，因後端逐年查詢含節流延遲，將逾時放寬至 120 秒，`_send()`／`_getMapFromSend()` 新增選用 `timeout` 參數）。`mobile/lib/screens/stocks_screen.dart` 的 `StocksScreen` 於「股利」分頁（index 2）的 AppBar 新增「同步股利」action（`Icons.sync`，執行中顯示共用 spinner），透過新增的 `GlobalKey<_DividendTabState>` 呼叫 `_DividendTabState.syncDividends()`：呼叫同步 API → 以 toast 回報 `synced`／`skipped` 筆數（`synced==0` 顯示「沒有新的股利可同步」）→ 有同步成功才 reload。無後端變更（沿用既有 `/api/stock-dividends/sync`，依各檔持有期間自 TWSE 抓除權息寫入股利紀錄） |
| 4.54.0 | 2026-06-11 | 行動版交易照片支援直接拍照：`mobile/lib/screens/transaction_form_screen.dart` 的 `_pickPhotos()` 改為先以 `showModalBottomSheet` 讓使用者選擇來源——「拍照」走 `ImagePicker.pickImage(source: ImageSource.camera, imageQuality: 82)` 拍單張加入；「從相簿選擇」維持原 `pickMultiImage(imageQuality: 82, limit: remaining)` 多選。仍受單筆最多 5 張上限（`remaining` 計算）約束。`image_picker` 相機在 Android 透過系統相機 intent 取像，免額外 `CAMERA` 權限，`AndroidManifest.xml` 無需變更；上傳沿用既有 `uploadTransactionPhotos()`（multipart `POST /api/transactions/{id}/attachments`），無後端變更 |
| 4.53.0 | 2026-06-11 | 行動版手動更新股價：`mobile/lib/api_client.dart` 新增 `batchFetchStockPrices()`（POST `/api/stocks/batch-fetch`）與 `batchUpdateStockPrices()`（POST `/api/stocks/batch-price`）。`mobile/lib/screens/stocks_screen.dart` 的 `StocksScreen` 改用顯式 `TabController`，於「持股」分頁的 AppBar 新增「更新股價」action（執行中顯示 spinner），透過既有 `GlobalKey<_HoldingsTabState>` 呼叫新增的 `_HoldingsTabState.updatePrices()`：批次抓 TWSE/TPEx 最新價 → 篩 `status=='ok'` 組 `{stockId,currentPrice}` 寫回 → reload，並以 toast 回報更新／失敗檔數。無後端變更（沿用既有批次查價/寫價 API） |
| 4.52.1 | 2026-06-11 | 容器安全修補：`Dockerfile` runner 階段加入 `RUN apk upgrade --no-cache`，升級 base image（`node:24-alpine`）落後的 OS 套件至 alpine repo 最新修補版，修補 Trivy 掃描回報的 OpenSSL `libcrypto3`/`libssl3` 高風險弱點（PKCS7_verify use-after-free，CVE-2026-45447），讓 `trivy.yml`（`ignore-unfixed: true`、HIGH/CRITICAL `exit-code: 1`）的容器掃描通過。另修正 `secret-scan.yml`（gitleaks）`permissions` 補上 `pull-requests: read`，解決 PR 事件下 gitleaks-action 取 PR commits 清單時 GitHub API 回 403 導致 CI 失敗。無應用程式碼變更 |
| 4.52.0 | 2026-06-11 | 股價自動更新（伺服器排程）：新增 `lib/stockPriceUpdater.ts`，由 `instrumentation.ts` 排程心跳（每 `SCHEDULER_TICK_MS` 一次）呼叫 `checkAndRunStockPriceUpdate()`；交易時段閘門限台北時間週一~五 09:00–14:00，並依 `stock_auto_update_interval_min` 節流（預設 10 分，由 `stock_auto_update_last_run` 記錄）。`runStockPriceUpdate()` 以 `SELECT DISTINCT symbol` 跨使用者去重，沿用 `twseFetchNext` 三段策略（realtime → STOCK_DAY → TPEx）經 `fetchAllWithLimit`（並發走 `TWSE_MAX_CONCURRENCY`）抓價，批次 `UPDATE stocks SET current_price WHERE symbol = ? AND COALESCE(delisted,0)=0`，僅覆寫現價不存歷史，結果寫入 `system_settings.stock_auto_update_last_summary`。`system_settings` 新增 `stock_auto_update_enabled`/`interval_min`/`last_run`/`last_summary` 四欄；`getSystemSettings()` 與 `app/api/admin/system-settings` PUT 曝露 enabled/interval；新增 `app/api/admin/stock-price-update/run-now`（管理員手動觸發，略過時段與節流）；`AdminClient.tsx` 系統設定頁加開關、間隔、狀態與「立即更新股價」按鈕。環境變數 `STOCK_AUTO_UPDATE_ENABLED`/`STOCK_AUTO_UPDATE_INTERVAL_MIN` 可覆寫 DB 設定 |
| 4.51.0 | 2026-06-11 | 行動版第三方登入擴充：新增 LINE 登入與 Passkey 登入。Flutter 新增 `mobile/lib/line_auth.dart`（開啟 LINE 授權頁 → `/app/line-callback` 回呼 → 取得一次性 ticket）與 `mobile/lib/passkey_auth.dart`（透過 `/app/passkey-login` 進行 WebAuthn）；`api_client.dart` 新增 `lineState()`/`lineLogin()`/`exchangeAppAuthTicket()`；`login_screen.dart` 依 `/api/config` 的 `lineCodeFlow`/`lineChannelId` 顯示「使用 LINE 登入」「使用 Passkey 登入」按鈕。Web 新增 `app/api/app/auth-ticket/route.ts` 與 `app/api/app/auth-ticket/exchange/route.ts`（一次性票券換認證 cookie，`exchange` 列入 `middleware.ts` PUBLIC_PATHS）、`lib/appAuthTicket.ts`、`app/app/line-callback/page.tsx`、`app/app/passkey-login/page.tsx`；`lib/lineOAuth.ts` 內建 redirect allowlist 附加 `/app/line-callback`（改為「附加」而非「覆蓋」自訂白名單）；`public/.well-known/assetlinks.json` 填入正式 App 簽章 SHA-256 指紋以啟用 App Links。mobile 各畫面套用 `dart format` 重排（無語意變更）。另新增 Google Play 上架截圖（手機 1080×1920、7" 平板 1440×2560、10" 平板 1800×3200，各 8 張）與產生器於 `mobile/assets/play-store/` |
| 4.50.0 | 2026-06-11 | 行動版交易收據附件 + 登入狀態反應式化 + Google redirect 白名單修正：Flutter 新增 `image_picker`/`http_parser` 依賴，`transaction_form_screen.dart` 以 `pickMultiImage` 選取至多 5 張照片，`api_client.dart` 新增 `uploadTransactionPhotos()`（multipart POST `/api/transactions/{id}/attachments`，依副檔名推算 `Content-Type`）、`createTransaction` 改回傳交易 JSON 以取得新建 id；`ApiClient.authState`（`ValueNotifier<bool>`）於 login/register/googleLogin/logout/deleteAccount/401 統一更新，`app.dart` 改監聽 authState 切換登入畫面（登入階段過期自動導回登入）。移除 App 內更新檢查：刪除 `mobile/lib/screens/app_update_screen.dart`、移除 `package_info_plus` 依賴與 `appVersion()`/`/api/app/version` 呼叫，並清理 `more_screen.dart`/`settings_screen.dart` 相關進入點。修正 `app/api/auth/google/route.ts` `buildGoogleRedirectAllowlist()`：`GOOGLE_OAUTH_REDIRECT_URIS` 改為「附加」而非「覆蓋」內建 fallback，避免自訂 redirect URIs 時行動版固定回呼路徑 `/app/google-callback` 被擋 |
| 4.49.1 | 2026-06-11 | 法規／合規頁面補強：`app/privacy/page.tsx` 新增「交易附件（收據相片／檔案）選配」段落、IPinfo 登入地理位置查詢揭露、處理者（SMTP／Nodemailer、Zeabur Email、Resend、MEGA S4 整檔備份）揭露，第三方服務清單補 IPinfo／郵件通道／MEGA／Google Play Integrity；`app/terms/page.tsx` 釐清官方版 vs self-hosted、新增 Android App 形式與「管理員」定義；`app/api-credits/page.tsx` 第三方登入補 LINE、身份驗證服務數 1→2、更新日期；`lib/external-apis.json` 新增 LINE Login 條目。另補齊 Play Console `data_safety_export.csv`（資料安全表單）以符實際蒐集情形 |
| 4.49.0 | 2026-06-11 | 新增 Play Integrity API（classic/nonce 流程，軟性上線）：`lib/playIntegrityVerdict.ts`（純判定邏輯，可獨立單元測試）+ `lib/playIntegrity.ts`（service account JWT bearer grant 換 OAuth2 token → `decodeIntegrityToken` → `evaluateVerdict`，全程不拋例外、未設定憑證 fail-open）+ `lib/playIntegrityNonce.ts`（一次性 TTL nonce，比照 `googleOAuthState.ts`）；新增 `GET /api/app/integrity/nonce`；`auth/login`、`auth/register`、`auth/google` route 讀 `integrityToken`/`integrityNonce`，軟模式僅記錄、`PLAY_INTEGRITY_ENFORCE=true` 時不通過回 403。Android：`build.gradle.kts` 加 `com.google.android.play:integrity:1.4.0`、`MainActivity.kt` 註冊 `assetpilot/play_integrity` MethodChannel；Flutter：`mobile/lib/play_integrity.dart` + `api_client.dart` 於 login/register/googleLogin 自動帶 token。`.env.example` 新增 `PLAY_INTEGRITY_SERVICE_ACCOUNT_JSON`/`PLAY_INTEGRITY_PACKAGE_NAME`/`PLAY_INTEGRITY_ENFORCE`。並修正 `app/api/admin/users/[id]/route.ts` 僅匯出 `DELETE`，導致前端 `apiPut('/api/admin/users/[id]', { isAdmin })` 切換管理員身分回 405（Next.js 誤報 Failed to find Server Action）的問題：新增 `PUT` handler（含最後一位管理員保護） |
| 4.48.0 | 2026-06-10 | 補齊使用者帳號自助刪除：`app/api/account/delete/route.ts` 改為密碼帳號驗密碼、OAuth-only（Google／LINE）帳號驗 `confirmEmail`（移除 Web 無法產生的 id_token 依賴與 LINE 無分支死路）；`AccountSettingsClient.tsx` 以 `Modal` 取代 `window.prompt`，依 `hasPassword` 切換驗證欄位；mobile 新增原生刪除帳號流程（`AppUser.hasPassword`、`ApiClient.deleteMyAccount()`、`settings_screen.dart` 刪除帳號項目）；`app/privacy/page.tsx` 補開發者身分、隱私聯絡信箱 `assetpilot@shao.one`、無法登入時的刪除管道、兒少聲明、HTTPS 強制與 Google 登入資料揭露以符合 Play 上架要求 |
| 4.47.4 | 2026-06-09 | `mobile/lib/screens/app_update_screen.dart` 移除硬編碼 `_currentVersion`/`_currentBuildNumber`，改用 `package_info_plus` `PackageInfo.fromPlatform()` 動態讀取，修正 App 更新畫面版本顯示恆為 1.0 的問題 |
| 4.47.3 | 2026-06-09 | `app/api/auth/google/route.ts` `buildGoogleRedirectAllowlist()` fallback 新增 `https://${APP_HOST}/app/google-callback`，修正 App Google SSO 回呼時後端 allowlist 驗證失敗（`invalid_redirect_uri`） |
| 4.47.2 | 2026-06-09 | 首頁 `app/page.tsx` 主標語改為兩行（插入 `<br />`），移除行尾逗號與句號 |
| 4.47.1 | 2026-06-09 | `android-apk.yml` CI workflow 改上傳至 MEGA S4（`MEGA_S4_BUCKET`／`MEGA_S4_ACCESS_KEY_ID`／`MEGA_S4_SECRET_ACCESS_KEY`／`MEGA_S4_REGION`／`MEGA_S4_ENDPOINT`），與 `app/api/app/version` 讀取來源對齊，修正 App 更新畫面永遠取不到版本資訊的問題 |
| 4.47.0 | 2026-06-09 | 安卓 App 新增 App 更新畫面（`AppUpdateScreen` 透過 `GET /api/app/version` 查 MEGA S4 版本資訊）；`GoogleAuth` 新增 `callbackScheme`/`callbackHost` 常數 + 自訂 URI scheme `assetpilot://google-callback` 備援 intent-filter，修正 App Links 未驗證時 OAuth 回呼失效；移除 `ApiClient.setBaseUrl()` 與 `SharedPreferences _kBaseUrl`，連線位址固定為 `https://asset.shao.one`；對應移除設定頁「後端位址」編輯 UI；`GET /api/app/version` 改以 `getMegaS4ConfigStatus()` 驅動，讀取 MEGA S4 的 `downloads/app-version.json`；新增 `app/app/google-callback/page.tsx`（重導向至 `assetpilot://google-callback` custom scheme） |
| 4.46.0 | 2026-06-09 | 安卓 App 新增 Google SSO 登入（系統瀏覽器 + App Link 回呼，`google_auth.dart` + `POST /api/auth/google`）；新增帳號註冊畫面（`POST /api/auth/register`，成功後自動登入）；新增 Turnstile WebView widget，修正後台啟用 Turnstile 時 App 登入 403（並修正 CSRF：所有請求帶 `Origin=<baseUrl>`）；App 圖示改為 AssetPilot 品牌 adaptive icon（`flutter_launcher_icons`）；預設 base URL 改為 `https://asset.shao.one`；`middleware.ts` 提取 `isPublicPath` 變數讓公開路徑略過 CSRF 檢查；排程 `dayOfMonth` 預設值及有效範圍由 0-28 修正為 1-28 |
| 4.45.0 | 2026-06-09 | 新增 Flutter 安卓客戶端（`mobile/`）：以現有 REST API 為後端，手動管理 httpOnly `authToken` Cookie（`http` 套件不自動帶 Cookie，登入時擷取 `Set-Cookie`、後續以 `Cookie` 標頭回帶，連同 base URL 持久化於 `shared_preferences`）。底部導覽四分頁（首頁/記帳/股票/更多）+ Material 3 三模式主題（`fl_chart` 圓餅圖）。涵蓋 `auth/login`、`auth/me`、`dashboard`、`transactions`(CRUD+`transactions/transfer`)、`accounts`、`categories`、`budgets`、`recurring`、`stocks`/`stock-transactions`/`stock-dividends`/`stock-realized`、`reports`、`account/settings/display-name`。`AndroidManifest.xml` 加 `INTERNET` 權限與開發用 `usesCleartextTraffic`。未涵蓋：OAuth/Passkey 登入、CSV 匯出入、備份還原、管理員系統設定、交易照片附件。`flutter analyze` 無警告、widget test 通過、debug APK 可建置 |
| 4.44.1 | 2026-06-04 | 修正全新 PostgreSQL 環境首次部署啟動失敗：`lib/postgresRuntime.ts` 的 `translateSql` 新增 `translateDdlTypes()`，在 `CREATE TABLE`／`ALTER TABLE` DDL 將 SQLite `INTEGER`（64-bit）改寫為 PostgreSQL `BIGINT`，避免 `*_at` Unix 毫秒時間戳寫入 int4（上限 ~21 億）時溢位（`value out of range for type integer`），與 `lib/postgresMigration.ts` 型別對應一致 |
| 4.44.0 | 2026-06-04 | 使用者個人資料完整打包匯出／上傳合併還原：①新增 `lib/userDataBundle.ts`（`exportUserBundle` 打包 14 張 user 資料表 + `transaction_attachments` metadata + 圖片實體成 ZIP，含 `manifest.json`；`restoreUserBundle` 合併式還原，依主鍵查重、僅 INSERT 缺漏、`BEGIN/COMMIT/ROLLBACK` 原子化；欄位名以識別字正則驗證防 SQL injection）；②`lib/transactionAttachments.ts` 新增 `restoreAttachmentFromBundle()`，將圖片位元組寫入 `getDefaultTransactionPhotoStorage()` 對應儲存並保留原 attachment id、remap user_id；③新增 `GET`/`POST /api/account/data-bundle`（requireAuth、200MB 上限、writeOperationAudit 記錄 export/restore_data_bundle）；④`DataTransferClient.tsx` 新增不分權限的「完整資料備份（含圖片）」區塊；⑤`openapi.yaml` 登記契約、新增 `types/adm-zip.d.ts`；⑥移除遷移後死相依 helmet / cookie-parser / cors / react-hook-form / @hookform/resolvers / recharts / dotenv，README 安全標頭描述改為 Next.js 回應標頭設定 |
| 4.43.0 | 2026-06-04 | 交易憑證照片前端壓縮：`TransactionsClient.tsx` 新增模組級 `compressPhoto()`，於 `uploadPhotos()` 送出前以 Canvas 將每張照片縮至最長邊 1600px、JPEG quality 0.8 後再 append 進 FormData，降低上傳頻寬與 S3／本機儲存佔用；`createImageBitmap(file, { imageOrientation: 'from-image' })` 處理 iPhone EXIF 旋轉；GIF／SVG、`createImageBitmap` 不可用、解碼失敗、或壓縮後體積未縮小等情況一律回退原檔，後端 `assertImageUpload` 上限與既有流程不變（純瀏覽器原生、無新增套件，符合 Brownfield 原則 V） |
| 4.41.0 | 2026-05-16 | 交易憑證照片管理強化：①TransactionsClient 新增編輯模式照片管理（查看現有附件、個別刪除、追加新照片，合計上限 5 張）；②附件數 > 1 時改以含縮圖的多張選擇器 Dialog 顯示，先前只能直開第一張；③新增 DELETE /api/transactions/:txId/attachments/:attachmentId 端點（deleteTransactionAttachment() 支援 local/S3 兩種儲存）；④admin UI 新增「交易憑證照片大小上限（MB）」輸入欄，對應 system_settings.transaction_photo_max_bytes INTEGER 欄位（0 表示使用環境變數預設值）；maxPhotoBytes() 優先讀取 DB 設定，再 fallback 至 TRANSACTION_PHOTO_MAX_BYTES env var；PUT /api/admin/system-settings 支援 transactionPhotoMaxBytes 欄位；⑤上傳流程移除前端儲存位置 select，改由 getDefaultTransactionPhotoStorage() 伺服器端統一決定 |
| 4.40.0 | 2026-05-16 | 管理員可從 UI 強制設定交易照片儲存位置：system_settings 新增 transaction_photo_storage 欄位（空字串 / 'local' / 's3'）；getDefaultTransactionPhotoStorage() 優先讀取 DB 設定，再 fallback 至 TRANSACTION_PHOTO_DEFAULT_STORAGE env var；PUT /api/admin/system-settings 支援 transactionPhotoStorage 欄位；管理員「系統設定」新增儲存位置下拉選單（依環境設定／強制本機／強制 S3） |
| 4.37.9 | 2026-05-11 | 帳號設定新增目前登入裝置管理：新增 `login_sessions` 紀錄有效登入 session，JWT 內含 `sessionId` 並以 token 雜湊比對；`GET /api/account/sessions` 列出裝置名稱、登入時間與登入 IP，`DELETE /api/account/sessions/:id` 可登出單一裝置，登出目前裝置時同步清除 Cookie；修改密碼與管理員重設密碼仍撤銷所有既有 session 並遞增 `token_version` |
| 4.37.8 | 2026-05-11 | 登出範圍修正：`POST /api/auth/logout` 改為只清除目前裝置的 `authToken` Cookie，不再遞增 `users.token_version`，避免 A 裝置登出時讓其他裝置同步失效；修改密碼與管理員重設密碼仍保留 `token_version` 遞增，維持高風險帳號變更後全裝置 Token 撤銷 |
| 4.37.3 | 2026-05-08 | 安全驗證差異補齊：①Next.js `requireAuth` / `requireServerAuth` 補回 JWT `tokenVersion` 與 `users.token_version` 比對，修改密碼、管理員重設密碼後舊 Token 立即失效；②middleware 與 API auth helper 補回 Cookie 認證狀態變更請求的 Origin / Referer CSRF 檢查；③新增 `lib/envSecrets.ts`，啟動時載入 `ENV_PATH` 並在缺少 `JWT_SECRET` / `DB_ENCRYPTION_KEY` 時自動產生寫入，避免固定預設 JWT 密鑰與未加密資料庫；④`/api/account/settings/delete` 與 `/api/account/settings/password` 復用主要帳號端點，避免 Google-only 刪除帳號與修改密碼流程安全性分岔；⑤production CSP 移除 `unsafe-eval`，僅 dev mode 保留 |
| 4.37.2 | 2026-05-07 | CI/CD build 修復 + 生產部署崩潰修正：①`lib/db.ts` 移除 `Function('return require')()` hack，改用頂層 `import * as path/fs/crypto from 'path'/'fs'/'crypto'`；`sql.js` 由 runtime require 改為 `await import('sql.js')`；②`next.config.js` 新增 `serverExternalPackages: ['sql.js']` + webpack `resolve.fallback: {path/fs/crypto: false}` for `nextRuntime !== 'nodejs'`（修正 Edge runtime 編譯時 UnhandledSchemeError / Module not found）；③新增 `types/sql.js.d.ts`（`declare module 'sql.js'`）修正 TS7016；④`lib/db.ts._runMigrations` 清除 merge 殘留的 `const path = getPathModule()` / `const fs = getFsModule()` 呼叫 |
| 4.37.1 | 2026-05-06 | Docker build 修復 + 遷移後架構規範收尾：①`package.json` 補上遷移後遺漏的 runtime/dev deps（`next@15`、`react@19`、`react-dom@19`、`@tailwindcss/postcss@4`、`tailwindcss@4`、`@base-ui/react@1`、`lucide-react`、`class-variance-authority`、`chart.js`、`pino`、`tailwind-merge` + `typescript@5`、`@types/{react,react-dom,node}`、`postcss`、`autoprefixer`），重生 `package-lock.json`；②刪除損毀的 `next.config.ts`（重複 import/export、rewrites 自迴圈），保留 `next.config.js` 並把 `outputFileTracingExcludes` 移出 `experimental` 區塊（Next.js 15 規範），暫時加上 `typescript.ignoreBuildErrors` + `eslint.ignoreDuringBuilds` 作為遷移期權宜開關；③Next.js App Router route file 違規 export 修正：`app/api/auth/google/state/route.js` 內的 `issueGoogleOAuthState` / `consumeGoogleOAuthState` 拆出至 `lib/googleOAuthState.js`、`app/api/auth/passkey/challenge/route.js` 內的 `issuePasskeyChallenge` / `consumePasskeyChallenge` / `passkeyChallenge` 拆出至 `lib/passkeyChallenge.js`、`app/api/transactions/import/route.js` 共用 `importLocks` / `importProgress` 拆出至 `lib/transactionImportState.js`（同時更新 `categories/import`、`imports/progress` importer），`stock-dividends/import` 與 `stock-transactions/import` 內同名 const 改為 module-private；④新增 `lib/utils.ts`（標準 `cn()` = `twMerge(clsx(...))`）、placeholder client `components/features/api-credits/ApiCreditsClient.tsx` + `components/features/data-transfer/DataTransferClient.tsx`；⑤10 個 finance/stocks `page.tsx` 的 `requireServerAuth` import path `@/lib/auth` → `@/lib/serverAuth`、`stockHelpers.js` → `stockHelpers`（檔實際為 `.ts`）、`app/finance/transactions/page.tsx` 半成品（含 `// ...` 佔位）重寫為標準 `AppLayout + TransactionsClient` 模式；⑥`components/ui/Input.tsx`、`Select.tsx` 補 named export；`components/ui/dialog.tsx` 的 `DialogTrigger` / `DialogClose` 加 `asChild` → Base UI `render` 相容 shim（影響 8 個 client 共 16 處 `asChild` 用法）；12 個 client component signature 加 `_props: { user?: any } = {}` 讓 `page.tsx` 的 `user={user}` 通過 TS 檢查；⑦`Dockerfile` 改寫為三階段 Next.js standalone build（`deps` → `builder` → `runner`，非 root user `nextjs:1001`，HEALTHCHECK 改打 `/api/config`，`HOSTNAME=0.0.0.0` 使 standalone 對外 listen）；`docker-compose.yml` 補 `HOSTNAME` / `NEXT_TELEMETRY_DISABLED` / `SSL_PATH`；`.dockerignore` 補 `.next` / `out` / `.next/types` |
| 4.37.0 | 2026-05-06 | 前端遷移收尾：①Phase 5 任務 T016–T020 完成，將 Accounts、Categories、Budget、Recurring、Reports 5 個記帳模組由舊 `app/finance/*/page.js` + `components/features/*/Client.js` 全面改寫為 Next.js App Router `page.tsx` + `*Client.tsx`（TypeScript + Tailwind v4 utility classes）；②持股相關 5 頁（`app/stocks/{dividends,portfolio,realized,settings,transactions}/page.tsx` + 對應 `*Client.tsx`）同步遷移；③Login、Account Settings、Admin、AppLayout、Sidebar、TopNav 改 `.tsx`；④清理 `app-legacy/` 整個舊版目錄與孤兒 `.js` client；⑤`package.json` scripts 由 `node server.js` 切為 `next dev` / `next build` / `next start`，部署需先 build 再 start；⑥`stockHelpers.js` → `stockHelpers.ts`；⑦剩餘 T014（lighthouse 驗證 LCP < 2.5s / TBT < 200ms）尚未執行 |
| 4.36.3 | 2026-05-05 | 側邊選單項目順序調整：`components/layout/Sidebar.tsx` 內 `NAV_ITEMS` 將「資料匯出匯入」（`/settings/export`）由原最末位上移至「持股總覽」之後；「帳號設定」（`/settings/account`）、「管理員」（`/settings/admin`，requireAdmin）緊接其後集中為設定區；「API 使用與授權」（`/api-credits`）移至清單最末。僅調整陣列順序，未變動路徑、icon 或 requireAdmin 條件 |
| 4.36.2 | 2026-05-05 | 修復交易記錄編輯視窗交互問題，優化事件處理機制 |
| 4.36.1 | 2026-05-05 | 前端架構遷移至 Next.js + Tailwind CSS v4：完成 Dashboard 與 Transactions 頁面遷移；UI 元件庫（Button、Table、Dialog、Badge 等）以 TypeScript 重構並套用 Tailwind v4 工具類別；Hybrid 路由轉發 API 至 Express 後端 |
| 4.36.0 | 2026-05-03 | 儀表板新增「收入分類」圓餅圖（010-dashboard-income-pie）：①`server.js` `/api/dashboard` 新增 `incomeCatBreakdown` 欄位（`buildCategoryAggregateNodes` + `type='income'` 查詢）；②`index.html` 在支出分類與資產配置卡片之間插入「收入分類」卡片（含雙圓餅圖開關 `dashIncomeDualPie`、canvas `dashIncomePieChart`、排行容器 `dashIncomeTop5`）；③`app.js` 新增 `DASH_DUAL_INCOME_KEY` 常數、`dashDualPie.income` 狀態、`renderDashIncomePie()`（單環 + useDualPie 雙環 + FR-009 點擊跳轉 type=income）、`renderDashIncomeTop5()`（前 5 名排行）、`drawDashboardIncomeDualPie()`（父+子雙環，鏡射 `drawDashboardExpenseDualPie`）、income toggle change 事件綁定；④`openapi.yaml` 新增 `incomeCatBreakdown` 欄位定義 |
| 4.35.2 | 2026-05-03 | 修正儀表板「資產配置（含股票市值）」與「帳戶前 5 名」中，信用卡等負值欠款帳戶錯誤顯示為負數且被列入資產總和計算的問題。改為排除負值帳戶，確保排行榜與圓餅圖符合資產語意。 |
| 4.35.1 | 2026-04-29 | 修正 `navigateToTransactions()`（`app.js:3062`）與 008-frontend-routing 不相容：原寫法用 `history.replaceState(null, '', '#/transactions?...')` 把 URL 參數塞到 hash，但 `navigateToPath()` 在 `location.pathname !== normalized` 時會執行 `history.pushState({...}, '', normalized)` 覆寫整個 URL（normalizePath 已剝除 search/hash），導致 hash 內的 `categoryId` / `dateFrom` / `dateTo` / `type` 全部遺失，`restoreFiltersFromHash()` 接著讀到空字串 → 無 filter 套用 → 4.34.0 backend 父→子展開邏輯永遠收不到 categoryId。本版改為先 `pushState({path,page,sub,scrollY}, '', '/finance/transactions?<params>')` 把 URL 寫成「目標 pathname + search params」，這樣 `navigateToPath` 進來時 `location.pathname === normalized` 條件為 true 不再覆寫，URL 與 search 全部保留 → `restoreFiltersFromHash` 正確讀取 → `applyFilters` 正確套用。同時受惠：dashboard 支出餅（line 2202）、dashboard 資產餅（line 2362）、報表分類餅（line 3363）三個 callsite |
| 4.35.0 | 2026-04-29 | 自動重啟服務（in-app update）：①`server.js` 新增 `detectProcessSupervisor()` 偵測 `/.dockerenv` / `process.env.pm_id` / `PM2_HOME` / `INVOCATION_ID`，回傳 `{available, type: 'docker' \| 'pm2' \| 'systemd' \| 'none'}`；②新增 `AUTO_RESTART_AFTER_UPDATE` env var（`auto`（預設）/ `force` / `off`）+ `planAutoRestart()` 決策函式，僅在 supervisor 可用時才執行 exit；③`POST /api/system/update-app` 成功後先註冊 `res.on('finish', ...)` hook，回應 JSON 含 `autoRestartScheduled` / `autoRestartReason` / `autoRestartSupervisor` / `restartDelayMs`，response flush 完成後 setTimeout 1500ms → `flushOnExit()` + `process.exit(0)`，由 supervisor (Docker `restart: unless-stopped`) 重新拉起；④`index.html` 新增 `#restartOverlay`（role=alertdialog，含 spinner / title / msg / elapsed / 立即重新整理 fallback button）；`style.css` 加 `.restart-overlay` 全螢幕遮罩 + backdrop-filter blur(4px)、`.restart-overlay-card` / `.restart-overlay-spinner` / `.restart-overlay-elapsed` 樣式；⑤`app.js` 新增 `showRestartOverlayAndWait()` 函式：開遮罩、每秒更新已等待秒數、`startDelayMs+500` 後開始輪詢 `/api/config`（公開端點，不需 auth）、每 2 秒 fetch 一次、200 即 `location.reload()`，90 秒未恢復顯示逾時 + 手動 reload 按鈕；⑥前端 `runAppUpdateBtn` click handler 改為依 `result.autoRestartScheduled` 分流：true → 開遮罩等待；false → 顯示 confirm 含失敗原因（如「未偵測到 supervisor」），由使用者決定是否手動 reload；⑦不變動 admin auth 中介層，仍維持 `adminMiddleware` 限制 |
| 4.34.0 | 2026-04-29 | 交易分類篩選多選 + 父分類展開修正：①`server.js` 內 `GET /api/transactions` 的 `categoryId` 參數改為接受逗號分隔清單，每個 ID 都先查 `categories.parent_id IN (...)` 展開為「自身 + 全部子分類」後合成單一 `IN (...)` 條件，沿用既有 `idx_cat_user_parent_sort` 索引；單一 ID 行為向後相容（視為 1 元素清單）。修正 dashboard `renderDashPie` 餅圖（`app.js:2202`）與報表 `drawCategoryReport` 餅圖（`app.js:3246`）`navigateToTransactions({ categoryId: seg.parentId })` 後因後端使用 `category_id = ?` 精確匹配導致結果為空（交易實際全掛在 leaf 分類）的 bug；②`index.html` 將 `<select id="filterCategory">` 替換為 `.multi-select` custom dropdown（trigger button + dropdown 含「全選 / 清除」action + 父子 checkbox 清單），加上 `aria-haspopup="listbox"` / `aria-multiselectable="true"` / `aria-expanded`；③`style.css` 新增 `.multi-select` / `.multi-select-trigger` / `.multi-select-dropdown` / `.multi-select-actions` / `.multi-select-action` / `.multi-select-item.parent|.child` / `.multi-select-group` 共 ~80 行樣式，沿用既有 `batch-cat-*` 設計語彙（`var(--border)` / `var(--primary)` / `var(--shadow-md)` / 淡入動畫）；④`app.js` 新增 `filterCategoryIds: Set<string>`（空 = 「全部」不送參數）+ `populateFilterCategoryItems()` / `refreshFilterCategoryUI()` / `setFilterCategoryIdsFromString()` / `bindFilterCategoryEvents()` 函式族；父子聯動：勾父 → 全勾子；取消任一子 → 父也取消；全部子勾起 → 父自動勾起；觸發按鈕標籤動態顯示「全部」/ 單一分類名 /「已選 N 項」；⑤`applyFilters()` 改讀 `filterCategoryIds` 並寫入 URL `categoryId=id1,id2,...`；`restoreFiltersFromHash()` 用 `setFilterCategoryIdsFromString` 還原；`bindFilters` 重置按鈕清空 Set 並 refresh UI；⑥UX 一致性：勾選不立即送請求，與其他 filter 對齊由「篩選」按鈕統一觸發，避免 N 次 API 呼叫；⑦dropdown 點擊外部自動關閉（`document.addEventListener('click', ...)` outside-click handler）；`bindFilterCategoryEvents` 用 `dataset.bound` guard 確保僅綁一次 |
| 4.33.0 | 2026-04-29 | 多時區支援（009-multi-timezone）：①users 表新增 `timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'` IANA 識別碼欄位 + 新增 `monthly_report_send_log` 表（`UNIQUE(user_id, year_month)` 防重寄）；②新增 `lib/userTime.js`（7 純函式：`isValidIanaTimezone` / `todayInUserTz` / `monthInUserTz` / `isFutureDateForTz` / `partsInTz` / `toIsoUtc` / `isValidIsoDate` + `__nowMs/__setNowMs` 測試 hook）；`lib/taipeiTime.js` 改為 thin wrapper（內部呼叫 userTime 並固定傳 'Asia/Taipei'）；③`authMiddleware` 擴成單次 SELECT 同取 `token_version, timezone` → 掛 `req.userTimezone`（零額外查詢）；④餘額計算（`server.js:6586/6707`）、定期交易展開（`processOneRecurring/processRecurringForUser` 改傳 `userTimezone`）、月度報表 `buildUserStatsReport()` 改用 `userTime.monthInUserTz(tz)` 取代 `thisMonth()` process timezone 依賴、POST `/api/transactions` 未提供 `date` 時預設 `userTime.todayInUserTz(req.userTimezone)`；⑤新增 `GET /api/users/me`（snake_case 完整 user 物件，`*_at` 過 `toIsoUtc()`）+ `PATCH /api/users/me/timezone`（IANA 驗證、no-op 不寫 audit、寫 `data_operation_audit_log` action='user.timezone.update' metadata={from,to,source}）；⑥前端 `app.js` 加 `getUserTz()` / `getBrowserTz()` / `todayInUserTz()` / `formatLocalDateTime()` / `listAvailableTimezones()` 工具，保留 `todayInTaipei` alias；`enterApp()` 呼 `GET /api/users/me` 合併 `currentUser.timezone`；`maybePromptTimezoneChange()` FR-010(b) 三條件 AND（tz=='Asia/Taipei' ∧ browserTz≠'Asia/Taipei' ∧ localStorage.tzPromptDismissedUntil 不在 7 天靜默期）→ 一次性 confirm；⑦個人設定頁新增「時區」card：搜尋下拉（`Intl.supportedValuesOf('timeZone')` ≈ 418 區域 + UTC/Etc/UTC 別名 + 10 項白名單 fallback）、即時預覽、儲存（source='manual'）；⑧scheduler `shouldRunSchedule(scheduleRow, userTimezone, nowTs)` 改用 `userTime.partsInTz(tz)` 計算 local hour/day/weekday + `localDayStartMs(tz, ymd)` 反推 helper；`checkAndRunSchedule()` JOIN users 取 timezone 帶入；`runScheduledReportNow` monthly 分支：先 INSERT `monthly_report_send_log` 失敗即 dedup 跳過，INSERT 成功才寄信，寄送失敗 UPDATE send_status='failed' + error_message 不自動重試（FR-018）；環境變數 `SCHEDULER_TICK_MS` 可注入；⑨TWSE 例外（FR-014）：`getTaiwanTime()` / `isTwseTrading()` / `lib/twseFetch.js` header 加註解標明永久鎖 Asia/Taipei 不隨使用者偏好變動；⑩憲章升級 v1.2.0→v1.3.0：新增 Principle IV「Time & Timezone Discipline」（後端 UTC ISO 8601 Z 字串 + per-user IANA + 市場/法規時間例外條款），FR-007a 由「鎖 UTC+8」修訂為「per-user `users.timezone` 預設 Asia/Taipei」；⑪OpenAPI（gitignored generated）：新增 `/api/users/me`、`/api/users/me/timezone` 路徑與 `UserMe` / `UpdateTimezoneRequest` / `ErrorResponse` / `ValidationError` schema，`info.version` 升 4.33.0，`openapi: 3.2.0` 不變；source of truth 為 [contracts/multi-timezone.openapi.yaml](specs/009-multi-timezone/contracts/multi-timezone.openapi.yaml)（已提交）；⑫測試：新增 5 支自動化套件（`tests/lib/userTime.test.js` 50/50 + `tests/migration/migration-009.test.js` 11/11 + `tests/integration/us1-natural-day.test.js` 15/15 + `us2-users-me-timezone.test.js` 18/18 + `us3-monthly-report.test.js` 13/13 + `fr015-transactions-historical.test.js` 6/6 = **128/128 pass**），`tools/check-iso-utc-format.js`（1000 隨機樣本）、`tools/sla-monthly-report.js`（100 帳號 × 12 時區 × 31 天 → P95 = 0.00 分鐘 ≤ 30 分 SC-003）；`npm test` / `npm run test:tz` / `npm run check:iso` / `npm run check:sla` 暴露；⑬T021 範圍縮減（implement 階段決議）：既有 `*_at` 欄位型別不一致（`users.created_at` 是 `'YYYY-MM-DD'` / `accounts.created_at` 是 INTEGER ms / `passkey_credentials.created_at` 是 DATETIME 字串），全面套 `toIsoUtc()` 違反 SC-001 regression-free，本 PR 僅本功能新增端點輸出 `.sssZ`，既有欄位另案處理；⑭T035/T039 暫緩：自動偵測新舊使用者統一走同一提示流程，散落 `toLocaleString` 全面替換為 `formatLocalDateTime` 為後續迭代；⑮Breaking Change 影響面：既有 Asia/Taipei 使用者所有 API 回應與 UI 行為相對升級前 100% 一致（regression-free，已通過自動化驗證） |
| 4.32.2 | 2026-04-29 | 兩處 UX 修正：①法律連結改為直連靜態檔：`index.html` 公開首頁 footer（行 237、241）與 sidebar legal links（行 369、371）、`privacy.html`（行 510）、`terms.html`（行 463、504）共 7 處 `href="/privacy"` / `href="/terms"` 改為 `href="/privacy.html"` / `href="/terms.html"`，避免命中 SPA 路由 `/privacy` / `/terms`（`app.js:1604-1607` 的 `showLegalPage()`）後渲染只有「完整政策內容請見 /privacy.html」單行佔位的 `#page-privacy` / `#page-terms`（`index.html:1841-1854`）；保留原 SPA 路由註冊（`app.js:1039-1040`）以維持書籤相容性；②`buildCategoryOptions()`（`app.js:8482-8497`）移除父分類「（全部）」選項：父分類存在子分類時，原 `<optgroup label>` 內第一個 `<option value="${p.id}">${p.name}（全部）</option>` 整行刪除，僅保留子分類 `<option>`；對齊 003-categories（v4.24.0）後端 leaf-only 強制（交易 `category_id` 必為子分類），消除前端可選但後端會拒絕的 mismatch；同時影響「新增交易」（`txCategory`）與「編輯固定收支」（`recCategory`）兩處 select；無子分類的父分類（例如預設「其他」）仍走 `else` 分支保留為可選；`buildBudgetCategoryOptions()` 不受影響（本就 leaf-only） |
| 4.32.1 | 2026-04-28 | 公開首頁視覺重新對齊內頁設計語彙：①移除 `.public-home-orb--a/b` 兩顆 80px blur orb 與 backdrop-filter blur(12px)；②`.public-home-hero` / `.pillar-card` / `.public-deploy` / `.public-stack` 等所有區塊卡片從自訂 `border-radius: 18-24px` 改為 `var(--radius)` 14px，從手刻多層 box-shadow 改為 `var(--shadow)` / `var(--shadow-md)`，與內頁通用 `.card` 完全同基底；③硬編碼 hex（`#4f6ef7` / `#7c3aed` / `#f97316` / `#10b981` / `#0f172a` 等 17 處）替換為語意 token：`var(--primary)` / `var(--income)` / `var(--net)` / `var(--today)` / `var(--text)` / `var(--text-secondary)` / `var(--text-muted)` / `var(--bg)` / `var(--surface)` / `var(--border)` / `var(--primary-light-bg)` / `var(--income-bg)` / `var(--net-bg)` / `var(--today-bg)`；④`.public-home-stats` 從 4 欄擠在單一容器靠 `+ ::before` 假分隔線，改為 `.summary-cards` 風格的 4 張獨立 `.stat-item` 卡（grid auto-fit minmax(220px, 1fr)），各帶 `.stat-icon`（44×44 / 12px radius / pastel bg + semantic color，沿用 `.summary-card .card-icon` pattern）+ `.stat-text` 區塊；⑤`.pillar-card` 移除 `::before` 3px 頂部 accent bar、移除 `color-mix()` bullet 環形光暈、hover 從 `translateY(-4px)` 改為 `-2px` 與 `var(--shadow-md)`，與儀表板 `.summary-card` 同步律；⑥`.public-deploy` 從 `linear-gradient(135deg, #0f172a, #1e293b)` 滿版深色 + 內含 radial orb 改為白色 `var(--surface)` 卡片外殼 + 內含暗色 `.code-window`（`#0f172a`，code-window 屬於程式碼塊本就應深色，與全站 syntax-highlighted block 一致）；⑦`.public-stack` 從飄在背景上改為包在 `.card` 內，badge hover 從自訂陰影改為 border-color 切換；⑧`body.dark-mode .public-*` 規則從 60+ 行手動 hex 重設縮減為 5 條例外（`.public-home` 漸層、`.public-home-bg` grid 透明度、`.public-home-kicker` alpha、4 組 pillar bg、icon i color），主要靠 token 自動切換；⑨`@media (max-width: 750px)` 響應式 overrides 簡化（移除 orb 與 18px radius 孤兒規則，新增 `.stat-icon` 縮為 40×40）；⑩CSS 規則 brace 從 1147 條減至 1098 條（淨減 ~25 條規則），HTML class token 92 個全對應、CSS 0 個 orphan rule；⑪保留所有 4.32.0 既有 `#goLoginBtn` / `#goRegisterBtn` / `App.openChangelog()` / `#deployCopyBtn` / `/privacy` / `/terms` 綁定，零行為變動 |
| 4.32.0 | 2026-04-28 | 公開首頁（`<section class="public-home">`）視覺改版：①Hero 區塊重寫文案為「你的財務指揮中心，從擁有資料開始」+ 漸層強調 `.h1-accent`（#4f6ef7→#7c3aed→#f97316），加入 `.public-home-trust` 5 顆信任 chip（開源 AGPL／落地加密／無雲端／一行部署／OpenAPI 3.2）；②數據條 `.public-home-stats` 從 hero 內抽出獨立 4 欄 grid 卡片，每格新增 `.stat-sub` 副說明文字（Poly1305 AEAD、三段策略、decimal.js）；③以 `.public-pillar-grid` 4 張深度卡（`pillar-card--blue|green|purple|amber`，CSS `--pillar-accent` 變數頂端 3px accent bar）取代舊 6 張單句 `.public-feature-card`，每張含 4 條 bullet 列出對應模組具體子功能；④新增 `.public-deploy` 深色漸層區塊（`#0f172a → #1e293b`），內嵌 `.code-window` 終端機樣式（traffic-light dots、5 種 token color：`.code-prompt|cmd|flag|arg|img`）展示單行 `docker run` 指令，附 `#deployCopyBtn` clipboard 複製按鈕（成功時 `.is-copied` 切換 icon 與標籤 1.8s）；⑤`.public-stack-badges` 從 2 顆擴充為 10 顆（Node.js ≥ 24、Express 5、SQLite (sql.js)、ChaCha20-Poly1305、decimal.js、JWT + WebAuthn、OpenAPI 3.2.0、Helmet + Rate Limit、Chart.js、Docker multi-arch），含 `fab fa-docker` / `fab fa-node-js` 品牌圖示；⑥CSS 加入 `.public-home-orb--a/b` 兩顆 blur(80px) gradient orb 製造深度，hero 卡 `backdrop-filter: blur(12px)` + 半透明白底；⑦完整 `body.dark-mode .public-home...` 覆蓋（hero 卡 `rgba(21,25,34,.78)`、stat dividers `rgba(255,255,255,.08)`、pillar bg/fg 改用低飽和透明色、deploy 漸層加深至 `#060a14→#0f172a`）；⑧`@media (prefers-reduced-motion: reduce)` 全面禁用 `.pillar-card` / `.pillar-icon` / `.public-stack-badges .badge` / `.btn-cta` 的 transition / transform；⑨響應式 ≤ 960px 支柱卡 1 欄、deploy 直排、stats 2x2 grid 改用 `border-left/border-top`；⑩`app.js` 新增 `el('deployCopyBtn')` 點擊處理（`navigator.clipboard.writeText` + 失敗時改顯「請手動複製」+ 1.8s 後狀態回復）；⑪移除舊版 `.public-feature-card` / `.feature-icon-wrap` / `.feature-icon--blue|green|teal|purple|amber|red` / `.public-home-grid` / `.public-footer-label` 共 10 個孤兒 class（HTML 與 CSS 同步清除）；保留既有 `#goLoginBtn` / `#goRegisterBtn` / `App.openChangelog()` / `/privacy` / `/terms` 綁定；零新前端依賴 |
| 4.31.1 | 2026-04-27 | 月度報表信件 Android Gmail 版面修正：`renderStatsEmailHtml()` 內成對 label/value `<td>`（儲蓄率列、topCategories 行、daily transactions 行、stockBlock 4 列）原僅 `width="100%"` 在外層 `<table>`，內層 `<td>` 無顯式寬度，Android Gmail 渲染時會把右側 `text-align:right` 儲存格收縮成內容寬度貼齊左側，造成「購物TWD 14,205」「本月儲蓄率0% · 偏低」之類視覺擠在一起；修正為各 `<td>` 顯式 `width="50%"` / `60%/40%` / `65%/35%` / `55%/45%` HTML 屬性 + 外層 `style="table-layout:fixed"`；另每日彙總表（weekly/monthly dailyBreakdown）加入 `<colgroup>` 28%/24%/24%/24% 固定欄寬 + `.ap-bk-cell` class，配合 `<style>` 內 `@media (max-width:600px) .ap-bk-cell { padding:8px 6px; font-size:12px }` 縮小行動版內距字體；日期欄 `white-space:nowrap` 移至內層 `<span>` 允許「日期」與「(星期)」必要時受控分行 |
| 4.31.0 | 2026-04-27 | GitHub Code Scanning（CodeQL）20 筆未修復告警一次性修補：①新增全域 API rate limiter `apiGlobalLimiter`（每 IP 每 15 分鐘 600 次，掛於 `app.use('/api', ...)`），覆蓋 `js/missing-rate-limiting` 規則所列 15 個端點（`/api/auth/google/state`、`/api/changelog`、`POST /api/auth/google`、`/api/auth/passkey/login`、`/api/auth/logout`、`/api/auth/me`、`/api/account/passkey/register`、`/api/admin/login-audit/{logId}` DELETE、`/api/admin/certs` 系列、`/api/database/import`、`/api/admin/backups` GET / DELETE）；既有 `authLimiter`（20/15min）對 login/register/google 仍套用，多層獨立計數；②新增 `/api` CSRF Origin/Referer 驗證中介層覆蓋 `js/missing-token-validation`：對 Cookie 登入的非 GET/HEAD/OPTIONS 請求，必須附帶屬於 `ALLOWED_ORIGINS` 的 `Origin` 或 `Referer`，未通過回 403；Bearer Token 流程（瀏覽器無法自動跨站送 `Authorization` header）跳過此檢查；③`isEncryptedDB(buffer)` 與 `/api/database/import` handler 內 `req.body` → `dbBuffer` 嚴格 `Buffer.isBuffer` 型別收斂，覆蓋 `js/type-confusion-through-parameter-tampering` 3 筆 critical 告警；④`normalizeRoutePath(rawPath)` 加入 `MAX_ROUTE_PATH_LENGTH = 2048` 上限提早 return，覆蓋 `js/polynomial-redos` 1 筆告警；⑤本次修復皆為 server.js 內部加固，不變動 OpenAPI 契約、不新增 npm 套件、不影響前端流程；現有 SPA 走同源 Cookie 認證，CSRF 中介層在 `ALLOWED_ORIGINS` 已正確設定的部署環境零影響 |
| 4.30.3 | 2026-04-27 | Modal 關閉時 history.back 重複觸發修正：`closeModal()` 與 `ModalBase.attachHashWatch` 內的 hashChangeHandler 原以 `while (modalStack.length > 0) ModalBase.closeTopmost()` 迴圈逐次呼叫 `history.back()`，但 `modalStack` 僅在 `popstate` 觸發後的 `handlePopstate` 中同步清空；於部分瀏覽器（特別是 mobile）`popstate` 為非同步派發、或 `hashchange` 在 `popstate` 之前同步觸發時，迴圈內 `modalStack` 不會即時清空，導致 `history.back()` 被連續呼叫多次（例：交易表單儲存 → `closeModal('modalTransaction')` 退兩頁），使用者被推回開啟 Modal 之前所在路徑。改為一次性 `history.go(-N)`（N = 從目標 modal id 到 stack 頂端的距離），由 `handlePopstate` 之「全部關閉」/「後退到較底層 Modal」分支處理 stack pop 與 DOM hide，行為對 modalConfirm 疊在其他 Modal 上的單層退出仍正確 |
| 4.30.2 | 2026-04-27 | 月度統計報表信件 hero 區塊渲染修正：`renderStatsEmailHtml()` 的 `<td class="ap-hero">` 原僅以 `background:linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)` 設背景搭配 `color:#ffffff` 白字，部分 Gmail mobile（特別是中國地區簡中 UI）會剝除 CSS gradient 屬性，使白字落在白底完全不可見、整封信只剩 hero 區塊的 `👋` emoji；改採三重 fallback：①新增 HTML4 `bgcolor="#4f46e5"` 屬性、②`background-color:#4f46e5` standalone 屬性宣告於 shorthand 之前、③`background:#4f46e5 linear-gradient(...)` shorthand 內含 solid 顏色；同步移除無實際用途的 `position:relative`（亦屬常被 email client 剝除的屬性） |
| 4.30.1 | 2026-04-27 | 寄信人顯示名稱統一設定：新增 `EMAIL_SENDER_NAME` 環境變數（三通道共用），由 `formatFromAddress()` helper 統一包裝為 RFC 5322 quoted-string `"<name>" <email>` 格式；若各通道 FROM 變數已含 `<` 字元（亦即既有 `Name <email>` 格式）則尊重 per-provider 設定不覆寫，達成「全域品牌名稱 + 例外可覆蓋」。helper 對名稱中的 `\` / `"` 進行 RFC 5322 雙引號逸出，避免特殊字元破壞郵件標頭 |
| 4.30.0 | 2026-04-27 | 寄信通道改用環境變數 + 新增 Zeabur Email 通道：①移除管理員「SMTP 寄信設定」UI 與 `GET / PUT /api/admin/smtp-settings` 端點；不再執行 `system_settings.smtp_*` 六欄 schema migration（既有 DB 欄位保留不主動破壞，但程式不再讀寫），原本透過管理員 UI 設定的 SMTP 必須改寫到環境變數；②新增三條寄信通道環境變數族 — SMTP（`SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM`）、Zeabur Email / ZSend（`ZEABUR_API_KEY` / `ZEABUR_FROM_EMAIL`，HTTP REST API：`POST https://api.zeabur.com/api/v1/zsend/emails`，Bearer token 認證）、Resend（沿用既有 `RESEND_API_KEY` / `RESEND_FROM_EMAIL`）；③新增 `EMAIL_PROVIDER_PRIMARY` / `EMAIL_PROVIDER_FALLBACK` 環境變數（值：`smtp` / `zeabur` / `resend` / 留空），管理員可指定 1 主 1 備、僅 1 主或全停用；primary 執行期失敗時若 fallback 已設定才自動退回，不重試不補寄（沿用 005 FR-021 / Round 1 Q3 語意）；④新增 `GET /api/admin/email-providers`（唯讀）回傳目前 primary / fallback 與三通道是否設定；管理員設定頁原 SMTP 卡片改為「寄信通道狀態」唯讀顯示 + 寄測試信按鈕；⑤`POST /api/admin/test-email` 與排程器錯誤訊息更新：未設定通道時提示「請設定 EMAIL_PROVIDER_PRIMARY 環境變數」；⑥`lib/external-apis.json` 新增 Zeabur Email 條目；⑦零新依賴（沿用既有 `nodemailer` + `resend`，Zeabur 走原生 `fetch`） |
| 4.26.0 | 2026-04-26 | 005-stats-reports 落地：①schema migration 新增 `report_schedules` 表（10 欄位 + 2 索引：`idx_report_schedules_user`、`idx_report_schedules_enabled_freq`），不變動既有表；啟動時自動把既有 `system_settings.report_schedule_*` singleton 排程遷移為多筆 row（冪等，僅當新表為空時執行）；②新增 5 個端點：`GET / POST /api/admin/report-schedules`、`PUT / DELETE /api/admin/report-schedules/{id}`、`POST /api/admin/report-schedules/{id}/run-now`（FR-016 / Round 2 Q2，皆斜線路徑、kebab-case 多字動詞）；③`GET /api/dashboard?yearMonth=YYYY-MM` 補 yearMonth query 參數，KPI / 預算 / 圓餅 / 最近 5 筆交易隨切換器同步重算（FR-001 / Round 1 Q1）；④`GET /api/accounts` response 新增 `twdAccumulated` 計算欄位（為 `SUM(transactions.twd_amount, signed by direction)`），外幣帳戶 initial_balance 不納入此累計（FR-004 / Round 4）；⑤雙圓餅圖「（其他）」虛擬子分類節點（父分類本身有交易但無子分類細項時呈現於外圈，金額不重複計入內圈，FR-013 / Round 3 Q1）；⑥圓餅圖點擊跳轉至預先篩選的交易列表（FR-015a / Round 3 Q2），採同 SPA 內 push state；⑦統計報表頁工具列狀態 Session 內保留（FR-011a / Round 1 Q5）；⑧排程引擎重寫為多筆並存（per-schedule lock map 取代既有全域 isRunningSchedule flag），`(user_id, freq)` 不設唯一鍵；⑨寄信通道執行期 fallback：SMTP 失敗時自動退回 Resend，兩通道皆未設定回 503（FR-021 / Round 1 Q3，不重試、不補寄）；⑩排程停用→啟用不補寄（FR-024a / Round 2 Q3，`shouldRunSchedule` 比對 `last_run < periodStart`）；⑪信件對比 pill 改為「同型前一段」（每日 vs 前日、每週 vs 上週、每月 vs 上月，FR-018 / Round 1 Q4）；⑫信件「股票投資」區塊若任一持股 priceAsOf 超過 12h 則顯示「最舊資料時間」小字註記（FR-023）；⑬`GET /api/reports`：起始日 > 結束日回 400 拒絕（不靜默交換）、categoryBreakdown 改為 CategoryAggregateNode[]、補 periodStart / periodEnd 預設化（FR-010 / FR-013）；⑭信件每週分支週末日期改用紫色 `#a855f7`（採 inline style 相容 Outlook Desktop Word 渲染引擎，FR-019 / Round 4）；⑮零新依賴（無新增 npm 套件、無新前端 CDN、無新外部 API） |
| 4.25.0 | 2026-04-25 | 004-budgets-recurring 落地：①schema migration（`budgets.amount` / `recurring.amount` REAL→INTEGER 對齊 002 慣例、`recurring.fx_rate` REAL→TEXT decimal 字串、`recurring` 補 `needs_attention` / `updated_at` 欄位、`transactions` 表新增 `source_recurring_id` / `scheduled_date` 欄位 + partial unique index `idx_tx_source_scheduled` 並發冪等保護 + 普通 index `idx_tx_source` 反查加速、`budgets` 補 `created_at` / `updated_at` + 兩條 partial unique index 對「(user_id, year_month, category_id IS NOT NULL)」與「(user_id, year_month, category_id IS NULL)」分別保唯一；啟動時自動備份 `database.db.bak.<ts>.before-004` / `.before-004-rec`）；②新增端點 `PATCH /api/budgets/{id}`（僅編輯金額；FR-008）；③預算進度條四段配色（綠／中性／黃／紅，閾值 50% / 80% / 100% 為固定值）；④預算月份切換器，可切到任意歷史／未來月份檢視（FR-007、FR-009a），「已用金額」永遠依當前資料庫即時重算（不快取／不凍結）；⑤固定收支自動產生流程提煉為共用函式 `processRecurringForUser(userId)`，於三條登入 handler（password / Google SSO / Passkey）內 server-side 觸發（與 003 backfillDefaultsForUser pattern 對稱），30 筆軟上限 + setImmediate 背景續跑保 SC-003 / SC-004；條件式 `last_generated` 推進（only-if-newer）+ `(source_recurring_id, scheduled_date)` 唯一鍵保並發冪等（資料層去重，不依賴應用層鎖）；⑥固定收支卡片色階分流：紅／橘「需處理」（原分類／帳戶已刪除自動標記）> 黃「（待執行）」逾期 > 灰停用 > 正常；備註直接顯示於卡片上；⑦編輯固定收支時對已刪除的分類／帳戶以 `__deleted_category__` / `__deleted_account__` 佔位下拉防呆（前後端共驗），改選有效項並儲存後 needs_attention 旗標立即清除；⑧衍生交易在交易列表與編輯頁顯示「來自配方」chip（`COALESCE(NULLIF(r.note,''),'（未命名配方）')` LEFT JOIN），來源配方刪除後 chip 退化為灰字「（來源配方已刪除）」；⑨修正每月 31 號遇 2 月正確回退至月底（取代既有 `Date.setMonth(+1)` overflow），每年 2/29 遇平年回退至 2/28；⑩編輯既有配方分支邏輯：起始日變動則重置 `last_generated`（FR-021a）、週期變動保留（FR-021b）、業務欄位（金額／分類／帳戶／備註／幣別／匯率）變動皆不溯及既往（FR-021c，PUT handler 嚴格不對 transactions 表觸發 UPDATE）；⑪固定收支類型欄位（收入／支出）建立後永久不可變更（與 003 對 `categories.type` 對稱治理）；⑫OUT-003：本期不做伺服器端 cron／worker 排程，FR-012 僅以登入觸發路徑兌現；⑬零新依賴（無新增 npm 套件、無新前端 CDN、無新外部 API） |
| 4.24.0 | 2026-04-25 | 003-categories 落地：①schema migration 移除 `categories.is_hidden` 欄位（rebuild 模式）+ 新增 `deleted_defaults(user_id, default_key, deleted_at)` 表 + 索引 `idx_cat_user_parent_sort` / `idx_cat_user_type`；啟動時自動備份 `database.db.bak.<ts>.before-003`；②預設樹重新設計（13 父 + 56 子）含支出「其他」與全部 5 個收入父分類，新增「美妝保養」「訂閱服務」「瓦斯費」「牙科」「健檢」等項；③新增端點 `PATCH /api/categories/{id}`（移動子分類至另一父分類）、`POST /api/categories/reorder`（批次重排同層）、`POST /api/categories/restore-defaults`（清空 registry + 補建）；④登入時冪等補建（password / Google SSO / Passkey 三條登入路徑）P95 < 200 ms，跳過 deleted_defaults 與既有客製化；⑤分類 type 一經建立永久不可變更（PUT 拒絕 type 變更）；⑥leaf-only：交易 `category_id` 必為子分類（後端強制）；⑦顏色驗證收緊為嚴格 `^#[0-9A-Fa-f]{6}$`，不接受 `#RGB` 或 `#RRGGBBAA`；⑧分類管理頁雙區塊（支出在上、收入在下）+ HTML5 原生拖曳排序（同層）+ 子分類縮排網格（左側 4px 藍色邊框 + ▸ 箭頭）+ 「補回過去刪除的預設分類」按鈕；⑨完全移除「是否隱藏」屬性；⑩零新依賴（無新增 npm 套件、無新前端 CDN） |
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

## v4.33.0 — 009 Multi-Timezone Support（2026-04-29）

### 規範升級（FR-007a 修訂）

- **FR-007a 重新定義**：原本「所有『今天／未來』判定固定以 UTC+8 計算」改為「以該操作所針對使用者的 `users.timezone`（IANA 識別碼，預設 `Asia/Taipei`）計算」。
- **新增治理原則（憲章 v1.3.0 Principle IV — Time & Timezone Discipline，NON-NEGOTIABLE）**：後端 timestamp 一律以 Unix ms 或 ISO 8601 UTC `Z` 字串儲存／傳輸；API 出口統一 `YYYY-MM-DDTHH:mm:ss.sssZ` 毫秒精度；「使用者當地某日／某月／某時刻」一律以 `users.timezone` 計算。例外：市場／法規時間（如 TWSE 09:00–13:30 Asia/Taipei）需源碼註解標明。
- **既有 Asia/Taipei 使用者不受影響**：所有 API 回應與 UI 行為相對升級前 100% 一致（regression-free）。

### 資料模型變更

- `users` 新增 `timezone TEXT NOT NULL DEFAULT 'Asia/Taipei'`（IANA 識別碼）。既有列由 DEFAULT 自動填值；不需資料遷移。
- 新增 `monthly_report_send_log` 表：`id`、`user_id`、`year_month`、`schedule_id`、`sent_at_utc`、`send_status`（success / failed）、`error_message`，以 `UNIQUE(user_id, year_month)` 防重寄；scheduler 先 INSERT、UNIQUE 衝突即跳過。
- `transactions.date` 欄位形式不變（`YYYY-MM-DD`），語意改為「該交易所有人於其偏好時區的當地自然日」；歷史列被視為以 Asia/Taipei 寫入，不重算。

### 後端工具

- 新增 `lib/userTime.js`：`isValidIanaTimezone`、`todayInUserTz`、`monthInUserTz`、`isFutureDateForTz`、`partsInTz`、`toIsoUtc`、`isValidIsoDate`、`__nowMs / __setNowMs`（測試 hook）。
- `lib/taipeiTime.js` 改為 thin wrapper（內部呼叫 `userTime.*` 並固定傳 `'Asia/Taipei'`），維持向後相容；既有 callsite 不需改。
- `authMiddleware` 擴展為同 `SELECT` 取 `timezone`，掛 `req.userTimezone`（零額外查詢）。

### 新 API 端點

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/users/me` | 取當前使用者完整資料（含 `timezone`、`theme_mode`、`created_at` 為 `.sssZ`） |
| PATCH | `/api/users/me/timezone` | 更新偏好時區；非 IANA 回 400；no-op（同值）不寫 audit；成功變更寫 `data_operation_audit_log`（`action='user.timezone.update'`、metadata 含 `from`/`to`/`source ∈ {auto-detect, manual}`） |

### 月度報表郵件 per-user 觸發（FR-006 / FR-018）

- `checkAndRunSchedule()` JOIN `users` 取 `timezone` 帶入；`shouldRunSchedule(scheduleRow, userTimezone, nowTs)` 改以 `userTime.partsInTz(tz, nowTs)` 計算 local hour / day / weekday。
- 環境變數 `SCHEDULER_TICK_MS` 可注入測試心跳間隔（預設 5 分鐘）。
- 寄送失敗保留 `monthly_report_send_log.send_status='failed'` + `error_message`，scheduler 不自動重試（避免風暴）。

### 前端

- `app.js` 新增工具：`getUserTz()`、`getBrowserTz()`、`todayInUserTz()`、`formatLocalDateTime(iso, opts?)`、`listAvailableTimezones()`，保留 `todayInTaipei()` 為 alias。
- 登入後 `enterApp()` 呼叫 `GET /api/users/me`，合併 `currentUser.timezone`。
- 既有使用者 `maybePromptTimezoneChange()` FR-010 (b) 三條件 AND（`timezone === Asia/Taipei` ∧ 瀏覽器 tz ≠ Asia/Taipei ∧ `localStorage.tzPromptDismissedUntil` 不在 7 天靜默期）→ 一次性 confirm 對話框。
- 個人設定頁新增「時區」card：搜尋下拉（`Intl.supportedValuesOf('timeZone')` ≈ 418 區域 + UTC/Etc/UTC 別名 + 10 項 fallback 白名單）、即時預覽（每秒更新）、儲存（`source='manual'`）。

### TWSE 例外（FR-014）

`getTaiwanTime()` / `isTwseTrading()` 永久鎖 Asia/Taipei；源碼加 `// FR-014: TWSE 市場時間鎖 Asia/Taipei，與 users.timezone 無關` 註解。市場開盤判斷不隨使用者偏好變動。

### 測試

新增 5 支自動化測試（**107 / 107 pass**）：

| 檔案 | 內容 | pass |
| --- | --- | --- |
| `tests/lib/userTime.test.js` | 7 個函式單元測試（含 5 組 DST 邊界） | 50 |
| `tests/migration/migration-009.test.js` | DDL + UNIQUE 約束 | 11 |
| `tests/integration/us1-natural-day.test.js` | PST 23:30 / 00:30 / 跨日 / regression-free | 15 |
| `tests/integration/us2-users-me-timezone.test.js` | PATCH IANA 驗證 / no-op / audit / source 白名單 | 18 |
| `tests/integration/us3-monthly-report.test.js` | PST 觸發 / UNIQUE 防重寄 / DST 秋重 / 失敗保留 | 13 |

`npm run test:tz` 一鍵跑全部。

### Breaking Change 影響面

- 既有 Asia/Taipei 使用者：**零行為變化**（regression-free）。
- 非 Asia/Taipei 使用者：原本看到的「今天／本月」邊界錯亂問題已修復；月度報表郵件改在當地 1 號 00:00 寄送。
- 新 API 與既有 `/api/auth/me` 並存；前端 `currentUser` 同時讀兩個（前者取 timezone、後者取 displayName 等 camelCase 欄位）。
- OpenAPI `info.version` 升至 `4.33.0`；`openapi: 3.2.0` 字串保持不變（憲章 II）。

### 後續迭代範圍（不在本 PR）

- 既有 `*_at` 欄位全面正規化為 `.sssZ`（型別不一致需逐欄分析，risk vs SC-001 trade-off）。
- 管理員手動清除 `monthly_report_send_log.send_status='failed'` 列以重觸發寄送的 UI / API。
- 前端散落的 `new Date(x).toLocaleString()` 全面替換為 `formatLocalDateTime(x)`（現提供工具未強制套用，視覺顯示在不同時區帳號下會跟隨瀏覽器系統 tz；資料正確性不受影響）。

## v4.29.0 — 008 Frontend Routing & Pages（2026-04-27）

### 路由架構（FR-001 ~ FR-005、FR-008、FR-014）

- 前端採 URL-first SPA 路由，`app.js` 內以模組級常數 `ROUTES` 維護 20 條路徑（4 公開 + 16 受保護，含 `/stocks` 與 `/stocks/portfolio` 雙別名）。
- 純函式 `parsePath` / `buildPath` / `normalizePath` / `validateNextParam` 為單一資料來源；不引入 router 套件、不引入 path-to-regexp。
- 路徑正規化：小寫 + 折疊連續斜線 + 去尾端斜線（除根 `/`）；不一致時以 `replaceState` 改寫；超出能力（含 `..` / `%2e%2e`）走 FR-027 path traversal 攔截。
- 不存在路徑或非管理員命中管理員路徑 → 前端渲染 `#page-404` 訊息頁（URL 保留原樣不被改寫）。

### 後端 admin-only 路徑常數（FR-032a）

- `server.js` 維護模組級常數 `const ADMIN_ONLY_PATHS = ['/settings/admin'];`，與前端 `ROUTES` 表 `requireAdmin: true` 條目對應。
- 同步要求：新增管理員專屬路徑時 MUST 同時更新前端 ROUTES 表與後端 `ADMIN_ONLY_PATHS`，由 PR code review 把關。

### 路由稽核模式（FR-033）

`system_settings.route_audit_mode` 欄位（TEXT、預設 `'security'`）控制 `data_operation_audit_log.action` 之路由相關事件寫入範圍：

| 模式 | route_admin_path_blocked | route_open_redirect_blocked | static_path_traversal_blocked | session_expired (401) | 既有 007 action |
| --- | --- | --- | --- | --- | --- |
| `security`（預設） | ✅ | ✅ | ✅ | ❌ | ✅ |
| `extended` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `minimal` | ❌ | ❌ | ❌ | ❌ | ✅ |

切換立即生效，不需重啟（catch-all 與 authMiddleware 即時查詢；單行 SQL）。

### 路由稽核 action 列舉值（FR-032）

`data_operation_audit_log.action` 擴充列舉值：

- `route_admin_path_blocked`：catch-all 偵測非管理員命中 `ADMIN_ONLY_PATHS`；metadata `{ path, normalizedPath }`。
- `route_open_redirect_blocked`：catch-all 偵測 `/login?next=...` 之 next 不通過白名單；metadata `{ next, reason }`。
- `static_path_traversal_blocked`：catch-all 偵測 `..` / `%2e%2e` / `%252e%252e`；metadata `{ rawUrl, pattern }`。
- `session_expired`：`authMiddleware` 對受保護 API 回 401（僅 `extended` 模式寫入）；metadata `{ path, reason ∈ {'token-missing', 'token-invalid', 'token-expired', 'token-version-mismatch'} }`。

### 靜態檔白名單擴充（FR-026 / FR-028）

`PUBLIC_FILES` 擴充至 9 條：`/app.js`、`/style.css`、`/logo.svg`、`/favicon.svg`、`/vendor/webauthn.min.js`、`/lib/moneyDecimal.js`、`/changelog.json`、`/privacy.html`、`/terms.html`。

Cache-Control 規則：
- `/changelog.json`、`/index.html`：`no-cache`
- 其他白名單條目：`public, max-age=300`

### Modal 共用基底元件（FR-022 ~ FR-024b）

`ModalBase`（`app.js` 內 IIFE 物件）統一接管 12 個 Modal 之 lifecycle：history 整合（pushState `#modal-<id>` + popstate 判別）、捲動鎖（含 iOS Safari 防穿透）、堆疊規則（僅 `modalConfirm` 可疊在其他 Modal 上）、焦點 trap、ESC 關閉、初始焦點。

### 外觀模式跨裝置同步快取（FR-019 ~ FR-021a）

新增前端 localStorage key `theme_pref`（值域 `system` / `light` / `dark`）；三層 fallback：
1. localStorage `theme_pref`（樂觀渲染）
2. API response `themeMode`（覆寫 localStorage）
3. `prefers-color-scheme`（首次或非合法值）

登出清除：`localStorage.removeItem('theme_pref')`（FR-007b）。

