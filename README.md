# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  個人資產管理網頁應用程式 — 記帳、股票紀錄、預算管理，一站搞定。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.41-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 功能特色

- **交易記錄** — 收入/支出/轉帳 CRUD，批次操作（刪除、變更分類/帳戶/日期）
- **帳戶管理** — 多帳戶餘額自動計算
- **分類管理** — 支援父子分類
- **預算管理** — 月度/分類預算，視覺化進度條
- **固定收支** — 週期性自動產生交易
- **收支管理整合** — 分類管理與固定收支已整合至收支管理模組內，與交易/預算/帳戶同層操作
- **統計報表** — 分類統計、趨勢分析、每日消費，自訂時間範圍
- **股票紀錄** — 持股總覽、買賣交易、股利紀錄、FIFO 實現損益計算
- **股票交易設定介面美化** — 交易設定改為分區卡片與重點提示，與全站卡片風格一致
- **情境式快速新增按鈕** — 收支管理顯示「新增交易」、股票紀錄顯示「新增股票交易紀錄」，其他頁面自動隱藏
- **TWSE 整合** — 即時/收盤股價查詢、除權息自動同步
- **CSV 匯出/匯入** — 交易記錄、分類、股票交易、股利紀錄
- **匯出匯入介面重整** — 設定頁「資料匯出匯入」改為交易/股票分組卡片，提升一致性與可讀性
- **全球即時匯率** — 串接 rter.info 匯率 API，支援手動更新與自動更新開關
- **API 使用與授權頁** — 左側選單新增 API 清單與授權說明，集中顯示出處資訊
- **主題切換容錯** — 深色/淺色切換先本機生效，後端同步異常時不影響當下使用
- **Google SSO** — 一鍵 Google 帳號登入（選配）
- **管理員模式** — 第一位使用者自動成為管理員，可控管註冊政策與使用者帳號
- **登入稽核紀錄** — 記錄登入時間、IP、登入方式，管理員全站紀錄含成功與失敗登入嘗試
- **登入紀錄刪除管理** — 管理員登入紀錄與全站登入紀錄皆支援單筆刪除與勾選批次刪除
- **登入紀錄批次刪除修正** — 強化管理員登入紀錄與全站登入紀錄批次刪除穩定性，批次失敗時自動逐筆備援
- **登入紀錄舊資料相容修正** — 舊版登入紀錄缺少主鍵時，仍可正常勾選並執行單筆/批次刪除
- **管理員登入紀錄勾選保證** — 無論新舊紀錄皆附備援識別值，確保每列都能勾選並單筆/批次刪除
- **最新登入列勾選補強** — 即時補入的最新登入紀錄若缺 id，會用時間戳作為備援識別，避免無法勾選
- **管理員單筆刪除再補強** — 管理員登入紀錄缺少主鍵時，操作欄仍可用時間戳備援識別執行單筆刪除
- **登入紀錄刪除回應容錯** — 後端 API 錯誤統一回傳 JSON，避免刪除時出現「伺服器回應格式異常」
- **管理員登入紀錄手動同步** — 管理員頁新增手動同步按鈕與上次同步時間，免重整頁面即可更新登入紀錄
- **資料庫加密** — ChaCha20-Poly1305 + PBKDF2-SHA256 全資料庫加密
- **響應式設計** — 桌面與手機皆可使用

## 近期更新

- **v3.40** — 分類管理與固定收支整合到收支管理流程
- **v3.40.1** — 強化登入紀錄批次刪除穩定性
- **v3.40.2** — 股票交易設定改為卡片式介面，手機版排版同步優化
- **v3.40.3** — 修正舊資料登入紀錄勾選與批次刪除相容性
- **v3.40.7** — 管理員登入紀錄新增單筆刪除備援路徑，舊資料也可刪除
- **v3.40.8** — 修正管理員登入紀錄刪除時的回應格式異常提示
- **v3.41** — 管理員登入紀錄新增手動同步與上次同步時間顯示

## 技術架構

