# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  🏠 <b>自托管</b>、🔒 <b>資料加密</b>的個人資產管理平台（Web + Android App）<br>
  記帳、預算、台股投資、報表、稽核日誌 — 一站搞定，資料完全掌控在自己手上。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.112.3-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D24-brightgreen" alt="node">
  <img src="https://img.shields.io/badge/next.js-16.x-000000" alt="next.js">
  <img src="https://img.shields.io/badge/认证-Google%2FLINE%2FPasskey-green" alt="auth">
  <img src="https://img.shields.io/badge/openapi-3.2.0-6BA539" alt="openapi">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
</p>

---

## 目錄

- [專案優勢](#專案優勢)
- [螢幕截圖](#螢幕截圖)
- [快速部屬教學](#部屬教學)
- [環境變數](#環境變數)
- [反向代理](#反向代理)
- [認證機制](#認證機制)
- [功能總覽](#功能總覽)
- [使用指南](#使用指南)
- [資料治理](#資料治理)
- [安全性](#安全性)
- [外部 API 來源](#外部-api-來源)
- [專案治理](#專案治理)
- [授權](#授權)

---

## 專案優勢

> 為什麼要自托管一個資產管理平台，而不是用現成的記帳 App？因為 **你的財務資料，應該由你自己掌控。**

| 優勢 | 說明 |
| ---- | ---- |
| 🏠 **自托管，資料自控** | 資料庫以 ChaCha20-Poly1305 加密儲存在**你自己的**伺服器，財務資訊**不上傳任何外部伺服器**，所有權完全屬於你。 |
| 🐳 **一鍵 Docker 部部署** | 單行指令啟動；`JWT_SECRET` 等敏感金鑰**首次啟動自動產生**並寫入持久化 Volume，重啟自動讀取，不用手動設定密鑰。 |
| 📊 **台股深度整合** | 串接 TWSE OpenAPI：即時股價、除權息自動同步、FIFO **全精度逐筆損益**（decimal.js）、定期定額自動順延休市日、下市凍結處理。 |
| 💱 **多幣別支援** | 串接 exchangerate-api.com 即時匯率，ISO 4217 白名單驗證，台股／美股／外幣一體管理。 |
| 🔐 **無密碼多重認證** | Google SSO / LINE Login / Passkey（WebAuthn）三種方式，**不提供本機密碼**——不需要記密碼，也不用怕密碼被盜。 |
| 🛡️ **安全可審計** | CSP、SRI、CORS 白名單、記憶體內速率限制、路徑遊走偵測、Formula Injection 防護；匯出匯入、備份還原、登入嘗試全部留下稽核軌跡。 |
| 🤖 **AI 助理整合** | 支援 **MCP OAuth 2.1**，可將 ChatGPT、Claude 等 AI 工具直接連到你的帳本，讓 AI 幫你記帳；PAT 相容模式與逐憑證寫入權限控制。 |
| 🧭 **URL-first SPA** | 任何頁面可直連、可書籤、可分享；F5 重整不掉頁；上一頁／下一頁完整還原。 |
| 📦 **純伺服端 CSV** | 匯出含 UTF-8 BOM + Formula Injection 防護；匯入採 DB transaction 原子化，失敗整批回滾。 |
| 🌗 **三模式主題** | system / light / dark 跨裝置同步；登入頁無 FOUC 樂觀渲染。 |
| 📱 **響應式 + Android App** | 桌機側邊欄常駐、行動裝置漢堡選單；另有 Android 原生 App，隨時隨地記帳。 |

---

## 螢幕截圖

> 以下為 Google Play 商店行銷截圖（App 深色／淺色）與網頁版行銷截圖，皆為真實 AssetPilot 介面搭配標題文案，深色／淺色主題皆為系統內建即時切換，非後製合成。

### App（Android）— 深色主題

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/01-device-bottom.png" width="200" alt="儀表板"><br><sub><b>儀表板</b><br>資產全貌，一手掌握</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/02-device-bottom.png" width="200" alt="記帳"><br><sub><b>記帳</b><br>3 秒記一筆帳</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/03-device-bottom.png" width="200" alt="預算"><br><sub><b>預算</b><br>設定預算，避免超支</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/04-device-bottom.png" width="200" alt="持股"><br><sub><b>持股</b><br>台股持股，一手掌握</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/05-device-bottom.png" width="200" alt="已實現損益"><br><sub><b>已實現損益</b><br>清楚透明</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/06-device-bottom.png" width="200" alt="統計報表"><br><sub><b>統計報表</b><br>圖表看懂現金流向</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/07-device-bottom.png" width="200" alt="登入"><br><sub><b>登入</b><br>安全連線，資料加密（Google / Passkey）</sub></td>
    <td align="center" width="25%"><img src="docs/android-dark/zh-TW/08-no-device.png" width="200" alt="總結"><br><sub><b>一站掌握</b><br>記帳、預算、股票、報表</sub></td>
  </tr>
</table>

### App（Android）— 淺色主題

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/01-device-bottom.png" width="200" alt="儀表板"><br><sub><b>儀表板</b><br>資產全貌，一手掌握</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/02-device-bottom.png" width="200" alt="記帳"><br><sub><b>記帳</b><br>3 秒記一筆帳</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/03-device-bottom.png" width="200" alt="預算"><br><sub><b>預算</b><br>設定預算，避免超支</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/04-device-bottom.png" width="200" alt="持股"><br><sub><b>持股</b><br>台股持股，一手掌握</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/05-device-bottom.png" width="200" alt="已實現損益"><br><sub><b>已實現損益</b><br>清楚透明</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/06-device-bottom.png" width="200" alt="統計報表"><br><sub><b>統計報表</b><br>圖表看懂現金流向</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/07-device-bottom.png" width="200" alt="登入"><br><sub><b>登入</b><br>安全連線，資料加密（Google / Passkey）</sub></td>
    <td align="center" width="25%"><img src="docs/android-light/zh-TW/08-no-device.png" width="200" alt="總結"><br><sub><b>一站掌握</b><br>記帳、預算、股票、報表</sub></td>
  </tr>
</table>

### Web 行銷截圖

<table>
  <tr>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/01-device-bottom.png" width="280" alt="儀表板"><br><sub><b>儀表板</b><br>資產全貌，一手掌握</sub></td>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/02-device-bottom.png" width="280" alt="記帳"><br><sub><b>記帳</b><br>3 秒記一筆帳</sub></td>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/03-device-bottom.png" width="280" alt="預算"><br><sub><b>預算</b><br>設定預算，避免超支</sub></td>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/04-device-bottom.png" width="280" alt="持股"><br><sub><b>持股</b><br>台股持股，一手掌握</sub></td>
  </tr>
  <tr>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/05-device-bottom.png" width="280" alt="已實現損益"><br><sub><b>已實現損益</b><br>清楚透明</sub></td>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/06-device-bottom.png" width="280" alt="統計報表"><br><sub><b>統計報表</b><br>圖表看懂現金流向</sub></td>
    <td align="center" width="25%"><img src="docs/web-marketing/zh-TW/07-device-bottom.png" width="280" alt="登入"><br><sub><b>登入</b><br>安全連線，資料加密（Google / Passkey）</sub></td>
    <td align="center" width="25%"></td>
  </tr>
</table>

---

## 部部署教學

> 以下是完整部部署步驟，依你的環境選擇一種方式。**所有方式皆可在一小時內完成上線。**

### 需求

| 需求 | 說明 |
| ---- | ---- |
| Docker | Docker 20.10+（或 Podman） |
| 記憶體 | ≥ 512 MB（建議 1 GB） |
| 磁碟 | 資料量小，一般家庭 NAS／VPS 皆足夠 |
| 資料庫 | PostgreSQL（Compose 內建，亦支援外部） |

---

### 方式 A：單行 Docker 快速啟動（最簡單）

不需要 PostgreSQL 環境變數也可跑（會以內建 SQLite 相容層啟動；正式建議用 PostgreSQL，見方式 B）。

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

開啟 **<http://localhost:3000>** 即可使用。`JWT_SECRET` 首次啟動自動產生並寫入 `/app/data/.env`，之後重啟自動讀取。

**部部署完成的驗收檢查：**

```bash
docker ps | grep assetpilot          # 狀態為 healthy
docker exec assetpilot wget -qO- http://localhost:3000/api/config | head   # 回傳 200
```

---

### 方式 B：Docker Compose（含 PostgreSQL，建議正式環境）

建立 `docker-compose.yml`：

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: assetpilot-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=assetpilot
      - POSTGRES_USER=assetpilot
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-assetpilot}
    volumes:
      - assetpilot-postgres:/var/lib/postgresql/data

  assetpilot:
    image: es94111/assetpilot:latest
    container_name: assetpilot
    restart: unless-stopped
    depends_on:
      - postgres
    ports:
      - "3000:3000"
    volumes:
      - assetpilot-data:/app/data
    environment:
      - PORT=3000
      - HOSTNAME=0.0.0.0
      - DATABASE_URL=${DATABASE_URL:-postgres://assetpilot:assetpilot@postgres:5432/assetpilot}
      - ENV_PATH=/app/data/.env
      - GOOGLE_CLIENT_ID=          # 選配，設定後啟用 Google 登入
      # - LINE_CHANNEL_ID=         # 選配，LINE 登入

volumes:
  assetpilot-data:
    driver: local
  assetpilot-postgres:
    driver: local
```

啟動並驗證：

```bash
docker compose up -d
docker compose logs -f assetpilot   # 看到 "Ready" 即完成
```

> 帳號採用「外部服務登入」模式：**第一位完成 Google／LINE 登入的使用者自動成為管理員**，不需要後台手動建帳號。

---

### 方式 C：Synology NAS（專用教學）

1. 開啟 **Container Manager → Registry**，搜尋 `es94111/assetpilot` → **下載**。
2. 到 **Container → 新增**，選擇剛下載的映像，名稱設 `assetpilot`。
3. **連接埠設定**：本機 `3000` 對應容器 `3000`。
4. **儲存空間設定**：新增 Volume，掛載 `/app/data`（並可另掛 PostgreSQL 資料）。
5. **環境變數**：加入 `PORT=3000`、`HOSTNAME=0.0.0.0`，以及選配的 `GOOGLE_CLIENT_ID` 等。
6. 點擊 **啟動**。

自訂網域請用 **DSM → 控制台 → 登入入口 → 反向代理**，並在自訂標題加入 `X-Forwarded-For: $proxy_add_x_forwarded_for`。

---

### 方式 D：Node.js 直接執行（開發／本機）

```bash
npm install                 # 需 Node.js ≥ 24
cp .env.example .env        # 依需求編輯（至少設定 DATABASE_URL）
npm run dev                 # 開發模式
```

**正式環境（build / start）：**

```bash
npm run build
npm run start
```

---

### 6. 反向代理（上 HTTPS，正式必備）

AssetPilot 本身不需掛在 HTTPS 後即可運作，但要對外上線（尤其用 Google / LINE 登入）強烈建議用反向代理。三種常見選項任選一：

<details>
<summary><b>Nginx</b></summary>

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

</details>

<details>
<summary><b>Caddy（自動 HTTPS）</b></summary>

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy 自動申請並續期 HTTPS 憑證，最省事。
</details>

<details>
<summary><b>Cloudflare Tunnel（可配 API Shield）</b></summary>

直接掛 Cloudflare Tunnel 後，可啟用 API Shield → 上傳 `openapi.yaml` 啟用 schema 驗證。
</details>

---

### 7. 資料備份 / 還原

```bash
# 備份應用設定與 SSL 憑證（PostgreSQL 資料請備份 assetpilot-postgres volume）
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 還原
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **PostgreSQL 資料位於資料庫 volume**；`assetpilot-data` 只保存應用設定與 SSL 憑證。強烈建議在管理員頁使用**整檔 SQL 備份／還原**功能（支援下載、還原失敗自動回滾、MEGA S4 雲端備份）。

**映像檔資訊**：[`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) — 支援 `linux/amd64` + `linux/arm64`，基底 `node:24-alpine`，約 180 MB，內建每 30 秒 `/api/config` 健康檢查，以非 root 使用者執行。

---

## 環境變數

Docker 多數參數已有合理預設，只需關心「自動產生」與「功能選配」兩區塊。Node.js 直接執行請複製 `.env.example`。

| 變數 | 類別 | 說明 | 預設值 |
| ---- | ---- | ---- | ------ |
| `PORT` | 基本 | 伺服器埠號 | `3000` |
| `DATABASE_URL` / `POSTGRES_URL` | 基本 | PostgreSQL 連線字串 | — |
| `JWT_EXPIRES` | 基本 | 瀏覽器登入 JWT 有效期限 | `7d` |
| `APP_JWT_EXPIRES` | 基本 | App 登入 JWT 有效期限（Token 存於裝置端加密儲存） | `90d` |
| `JWT_SECRET` | 🔑 自動 | JWT 簽章金鑰，64 字元 hex（首次啟動自動產生） | — |
| `ENV_PATH` | 🔑 自動 | 自動產生金鑰的存放路徑 | `/app/data/.env` |
| `GOOGLE_CLIENT_ID` | SSO | Google OAuth Client ID（留空停用 Google 登入） | — |
| `GOOGLE_CLIENT_SECRET` | SSO | Google OAuth Client Secret | — |
| `LINE_CHANNEL_ID` | SSO | LINE Login Channel ID（留空停用） | — |
| `LINE_CHANNEL_SECRET` | SSO | LINE Login Channel Secret | — |
| `ALLOWED_ORIGINS` | 安全 | CORS 白名單，逗號分隔（正式環境建議設定） | — |
| `ADMIN_IP_ALLOWLIST` | 安全 | 管理員 IP 白名單，逗號分隔 | — |
| `EXCHANGE_RATE_API_KEY` | 選配 | exchangerate-api.com Key | `free` |
| `IPINFO_TOKEN` | 選配 | ipinfo.io Token，提升 IP 查詢配額 | — |
| `STOCK_AUTO_UPDATE_ENABLED` | 選配 | 股價自動更新總開關 | — |
| `STOCK_AUTO_UPDATE_INTERVAL_MIN` | 選配 | 股價自動更新間隔（分鐘） | `10` |
| `MEGA_S4_*` | 選配 | MEGA S4 雲端備份的 S3 相容 bucket 設定 | — |
| `TRANSACTION_PHOTO_*` | 選配 | 交易照片本機或 S3 儲存設定 | — |
| `EMAIL_PROVIDER_PRIMARY` / `EMAIL_PROVIDER_FALLBACK` | 寄信 | 主要／備用寄信通道：`smtp` / `zeabur` / `resend` | — |
| `SMTP_*` / `ZEABUR_*` / `RESEND_*` | 寄信 | 各寄信通道的連線設定 | — |
| `APP_URL` | MCP OAuth / 寄信 | 正式環境的對外 HTTPS origin | — |

> 💡 **寄信通道**（v4.30.0 起）一律由環境變數設定。`EMAIL_PROVIDER_PRIMARY` 留空則寄信停用；`EMAIL_PROVIDER_FALLBACK` 僅在 primary 執行期失敗時觸發。對應通道的設定變數需配合補齊。

---

## 認證機制

支援三種登入方式，皆可同時啟用。**AssetPilot 不提供本機 Email／密碼登入**——使用者只能透過 Google、LINE、Passkey 等外部或無密碼方式建立帳號；第一位完成外部登入的使用者自動成為管理員。

### Google SSO（建議）

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
2. **已授權 JavaScript 來源**：本機 `http://localhost:3000`、正式 `https://your-domain.com`
3. **已授權重新導向 URI**：本機 `http://localhost:3000/`、正式 `https://your-domain.com/`（含尾端 `/`）；Android App 另需加入 `https://your-domain.com/app/google-callback`
4. 設定 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 後啟動
5. 未設定時 Google 登入按鈕自動隱藏，不影響其他登入方式

> ⚠️ 若登入後停在 `/?code=...`，請確認重新導向 URI 與網域完全一致（含 `https://` 與尾端 `/`）。

### LINE Login

1. 至 [LINE Developers Console](https://developers.line.biz/console/) 建立 Provider 與 LINE Login channel，啟用 email 權限
2. **Callback URL**：本機 `http://localhost:3000/auth/line/callback`、`http://localhost:3000/app/line-callback`；正式 `https://your-domain.com/auth/line/callback`、`https://your-domain.com/app/line-callback`
3. 設定 `LINE_CHANNEL_ID`、`LINE_CHANNEL_SECRET`、`LINE_OAUTH_REDIRECT_URIS`
4. 到「管理員設定 → 系統設定」勾選「啟用 LINE 登入」

### Passkey（WebAuthn）

登入後可至「個人設定 → 安全」綁定。支援 Touch ID / Face ID / Windows Hello / 硬體金鑰。

### LINE 官方帳號記帳

設定 `LINE_MESSAGING_CHANNEL_SECRET`、`LINE_MESSAGING_CHANNEL_ACCESS_TOKEN` 與 `APP_URL`，在 Messaging API 的 Webhook URL 填入 `https://your-domain.com/api/line/webhook`。使用者綁定 LINE 帳號後，即可在官方帳號輸入 `選單`、`支出 120 午餐`、`收入 5000 薪資` 等文字記帳。

---

## 功能總覽

### 收支與預算

- **儀表板**：月份切換、總資產／收入／支出／淨額卡片、雙圓餅（含「（其他）」群組）、最近交易
- **交易管理**：CRUD、跨帳戶轉帳（雙向配對）、批次刪除／變更分類／變更日期、未來交易標記
- **預算管理**：月度總預算 + 分類預算；四段配色進度條；歷史與未來月份切換
- **帳戶管理**：多幣別、銀行／信用卡／證券／現金，可排除特定帳戶於總資產統計
- **分類管理**：父子兩層、自訂顏色、CSV 匯出匯入
- **固定收支**：週期性收支自動產生交易，支援外幣；登入時 server-side 觸發、並發冪等保護

### 股票投資

- **持股總覽**：即時市值、未實現損益、整體報酬率、三段策略抓股價（盤中即時／盤後收盤／備援）
- **股價自動更新**：交易時段自動抓 TWSE／TPEx 最新價寫回現價；跨使用者去重、管理員可調整間隔
- **股票交易**：手續費（0.1425%，最低 20 元）／證交稅（0.3%／ETF 權證 0.1%）自動計算可手動覆寫
- **股利紀錄**：TWSE 除權息自動同步；現金股利對應入款交易帳戶反查
- **實現損益**：FIFO 全精度（decimal.js）逐筆計算、今年／總損益彙總、賣出鏈式約束驗證
- **定期定額**：遇 TWSE 休市日自動順延、歷史收盤價回填、idempotency 保證
- **下市標記**：凍結最後價格，後續查價自動跳過
- **美股支援**：支援美股小數股數

### 統計與排程

- **統計報表**：分類圓餅（單／雙）+ 月度趨勢 + 每日消費 + 自訂時間範圍；同型前一段對比 pill；圓餅扇區可點擊跳轉
- **排程寄送**：多筆排程（每日／每週／每月，每月可指定 1–28 日或「最後一天」）；寄信通道支援 SMTP／Zeabur Email／Resend，主要通道失敗自動退備用

### AI 助理整合（MCP）

- **MCP OAuth 2.1**：在 ChatGPT、Claude 等工具輸入 `https://<你的網域>/api/mcp`，透過瀏覽器登入 AssetPilot、確認權限並完成連線；完整支援 PKCE S256、rotating refresh token
- **AI 記帳寫入**（可選）：AI 可透過 `create_transaction` 新增交易、`update_transaction_note` 更新備註；僅能新增／改備註，無法修改或刪除既有資料
- **逐憑證權限**：寫入能力預設關閉，於「設定 → MCP 連線」逐憑證開關
- **AI 標記與還原**：交易列表為 AI 建立的交易顯示徽章，可一鍵還原

> 正式環境啟用 MCP OAuth 前，務必將 `APP_URL` 設為對外 HTTPS origin。

### 資料治理

- **CSV 匯出**：交易／分類／股票交易／股利紀錄；純伺服器端 stream + UTF-8 BOM + Formula Injection 防護
- **CSV 匯入**：互斥鎖（重入回 409）+ 全 DB transaction 原子化 + 進度回饋
- **整檔備份／還原**：SQL 備份下載／上傳、還原失敗自動回滾、管理員列管 5 份／90 天
- **稽核日誌**：管理員與使用者分開檢視；過濾、CSV 匯出、清空、保留天數設定
- **交易照片附件**：最多 5 張、本機或 S3 儲存、讀取一律走登入授權 API

### 系統管理

- **使用者管理**：管理員可開關外部服務註冊、設定 Email 白名單、IP 白名單
- **登入稽核**：時間、IP、國家、方式、成功／失敗
- **API 使用與授權頁**：動態列出所有外部 API 來源、配額、合規授權字樣

---

## 使用指南

### 首次使用

1. 開啟 `http://localhost:3000` → 選擇 **Google** 或 **LINE** 登入
2. **第一位完成外部登入的使用者自動成為管理員**
3. 系統自動建立預設分類（食、衣、住、行…）與預設帳戶（現金、銀行帳戶）

### URL 直連

任何頁面皆可直連、加入書籤；未登入訪客導向 `/login?next=<原 URL>`，登入後自動跳回。

| URL | 說明 |
| --- | --- |
| `/` | 公開首頁 |
| `/login` | 登入頁 |
| `/dashboard` | 儀表板 |
| `/finance/transactions`, `/finance/reports`, `/finance/budget`, `/finance/accounts`, `/finance/categories`, `/finance/recurring` | 收支管理 |
| `/stocks`, `/stocks/transactions`, `/stocks/dividends`, `/stocks/realized` | 股票投資 |
| `/settings/account`, `/settings/admin`, `/settings/export` | 設定（admin 僅管理員可見） |
| `/api-credits` | API 使用與授權 |

### 信用卡繳費

使用信用卡消費時記為「**支出**」+ 信用卡帳戶（餘額負數＝真實負債）。繳費時選「**轉帳**」，從銀行轉到信用卡帳戶即可沖銷負債，不重複計算為支出。

### CSV 匯出欄位

| 類型 | 欄位 |
| ---- | ---- |
| 交易記錄 | 日期、類型、金額、幣別、分類、帳戶、備註 |
| 分類 | 父分類／子分類、類型、顏色 |
| 股票交易 | 日期、代號、名稱、類型、股數、成交價、手續費、交易稅、帳戶、備註 |
| 股利紀錄 | 日期、代號、名稱、現金股利、股票股利、備註 |

---

## 安全性

| 機制 | 說明 |
| ---- | ---- |
| 資料庫加密 | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 金鑰推導 |
| 身份驗證 | 僅接受 Google、LINE、Passkey 等外部／無密碼方式；不建立本機密碼 |
| XSS 防護 | 所有使用者輸入經 `escHtml()` 跳脫後才插入 DOM |
| 安全標頭 | HSTS、X-Content-Type-Options、Referrer-Policy |
| CSP | 限制 inline script 與外部資源來源 |
| 速率限制 | 登入／Passkey 端點每 IP 每 15 分鐘最多 20 次；公開頁面每分鐘最多 120 次 |
| OAuth 防 CSRF | Google／LINE 使用一次性 state；LINE 額外 nonce 驗證 ID Token |
| MCP OAuth 2.1 | PKCE S256、精確 redirect URI、short-lived token、refresh rotation、token 僅存 SHA-256 |
| `?next=` 防護 | 相對路徑白名單、拒 protocol-relative、拒 `://`、pathname 必須命中前端 ROUTES 表 |
| 路徑遊走偵測 | catch-all 偵測 `..`／`%2e%2e`／`%252e%252e`，寫稽核日誌 |
| Formula Injection 防護 | CSV 匯出對以 `=` `+` `-` `@` 開頭欄位前置撇號 |
| SRI | 外部 CDN 腳本完整性驗證 |
| 登入稽核 | 記錄時間、IP、國家、方式；管理員可查失敗嘗試與帳號鎖定狀態 |

---

## 外部 API 來源

| 服務 | 用途 |
| ---- | ---- |
| TWSE OpenAPI | 台股即時股價、收盤、除權息 |
| exchangerate-api.com | 全球即時匯率（基礎 TWD） |
| Google Identity Services | Google SSO 登入 |
| LINE Login API | LINE 登入與帳號綁定 |
| IPinfo Lite | IP 國家查詢（合規授權字樣固定顯示於 API 使用頁） |
| SMTP（Nodemailer） | 排程信件／系統通知 |
| Zeabur Email（ZSend） | 排程信件／系統通知 |
| Resend | 排程信件／系統通知 |
| MEGA S4 Object Storage | 管理員整備 PostgreSQL SQL 備份的 S3 相容目的地 |

完整列表與授權字樣可在執行中應用程式的 `/api-credits` 頁面查看。

---

## 專案治理

本專案採用 **Spec-Driven Development** 工作流程。每個功能皆有完整的 spec → research → plan → contracts → tasks → implementation 軌跡，存於 `specs/<NNN-feature-name>/` 下。

| 工件 | 用途 |
| --- | --- |
| `spec.md` | 使用者導向的功能規格與驗收條件 |
| `research.md` | 技術選型決策記錄 |
| `plan.md` | 實作計畫與檔案影響面 |
| `data-model.md` | 資料模型與 schema 變更 |
| `contracts/*.openapi.yaml` | API 契約 delta（OpenAPI 3.2.0） |
| `quickstart.md` | 手動驗證劇本 |
| `tasks.md` | 可執行任務清單 |
| `checklists/` | 上線前檢查表 |

專案憲章：[`.specify/memory/constitution.md`](.specify/memory/constitution.md)
完整變更歷史：[`changelog.json`](changelog.json) | 軟體需求規格：[`SRS.md`](SRS.md)

---

## 授權

[GNU AGPL v3](LICENSE)

> 本軟體採 AGPL v3 授權；**只要任何人能透過網路使用您運行的這個程式（即使您只是自托管給朋友家人用）**，您就有義務以同樣 AGPL v3 條款公開您的修改原始碼。商業授權請另行洽談。
