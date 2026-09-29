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

## Demo auth

`/api/auth/dev-login` remains available only outside `ENVIRONMENT=production`.
