# Feature Specification: Frontend Next.js and Tailwind CSS Migration

## Feature Overview

**Short Name**: `frontend-nextjs-tailwind-migration`
**Purpose**: Migrate the existing Express-based frontend to a modern Next.js + Tailwind CSS v4 architecture.

## User Scenarios

1. **User visits application**: User experiences improved load times, better routing, and a consistent UI styled with Tailwind CSS v4.
2. **Developer develops features**: Developer works within a clean, modern Next.js structure, utilizing React, TypeScript, and Tailwind utility classes, leading to faster development and maintenance.

## Clarifications
### Session 2026-05-05
- Q: Are there specific features or pages that should be migrated first as a priority? → A: Dashboard + Transactions
- Q: Should we aim for a hybrid approach (keeping Express for now) or a complete split into separate frontend/backend? → A: Hybrid approach (Hybrid)

## Functional Requirements

- [x] Migrate existing UI features (Dashboard, Transactions) to Next.js structure.
- [ ] Styles migrated from existing CSS to Tailwind CSS v4 utility classes.
- [ ] Routes migrated from Express routes to Next.js App Router (hybrid setup).
- [ ] Frontend logic refactored into Next.js Server Components, Client Components, or API Routes.
- [ ] UI components library fully converted to TypeScript and Tailwind CSS.


## Migration Strategy
- Adopt a Hybrid approach: Next.js acts as the UI layer calling the existing Express backend APIs, ensuring stability during the incremental migration.
- Priority for migration: Dashboard and Transactions modules.


## Success Criteria

- [ ] All frontend features work exactly as they did before migration.
- [ ] No more Express rendering logic remains for frontend pages.
- [ ] All styling is managed by Tailwind CSS v4.
- [ ] Lighthouse performance scores: LCP < 2.5s, TBT < 200ms.


## Assumptions

- The backend API will remain as Express for now, serving as the API provider for Next.js.
- TypeScript will be used for all new frontend code.
- Existing data models and API contracts remain unchanged.

## Needs Clarification
- [Resolved: Feature priority set to Dashboard + Transactions]
- [Resolved: Strategy set to Hybrid approach]

