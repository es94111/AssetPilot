# Quickstart: Finance Transactions Migration

**Date**: 2026-05-05

This feature migrates the Finance Transactions module to Next.js using Tailwind v4.

## Setup

1. **Install Dependencies**: `npm install recharts react-hook-form zod @hookform/resolvers`
2. **Develop**: Create `app/finance/transactions/page.tsx` with filtering components.
3. **Route**: Update Nginx config to point `/app/finance/transactions` to the Next.js process.

## Running

1. **Start Express (Legacy)**: `npm start`
2. **Start Next.js (New)**: `npm run dev`
3. **Verify**: Open `http://localhost:3000/app/finance/transactions` and check connectivity.
