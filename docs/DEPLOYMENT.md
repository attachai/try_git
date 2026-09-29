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
```

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
```

## Deploy
```bash
npm run deploy
```

Do not commit secrets. Use Wrangler/Cloudflare secret management for secrets introduced in later phases.
