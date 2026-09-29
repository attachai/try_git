# Production Authentication

## Parent login

Parents authenticate with email + password.

Endpoint:

```text
POST /api/auth/login/parent
```

## Child login

Children authenticate with:

- Family Code
- child display name
- PIN

Endpoint:

```text
POST /api/auth/login/child
```

This avoids requiring a child email account.

## Password/PIN storage

Credentials are not stored in plaintext.

The Worker uses Web Crypto PBKDF2-SHA256 with:

- random 16-byte salt
- 210,000 iterations
- 32-byte derived key

The encoded hash is stored in `users.password_hash`.

## Initial family bootstrap

The first production family is created through:

```text
POST /api/auth/bootstrap
```

The request must include:

```text
X-Bootstrap-Secret: <BOOTSTRAP_SECRET>
```

The endpoint refuses to run if a parent account already exists.

Set `BOOTSTRAP_SECRET` as a Cloudflare Worker secret before initial setup. Rotate/remove it after bootstrap.

## Profile picker login

The login screen asks for the Family Code once (remembered in the browser's
localStorage), then shows every family member as a profile tile. Tapping a
profile asks for that person's PIN.

- `POST /api/auth/family` `{ familyCode }` returns the family name and its profiles (name, relation, avatar, whether a PIN is set). No session needed.
- `POST /api/auth/login/profile` `{ familyCode, userId, pin }` signs the profile in. Parents are checked against `users.pin_hash`, children against `users.password_hash` (their PIN).
- `POST /api/auth/profile` `{ pin?, relation? }` lets a signed-in parent set their own PIN and whether they are FATHER, MOTHER or GUARDIAN.
- `POST /api/parents` `{ familyId, displayName, relation, pin }` adds another parent with no email. They can only sign in through the profile picker.
- `POST /api/children/avatar` `{ childId, avatarUrl }` stores a child's avatar as a small `data:image/...` URL (max 200 KB). The browser center-crops and resizes to 256px first.

Anyone who knows a Family Code can see that family's names and child avatars, so use a code that is hard to guess. Email + password login is still available for parents.

## Demo auth

`/api/auth/dev-login` remains available only outside `ENVIRONMENT=production`.
