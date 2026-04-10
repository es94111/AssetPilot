FROM node:24-alpine

WORKDIR /app

# 複製 package.json 先安裝依賴（利用 Docker 快取層）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# 複製應用程式檔案
COPY server.js app.js index.html style.css logo.svg favicon.svg changelog.json privacy.html terms.html ./

# 資料庫與設定存放目錄
RUN mkdir -p /app/data

EXPOSE 3000

# 自動建立 Volume — 即使 docker run 未指定 -v，資料也會持久化到匿名 Volume
VOLUME /app/data

# 環境變數（密鑰留空，首次啟動時自動產生並寫入 /app/data/.env）
ENV PORT=3000
ENV DB_PATH=/app/data/database.db
ENV ENV_PATH=/app/data/.env
ENV JWT_EXPIRES=7d
ENV GOOGLE_CLIENT_ID=

# 健康檢查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/config || exit 1

CMD ["node", "server.js"]
