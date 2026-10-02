# footing

Find realistic open-source work and get through setup, investigation, and a useful PR — without replacing the engineering.

Not a `good first issue` directory. Not an AI coding agent. Not a gamified social network.

## What it does

1. Capture skills, learning goals, and interests
2. Paste a GitHub repository or issue
3. Ingest issues via the GitHub API
4. Filter weak opportunities (stale, abandoned, active PR, vague)
5. Rank with transparent match reasons
6. Analyze contributor readiness and issue difficulty dimensions
7. Open a contribution workspace: understand → setup → reproduce → investigate → implement → verify → submit

## Stack

- Next.js / TypeScript / React
- PostgreSQL + Prisma
- Tailwind CSS
- GitHub OAuth (minimal scopes) + optional local demo login
- GitHub REST API via Octokit
- Auth.js v5 (beta)

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io) 10+
- PostgreSQL with `createdb` available

## Setup

```bash
createdb footing
cp .env.example .env
# set AUTH_SECRET, e.g. openssl rand -base64 32
pnpm install
pnpm db:push
pnpm dev
```

Do not commit `.env`. Use `.env.example` as the template.

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET` | Auth.js secret (required) |
| `AUTH_URL` / `NEXTAUTH_URL` | App URL (`http://localhost:3000`) |
| `ENABLE_DEV_LOGIN` | Local credentials login (`true` when OAuth unset) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth (`read:user user:email`) |
| `GITHUB_TOKEN` | Optional token for higher public API rate limits |

## Vertical slice

Sign in → set skills to React + TypeScript → learning goal Testing → paste a public repo → inspect ranked opportunities → investigate → start contribution workspace.

## Principles

- Explanations over opaque scores
- Facts vs inference are labeled
- Setup commands have provenance (`View source`)
- Heuristics reduce friction; they do not write the PR for you

## License

MIT
