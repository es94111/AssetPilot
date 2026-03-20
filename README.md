# AssetPilot — 資產管理

<p align="center">
  <img src="logo.svg" alt="AssetPilot Logo" width="120">
</p>

<p align="center">
  個人資產管理網頁應用程式 — 記帳、股票紀錄、預算管理，一站搞定。
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.8-blue" alt="version">
  <img src="https://img.shields.io/badge/node-%3E%3D18-green" alt="node">
  <img src="https://img.shields.io/badge/license-MIT-orange" alt="license">
  <img src="https://img.shields.io/badge/docker-ready-2496ED" alt="docker">
</p>

---

## 功能特色

- **交易記錄** — 收入/支出/轉帳 CRUD，批次操作（刪除、變更分類/帳戶/日期）
- **帳戶管理** — 多帳戶餘額自動計算
- **分類管理** — 支援父子分類（`parent_id` 自關聯）
- **預算管理** — 月度/分類預算，視覺化進度條
- **固定收支** — 週期性自動產生交易
- **統計報表** — 分類統計、趨勢分析、每日消費，自訂時間範圍
- **股票紀錄** — 持股總覽、買賣交易、股利紀錄、FIFO 實現損益計算
- **TWSE 整合** — 即時/收盤股價查詢、除權息自動同步
- **CSV 匯出/匯入** — 交易記錄、分類、股票交易、股利紀錄
- **Google SSO** — 一鍵 Google 帳號登入（選配）
- **資料庫加密** — ChaCha20-Poly1305 + PBKDF2-SHA256 全資料庫加密
- **響應式設計** — 桌面與手機皆可使用

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | 原生 HTML / CSS / JavaScript（SPA） |
| 後端 | Node.js + Express |
| 資料庫 | SQLite（sql.js，記憶體 + 檔案持久化） |
| 認證 | JWT + bcryptjs，Google SSO（選配） |
| 圖表 | Chart.js |
| 安全 | Helmet、express-rate-limit、SRI、CORS 白名單 |

## 快速開始

### 方式一：Node.js 直接執行

```bash
# 安裝依賴
npm install

# 複製環境變數範本
cp .env.example .env

# 啟動伺服器
node server.js
```

開啟 http://localhost:3000 即可使用。

> 首次啟動時 `JWT_SECRET` 和 `DB_ENCRYPTION_KEY` 會自動隨機產生並寫入 `.env`。

### 方式二：Docker Hub 拉取（推薦）

```bash
# 從 Docker Hub 拉取最新映像檔
docker pull es94111/assetpilot:latest

# 啟動容器
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  es94111/assetpilot:latest
```

> 映像檔支援 `linux/amd64` 和 `linux/arm64`（Synology NAS、Raspberry Pi 皆可使用）。

### 方式三：自行建置 Docker

```bash
# 建置映像檔
docker build -t assetpilot .

# 啟動容器
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  assetpilot
```

或使用 Docker Compose：

```bash
docker compose up -d
```

### 方式四：匯入 Docker Image

如果你已經有 `asset-manager.tar` 映像檔：

```bash
# 匯入映像檔
docker load -i asset-manager.tar

# 啟動容器
docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v ./data:/app/data \
  asset-manager:latest
```

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `PORT` | 伺服器埠號 | `3000` |
| `JWT_SECRET` | JWT 簽章金鑰 | 首次啟動自動產生 |
| `JWT_EXPIRES` | JWT 有效期限 | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID（留空停用 SSO） | — |
| `DB_ENCRYPTION_KEY` | 資料庫加密金鑰（ChaCha20-Poly1305） | 首次啟動自動產生 |
| `ALLOWED_ORIGINS` | CORS 白名單（逗號分隔） | — |

## Docker 部署到 Synology NAS

1. 將專案資料夾上傳至 NAS
2. SSH 進入 NAS 並進入專案目錄
3. 執行 `sudo docker build -t assetpilot .`
4. 至 DSM **Container Manager** 建立容器，或使用指令：

```bash
sudo docker run -d \
  --name assetpilot \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /volume1/docker/assetpilot/data:/app/data \
  assetpilot
```

5. 至 DSM **控制台 → 登入入口 → 反向代理**，將 `https://your-domain` 導向 `http://localhost:3000`

## Google SSO 設定（選配）

1. 至 [Google Cloud Console](https://console.cloud.google.com/) 建立 OAuth 2.0 用戶端 ID
2. 設定「已授權的 JavaScript 來源」（如 `http://localhost:3000`、`https://your-domain`）
3. 將 Client ID 設為環境變數 `GOOGLE_CLIENT_ID`
4. 未設定時 Google 登入按鈕自動隱藏

## 檔案結構

```
├── server.js          # Express 後端（API + 資料庫）
├── app.js             # 前端 SPA 邏輯
├── index.html         # 單頁 HTML
├── style.css          # 全域樣式
├── logo.svg           # 網站 Logo
├── favicon.svg        # Favicon
├── changelog.json     # 版本更新紀錄
├── Dockerfile         # Docker 建置設定
├── docker-compose.yml # Docker Compose 設定
├── .env.example       # 環境變數範本
└── data/              # 資料目錄（Docker 掛載）
    ├── database.db    # SQLite 資料庫（自動產生）
    └── .env           # 環境變數（Docker 自動產生）
```

## 安全性

- **XSS 防護** — 所有使用者輸入經 `escHtml()` 跳脫
- **安全標頭** — Helmet（HSTS、X-Content-Type-Options、Referrer-Policy）
- **速率限制** — 登入/註冊 API 限制每 IP 每 15 分鐘 20 次
- **CORS 控制** — 可透過 `ALLOWED_ORIGINS` 限制來源
- **SRI 驗證** — 外部 CDN 腳本加入完整性驗證
- **資料庫加密** — ChaCha20-Poly1305 AEAD + PBKDF2-SHA256 金鑰推導
- **密碼加密** — bcryptjs 雜湊儲存

## 授權

MIT License
