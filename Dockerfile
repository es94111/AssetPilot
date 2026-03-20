FROM node:20-alpine

WORKDIR /app

# 複製 package.json 先安裝依賴（利用 Docker 快取層）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# 複製應用程式檔案
COPY server.js app.js index.html style.css logo.svg favicon.svg changelog.json ./

# 資料庫與設定存放目錄（掛載用）
RUN mkdir -p /app/data

EXPOSE 3000

# 環境變數（密鑰留空，首次啟動時自動產生並寫入 .env）
ENV PORT=3000
ENV DB_PATH=/app/data/database.db
ENV ENV_PATH=/app/data/.env
ENV JWT_EXPIRES=7d
ENV GOOGLE_CLIENT_ID=

CMD ["node", "server.js"]