| 層級   | 技術                                         |
| ------ | -------------------------------------------- |
| 前端   | 原生 HTML / CSS / JavaScript（SPA）          |
| 後端   | Node.js + Express                            |
| 資料庫 | SQLite（sql.js，記憶體 + 檔案持久化）        |
| 認證   | JWT + bcryptjs，Google SSO（選配）           |
| 圖表   | Chart.js                                     |
| 安全   | Helmet、express-rate-limit、SRI、CORS 白名單 |

---

## 快速開始

### 方式一：Docker Hub 一鍵部署（推薦）

```bash
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

開啟 http://localhost:3000 即可使用。

> **就這樣！** 不需要任何額外設定。資料庫、金鑰、Volume 全部自動建立。

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

### 方式三：Node.js 直接執行

```bash
npm install
cp .env.example .env
node server.js
```

---

## Docker 部署詳細說明

### 映像檔資訊

| 項目         | 值                                                                 |
| ------------ | ------------------------------------------------------------------ |
| Docker Hub   | [`es94111/assetpilot`](https://hub.docker.com/r/es94111/assetpilot) |
| 支援架構     | `linux/amd64`、`linux/arm64`                                   |
| 基底映像檔   | `node:20-alpine`                                                 |
| 映像大小     | ~180MB                                                             |
| 內建健康檢查 | ✅ 每 30 秒自動檢測                                                |

### 自動化機制

首次啟動容器時，系統會自動完成以下設定：

| 項目                     | 說明                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------- |
| **Volume**         | Dockerfile 內建 `VOLUME /app/data`，即使不指定 `-v`，Docker 也會自動建立匿名 Volume |
| **JWT 金鑰**       | 未設定 `JWT_SECRET` 時，自動產生 64 字元隨機金鑰並寫入 `/app/data/.env`             |
| **資料庫加密金鑰** | 未設定 `DB_ENCRYPTION_KEY` 時，自動產生 64 字元隨機金鑰並寫入 `/app/data/.env`      |
| **資料庫**         | 自動建立 `/app/data/database.db`，含加密保護                                          |
| **預設資料**       | 新使用者註冊時自動建立預設分類和帳戶                                                    |

### 環境變數

| 變數                  | 說明                                   | 預設值                    |
| --------------------- | -------------------------------------- | ------------------------- |
| `PORT`              | 伺服器埠號                             | `3000`                  |
| `JWT_SECRET`        | JWT 簽章金鑰                           | 首次啟動自動產生          |
| `JWT_EXPIRES`       | JWT 有效期限                           | `7d`                    |
| `DB_ENCRYPTION_KEY` | 資料庫加密金鑰（ChaCha20-Poly1305）    | 首次啟動自動產生          |
| `GOOGLE_CLIENT_ID`  | Google OAuth Client ID（留空停用 SSO） | —                        |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret（Code Flow 必填） | —                   |
| `ALLOWED_ORIGINS`   | CORS 白名單（逗號分隔）                | —（不限制）              |
| `DB_PATH`           | 資料庫檔案路徑                         | `/app/data/database.db` |
| `ENV_PATH`          | 自動產生的 .env 檔案路徑               | `/app/data/.env`        |

設定環境變數的方式：

```bash
# 方式 A：docker run -e 參數
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -e GOOGLE_CLIENT_ID=your-google-client-id \
  -e ALLOWED_ORIGINS=https://your-domain.com \
  es94111/assetpilot:latest

# 方式 B：docker compose（修改 docker-compose.yml 的 environment 區段）
docker compose up -d
```

### Volume 與資料持久化

容器內的 `/app/data` 目錄存放所有持久化資料：

```
/app/data/
├── database.db    # 加密的 SQLite 資料庫
└── .env           # 自動產生的金鑰（JWT_SECRET、DB_ENCRYPTION_KEY）
```

**三種掛載方式：**

```bash
# 1. 自動（不指定 -v）— Docker 自動建立匿名 Volume
docker run -d -p 3000:3000 es94111/assetpilot:latest

# 2. 具名 Volume（推薦）— 方便管理與識別
docker run -d -p 3000:3000 -v assetpilot-data:/app/data es94111/assetpilot:latest

