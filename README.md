# footing

Find realistic open-source issues and work a contribution through setup → PR.

## Setup

```bash
createdb footing
cp .env.example .env
# AUTH_SECRET=$(openssl rand -base64 32)
pnpm install
pnpm db:push
pnpm dev
```

Requires Node 20+, pnpm 10+, Postgres.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres |
| `AUTH_SECRET` | Auth.js secret |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL |
| `ENABLE_DEV_LOGIN` | Local login (dev only; off in production) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | OAuth (`read:user user:email`) |
| `GITHUB_TOKEN` | Optional API rate limit boost |

## License

MIT
