# footing

Match developers to realistic open-source issues, then walk them through setup, investigation, and a PR. Not a good-first-issue list and not an AI coding agent.

## Features

1. Profile skills, goals, and interests
2. Paste a GitHub repo or issue
3. Ingest issues via the GitHub API
4. Drop weak opportunities (stale, abandoned, open PR, vague)
5. Rank with explicit match reasons
6. Score readiness and difficulty
7. Contribution workspace: understand → setup → reproduce → investigate → implement → verify → submit

## Stack

Next.js, TypeScript, React, PostgreSQL, Prisma, Tailwind, GitHub OAuth / optional local login, Octokit, Auth.js v5 (beta)

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL (`createdb` available)

## Setup

```bash
createdb footing
cp .env.example .env
# AUTH_SECRET=$(openssl rand -base64 32)
pnpm install
pnpm db:push
pnpm dev
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection |
| `AUTH_SECRET` | Auth.js secret (required) |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL (`http://localhost:3000`) |
| `ENABLE_DEV_LOGIN` | Local credentials login (on when OAuth unset) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth (`read:user user:email`) |
| `GITHUB_TOKEN` | Optional; raises public API rate limits |

## Try it

Sign in → add React + TypeScript skills → learning goal Testing → paste a public repo → open a ranked issue → start a workspace.

Match reasons label facts vs inference. Setup steps show provenance.

## License

MIT
