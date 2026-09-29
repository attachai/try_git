# Phase 10 — Cloudflare Production Release

## Current status

The application code, D1 migrations, test suite, build pipeline, and production deployment workflow are prepared.

Actual Cloudflare production deployment is intentionally blocked until:

1. a production D1 database exists;
2. required GitHub production secrets are configured;
3. real production authentication is implemented;
4. public/commercial character artwork is licensed/original.

The current demo login endpoint is disabled when `ENVIRONMENT=production`.

## Required Cloudflare resources

Create a D1 database:

```bash
npx wrangler login
npx wrangler d1 create family-reward-db-production
```

Record the returned D1 database ID.

## Required GitHub environment

Create a GitHub Environment named:

```text
production
```

Add these environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_D1_DATABASE_ID`
- `CLOUDFLARE_PRODUCTION_URL`
- `BOOTSTRAP_SECRET`

Recommended: configure required reviewers on the production environment so deployment requires explicit approval.

## API token permissions

Use the minimum Cloudflare token permissions required for:

- Workers Scripts: Edit
- D1: Edit

Restrict the token to the intended Cloudflare account.

## Deployment workflow

Run:

```text
GitHub Actions -> Deploy Cloudflare -> Run workflow
```

The workflow performs:

1. secret validation
2. dependency install
3. TypeScript typecheck
4. Worker/D1 integration tests
5. production build
6. render production Wrangler config
7. apply remote D1 migrations
8. deploy Worker + static assets
9. configure the one-time bootstrap secret
10. smoke test /api/health and application root

## Production config safety

The actual production Wrangler config is generated during deployment from:

```text
wrangler.production.template.jsonc
```

The D1 ID is injected from GitHub Secrets and the generated file is not committed.

## Authentication gate

Do not expose the application publicly with demo authentication.

Production credential authentication is now implemented:

- parent: email + password
- child: Family Code + child name + 4–8 digit PIN
- credentials stored as salted PBKDF2-SHA256 hashes

After the first deployment, call the one-time bootstrap endpoint described in docs/AUTH.md to create the first family. Rotate or remove BOOTSTRAP_SECRET after bootstrap.

## Artwork gate

Pokémon artwork in current seed data is prototype content. Replace with owned/licensed character assets before a public/commercial release.
