FROM node:20-alpine

WORKDIR /app

# 複製 package.json 先安裝依賴（利用 Docker 快取層）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# 複製應用程式檔案
COPY server.js app.js index.html style.css logo.svg favicon.svg changelog.json ./

# 資料庫存放目錄（掛載用）
RUN mkdir -p /app/data

EXPOSE 3000

# 環境變數預設值
ENV PORT=3000
ENV DB_PATH=/app/data/database.db
ENV JWT_SECRET=please-change-this-secret
ENV JWT_EXPIRES=7d
ENV GOOGLE_CLIENT_ID=
ENV DB_ENCRYPTION_KEY=

CMD ["node", "server.js"]
