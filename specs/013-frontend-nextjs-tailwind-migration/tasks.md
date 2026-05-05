# Task List: Frontend Next.js and Tailwind CSS Migration

## Phase 1: Setup
- [X] T001 Initialize Next.js in the project root
- [X] T002 Configure `tailwind.config.ts` for Tailwind v4 (postcss setup, content paths)

## Phase 2: Foundational
- [X] T003 Create `app/layout.tsx` for global layout
- [X] T004 Setup global CSS and import Tailwind base styles in `styles/globals.css`
- [X] T005 [P] Setup Next.js App Router middleware to handle hybrid routing (`middleware.ts`)
- [X] T006 [P] Configure `next.config.ts` for hybrid Express/Next.js API forwarding

## Phase 3: Dashboard [US1]
- [X] T007 [P] Create `app/dashboard/page.tsx`
- [X] T008 [P] Create `components/features/dashboard/DashboardClient.tsx` (Migrated)
- [X] T009 [P] Implement data fetching logic for Dashboard in `lib/dashboardHelpers.ts`

## Phase 4: Transactions [US2]
- [X] T010 [P] Create `app/finance/transactions/page.tsx`
- [X] T011 [P] Create `components/features/transactions/TransactionsClient.tsx` (Migrated)
- [X] T012 [P] Implement API interaction for Transactions in `lib/apiHelpers.ts`

## Phase 5: Polish & Cross-cutting
- [X] T013 Migrate remaining UI components from `components/ui/` to Tailwind v4/TSX
- [X] T015 Migrate Account Settings page
- [X] T016 Migrate Accounts module
- [X] T017 Migrate Categories module
- [X] T018 Migrate Budget module
- [X] T019 Migrate Recurring module
- [X] T020 Migrate Reports module
- [ ] T014 Run lighthouse and verify performance improvements (LCP < 2.5s, TBT < 200ms)


## Dependencies
- Phase 3 & 4 are independent.
- Phase 5 depends on Phase 3 & 4.
