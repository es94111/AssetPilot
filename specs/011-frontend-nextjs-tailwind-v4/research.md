# Research: Next.js + Tailwind v4 Migration

**Date**: 2026-05-05
**Feature**: [011-nextjs-tailwind-migration](spec.md)

## Incremental Next.js Migration Strategy (Sub-path Routing)

- **Decision**: Use reverse proxy (e.g., Nginx or simple node proxy) to route `/app/*` requests to Next.js process, remaining paths to Express.
- **Rationale**: Minimal interference with existing Express server, allows independent scaling and deployment of Next.js.
- **Alternatives Considered**: 
  - Express Middleware: Rejected due to compatibility risks and performance constraints with App Router.
  - Sub-domain migration: Rejected as it introduces CORS and authentication complexity.

## Tailwind CSS v4 Integration (CSS-first)

- **Decision**: Use CSS-first approach (`@import "tailwindcss";`) in `globals.css`.
- **Rationale**: Simplified configuration, zero-config for basic setups, optimized build performance.
- **Alternatives Considered**: 
  - PostCSS configuration: Rejected as it is less modern and less efficient than v4's native CSS-first approach.

## Data Fetching (Server Components)

- **Decision**: Server Components to call backend APIs directly.
- **Rationale**: Best performance (SSR), cleaner code, utilizes Next.js native features.
- **Alternatives Considered**: 
  - Next.js API Routes as Proxy: Rejected to minimize overhead, unless API format conversion is required later.
