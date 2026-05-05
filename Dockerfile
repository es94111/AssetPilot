FROM node:24-alpine AS builder

WORKDIR /app

# 複製 package.json 先安裝依賴（含 devDependencies，建置需要）
COPY package.json package-lock.json* ./
RUN npm ci

# 複製所有原始碼
COPY . .

# 建置 Next.js（產生 .next/standalone）
RUN npm run build

# ── 生產映像 ──
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/database.db
ENV ENV_PATH=/app/data/.env
ENV SSL_PATH=/app/data/SSL
ENV JWT_EXPIRES=7d
ENV GOOGLE_CLIENT_ID=

# 複製 Next.js standalone 輸出
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 複製非 JS 資料（changelog、原始 lib 供 scheduler 等 webpackIgnore 路由載入）
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/changelog.json ./changelog.json

# 資料庫、設定與 SSL 憑證存放目錄
RUN mkdir -p /app/data/SSL/Origin\ Certificates

EXPOSE 3000

# /app/data 同時包含：database.db、.env、SSL/ 憑證目錄
VOLUME /app/data

# 健康檢查
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/config || exit 1

CMD ["node", "server.js"]
