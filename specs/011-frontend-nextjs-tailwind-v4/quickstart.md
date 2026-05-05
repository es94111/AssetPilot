# Quickstart: Next.js + Tailwind v4 Migration

**Date**: 2026-05-05

This feature enables the incremental migration of the frontend to Next.js using Tailwind v4.

## Setup

1. **Install Next.js**:
   `npx create-next-app@latest . --typescript --tailwind --eslint` (Configure to use `app/` directory)
2. **Install Tailwind v4**:
   `npm install tailwindcss @tailwindcss/postcss`
3. **Configure Proxy**: Set up reverse proxy to route `/app/*` to the Next.js process.

## Running

1. **Start Express (Legacy)**: `npm start`
2. **Start Next.js (New)**: `npm run dev`
3. **Proxy**: Ensure Nginx/Proxy server is running.
