# Data Model: Dashboard Migration

**Date**: 2026-05-05

Since this is an incremental frontend migration, no new data models are required for the backend. The Next.js frontend will consume existing data models served by the legacy Express backend API.

## Entities Consumed

- **DashboardData**: Object containing aggregated data for the dashboard (income/expense summaries, chart data).
- **UserSession**: Shared cookie/session object for authentication.
