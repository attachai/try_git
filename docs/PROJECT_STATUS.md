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
- Pokémon prototype artwork URLs isolated as data
- Type and rarity presentation
- Owned-state indication

## Phase 6 — Purchase transaction
Status: MVP COMPLETE

- Child-only purchase endpoint
- Balance debit through ledger
- D1 batch transaction for ledger + ownership + audit record
- Insufficient balance rollback
- Duplicate owned-character protection

Cloudflare documents D1 batch statements as transactional and rolled back when a statement fails.

## Phase 7 — Collection + evolution
Status: MVP COMPLETE

- Child collection API and UI
- Current ownership state
- Evolution paths and costs
- Pikachu -> Raichu
- Charmander -> Charmeleon -> Charizard
- Squirtle -> Wartortle -> Blastoise
- Bulbasaur -> Ivysaur -> Venusaur
- Atomic evolution ledger/ownership/audit batch
- Evolved source retained for lineage with status EVOLVED

## Not implemented yet

- Production password/passkey/magic-link login
- Automated tests
- UX animations/celebration
- Production D1 database ID
- Cloudflare deployment
- Original/licensed character artwork for public/commercial use

## Next

Phase 8: UI polish, navigation, celebration/evolution animation.
Phase 9: automated tests and security review.
Phase 10: create production D1 database and deploy to Cloudflare.
