# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  個人資產管理網頁應用程式 — 記帳、股票紀錄、預算管理，一站搞定。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-4.7.4-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 目錄

- [專案介紹](#專案介紹)
- [專案特色](#專案特色)
- [專案功能](#專案功能)
  - [儀表板](#儀表板)
  - [收支管理](#收支管理)
  - [股票紀錄](#股票紀錄)
  - [統計報表](#統計報表)
  - [預算管理](#預算管理)
  - [帳戶管理](#帳戶管理)
  - [設定與管理員](#設定與管理員)
- [技術架構](#技術架構)
- [專案安裝方式](#專案安裝方式)
  - [方式一：Docker Hub 一鍵部署（推薦）](#方式一docker-hub-一鍵部署推薦)
  - [方式二：Docker Compose](#方式二docker-compose)
  - [方式三：Node.js 直接執行](#方式三nodejs-直接執行)
- [環境變數設定](#環境變數設定)
- [部署指南](#部署指南)
  - [Synology NAS](#synology-nas)
  - [雲端主機 VPS](#雲端主機-vps)
  - [Nginx 反向代理](#nginx-反向代理)
  - [Caddy 反向代理](#caddy-反向代理)
- [Google SSO 設定](#google-sso-設定)
- [專案使用方法](#專案使用方法)
  - [首次使用](#首次使用)
  - [新增交易](#新增交易)
  - [信用卡繳費教學](#信用卡繳費教學)
  - [股票管理](#股票管理)
  - [匯率管理](#匯率管理)
  - [CSV 匯出匯入](#csv-匯出匯入)
  - [管理員操作](#管理員操作)
- [Docker 進階管理](#docker-進階管理)
- [安全性](#安全性)
- [檔案結構](#檔案結構)
- [API 來源](#api-來源)
- [授權](#授權)

---

## 專案介紹

**AssetPilot** 是一款以隱私優先設計的個人資產管理網頁應用程式。

所有資料皆儲存於本地（或自托管伺服器），不依賴任何第三方雲端資料庫。透過 Docker 一行指令即可部署，適合在家用 NAS（如 Synology）、VPS 或本機電腦自行托管。

**適合誰使用？**

- 希望掌握個人資金流向，追蹤每月收支與預算的人
- 有台股投資習慣，需要管理持股、損益與股利的投資人
- 重視資料隱私，不想把個人財務資料交給第三方平台的人

---

## 專案特色

| 特色                         | 說明                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| 🏠**自托管，資料自控** | 資料庫加密儲存於本地，不上傳任何財務資訊至外部伺服器              |
| 🐳**Docker 一鍵部署**  | 無需設定，單行指令啟動；JWT 金鑰與加密金鑰自動產生                |
| 📊**台股深度整合**     | 串接 TWSE OpenAPI，即時股價、除權息自動同步、FIFO 損益計算        |
| 💱**多幣別支援**       | 支援 150+ 種幣別，串接 exchangerate-api.com 即時匯率              |
| 📱**響應式設計**       | 桌機與手機皆可流暢使用                                            |
| 🔒**企業級安全**       | ChaCha20-Poly1305 資料庫加密、Helmet 安全標頭、速率限制、CSP 保護 |
| 👥**多帳號管理**       | 支援多使用者，管理員可管控註冊政策與稽核登入紀錄                  |
| 🔑**Google SSO**       | 選配 Google 一鍵登入，OAuth Authorization Code Flow               |

---

## 專案功能

### 儀表板

- 總資產概覽卡片（各帳戶餘額加總）
- 本月收入／支出統計
- 支出分類圓餅圖（支援雙圓餅圖：內圈父分類、外圈子分類）
- 資產配置圓餅圖（帳戶資產 + 股票市值，支援雙圓餅圖切換）
- 最近交易記錄列表

### 收支管理

**交易記錄**

- 收入／支出／轉帳 CRUD，支援備註、分類、帳戶、幣別
- 未來日期交易，自動標記「未來」標籤供辨識與篩選
- 多筆勾選批次操作：批次刪除、批次變更分類／帳戶／日期
- 帳戶間轉帳，雙向自動配對（`linked_id`）

**預算管理**

- 月度總預算 + 各分類預算
- 視覺化進度條，即時顯示剩餘預算

**帳戶管理**

- 多帳戶設定（現金、銀行、信用卡等）
- 餘額依交易記錄自動計算
- 多幣別帳戶，整合即時匯率換算

**匯率設定**

- 串接 exchangerate-api.com，支援 150+ 幣別
- 手動觸發或自動同步，顯示上次取得時間

**分類管理**

- 父子兩層分類結構（如：食物 → 早餐 / 午餐 / 晚餐）
- 自訂分類顏色

**固定收支**

- 設定週期性收支（月租、薪水等），自動產生交易記錄

### 股票紀錄

**持股總覽**

- 即時計算持股市值、未實現損益、損益率
- 自動從 TWSE 取得即時／收盤股價（三段策略）
- 批次更新股價，顯示每檔價格來源與時間

**交易紀錄**

- 買進／賣出記錄，支援整股與零股
- 手續費自動計算（`0.1425%`，整股最低 20 元）
- 證交稅自動計算（賣出：一般股 `0.3%`、ETF/權證 `0.1%`）
- 輸入股票代號自動查詢並建立股票（免先手動新增）
- 搜尋篩選、分頁、多選批次刪除

**股利紀錄**

- 現金股利／股票股利記錄
- 除權息自動同步（TWSE `TWT49U` + `TWT49UDetail`），不重複新增

**實現損益**

- FIFO 逐筆計算成本均價、實現損益、報酬率
- 彙總卡片：總實現損益、整體報酬率、今年損益

**定期定額**

- 設定週期與每期預算，自動產生買進交易

### 統計報表

- **分類統計**：父分類圓餅圖，可切換雙圓餅圖（內圈父分類、外圈子分類）；圖例與 tooltip 顯示金額與佔比百分比
- **趨勢分析**：月度收入／支出折線圖
- **每日消費**：每日支出長條圖
- 自訂時間範圍篩選

### 帳戶管理

- 多帳戶新增、編輯、刪除
- 顯示各帳戶即時餘額

### 設定與管理員

**帳號設定**

- 修改顯示名稱、密碼
- 查看個人登入紀錄（最近 100 筆），含登入時間、IP、國家、登入方式

**資料匯出匯入**

- 交易記錄 CSV 匯出／匯入（含分類結構）
- 股票交易 CSV 匯出／匯入
- 股利紀錄 CSV 匯出／匯入

**管理員功能**

- 開關公開註冊；設定 Email 白名單
- 新增／刪除使用者帳號
- 查看所有使用者登入紀錄（含失敗嘗試）
- 手動同步登入紀錄（免重整頁面）

---

## 技術架構

| 層級   | 技術                                                          |
| ------ | ------------------------------------------------------------- |
| 前端   | 原生 HTML / CSS / JavaScript（SPA，`history.pushState`）    |
| 後端   | Node.js + Express                                             |
| 資料庫 | SQLite（sql.js，記憶體 + 檔案持久化）                         |
| 加密   | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256                        |
| 認證   | JWT（Bearer Token）+ bcryptjs，Google OAuth Code Flow（選配） |
| 圖表   | Chart.js                                                      |
| 圖示   | Font Awesome 6                                                |
| 安全   | Helmet、express-rate-limit、SRI、CORS 白名單、CSP             |

---

## 專案安裝方式

### 方式一：Docker Hub 一鍵部署（推薦）

不需任何前置設定，一行指令即可啟動：

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

> **就這樣！** 資料庫、JWT 金鑰、加密金鑰、Volume 全部自動建立。

---

### 方式二：Docker Compose

建立 `docker-compose.yml`：

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
      - GOOGLE_CLIENT_ID=          # 選配：填入 Google OAuth Client ID 啟用 SSO
      # - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
```

啟動：

```bash
docker compose up -d
```

---

### 方式三：Node.js 直接執行

**系統需求：** Node.js >= 18

```bash
# 1. 安裝依賴套件
npm install

# 2. 設定環境變數
cp .env.example .env
# 依需求編輯 .env 內容

# 3. 啟動伺服器
node server.js
```

開啟 [http://localhost:3000](http://localhost:3000) 即可使用。

---

## 環境變數設定

| 變數                      | 說明                                      | 預設值                    |
| ------------------------- | ----------------------------------------- | ------------------------- |
| `PORT`                  | 伺服器埠號                                | `3000`                  |
| `JWT_SECRET`            | JWT 簽章金鑰（正式環境務必更換）          | Docker 自動產生           |
| `JWT_EXPIRES`           | JWT 有效期限                              | `7d`                    |
| `DB_ENCRYPTION_KEY`     | 資料庫加密金鑰                            | Docker 自動產生           |
| `DB_PATH`               | 資料庫檔案路徑                            | `/app/data/database.db` |
| `ENV_PATH`              | 自動產生 .env 路徑                        | `/app/data/.env`        |
| `GOOGLE_CLIENT_ID`      | Google OAuth Client ID（選配）            | —                        |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth Client Secret（選配）        | —                        |
| `ALLOWED_ORIGINS`       | CORS 白名單，逗號分隔（留空不限制）       | —                        |
| `EXCHANGE_RATE_API_KEY` | exchangerate-api.com API Key（選配）      | —                        |
| `IPINFO_TOKEN`          | ipinfo.io Token，提升 IP 查詢配額（選配） | —                        |
| `CHANGELOG_URL`         | 遠端 changelog.json URL                   | GitHub 倉庫預設 URL       |

---

## 部署指南

### Synology NAS

**方式 A：Container Manager GUI（最簡單）**

1. DSM → **Container Manager** → **Registry** → 搜尋 `es94111/assetpilot` → 下載
2. **Container** → **Create** → 選擇 `es94111/assetpilot:latest`
3. 設定 Port：`3000 → 3000`，Volume 自動建立
4. 啟動即可

**方式 B：SSH 指令**

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

**反向代理設定（自訂網域 + HTTPS）**

DSM → **控制台** → **登入入口** → **進階** → **反向代理**，新增規則：

| 欄位           | 值                  |
| -------------- | ------------------- |
| 來源通訊協定   | HTTPS               |
| 來源主機名稱   | `your-domain.com` |
| 來源連接埠     | 443                 |
| 目的地通訊協定 | HTTP                |
| 目的地主機名稱 | `localhost`       |
| 目的地連接埠   | `3000`            |

自訂標題加入：`X-Forwarded-For` → `$proxy_add_x_forwarded_for`

---

### 雲端主機 VPS

```bash
mkdir assetpilot && cd assetpilot

cat > docker-compose.yml << 'EOF'
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
      - ALLOWED_ORIGINS=https://your-domain.com

volumes:
  assetpilot-data:
EOF

docker compose up -d
```

---

### Nginx 反向代理

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

---

### Caddy 反向代理

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy 會自動申請並續期 HTTPS 憑證。

---

## Google SSO 設定

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式）
2. 設定「已授權的 JavaScript 來源」：
   - 本機：`http://localhost:3000`
   - 正式：`https://your-domain.com`
3. 設定「已授權的重新導向 URI」：
   - 本機：`http://localhost:3000/`
   - 正式：`https://your-domain.com/`
4. 將 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 設為環境變數啟動
5. 未設定時 Google 登入按鈕自動隱藏，不影響帳號密碼登入

> ⚠️ 若登入後停在 `/?code=...`，請確認重新導向 URI 與網域完全一致（含 `https://` 與尾端 `/`）。

---

## 專案使用方法

### 首次使用

1. 開啟瀏覽器前往 `http://localhost:3000`
2. 點擊「**立即註冊**」建立帳號
3. **第一位註冊的使用者自動成為管理員**
4. 系統自動建立預設分類（食衣住行等）與預設帳戶（現金、銀行帳戶）
5. 登入後即可開始使用

---

### 新增交易

1. 點擊側邊欄「**收支管理**」
2. 點擊右上角「**+ 新增交易**」
3. 填入日期、類型（收入/支出/轉帳）、金額、分類、帳戶
4. 可選填備註、幣別（選擇外幣時，若尚無匯率，系統自動查詢並填入）
5. 點擊「**儲存**」

**批次操作：** 勾選多筆交易後，操作列出現批次刪除、批次變更分類／帳戶／日期按鈕。

---

### 信用卡繳費教學

使用信用卡消費時，建議記錄「**支出**」並選「信用卡」帳戶，讓餘額顯示為負數（反映真實負債）。

**繳費時：**

1. 「**收支管理**」→「**新增交易**」
2. 類型選「**轉帳**」
3. 轉出帳戶：**銀行帳戶**
4. 轉入帳戶：**信用卡帳戶**
5. 輸入繳款金額後儲存

這樣既能扣除銀行餘額，又能沖銷信用卡負數餘額，且不重複計算為支出。

---

### 股票管理

**新增持股**

1. 「**股票紀錄**」→「**交易紀錄**」→「**+ 新增股票交易**」
2. 輸入股票代號（如 `2330`），系統自動從 TWSE 查詢並帶入名稱與現價
3. 填入買進日期、股數、成交價
4. 手續費與交易稅自動計算，可手動修改
5. 儲存後即計入持股

**更新股價**

持股總覽點擊「**更新股價**」，系統使用三段策略自動取得最新價格：

- 盤中 → TWSE 即時成交價
- 盤後 → STOCK_DAY 當日收盤價
- 其他時段 → STOCK_DAY_ALL 最近收盤備援

**同步除權息**

「**股利紀錄**」→「**同步除權息**」，依持股期間自動新增現金股利與股票股利（不重複）。

---

### 匯率管理

1. 「**收支管理**」→「**帳戶管理**」→「**匯率設定**」
2. 點擊「**立即取得即時匯率**」手動同步
3. 或開啟「**自動更新匯率**」，進入頁面時自動同步
4. 可新增任意 3 碼幣別代碼作為自訂幣別

---

### CSV 匯出匯入

**路徑：** 「**設定**」→「**資料匯出匯入**」

| 類型     | 匯出欄位                                                                  |
| -------- | ------------------------------------------------------------------------- |
| 交易記錄 | 日期、類型、金額、幣別、分類、帳戶、備註                                  |
| 股票交易 | 日期、代號、名稱、類型（買/賣）、股數、成交價、手續費、交易稅、帳戶、備註 |
| 股利紀錄 | 日期、代號、名稱、現金股利、股票股利、備註                                |

**匯入注意：** 若股票代號不存在，匯入時自動建立；若名稱不正確，自動以 CSV 內的名稱更新。

---

### 管理員操作

**路徑：** 「**設定**」→「**管理員**」

| 功能         | 說明                                            |
| ------------ | ----------------------------------------------- |
| 開關公開註冊 | 控制是否允許任何人自行註冊                      |
| Email 白名單 | 僅允許白名單內的 Email 註冊（每行一個）         |
| 新增帳號     | 直接建立新使用者，可設定管理員身份              |
| 刪除帳號     | 永久刪除使用者及所有關聯資料                    |
| 登入稽核     | 查看所有使用者登入時間、IP、國家、成功/失敗狀態 |

---

## Docker 進階管理

### 映像檔資訊

| 項目       | 值                                                                 |
| ---------- | ------------------------------------------------------------------ |
| Docker Hub | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| 支援架構   | `linux/amd64`、`linux/arm64`                                   |
| 基底映像   | `node:24-alpine`                                                 |
| 映像大小   | ~180 MB                                                            |
| 健康檢查   | 每 30 秒自動檢測                                                   |

### Volume 與資料持久化

容器內 `/app/data` 存放所有持久化資料：

```
/app/data/
├── database.db    # 加密的 SQLite 資料庫
└── .env           # 自動產生的金鑰（JWT_SECRET、DB_ENCRYPTION_KEY）
```

**三種掛載方式：**

```bash
# 1. 自動匿名 Volume（最簡單）
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. 具名 Volume（推薦，方便管理）
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. 綁定本機目錄（方便直接存取）
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

### 備份與還原

```bash
# 備份
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 還原
docker run --rm \
  -v assetpilot-data:/data \
  -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **重要：** 刪除 Volume 會永久遺失資料庫和加密金鑰，請先備份再操作。

### 常用管理指令

```bash
# 查看容器狀態（含健康檢查）
docker ps

# 查看即時日誌
docker logs -f assetpilot

# 停止 / 重啟
docker stop assetpilot
docker restart assetpilot

# 更新至最新版本
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### 自行建置映像檔

```bash
docker build -t assetpilot .

docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot
```

---

## 安全性

| 機制                            | 說明                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| **資料庫加密**            | ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 金鑰推導                                                     |
| **密碼加密**              | bcryptjs 雜湊儲存，不明文保存                                                                       |
| **XSS 防護**              | 所有使用者輸入經 `escHtml()` 跳脫後才插入 DOM                                                     |
| **安全標頭**              | Helmet（HSTS、X-Content-Type-Options、Referrer-Policy）                                             |
| **CSP 保護**              | 限制 inline script，限制腳本與外部資源來源                                                          |
| **速率限制**              | 登入／註冊 API 每 IP 每 15 分鐘最多 20 次；公開頁面每分鐘最多 120 次                                |
| **Cloudflare API Shield** | 提供 OpenAPI 3.0.3 Schema（`openapi.yaml`），可上傳至 Cloudflare 啟用請求驗證（Block / Log 模式） |
| **CORS 控制**             | `ALLOWED_ORIGINS` 可限制允許的來源網域                                                            |
| **OAuth State 驗證**      | Google 登入使用一次性 state 防 CSRF／重放攻擊                                                       |
| **SRI 驗證**              | 外部 CDN 腳本（Font Awesome、Chart.js）加入完整性驗證                                               |
| **屬性注入防護**          | 帳戶 icon 採白名單驗證（僅允許 `fa-*`）                                                           |
| **登入稽核**              | 記錄登入時間、IP、國家、方式；管理員可查失敗嘗試                                                    |
| **健康檢查**              | Docker HEALTHCHECK 每 30 秒自動偵測服務狀態                                                         |

---

## 檔案結構

```
├── server.js              # Express 後端（API + 資料庫）
├── app.js                 # 前端 SPA 邏輯（IIFE 模組）
├── index.html             # 單頁 HTML（所有頁面 + Modal）
├── style.css              # 全域樣式
├── logo.svg               # 網站 Logo（登入頁）
├── favicon.svg            # Favicon + 側邊欄 Logo
├── changelog.json         # 版本更新紀錄
├── openapi.yaml           # Cloudflare API Shield Schema（OpenAPI 3.0.3）
├── privacy.html           # 隱私權政策頁面（公開，無需登入）
├── terms.html             # 服務條款頁面（公開，無需登入）
├── Dockerfile             # Docker 建置設定
├── docker-compose.yml     # Docker Compose 設定
├── .env.example           # 環境變數範本
├── .gitignore             # Git 忽略清單
├── SRS.md                 # 軟體需求規格書
├── .github/workflows/
│   └── docker-publish.yml # CI/CD 自動建置推送
└── data/                  # 資料目錄（Docker Volume 掛載）
    ├── database.db        # 加密的 SQLite 資料庫（自動產生）
    └── .env               # 金鑰檔案（自動產生）
```

---

## API 來源

| 服務                               | 用途                         | 連結                                                                  |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------- |
| **TWSE OpenAPI**             | 台股即時股價、除權息資料     | [openapi.twse.com.tw](https://openapi.twse.com.tw/)                      |
| **exchangerate-api.com**     | 全球即時匯率（基礎貨幣 TWD） | [exchangerate-api.com](https://www.exchangerate-api.com/)                |
| **Google Identity Services** | Google SSO 登入              | [developers.google.com/identity](https://developers.google.com/identity) |
| **IPinfo Lite**              | IP 國家查詢                  | [ipinfo.io/lite](https://ipinfo.io/lite)                                 |

---

## 授權

[GNU AGPL v3](LICENSE)
