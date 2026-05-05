# Implementation Tasks: Next.js + Tailwind v4 Migration

## Phase 1: Setup
- [x] T001 Initialize Next.js project in root `app/` directory (TypeScript)
- [x] T002 Configure Tailwind v4 CSS-first styling (`@import "tailwindcss";`) in `app/globals.css`
- [x] T003 Setup Reverse Proxy (Nginx/Docker) for sub-path routing (`/app/*` -> Next.js)

## Phase 2: Foundational
- [x] T004 [P] Setup `shadcn/ui` components for Dashboard
- [x] T005 Setup Playwright E2E testing framework in `tests/e2e/`

## Phase 3: User Story 1 - Migrate Dashboard (P1)
- [x] T006 [US1] Create Dashboard layout in `app/dashboard/page.tsx` (using App Router)
- [x] T007 [US1] Implement shared Cookie authentication utility in `lib/auth.ts`
- [x] T008 [US1] Implement Dashboard data fetching using Server Components in `app/dashboard/page.tsx`
- [x] T009 [US1] Integrate React Hook Form + Zod for Dashboard filters in `app/dashboard/components/`
- [x] T009a [US1] Verify functional data consistency (Filters/Charts) against legacy API response

## Phase 4: User Story 2 - Modern Styling (P1)
- [x] T010 [US2] Apply Tailwind v4 classes to Dashboard components
- [x] T011 [US2] Validate responsive design and styling consistency

## Phase 5: Testing & Polish
- [x] T012 Add Playwright E2E tests for Dashboard in `tests/e2e/dashboard.test.ts`
- [x] T013 Implement structured logging (e.g., `pino`) for both Express and Next.js
