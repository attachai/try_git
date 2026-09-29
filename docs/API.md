# API — Phase 2-4

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

`type` is `EARN` or `DEDUCT`.

The API never updates `children.points_balance` directly. It inserts the permanent ledger entry. D1 triggers apply the balance change atomically and reject any operation that would produce a negative balance.

### GET /api/children/:childId/history
Parent may access children in their family. Child may access only their own history.

Current MVP limit: latest 100 records.

## Error shape

```json
{
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "คะแนนคงเหลือไม่พอสำหรับการหักคะแนนนี้"
  }
}
```

## Production authentication note

Phase 2 intentionally provides only a development/demo login flow. Do not expose demo login in production. A production credential flow (password/passkey/magic-link) must be implemented before public deployment.
