# Cloudflare Deployment

## Install
```bash
npm install
```

## Create D1 database
```bash
npx wrangler d1 create family-reward-db
```

Copy the returned database ID into `wrangler.jsonc`.

## Local migration
```bash
npm run db:migrate:local
```

## Local seed
```bash
npm run db:seed:local
npm run db:seed:characters:local
```

`db:seed:characters:*` adds 50 more characters and their evolution paths from `db/seed/002_more_characters.sql`. Run it after the demo seed; it is safe to re-run.

## Development
```bash
npm run dev
```

## Remote migration
```bash
npm run db:migrate:remote
```

## Remote seed
Use demo seed remotely only for a disposable/test environment.

```bash
npm run db:seed:remote
npm run db:seed:characters:remote
```

## Deploy
```bash
npm run deploy
```

Do not commit secrets. Use Wrangler/Cloudflare secret management for secrets introduced in later phases.
