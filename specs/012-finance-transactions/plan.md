# Implementation Plan: Finance Transactions Migration

**Branch**: `012-finance-transactions` | **Date**: 2026-05-05 | **Spec**: [specs/012-finance-transactions/spec.md](spec.md)
**Input**: Frontend Migration to Next.js + Tailwind v4

## Summary

The goal is to incrementally migrate the transactions module to Next.js using App Router, Tailwind CSS v4, and React components. The strategy involves coexisting with the legacy Express application using sub-path routing (`/app/finance/transactions/*`) mediated by a reverse proxy. Transactions list, filtering, and row-level management (edit/delete) will be migrated.

## Technical Context

**Language/Version**: TypeScript, Node.js >= 24.0.0
**Primary Dependencies**: Next.js (App Router), Tailwind CSS v4, shadcn/ui, React Hook Form, Zod, Playwright, Recharts (for charts)
**Storage**: (Shared with legacy system)
**Testing**: Playwright (E2E)
**Target Platform**: Docker-based containers
**Project Type**: Incremental web application migration
**Performance Goals**: Maintain current performance, improve SEO, faster frontend iteration
**Constraints**: <200ms p95 API latency (shared), zero downtime for existing features
**Scale/Scope**: Incremental Finance Transactions migration

## Constitution Check

- **[I] 繁體中文文件規範 Gate**: Pass.
- **[II] OpenAPI 3.2.0 契約 Gate**: Pass (Existing API endpoints reused).
- **[III] Slash-Style HTTP Path Gate**: Pass.
- **Development Workflow Gate**: Pass.

## Project Structure

### Documentation

```text
specs/012-finance-transactions/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code

```text
app/finance/transactions/    # Next.js App Router (New)
src/                         # Legacy Express (Existing)
public/                      # Static assets
tests/e2e/                   # E2E tests
```

**Structure Decision**: Root `app/finance/transactions` directory for Next.js coexist with legacy `src/` directory.

## Complexity Tracking

> No violations of Constitution Check.
