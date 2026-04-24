# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  自托管、資料加密的個人資產管理網頁應用 — 記帳、股票紀錄、預算管理，一站搞定。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.21.1-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
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
- [Google SSO](#google-sso)
- [使用指南](#使用指南)
- [安全性](#安全性)
- [外部 API 來源](#外部-api-來源)
- [授權](#授權)

---

## 特色

| 特色 | 說明 |
| ---- | ---- |
| 🏠 自托管，資料自控 | 資料庫 ChaCha20-Poly1305 加密儲存於本地，不上傳任何財務資訊至外部伺服器 |
| 🐳 Docker 一鍵部署 | 單行指令啟動；JWT 金鑰與加密金鑰首次啟動自動產生 |
| 📊 台股深度整合 | 串接 TWSE OpenAPI：即時股價、除權息自動同步、FIFO 損益計算 |
| 💱 多幣別支援 | 150+ 種幣別，串接 exchangerate-api.com 即時匯率 |
| 📱 響應式設計 | 桌機與手機皆可流暢使用 |
| 🔒 企業級安全 | Helmet 安全標頭、速率限制、CSP、SRI、登入稽核 |
| 👥 多帳號 / SSO | 多使用者管理；選配 Google OAuth Code Flow |

---

## 功能總覽

- **儀表板**：總資產卡片、收支圓餅圖、資產配置（含股票市值）、近期交易
- **收支管理**：交易 CRUD、帳戶間轉帳（雙向配對）、多筆批次刪除 / 變更分類 / 日期、未來交易標記
- **預算管理**：月度總預算 + 分類預算，進度條視覺化
- **帳戶 / 分類 / 匯率**：多幣別帳戶、父子兩層分類、自訂顏色、匯率手動 / 自動同步
- **固定收支**：週期性收支自動產生交易，支援外幣
- **股票紀錄**
  - 持股總覽：即時市值、未實現損益、三段策略抓股價
  - 交易紀錄：手續費（0.1425%，整股最低 20 元）/ 證交稅（一般股 0.3%、ETF/權證 0.1%）自動計算
  - 股利紀錄：TWSE `TWT49U` / `TWT49UDetail` 除權息自動同步
  - 實現損益：FIFO 逐筆計算，彙總今年 / 總損益
  - 定期定額：遇 TWSE 休市日自動順延下一個交易日
- **統計報表**：分類圓餅（支援雙圓餅）、月度趨勢、每日消費、自訂時間範圍
- **資料匯出匯入**：交易記錄 / 股票交易 / 股利紀錄 CSV
- **管理員**：開關註冊、Email 白名單、新增 / 刪除帳號、登入稽核（IP、國家、成功/失敗）
- **排程寄送報表**：以台灣時區固定 UTC+8 觸發，支援 Resend / SMTP

---

## 技術架構

| 層級 | 技術 |
| ---- | ---- |
| 前端 | 原生 HTML / CSS / JavaScript（SPA，`history.pushState`） |
| 後端 | Node.js ≥ 18 + Express |
| 資料庫 | SQLite（sql.js，記憶體 + 檔案持久化） |
| 加密 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 |
| 認證 | JWT（Bearer Token）+ bcryptjs，選配 Google OAuth Code Flow |
| 圖表 | Chart.js |
| 安全 | Helmet、express-rate-limit、SRI、CORS 白名單、CSP |

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

### 備份 / 還原

```bash
# 備份（含資料庫與金鑰，兩者缺一無法還原）
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 還原
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

### Node.js 直接執行

```bash
npm install
cp .env.example .env    # 依需求編輯
node server.js
```

### Synology NAS

Container Manager → Registry → 搜尋 `es94111/assetpilot` → 下載 → Create → Port `3000:3000` → 啟動。自訂網域請用 DSM **控制台 → 登入入口 → 反向代理**，並在自訂標題加入 `X-Forwarded-For: $proxy_add_x_forwarded_for`。

---

## 環境變數

Docker 多數參數已有合理預設，只需關注「自動產生」與「功能選配」區塊。Node.js 直接執行請複製 `.env.example`。

| 變數 | 類別 | 說明 | 預設值 |
| ---- | ---- | ---- | ------ |
| `PORT` | 基本 | 伺服器埠號 | `3000` |
| `DB_PATH` | 基本 | 資料庫檔案路徑 | `./database.db`（Docker: `/app/data/database.db`） |
| `JWT_EXPIRES` | 基本 | JWT 有效期限 | `7d` |
| `JWT_SECRET` | 🔑 自動 | JWT 簽章金鑰，64 字元 hex（Docker 首次啟動自動產生） | — |
| `DB_ENCRYPTION_KEY` | 🔑 自動 | 資料庫 ChaCha20 金鑰，64 字元 hex（Docker 自動產生） | — |
| `ENV_PATH` | 🔑 自動 | 自動產生金鑰的存放路徑 | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | SSO | Google OAuth 2.0 Client ID（留空停用 SSO） | — |
| `GOOGLE_CLIENT_SECRET` | SSO | Google OAuth Client Secret | — |
| `ALLOWED_ORIGINS` | 安全 | CORS 白名單，逗號分隔（正式環境建議設定） | — |
| `ADMIN_IP_ALLOWLIST` | 安全 | 管理員 IP 白名單，逗號分隔，略過速率限制 | — |
| `EXCHANGE_RATE_API_KEY` | 選配 | exchangerate-api.com Key | `free` |
| `IPINFO_TOKEN` | 選配 | ipinfo.io Token，提升 IP 查詢配額 | — |
| `SSL_CERT` / `SSL_KEY` | 選配 | Cloudflare Origin Certificate 路徑（可由管理員面板上傳，需重啟套用） | — |
| `RESEND_API_KEY` | 寄信 | [Resend](https://resend.com/api-keys) API Key（管理員寄送資產統計報表用） | — |
| `RESEND_FROM_EMAIL` | 寄信 | Resend 寄件人，須為已驗證網域信箱 | — |
| `APP_URL` | 寄信 | 對外網址，用於信件 CTA 按鈕（留空則隱藏） | — |

> ⚠️ **Volume 與金鑰為一組**，請勿單獨刪除 `/app/data/.env`，否則資料庫將無法讀取。
>
> 💡 **SMTP 寄信**（Gmail / Outlook）**不走環境變數**，請至「管理員 → SMTP 寄信設定」UI 直接輸入 Host / Port / User / Password / From / TLS，即時生效。SMTP 設了會優先於 Resend。

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

---

## Google SSO

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
2. **已授權 JavaScript 來源**：本機 `http://localhost:3000`、正式 `https://your-domain.com`
3. **已授權重新導向 URI**：本機 `http://localhost:3000/`、正式 `https://your-domain.com/`（含尾端 `/`）
4. 將 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 設為環境變數啟動
5. 未設定時 Google 登入按鈕自動隱藏，不影響帳號密碼登入

> ⚠️ 若登入後停在 `/?code=...`，請確認重新導向 URI 與網域完全一致（含 `https://` 與尾端 `/`）。

---

## 使用指南

### 首次使用

1. 開啟 `http://localhost:3000` → **立即註冊**
2. **第一位註冊的使用者自動成為管理員**
3. 系統自動建立預設分類與預設帳戶（現金、銀行帳戶）

### 信用卡繳費

使用信用卡消費時記為「**支出**」+ 信用卡帳戶（餘額顯示負數=真實負債）。繳費時類型選「**轉帳**」，從銀行帳戶轉至信用卡帳戶，即可扣除銀行餘額並沖銷信用卡負數，不重複計算為支出。

### 股票

- **新增持股**：輸入股票代號（如 `2330`），系統自動從 TWSE 查詢帶入名稱與現價；手續費、交易稅自動計算可手動修改
- **更新股價**：三段策略 — 盤中 TWSE 即時、盤後 `STOCK_DAY` 今日收盤、其他時段 `STOCK_DAY_ALL` 備援
- **同步除權息**：依持股期間自動新增現金 / 股票股利，不重複

### CSV 匯出匯入

| 類型 | 欄位 |
| ---- | ---- |
| 交易記錄 | 日期、類型、金額、幣別、分類、帳戶、備註 |
| 股票交易 | 日期、代號、名稱、類型、股數、成交價、手續費、交易稅、帳戶、備註 |
| 股利紀錄 | 日期、代號、名稱、現金股利、股票股利、備註 |

匯入時若股票代號不存在會自動建立；名稱不正確會以 CSV 內的名稱更新。

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
| Cloudflare API Shield | 提供 OpenAPI 3.0.3 Schema（`openapi.yaml`），可啟用請求驗證 |
| CORS 控制 | `ALLOWED_ORIGINS` 白名單 |
| OAuth 防 CSRF | Google 登入使用一次性 state |
| SRI | 外部 CDN 腳本（Font Awesome、Chart.js）完整性驗證 |
| 登入稽核 | 記錄時間、IP、國家、方式；管理員可查失敗嘗試 |

---

## 外部 API 來源

| 服務 | 用途 | 連結 |
| ---- | ---- | ---- |
| TWSE OpenAPI | 台股即時股價、除權息 | <https://openapi.twse.com.tw/> |
| exchangerate-api.com | 全球即時匯率（基礎 TWD） | <https://www.exchangerate-api.com/> |
| Google Identity Services | Google SSO 登入 | <https://developers.google.com/identity> |
| IPinfo Lite | IP 國家查詢 | <https://ipinfo.io/lite> |

---

## 授權

[GNU AGPL v3](LICENSE)