# 3. 綁定本機目錄 — 方便直接存取檔案
docker run -d -p 3000:3000 -v /path/to/data:/app/data es94111/assetpilot:latest
```

**Volume 管理指令：**

```bash
# 查看所有 Volume
docker volume ls

# 查看 Volume 詳細資訊（儲存位置、大小）
docker volume inspect assetpilot-data

# 備份資料
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/assetpilot-backup.tar.gz -C /data .

# 還原資料
docker run --rm -v assetpilot-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/assetpilot-backup.tar.gz -C /data
```

> ⚠️ **重要：** 刪除 Volume 會永久遺失資料庫和加密金鑰，請先備份再操作。

### 容器管理指令

```bash
# 查看容器狀態（含健康檢查結果）
docker ps

# 查看即時日誌
docker logs -f assetpilot

# 停止容器
docker stop assetpilot

# 重新啟動
docker restart assetpilot

# 刪除容器（Volume 資料不受影響）
docker rm -f assetpilot

# 更新到最新版本
docker pull es94111/assetpilot:latest
docker rm -f assetpilot
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v assetpilot-data:/app/data \
  es94111/assetpilot:latest
```

### 全球即時匯率（rter.info）

- 匯率設定可連接全球即時匯率 API：`https://tw.rter.info/capi.php`
- 在 `收支管理 > 帳戶管理 > 匯率設定` 可使用：
  - `立即取得即時匯率`：手動同步最新匯率
  - `自動更新匯率`：由使用者自行決定是否開啟
- 啟用自動更新後，系統會在進入匯率設定時依節流策略自動同步，並以 `YYYY-MM-DD HH:mm:ss`（精確到秒）顯示上次更新時間。
- 全球即時匯率 API 使用授權：CC BY-SA，系統於左側選單 `API 使用與授權` 明確標示出處與授權資訊。

### 管理員模式

- 第一個建立的使用者會自動成為管理員。
- 管理員可在 `設定 > 管理員` 進行以下操作：
  - 開關公開註冊
  - 設定可註冊 Email 白名單（每行一個）
  - 建立新帳號（可直接指定為管理員）
  - 刪除指定帳號
  - 檢視管理員登入時間與 IP 紀錄
  - 檢視全部使用者登入時間與 IP 紀錄（含失敗登入：帳號不存在、密碼錯誤、暫時鎖定等）
- 註冊策略同時套用於一般註冊與 Google 首次註冊：
  - 若設定白名單，只有白名單內 Email 可註冊
  - 若未設定白名單且關閉公開註冊，僅能由管理員建立帳號
- 系統保護規則：最後一位管理員不可被刪除。
- 一般使用者可在 `設定 > 帳號設定` 查看自己的登入時間與 IP 紀錄（最近 100 筆）。

### 自行建置映像檔

```bash
# 建置
docker build -t assetpilot .

# 啟動
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  assetpilot

# 匯出映像檔（帶到其他電腦）
docker save assetpilot -o assetpilot.tar

# 在其他電腦匯入
docker load -i assetpilot.tar
```

---

## 部署到 Synology NAS

### 方式 A：Container Manager GUI（最簡單）

1. DSM → **Container Manager** → **Registry** → 搜尋 `es94111/assetpilot` → 下載
2. **Container** → **Create** → 選擇 `es94111/assetpilot:latest`
3. 設定 Port：`3000 → 3000`
4. Volume 會自動建立，無需手動設定
5. 啟動即可

### 方式 B：SSH 指令

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  es94111/assetpilot:latest
```

如需指定資料路徑以便備份：

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  es94111/assetpilot:latest
```

### 反向代理設定（使用自訂網域）

1. 至 DSM **控制台** → **登入入口** → **進階** → **反向代理**
2. 新增規則：

| 欄位           | 值                  |
| -------------- | ------------------- |
| 來源通訊協定   | HTTPS               |
| 來源主機名稱   | `your-domain.com` |
| 來源連接埠     | 443                 |
| 目的地通訊協定 | HTTP                |
| 目的地主機名稱 | `localhost`       |
| 目的地連接埠   | `3000`            |

