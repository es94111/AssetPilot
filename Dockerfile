# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache dumb-init

# Copy backend
COPY --from=backend-build /app/backend/dist ./dist
COPY --from=backend-build /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/package.json ./
COPY --from=backend-build /app/backend/prisma ./prisma

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000

# Run migrations then start
ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
