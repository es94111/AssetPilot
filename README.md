# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  自托管、資料加密的個人資產管理網頁應用 — 記帳、預算、股票紀錄、報表、稽核日誌，一站搞定。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.30.2-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen" alt="node">
  <img src="https://img.shields.io/badge/express-5.x-000000" alt="express">
  <img src="https://img.shields.io/badge/openapi-3.2.0-6BA539" alt="openapi">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 目錄

- [特色](#特色)
- [功能總覽](#功能總覽)
- [技術架構](#技術架構)
- [快速啟動](#快速啟動)
- [環境變數](#環境變數)
- [反向代理](#反向代理)
- [認證機制](#認證機制)
- [使用指南](#使用指南)
- [資料治理](#資料治理)
- [安全性](#安全性)
- [外部 API 來源](#外部-api-來源)
- [專案治理](#專案治理)
- [授權](#授權)

---

## 特色

| 特色 | 說明 |
| ---- | ---- |
| 🏠 自托管，資料自控 | 資料庫 ChaCha20-Poly1305 加密儲存於本地，財務資訊不上傳任何外部伺服器 |
| 🐳 Docker 一鍵部署 | 單行指令啟動；JWT 與資料庫加密金鑰首次啟動自動產生並寫入持久化 volume |
| 📊 台股深度整合 | 串接 TWSE OpenAPI：即時股價、除權息自動同步、FIFO 全精度逐筆損益 |
| 💱 多幣別支援 | 串接 exchangerate-api.com 即時匯率，ISO 4217 白名單驗證 |
| 🔐 多重認證 | 帳密 / Google SSO（Authorization Code Flow）/ Passkey（WebAuthn） |
| 🛡️ 稽核可審計 | 資料匯出匯入、備份還原、登入嘗試、路由攔截皆可追溯；保留天數可調 |
| 🧭 URL-first SPA | 任何頁面可直連、書籤、分享；F5 重整不掉頁；上一頁 / 下一頁完整還原 |
| 🌗 三模式主題 | system / light / dark；跨裝置同步；登入頁無 FOUC 樂觀渲染 |
| 📦 純伺服端 CSV | 匯出含 UTF-8 BOM + Formula Injection 防護；匯入採 DB transaction 原子化 |
| 📜 OpenAPI 3.2.0 | 完整契約檔案，可掛載至 Cloudflare API Shield 啟用 schema 驗證 |
| 📱 響應式設計 | 桌機側邊欄常駐、行動裝置漢堡選單；< 768px 自動切換 |

---

## 功能總覽

### 收支與預算

- **儀表板**：月份切換、總資產 / 收入 / 支出 / 淨額卡片、雙圓餅（含「（其他）」群組）、最近交易
- **交易管理**：CRUD、跨帳戶轉帳（雙向配對）、批次刪除 / 變更分類 / 變更日期、未來交易標記
- **預算管理**：月度總預算 + 分類預算；進度條四段配色（綠 / 中性 / 黃接近上限 / 紅超支）；歷史與未來月份切換
- **帳戶管理**：多幣別、銀行 / 信用卡 / 證券 / 現金，可排除特定帳戶於總資產統計
- **分類管理**：父子兩層、自訂顏色、CSV 匯出匯入（先父後子）
- **固定收支**：週期性收支自動產生交易，支援外幣；登入時 server-side 觸發（30 筆軟上限 + setImmediate 背景續跑）；並發冪等保護

### 股票投資

- **持股總覽**：即時市值、未實現損益、整體報酬率、三段策略抓股價（盤中即時 / 盤後收盤 / 備援）
- **股票交易**：手續費（0.1425%，整股最低 20 元）/ 證交稅（一般股 0.3%、ETF / 權證 0.1%）自動計算可手動覆寫
- **股利紀錄**：TWSE `TWT49U` / `TWT49UDetail` 除權息自動同步；現金股利對應入款交易帳戶反查
- **實現損益**：FIFO 全精度（decimal.js）逐筆計算，今年 / 總損益彙總；賣出鏈式約束驗證
- **定期定額**：遇 TWSE 休市日自動順延；歷史收盤價回填；`(plan_id, period_start_date)` 唯一鍵保 idempotency
- **下市標記**：凍結最後價格，後續查價自動跳過

### 統計與排程

- **統計報表**：分類圓餅（單 / 雙）+ 月度趨勢 + 每日消費 + 自訂時間範圍；同型前一段對比 pill；圓餅扇區可點擊跳轉
- **排程寄送**：多筆排程並存（每日 / 每週 / 每月）；以伺服器時區固定觸發；寄信通道支援 SMTP / Zeabur Email / Resend，主要通道執行期失敗自動退回備用通道；停用期間漏掉的觸發點不溯及補寄

### 資料治理（v4.28.0）

- **CSV 匯出**：交易 / 分類 / 股票交易 / 股利紀錄；純伺服端 stream + UTF-8 BOM + Formula Injection 防護
- **CSV 匯入**：互斥鎖（重入回 409）+ 全 DB transaction 原子化 + 進度回饋每 500 筆 + ISO 8601 嚴格驗證 + 多欄重複偵測
- **整檔備份 / 還原**：壓縮加密的 `.db` 檔案下載 / 上傳；還原失敗自動回滾至 `before-restore-{ts}.db`；管理員可列管 5 份 / 90 天內備份
- **稽核日誌**：管理員與使用者可分別檢視；支援過濾、CSV 匯出、清空、保留天數設定（30 / 90 / 180 / 365 / forever）

### 系統管理

- **使用者管理**：管理員可開關註冊、設定 Email 白名單、IP 白名單、新增 / 刪除 / 重設密碼
- **登入稽核**：時間、IP、國家、方式（密碼 / Google / Passkey）、成功 / 失敗
- **寄信通道**：以 `EMAIL_PROVIDER_PRIMARY` / `EMAIL_PROVIDER_FALLBACK` 環境變數指定主要與備用通道（值：`smtp` / `zeabur` / `resend` / 留空），支援 SMTP（Nodemailer）、Zeabur Email（ZSend HTTP API）、Resend；可選 `EMAIL_SENDER_NAME` 為三通道統一指定寄件人顯示名稱；管理員設定頁可即時檢視各通道是否設定並寄送測試信
- **路由稽核模式**（v4.29.0）：security（預設）/ extended（含 401 session 失效）/ minimal（路由稽核全部關閉）
- **API 使用與授權頁**：動態列出所有外部 API 來源、配額、合規授權字樣（IPinfo `IP address data is powered by IPinfo`）

---

## 技術架構

| 層級 | 技術 |
| ---- | ---- |
| 前端 | 原生 HTML / CSS / Vanilla JS（IIFE，無框架、無 build step）；URL-first SPA 路由 |
| 後端 | Node.js ≥ 24 + Express 5 |
| 資料庫 | SQLite（sql.js，記憶體 + 檔案持久化） |
| 加密 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| 認證 | JWT（HS256，httpOnly Cookie）+ bcryptjs；選配 Google OAuth Code Flow + Passkey（WebAuthn） |
| 金額精度 | decimal.js（FIFO / 匯率 / 手續費分攤前後端同構共用 `lib/moneyDecimal.js`） |
| 圖表 | Chart.js |
| 寄信 | SMTP（Nodemailer）/ Zeabur Email（ZSend HTTP API）/ Resend；以環境變數指定主備通道，執行期 fallback |
| 安全 | Helmet、express-rate-limit、CSP、SRI、CORS 白名單 |
| 契約 | OpenAPI 3.2.0（`openapi.yaml`） |

**完全不引入**：前端框架（React / Vue）、router 套件（page.js / Navigo）、Modal 函式庫（micromodal）、focus-trap、icon 字型（Lucide / Heroicons）、build 工具（Vite / esbuild）。所有 UI 行為以原生 DOM API + IIFE 模組實作。

---

## 快速啟動

### Docker（推薦）

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

開啟 <http://localhost:3000> 即可使用。`JWT_SECRET` 與 `DB_ENCRYPTION_KEY` 首次啟動自動產生並寫入 `/app/data/.env`，之後重啟自動讀取。

**Docker Compose 範例：**

```yaml
services:
  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - GOOGLE_CLIENT_ID=         # 選配
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

**映像檔：** [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot)，支援 `linux/amd64` + `linux/arm64`，基底 `node:24-alpine`，~180 MB，內建每 30 秒 `/api/config` 健康檢查。

### Node.js 直接執行

```bash
npm install              # Node.js ≥ 24
cp .env.example .env     # 依需求編輯
node server.js
```

### Synology NAS

Container Manager → Registry → 搜尋 `es94111/assetpilot` → 下載 → Create → Port `3000:3000` → 啟動。
自訂網域請用 DSM **控制台 → 登入入口 → 反向代理**，並在自訂標題加入 `X-Forwarded-For: $proxy_add_x_forwarded_for`。

### Volume 備份 / 還原

```bash
# 備份（含資料庫與金鑰；兩者缺一無法還原）
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 還原
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ Volume 與 `.env` 內的金鑰為一組；切勿單獨刪除 `/app/data/.env`，否則資料庫無法解密。

---

## 環境變數

Docker 多數參數已有合理預設，重點關注「自動產生」與「功能選配」區塊。Node.js 直接執行請複製 `.env.example`。

| 變數 | 類別 | 說明 | 預設值 |
| ---- | ---- | ---- | ------ |
| `PORT` | 基本 | 伺服器埠號 | `3000` |
| `DB_PATH` | 基本 | 資料庫檔案路徑 | `./database.db`（Docker：`/app/data/database.db`） |
| `JWT_EXPIRES` | 基本 | JWT 有效期限 | `7d` |
| `JWT_SECRET` | 🔑 自動 | JWT 簽章金鑰，64 字元 hex（首次啟動自動產生） | — |
| `DB_ENCRYPTION_KEY` | 🔑 自動 | 資料庫 ChaCha20 金鑰，64 字元 hex（自動產生） | — |
| `ENV_PATH` | 🔑 自動 | 自動產生金鑰的存放路徑 | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | SSO | Google OAuth 2.0 Client ID（留空停用 SSO） | — |
| `GOOGLE_CLIENT_SECRET` | SSO | Google OAuth Client Secret | — |
| `GOOGLE_OAUTH_REDIRECT_URIS` | SSO | OAuth 重定向 URI 白名單，逗號分隔 | 自動推導 |
| `ALLOWED_ORIGINS` | 安全 | CORS 白名單，逗號分隔（正式環境建議設定） | — |
| `ADMIN_IP_ALLOWLIST` | 安全 | 管理員 IP 白名單，逗號分隔，略過速率限制 | — |
| `EXCHANGE_RATE_API_KEY` | 選配 | exchangerate-api.com Key | `free` |
| `IPINFO_TOKEN` | 選配 | ipinfo.io Token，提升 IP 查詢配額 | — |
| `TWSE_MAX_CONCURRENCY` | 選配 | TWSE 並發查詢上限 | `5` |
| `SSL_CERT` / `SSL_KEY` | 選配 | Cloudflare Origin Certificate 路徑（管理員 UI 可上傳，需重啟套用） | — |
| `EMAIL_PROVIDER_PRIMARY` | 寄信 | 主要寄信通道：`smtp` / `zeabur` / `resend` / 留空（停用） | — |
| `EMAIL_PROVIDER_FALLBACK` | 寄信 | 備用寄信通道（同上選項；留空或與 primary 同則不啟用 fallback） | — |
| `EMAIL_SENDER_NAME` | 寄信 | 寄信人顯示名稱（三通道共用，例：`AssetPilot`）；若 FROM 變數已是 `Name <email>` 格式則尊重該通道既有設定 | — |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | 寄信 | SMTP 通道設定（Gmail / Outlook 等；465 走 TLS 設 `SMTP_SECURE=true`，587 走 STARTTLS 設 false） | `SMTP_PORT=587`、`SMTP_SECURE=false` |
| `ZEABUR_API_KEY` | 寄信 | [Zeabur Email / ZSend](https://zeabur.com/docs/en-US/email/quick-start) API Key | — |
| `ZEABUR_FROM_EMAIL` | 寄信 | Zeabur Email 寄件人，須為已驗證寄件網域 | — |
| `RESEND_API_KEY` | 寄信 | [Resend](https://resend.com/api-keys) API Key | — |
| `RESEND_FROM_EMAIL` | 寄信 | Resend 寄件人，須為已驗證網域信箱 | — |
| `APP_URL` | 寄信 | 對外網址，用於信件 CTA 按鈕（留空則隱藏） | — |

> 💡 **寄信通道**（v4.30.0 起）一律由環境變數設定。`EMAIL_PROVIDER_PRIMARY` 留空則寄信功能停用；`EMAIL_PROVIDER_FALLBACK` 僅在 primary 執行期失敗時觸發（不重試、不補寄）。對應通道的設定變數需配合補齊（例：選 `smtp` 需設 `SMTP_HOST` 等；選 `zeabur` 需設 `ZEABUR_API_KEY` 與 `ZEABUR_FROM_EMAIL`）。

---

## 反向代理

### Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy 自動申請並續期 HTTPS 憑證。

### Cloudflare Tunnel

可直接掛 Cloudflare Tunnel 後啟用 API Shield → 上傳 `openapi.yaml` 啟用 schema 驗證。

---

## 認證機制

支援三種登入方式，皆可同時啟用：

### 帳密登入

預設啟用。第一位註冊的使用者自動成為管理員。可由管理員開關「公開註冊」與「Email 白名單」。

### Google SSO（Authorization Code Flow）

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
2. **已授權 JavaScript 來源**：本機 `http://localhost:3000`、正式 `https://your-domain.com`
3. **已授權重新導向 URI**：本機 `http://localhost:3000/`、正式 `https://your-domain.com/`（含尾端 `/`）
4. 將 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 設為環境變數啟動
5. 未設定時 Google 登入按鈕自動隱藏，不影響其他登入方式

> ⚠️ 若登入後停在 `/?code=...`，請確認重新導向 URI 與網域完全一致（含 `https://` 與尾端 `/`）。

### Passkey（WebAuthn）

登入後可至「個人設定 → 安全」綁定。支援 Touch ID / Face ID / Windows Hello / 硬體金鑰；採 `@passwordless-id/webauthn` 純前端實作 + 後端驗證。

---

## 使用指南

### 首次使用

1. 開啟 `http://localhost:3000` → **立即註冊**
2. **第一位註冊的使用者自動成為管理員**
3. 系統自動建立預設分類（食、衣、住、行 ...）與預設帳戶（現金、銀行帳戶）

### URL 直連

任何頁面皆可直接以網址訪問或加入書籤；F5 重整不掉頁；瀏覽器上一頁 / 下一頁完整還原（含捲動位置）。未登入訪客被導向 `/login?next=<原 URL>`，登入成功後自動跳回。

| URL | 說明 |
| --- | --- |
| `/` | 公開首頁 |
| `/login` | 登入頁 |
| `/dashboard` | 儀表板 |
| `/finance/transactions`, `/finance/reports`, `/finance/budget`, `/finance/accounts`, `/finance/categories`, `/finance/recurring` | 收支管理 |
| `/stocks`, `/stocks/transactions`, `/stocks/dividends`, `/stocks/realized` | 股票投資 |
| `/settings/account`, `/settings/admin`, `/settings/export` | 設定（admin 僅管理員可見） |
| `/api-credits` | API 使用與授權 |
| `/privacy`, `/terms` | 隱私權政策 / 服務條款 |

### 信用卡繳費

使用信用卡消費時記為「**支出**」+ 信用卡帳戶（餘額顯示負數=真實負債）。繳費時類型選「**轉帳**」，從銀行帳戶轉至信用卡帳戶，即可扣除銀行餘額並沖銷信用卡負數，不重複計算為支出。

### 股票

- **新增持股**：輸入股票代號（如 `2330`），系統自動從 TWSE 查詢帶入名稱與現價；手續費、交易稅自動計算可手動修改
- **更新股價**：三段策略 — 盤中 TWSE 即時、盤後 `STOCK_DAY` 今日收盤、其他時段 `STOCK_DAY_ALL` 備援
- **同步除權息**：依持股期間自動新增現金 / 股票股利，不重複；阻擋式 Modal 含進度條與取消按鈕

### CSV 匯出匯入

| 類型 | 欄位 |
| ---- | ---- |
| 交易記錄 | 日期、類型、金額、幣別、分類、帳戶、備註 |
| 分類 | 父分類 / 子分類、類型（收入 / 支出）、顏色 |
| 股票交易 | 日期、代號、名稱、類型、股數、成交價、手續費、交易稅、帳戶、備註 |
| 股利紀錄 | 日期、代號、名稱、現金股利、股票股利、備註 |

匯入時若股票代號不存在會自動建立；名稱不正確會以 CSV 內的名稱更新。匯入採互斥鎖 + DB transaction 原子化，發生錯誤會整批回滾。

---

## 資料治理

### 資料操作稽核日誌（v4.28.0）

每次 CSV 匯出 / 匯入、整檔備份 / 還原皆寫入 `data_operation_audit_log`，欄位含使用者、IP、UA、時間、結果、metadata（如 imported / skipped / errors / byteSize）。

- 一般使用者可至「個人設定 → 我的操作紀錄」檢視自己的歷史（後端強制 user_id 覆寫）
- 管理員可至「管理員 → 資料操作稽核日誌」檢視全部，支援過濾、CSV 匯出、清空、保留天數調整（30 / 90 / 180 / 365 / forever）

### 路由稽核模式（v4.29.0）

`system_settings.route_audit_mode`：

| 模式 | 寫入事件 |
| --- | --- |
| `security`（預設） | admin path blocked / open redirect blocked / static path traversal blocked |
| `extended` | security 範圍 + 401 session_expired |
| `minimal` | 本功能定義之路由稽核全部不寫入；既有 007 稽核行為不受影響 |

切換立即生效，不需重啟。

### 整檔備份 / 還原

- **下載備份**：管理員可下載當前資料庫（檔名 `assetpilot-backup-{YYYYMMDDHHmmss}.db`）；按下下載前彈出敏感資料警示確認 Modal
- **還原**：上傳備份檔；通過驗證後寫入 `backups/before-restore-{ts}.db`；替換失敗自動回滾並回 `422 RESTORE_FAILED_ROLLED_BACK`
- **自動備份保留**：保留最近 5 份且 ≤ 90 天；管理員可手動刪除（雙重防路徑遍歷：`path.basename` + regex）

---

## 安全性

| 機制 | 說明 |
| ---- | ---- |
| 資料庫加密 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 金鑰推導 |
| 密碼加密 | bcryptjs 雜湊儲存，不明文保存 |
| XSS 防護 | 所有使用者輸入經 `escHtml()` 跳脫後才插入 DOM |
| 安全標頭 | Helmet（HSTS、X-Content-Type-Options、Referrer-Policy） |
| CSP | 限制 inline script 與外部資源來源 |
| 速率限制 | 登入 / 註冊每 IP 每 15 分鐘最多 20 次；公開頁面每分鐘最多 120 次 |
| Cloudflare API Shield | OpenAPI 3.2.0 Schema（`openapi.yaml`），可啟用請求驗證 |
| CORS 控制 | `ALLOWED_ORIGINS` 白名單 |
| OAuth 防 CSRF | Google 登入使用一次性 state（10 分鐘 TTL） |
| `?next=` 開放重定向防護 | 5 條規則白名單：相對路徑 / 拒 protocol-relative / 拒 `://` / pathname 必須命中前端 ROUTES 表 |
| 路徑遊走偵測 | catch-all 偵測 `..` / `%2e%2e` / `%252e%252e`；寫稽核日誌 |
| Admin path 攔截 | 後端維護 `ADMIN_ONLY_PATHS` 常數陣列；非管理員命中時寫稽核並由前端渲染 404 訊息頁 |
| Formula Injection 防護 | CSV 匯出對所有以 `=` `+` `-` `@` 開頭的欄位前置撇號 |
| SRI | 外部 CDN 腳本（Font Awesome、Chart.js、decimal.js）完整性驗證 |
| 登入稽核 | 記錄時間、IP、國家、方式；管理員可查失敗嘗試與帳號鎖定狀態 |

---

## 外部 API 來源

| 服務 | 用途 | 連結 |
| ---- | ---- | ---- |
| TWSE OpenAPI | 台股即時股價、收盤、除權息 | <https://openapi.twse.com.tw/> |
| exchangerate-api.com | 全球即時匯率（基礎 TWD） | <https://www.exchangerate-api.com/> |
| Google Identity Services | Google SSO 登入 | <https://developers.google.com/identity> |
| IPinfo Lite | IP 國家查詢（合規授權字樣固定顯示於 API 使用頁） | <https://ipinfo.io/lite> |
| SMTP（Nodemailer） | 排程信件 / 系統通知（Gmail / Outlook 等） | <https://nodemailer.com/> |
| Zeabur Email（ZSend） | 排程信件 / 系統通知 | <https://zeabur.com/docs/en-US/email/quick-start> |
| Resend | 排程信件 / 系統通知 | <https://resend.com/> |

完整列表與授權字樣可在執行中應用程式的 `/api-credits` 頁面查看。

---

## 專案治理

本專案採用 [Spec-Driven Development](https://github.com/github/spec-kit) 工作流程。每個功能皆有完整的 spec → research → plan → contracts → tasks → implementation 軌跡，存於 `specs/<NNN-feature-name>/` 下。

| 工件 | 用途 |
| --- | --- |
| `spec.md` | 使用者導向的功能規格與驗收條件 |
| `research.md` | 技術選型決策記錄 |
| `plan.md` | 實作計畫與檔案影響面 |
| `data-model.md` | 資料模型與 schema 變更 |
| `contracts/*.openapi.yaml` | API 契約 delta（OpenAPI 3.2.0）|
| `quickstart.md` | 手動驗證劇本 |
| `tasks.md` | 可執行任務清單 |
| `checklists/` | 上線前檢查表 |

專案憲章：[`.specify/memory/constitution.md`](.specify/memory/constitution.md)
完整變更歷史：[`changelog.json`](changelog.json) | 軟體需求規格：[`SRS.md`](SRS.md)

---

## 授權

[GNU AGPL v3](LICENSE)

> 本軟體採 AGPL v3 授權；**只要任何人能透過網路使用您運行的這個程式（即使您只是自托管給朋友家人用）**，您就有義務以同樣 AGPL v3 條款公開您的修改原始碼。商業授權請另行洽談。
