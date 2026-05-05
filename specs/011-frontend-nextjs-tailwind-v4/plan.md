# Implementation Plan: Next.js + Tailwind v4 Migration

**Branch**: `011-nextjs-tailwind-migration` | **Date**: 2026-05-05 | **Spec**: [specs/011-nextjs-tailwind-migration/spec.md](spec.md)
**Input**: Frontend Migration to Next.js + Tailwind v4

## Summary

The goal is to incrementally migrate the existing frontend to Next.js using App Router and Tailwind CSS v4. The strategy involves coexisting with the legacy Express application using sub-path routing (`/app/*`) mediated by a reverse proxy. The Dashboard will be the first feature migrated, followed by E2E testing to ensure stability.

## Technical Context

**Language/Version**: TypeScript, Node.js >= 24.0.0
**Primary Dependencies**: Next.js (App Router), Tailwind CSS v4, shadcn/ui, React Hook Form, Zod, Playwright
**Storage**: (Shared with legacy system)
**Testing**: Playwright (E2E)
**Target Platform**: Docker-based containers
**Project Type**: Incremental web application migration
**Performance Goals**: Maintain current performance, improve SEO, faster frontend iteration
**Constraints**: <200ms p95 API latency (shared), zero downtime for existing features
**Scale/Scope**: Incremental Dashboard migration

## Constitution Check

- **[I] 繁體中文文件規範 Gate**: Pass.
- **[II] OpenAPI 3.2.0 契約 Gate**: Pass (No new API endpoints added).
- **[III] Slash-Style HTTP Path Gate**: Pass.
- **Development Workflow Gate**: Pass.

## Project Structure

### Documentation

```text
specs/011-nextjs-tailwind-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code

```text
app/             # Next.js App Router (New)
src/             # Legacy Express (Existing)
public/          # Static assets
specs/           # Documentation
tests/           # Integration & E2E (New Playwright tests)
```

**Structure Decision**: Root `app/` directory for Next.js coexist with legacy `src/` directory.

## Complexity Tracking

> No violations of Constitution Check.
