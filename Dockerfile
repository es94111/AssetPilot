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

# 修補 base image 落後的 OS 套件（如 OpenSSL libcrypto3/libssl3 CVE）。
# Trivy 設 ignore-unfixed=true，僅會擋「上游已有修補」的弱點，故升級到 alpine repo 最新修補版即可通過掃描。
RUN apk upgrade --no-cache

# 移除 base image 內建的 npm。standalone 入口僅需 `node server.js`，執行期完全用不到 npm，
# 而 npm 自帶的 vendored undici（node:24-alpine 為 6.25.0）帶有 CVE-2026-12151（DoS），
# 上游 npm 尚未隨基底映像更新。移除可同時縮小攻擊面並通過 Trivy 容器掃描。
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/bin/npm \
           /usr/local/bin/npx

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
# /api/changelog 以 readFileSync(process.cwd()/changelog.json) 動態讀檔，standalone
# tracing 無法發現此執行期路徑；私有 repo 又讓 raw.githubusercontent.com fallback 失效
# (404)，故須手動複製，否則 App 版本資訊頁拿到空清單、無法顯示更新內容。
COPY --from=builder --chown=nextjs:nodejs /app/changelog.json ./changelog.json
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
# sharp（交易照片壓縮）為 serverExternalPackages，於 runtime require，需手動複製其
# 本體與相依：平台專屬原生套件（@img/sharp-linuxmusl-*、libvips、@img/colour）、
# detect-libc、semver。
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/detect-libc ./node_modules/detect-libc
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/semver ./node_modules/semver

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
