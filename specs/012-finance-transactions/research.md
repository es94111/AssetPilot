# Research: Finance Transactions Migration

**Date**: 2026-05-05
**Feature**: [012-finance-transactions](spec.md)

## Incremental Migration Strategy (Sub-path Routing)

- **Decision**: Use existing reverse proxy (Nginx) to route `/app/finance/transactions/*` requests to Next.js process.
- **Rationale**: Keeps architecture consistent with previous dashboard migration and allows independent module deployments.

## Tailwind v4 Integration (CSS-first)

- **Decision**: Continue using CSS-first approach (`@import "tailwindcss";`) as per project standard.
- **Rationale**: Keeps consistency with existing migrated components.

## Data Fetching (Server Components)

- **Decision**: Use Next.js Server Components for initial list rendering; React Hook Form + Zod for client-side filtering; Server Actions (`revalidatePath`) for updates.
- **Rationale**: Provides SSR performance for the table list and robust, type-safe validation for CRUD actions.

## Chart Integration

- **Decision**: Adopt `recharts` for visualization needs.
- **Rationale**: Native React support, lightweight, integrates well with Tailwind CSS.