3. 自訂標題 → 新增 `X-Forwarded-For`：`$proxy_add_x_forwarded_for`

---

## 部署到雲端主機

### 使用 Docker Compose（VPS / AWS / GCP / Azure）

```bash
# 1. 建立專案目錄
mkdir assetpilot && cd assetpilot

# 2. 建立 docker-compose.yml
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
      - GOOGLE_CLIENT_ID=

volumes:
  assetpilot-data:
EOF

# 3. 啟動
docker compose up -d
```

### 搭配 Nginx 反向代理 + HTTPS

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 搭配 Caddy（自動 HTTPS）

```
your-domain.com {
    reverse_proxy localhost:3000
}
```

---

## Google SSO 設定（選配）

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID
2. 設定「已授權的 JavaScript 來源」：
   - 本機開發：`http://localhost:3000`
   - 正式網域：`https://your-domain.com`
3. 設定「已授權的重新導向 URI」：
   - 本機開發：`http://localhost:3000/`
   - 正式網域：`https://your-domain.com/`
4. 將 `GOOGLE_CLIENT_ID` 與 `GOOGLE_CLIENT_SECRET` 設為環境變數
5. 系統使用 OAuth Authorization Code Flow，登入流程含 state 一次性驗證防重放
6. 未設定時 Google 登入按鈕自動隱藏，不影響帳號密碼登入

> 若登入後停在 `/?code=...` 無法進入系統，請確認 Google Console 的重新導向 URI 與網站網域完全一致（含 `https` 與尾端 `/`），並更新到 v3.35.2（已修正 callback URL 卡住與 state 帶回相容性）。

---

## 檔案結構

```
├── server.js              # Express 後端（API + 資料庫）
├── app.js                 # 前端 SPA 邏輯
├── index.html             # 單頁 HTML
├── style.css              # 全域樣式
├── logo.svg               # 網站 Logo
├── favicon.svg            # Favicon
├── changelog.json         # 版本更新紀錄
├── Dockerfile             # Docker 建置設定
├── docker-compose.yml     # Docker Compose 設定
├── .env.example           # 環境變數範本
├── .github/workflows/
│   └── docker-publish.yml # CI/CD 自動建置推送
└── data/                  # 資料目錄（Docker Volume 掛載）
    ├── database.db        # 加密的 SQLite 資料庫（自動產生）
    └── .env               # 金鑰檔案（自動產生）
```

## 安全性

- **XSS 防護** — 所有使用者輸入經 `escHtml()` 跳脫
- **屬性注入防護** — 帳戶 icon 欄位採前後端白名單驗證（僅允許 `fa-*`）
- **安全標頭** — Helmet（HSTS、X-Content-Type-Options、Referrer-Policy）
- **CSP 保護** — 已收斂為禁止 inline script，限制腳本與外部資源來源
- **OAuth state 驗證** — Google 授權碼登入使用一次性 state，降低登入 CSRF/重放風險
- **速率限制** — 登入/註冊 API 限制每 IP 每 15 分鐘 20 次
- **登入稽核** — 密碼登入與 Google SSO 成功後皆記錄登入時間、IP、登入方式與身份
- **失敗登入稽核** — 管理員全站登入紀錄會保留失敗嘗試（帳號不存在、密碼錯誤、缺少憑證、暫時鎖定）
- **本次登入保證** — 登入後可立即顯示本次登入紀錄
- **CORS 控制** — 可透過 `ALLOWED_ORIGINS` 限制來源
- **最小暴露面** — 僅白名單前端檔案可靜態存取，不再公開整個專案根目錄
- **管理員權限管控** — 系統更新功能僅允許管理員執行
- **SRI 驗證** — 外部 CDN 腳本加入完整性驗證
- **資料庫加密** — ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 金鑰推導
- **密碼加密** — bcryptjs 雜湊儲存
- **健康檢查** — Docker HEALTHCHECK 每 30 秒自動檢測服務狀態

## 授權

MIT License
