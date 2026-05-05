# Data Model: Finance Transactions Migration

**Date**: 2026-05-05

Since this is an incremental frontend migration, no new data models are required for the backend. The Next.js frontend will consume existing data models served by the legacy Express backend API.

## Entities Consumed

- **Transaction**: The primary entity representing a single income or expense.
- **Account**: Used for filtering transactions.
- **Category**: Used for filtering and visualizing transactions.
- **UserSession**: Shared cookie/session object for authentication.
