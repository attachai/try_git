# API — Phase 2-7

All endpoints use JSON. Authenticated sessions use an HttpOnly cookie.

## Development authentication

### POST /api/auth/dev-login
Disabled when `ENVIRONMENT=production`.

Body:
```json
{ "role": "PARENT" }
```

or:

```json
{ "role": "CHILD" }
```

### GET /api/auth/me
Returns the current session user.

### POST /api/auth/logout
Deletes the current session.

## Children

### GET /api/children
Parent only. Returns children belonging to the parent's family.

### GET /api/child/me
Child only. Returns the child profile linked to the session user.

## Families (parent only)

- `GET /api/families`: the caller's families with members and whether each has a PIN.
- `POST /api/families/update` `{ familyId, name, familyCode }`: rename a family and change its Family Code (normalized to upper case, spaces to `-`). 409 `FAMILY_CODE_TAKEN` when another family uses it.
- `POST /api/members/rename` `{ familyId, userId, displayName }`: rename a parent or child in that family. Child names stay unique per family (409 `CHILD_NAME_TAKEN`).
- `POST /api/families/leave` `{ familyId }`: remove the caller from a family, e.g. after creating it for someone else. 409 `LAST_PARENT` unless another parent with a PIN remains.
- `POST /api/parents` `{ familyId, displayName, relation, pin }`: add a parent who signs in with the profile picker PIN.

## Points

### POST /api/points
Parent only.

```json
{
  "childId": "child_demo",
  "type": "EARN",
  "amount": 50,
  "reason": "ทำการบ้าน"
}
```

The API inserts the permanent ledger entry. D1 triggers apply the balance change atomically and reject any operation that would produce a negative balance.

### GET /api/children/:childId/history
Parent of the child, or the child themselves. Shows Thailand-time days:
- `?days=N` (1–366): the last N days including today. The default is 7.
- `?from=YYYY-MM-DD&to=YYYY-MM-DD`: an inclusive range of at most 366 days.

Returns `history` (newest first, up to 500 rows), `truncated`, `range { from, to }`, and `summary { count, earned, spent }` for the whole range. An invalid range returns 400 `INVALID_RANGE`.

## Shop

### GET /api/shop
Authenticated. Returns active purchasable characters. For a child session, each character includes an `owned` flag. Each character also has `evolutions`: every form it evolves into, in order (`id`, `name`, `image_url`, `rarity`, types, and the step's point `cost`), or `[]` for a single-stage character.

### POST /api/shop/purchase
Child only.

```json
{ "characterId": "char_pikachu" }
```

The purchase uses `D1.batch()` for one atomic unit:
1. insert PURCHASE point ledger entry
2. ledger trigger deducts balance
3. insert owned character
4. insert purchase audit record

If any statement fails, the whole batch rolls back.

## Collection

### GET /api/collection
Child only. Returns current owned characters plus the next available evolution path.

### POST /api/collection/evolve
Child only.

```json
{ "childCharacterId": "..." }
```

Evolution atomically:
1. inserts EVOLUTION ledger debit
2. marks source collection item EVOLVED
3. creates evolved owned character
4. inserts evolution audit record

## Daily quests

Parents define repeatable quests for one child or every child in a family. Days are counted in Thailand time (UTC+7).

- `GET /api/quests` (child) or `GET /api/quests?childId=` (parent): today's quests with each one's status (`null`, `PENDING`, `APPROVED`, `REJECTED`) and the streak (`current`, `today_done`, `next_milestone`, `next_bonus`)
- `GET /api/quests/pending` (parent): completions waiting for approval across the parent's families
- `POST /api/quests` (parent) `{ childId, forAllChildren, title, points }`: points 5-500
- `POST /api/quests/archive` (parent) `{ questId }`
- `POST /api/quests/complete` `{ questId, childId? }`: a child submits for approval. A parent marks it done and approves it right away. A rejected quest can be submitted again
- `POST /api/quests/review` (parent) `{ completionId, approve }`

Approval inserts an `EARN` ledger row with `reference_type = 'QUEST'`. A streak day is any day with at least one approved quest. Reaching 3, 7, 14 or 30 days in a row pays +20, +50, +100 or +200 as a `STREAK` ledger row. A unique index on `(reference_type, reference_id)` makes each quest completion and each streak day pay out once.

## Mystery box (กล่องสุ่ม)

Child only. A spin costs 400 points, is limited to 3 per child per Thailand-time day, and always grants a shop character (`price > 0`) the child doesn't own, so there are no duplicates and no evolved forms. Rarity weights are COMMON 60, RARE 30, EPIC 9, LEGENDARY 1. Rarities with nothing left are skipped and the rest renormalized, and `GET /api/gacha` returns those effective odds.

- `GET /api/gacha`: `price`, `daily_limit`, `spins_today`, `pool_size`, `odds`
- `POST /api/gacha/spin`: `201 { character }`. Returns `429 DAILY_LIMIT`, `409 POOL_EMPTY`, `409 INSUFFICIENT_POINTS`, or `409 TRY_AGAIN` (a concurrent spin took the character; nothing was charged)

A spin atomically writes a `PURCHASE` ledger row (`reference_type = 'GACHA'`), the owned character, and a `gacha_spins` audit row.

## Pokédex (สมุดสะสม)

Child only. A character counts as registered once the child has ever had it, including forms they've since evolved.

- `GET /api/pokedex`: `total`, `registered`, `entries` (every active character in dex order, with `registered` and `evolves_from` so the UI can say how to get it), and `sets`
- `POST /api/pokedex/claim` `{ set }`: pays a completed set's bonus once. Returns `409 SET_INCOMPLETE` or `409 ALREADY_CLAIMED`

A set is every active character sharing a `type_primary`, worth 30 points per character, plus `ALL` (the whole Pokédex) worth 1000. The bonus is an `EARN` ledger row with `reference_type = 'DEX_SET'` and `reference_id = '<childId>:<set>'`. Migration 0009 adds `DEX_SET` to the one-payout-per-reference unique index.

## Arena

Parent-vs-child turn-based battles with room codes, three-round tournaments, rank, achievements and daily arena quests. The rules, endpoints (including `/api/arena/profile` and `POST /api/arena/rooms/:code/next`), rewards and balance numbers are in [ARENA.md](ARENA.md).

## Error shape

```json
{
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "คะแนนสะสมไม่พอ"
  }
}
```

Other expected conflicts:
- `ALREADY_OWNED`
- `EVOLUTION_NOT_AVAILABLE`

## Production authentication note

Development/demo login must not be exposed in production. A production credential flow must be implemented before public deployment.
