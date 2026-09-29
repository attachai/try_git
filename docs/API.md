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
Parent may access children in their family. Child may access only their own history.

## Shop

### GET /api/shop
Authenticated. Returns active purchasable characters. For a child session, each character includes an `owned` flag.

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
