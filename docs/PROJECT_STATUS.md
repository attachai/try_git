# Project Status

## Phase 0 — Project scaffolding
Status: COMPLETE

## Phase 1 — D1 schema and migrations
Status: COMPLETE

## Phase 2 — Authentication + family ownership
Status: MVP COMPLETE

- HttpOnly server session
- Non-production Parent/Child demo login
- Server-side role enforcement
- Family ownership checks

Production credential authentication is intentionally deferred.

## Phase 3 — Parent point management
Status: MVP COMPLETE

- Award/deduct points
- Zod validation
- Permanent ledger
- D1 trigger updates balance atomically
- Negative balances rejected

## Phase 4 — Child dashboard + history
Status: MVP COMPLETE

- Parent and child read scopes
- History API
- Real D1-backed React UI
- Child cannot manually alter points

## Phase 5 — Character catalog/shop
Status: MVP COMPLETE

- D1-backed shop catalog
- Prototype artwork URLs isolated as replaceable data
- Type and rarity presentation
- Owned-state indication

## Phase 6 — Purchase transaction
Status: MVP COMPLETE

- Child-only purchase endpoint
- Balance debit through ledger
- D1 batch transaction for ledger + ownership + audit record
- Insufficient balance rollback
- Duplicate owned-character protection

## Phase 7 — Collection + evolution
Status: MVP COMPLETE

- Child collection API and UI
- Evolution paths and costs
- Atomic evolution ledger/ownership/audit batch
- Evolved source retained for lineage with status EVOLVED

## Phase 8 — Game UX polish
Status: COMPLETE

- Mobile bottom navigation
- Child Home / Shop / Collection / History separation
- Parent Points / History navigation
- Custom confirmation dialog replaces browser confirm()
- Purchase and evolution celebration feedback
- Loading/disabled mutation states
- Responsive collection/shop cards
- prefers-reduced-motion support

## Phase 9 — Tests + security review
Status: IMPLEMENTED; EXECUTION VERIFICATION REQUIRED

- Cloudflare Workers Vitest plugin configured
- D1 migrations applied in test runtime
- Integration tests for point ledger, authorization, negative balance, purchase and evolution
- Cross-site mutation test
- Production Secure session cookie
- Origin/Sec-Fetch-Site mutation guard
- Security response headers
- docs/SECURITY.md

The test suite must be executed with npm install && npm test before merging/deploying.

## Production gates remaining

- Production password/passkey/magic-link authentication
- Production authentication rate limiting
- Production D1 database ID
- Cloudflare deployment
- Original/licensed character artwork for public/commercial use
- Final CSP after asset hosts are decided

## Next

Phase 10: run build/test gate, create production D1, configure Cloudflare environment, and deploy.
