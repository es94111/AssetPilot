# syntax=docker/dockerfile:1.7

# ── Stage 1: 安裝相依套件 ──
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: 建置 Next.js standalone ──
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# ── Stage 3: 執行階段 ──
FROM node:24-alpine AS runner
WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/build/standalone ./
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV ENV_PATH=/app/data/.env
ENV SSL_PATH=/app/data/SSL
ENV JWT_EXPIRES=7d
ENV GOOGLE_CLIENT_ID=

# 建立非 root 使用者執行 Next.js（best practice）
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Next.js standalone 輸出（內含最小化 node_modules 與 server.js 入口）
# (使用 distDir='build' 輸出，因此從 /app/build/ 拷貝已在上方處理)
# public 目錄（favicon、logo 等）
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Next.js 靜態資產（含編譯後 CSS/JS）
COPY --from=builder --chown=nextjs:nodejs /app/build/static ./build/static
# lib/ 透過 instrumentation.js 動態 import (webpackIgnore)，未被 Next.js trace，需手動複製
COPY --from=builder --chown=nextjs:nodejs /app/lib ./lib
# 手動維運指令需在 runner 映像內可用
COPY --from=builder --chown=nextjs:nodejs /app/tools ./tools
# PostgreSQL runtime uses worker_threads require() to keep pg out of the edge/instrumentation bundle,
# so Next.js standalone tracing cannot discover these packages automatically.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg ./node_modules/pg
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-cloudflare ./node_modules/pg-cloudflare
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-connection-string ./node_modules/pg-connection-string
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-int8 ./node_modules/pg-int8
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-pool ./node_modules/pg-pool
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-protocol ./node_modules/pg-protocol
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pg-types ./node_modules/pg-types
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pgpass ./node_modules/pgpass
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-array ./node_modules/postgres-array
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-bytea ./node_modules/postgres-bytea
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-date ./node_modules/postgres-date
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/postgres-interval ./node_modules/postgres-interval
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/split2 ./node_modules/split2
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/xtend ./node_modules/xtend

# 持久化資料目錄（.env、SSL 憑證）
RUN mkdir -p /app/data/SSL/Origin\ Certificates \
 && chown -R nextjs:nodejs /app/data
VOLUME /app/data

USER nextjs
EXPOSE 3000

# 健康檢查（使用 Next.js API route /api/config 回傳 200 視為健康）
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/config || exit 1

# Next.js standalone 入口（.next/standalone/server.js）
CMD ["node", "server.js"]
