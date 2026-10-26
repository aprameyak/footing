# footing

footing helps newer contributors find open-source issues they can realistically finish, then walks them from reading the issue to opening a pull request. It reads a repository through the GitHub API, scores its open issues against your skills and goals, and turns the repo's own docs into setup and verification checklists.

## How you use it

1. Sign in with GitHub (or the local dev login) and fill in onboarding: what you work with, what you want to learn, what kinds of software interest you, repos you like, and a challenge preference (comfortable, stretch, or challenge).
2. On the feed, paste `owner/repo` or a full issue URL such as `github.com/owner/repo/issues/123`, or pick a starter repo such as `vercel/next.js` or `withastro/astro`.
3. footing ingests the repo and its open issues, ranks them for you, and lists the reasons for each match, both for and against.
4. Open an issue to investigate it: a summary, what the maintainer asked for, difficulty estimates with an explanation, viability signals, suggested files to start from, and reproduce steps. Inferred items are labeled as inferred.
5. Start a contribution to get a workspace with seven stages: understand, setup, reproduce, investigate, implement, verify, submit.

## Features

- Matching (`src/lib/matching/engine.ts`): rule-based scoring on language, topic, and label overlap, issue recency, assignees, linked PRs, comment count, archived status, setup friction, and estimated complexity, weighted by your challenge preference.
- Repository readiness (`src/lib/analysis/repository.ts`): detects CONTRIBUTING docs, documented setup and test instructions, issue templates, recent activity and external PRs, CLA requirements, and AI policies, and extracts shell commands from fenced code blocks into checklists that link back to the source file.
- Issue analysis (`src/lib/analysis/issue.ts`): heuristic classification of issue type, code change size, codebase context, and concept complexity, plus suggested relevant paths from the repo tree.
- "I'm stuck" help (`src/lib/analysis/stuck.ts`): fixed guidance for ten blocker categories, such as "Repo won't run", "Tests are failing", and "Maintainer requested changes".
- Saved and hidden opportunities, a search page with label filters (good first issue, help wanted), a contributions list, and a profile.

All analysis is deterministic code over GitHub data. footing does not call an LLM.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4
- Auth.js (next-auth v5) with GitHub OAuth and an optional dev-only credentials login
- Prisma 5 with PostgreSQL
- Octokit for the GitHub REST API, zod for input validation

## Getting started

Prerequisites: Node.js 20+, pnpm 10+, PostgreSQL.

```bash
createdb footing
cp .env.example .env     # then set AUTH_SECRET, e.g. openssl rand -base64 32
pnpm install
pnpm db:push
pnpm dev                 # http://localhost:3000
```

Environment variables (see `.env.example`):

- `DATABASE_URL`: Postgres connection string
- `AUTH_SECRET`: Auth.js secret
- `AUTH_URL`, `NEXTAUTH_URL`: app URL
- `ENABLE_DEV_LOGIN`: enables the local dev login. It is always off when `NODE_ENV` is `production`, and it is also enabled when `GITHUB_CLIENT_ID` is unset.
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`: GitHub OAuth app (scopes `read:user user:email`)
- `GITHUB_TOKEN`: optional, raises the GitHub API rate limit

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, `pnpm db:studio`. There is no test suite yet.

## How it works

- `src/app/(app)/`: signed-in pages: `feed`, `search`, `saved`, `contributions`, `profile`, `investigate/[id]`, and `workspace/[id]`. `src/middleware.ts` redirects signed-out users to `/login`.
- `src/app/api/`: route handlers for `repos` (ingest a pasted repo or issue), `opportunities`, `contributions`, `onboarding`, and Auth.js.
- `src/lib/github/client.ts` fetches repo bundles, issue details, and file trees with Octokit. `src/lib/github/ingest.ts` stores them, runs the analyzers, ranks opportunities for a user, and creates contribution workspaces.
- `prisma/schema.prisma`: users and their skills and goals, repositories and their docs and analysis, issues and their analysis, opportunities with match reasons, and contributions with stages, checklist items, blockers, and pull requests.

## Contributing

Issues and pull requests are welcome. CI runs `pnpm lint`, `pnpm typecheck`, and `pnpm build`; run the same three commands before opening a PR.

## License

MIT, see [LICENSE](LICENSE).
