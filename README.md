# VitaTrack 健康管理系統

> **Version 2.0** — Phase 1 MVP

個人健康管理應用程式，協助使用者記錄身體組成、飲食攝取、運動與健康指標，透過數據分析做出更好的健康決策。

## Phase 1 已實作功能

| 模組 | 說明 | 狀態 |
|------|------|------|
| 使用者管理 | 註冊、登入（JWT）、個人檔案、偏好設定 | Done |
| 身體組成紀錄 | 體重、體脂率、肌肉量、身體圍度、趨勢圖表 | Done |
| 飲食紀錄 | 餐次紀錄、食物資料庫（55 種）、營養素自動計算、飲水追蹤 | Done |
| 儀表板 | 每日摘要、BMR/TDEE 計算、體重趨勢、營養素環形圖 | Done |
| 運動紀錄 | 有氧 / 重訓紀錄、消耗熱量估算 | Phase 2 |
| 健康指標 | 血壓、血糖、睡眠、自訂指標追蹤 | Phase 2 |
| 數據報表 | 週報月報、長期趨勢分析、資料匯出 | Phase 3 |

## 技術架構

- **前端**：React 18 + TypeScript + Vite + Tailwind CSS + Recharts
- **後端**：Node.js + Express + TypeScript + Prisma ORM
- **資料庫**：PostgreSQL 16
- **部署**：Docker 多階段建置 + GitHub Actions CI/CD

## 快速開始

```bash
# 1. 啟動 PostgreSQL
docker compose -f docker-compose.dev.yml up -d

# 2. 安裝依賴
cd backend && npm install && npx prisma generate && npx prisma migrate dev --name init && npm run db:seed
cd ../frontend && npm install

# 3. 啟動開發伺服器
cd backend && npm run dev    # API: http://localhost:3001
cd frontend && npm run dev   # Web: http://localhost:5173
```

## CI/CD 與部署

| 檔案 | 說明 |
|------|------|
| `.github/workflows/deploy.yml` | 推送 `main` 後自動建置 Image 並部署 |
| `docker-compose.yml` | 生產環境服務定義（App + PostgreSQL） |
| `.env.example` | 環境變數範本，複製為 `.env` 後填入實際值 |

### GitHub Secrets 設定

需在 GitHub → Settings → Secrets and variables → Actions 設定以下 Secrets：

| Secret | 說明 |
|--------|------|
| `DEPLOY_HOST` | 伺服器 IP 或網域 |
| `DEPLOY_USER` | SSH 使用者名稱 |
| `DEPLOY_SSH_KEY` | SSH 私鑰（`~/.ssh/id_rsa` 內容） |
| `DEPLOY_PORT` | SSH 埠號（預設 22，可不設） |
| `DEPLOY_PATH` | 伺服器上的專案目錄路徑 |

### 部署流程

```
git push origin main
      │
      ▼
[GitHub Actions]
  1. Checkout 程式碼
  2. 登入 GHCR
  3. 建置 Docker Image（含 BuildKit 快取）
  4. 推送 :latest 與 :sha-xxxxxxx 標籤
      │
      ▼
[SSH 連線至伺服器]
  5. docker compose pull   ← 拉取新 Image
  6. docker compose up -d  ← 滾動更新
  7. docker image prune    ← 清理舊 Image
```

## 文件

- [軟體需求規格書（SRS）](SRS.md)
- [變更日誌](changelog.json)

## 開發階段

| 階段 | 範圍 |
|------|------|
| Phase 1 — MVP | 使用者管理、身體組成紀錄、飲食紀錄、每日摘要 |
| Phase 2 | 運動紀錄、健康指標、目標設定 |
| Phase 3 | 報表分析、通知提醒、資料匯出 |
| Phase 4 | 第三方整合、條碼掃描、食譜功能 |
