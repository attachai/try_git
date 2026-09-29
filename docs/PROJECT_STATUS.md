# Project Status

## Phase 0 — Project scaffolding
Status: COMPLETE

- React + TypeScript + Vite shell
- Cloudflare Worker entrypoint
- D1 binding configuration placeholder
- Mobile-first dashboard shell
- Architecture/deployment documentation

## Phase 1 — D1 schema and migrations
Status: COMPLETE

- Initial D1 migration
- Ledger-oriented point model
- Character/evolution schema
- Demo seed data
- Core indexes and foreign keys

## Phase 2 — Authentication + family ownership
Status: MVP COMPLETE

- Server-side session table and HttpOnly cookie
- Demo parent/child sign-in for non-production environments
- /api/auth/me
- /api/auth/logout
- Parent/child role enforcement
- Family ownership checks on parent operations

Production credential authentication is intentionally deferred; demo login returns 404 when ENVIRONMENT=production.

## Phase 3 — Parent point management
Status: MVP COMPLETE

- Parent can award points
- Parent can deduct points
- Zod validation
- Ownership enforcement
- D1 trigger applies ledger entry to balance atomically
- D1 trigger rejects negative resulting balance
- Reason stored in audit history

## Phase 4 — Child dashboard + history
Status: MVP COMPLETE

- Parent reads children from D1
- Child reads own profile only
- Parent and child history API
- React dashboard consumes real API data
- Child cannot mutate points

## Important architecture improvement

From migration 0002 onward, point balance changes are driven by insertion into point_transactions.
The database trigger updates children.points_balance in the same statement transaction, preventing a balance/history split.

## Not implemented yet
- Production password/passkey login
- Shop API
- Purchase transaction
- Collection/evolution API
- Automated tests
- Production D1 database ID
- Cloudflare deployment

## Next
Phase 5-7: character catalog/shop, atomic purchase flow, collection and evolution.
