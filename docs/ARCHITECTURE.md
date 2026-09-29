# Architecture

## Goal
Family Reward Game is a mobile-first family points ledger and collectible-character reward experience.

## Runtime
- React + TypeScript SPA
- Vite
- Cloudflare Worker API
- Cloudflare D1
- Optional future Cloudflare R2 for owned/licensed artwork

## Boundaries
The UI never directly edits D1. All mutations go through Worker API routes. Server-side authorization is mandatory.

## Core rule
`point_transactions` is the permanent audit ledger. `children.points_balance` is a cached/current balance only.

Any point-changing feature must:
1. validate actor and family ownership
2. validate amount/reason
3. reject negative resulting balance by default
4. update balance and append ledger entry atomically

## Character assets
Character metadata and image URLs are data, not hardcoded UI dependencies. Prototype Pokémon assets are replaceable and must be swapped for original/licensed assets before public/commercial release.

## Planned route groups
- /api/auth
- /api/children
- /api/points
- /api/characters
- /api/shop
- /api/collection

Only /api/health is implemented in Phase 0-1.
