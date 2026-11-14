# CS6983 Project 2

Full-stack app for CS 6983 (AI Coding), Fall 2026.

Stack: Next.js (App Router, TypeScript) · Tailwind CSS · PostgreSQL with Prisma · Vitest + Testing Library.

**Live app:** https://loadline-cs6983-loadline1.vercel.app

## Setup

Requires Node.js 22 or newer.

```bash
npm install            # also generates the Prisma client
cp .env.example .env   # then set DATABASE_URL
npm run dev            # http://localhost:3000
```

For a local database, run `npx prisma dev` in a separate terminal and paste the
URL it prints into `.env`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Run unit tests once |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run typecheck` | Generate Next.js route types and type-check |
| `npm run build` | Production build |
| `npm run vercel-build` | What Vercel runs: migrations (production only), then the build |

## Deployment

The app is hosted on [Vercel](https://vercel.com) with a [Neon](https://neon.tech)
Postgres database, connected to this GitHub repo.

| Event | What happens |
|---|---|
| Pull request opened or updated | CI runs, and Vercel posts a preview URL on the PR |
| Merge to `main` | Vercel deploys to production at the live URL above, running `prisma migrate deploy` first |

Environment variables live in Vercel (Project → Settings → Environment
Variables), never in the repo. The Neon integration provides `DATABASE_URL`
(pooled, used by the app) and `DATABASE_URL_UNPOOLED` (direct, used by
migrations); Production and Preview should each have their own values there.
Locally, they go in `.env` (see `.env.example`).

## Mockup

An interactive desktop and mobile mockup of Loadline is in
[`docs/mockups/loadline-mockup.html`](docs/mockups/loadline-mockup.html). Open it in a browser.

## Documentation

- [Architecture](docs/architecture.md): system diagram and delivery pipeline
- [Database schema](docs/database.md): tables, relations, and constraints
- [Product requirements](docs/PRD.md)
