# CS6983 Project 2

Full-stack app for CS 6983 (AI Coding), Fall 2026.

Stack: Next.js (App Router, TypeScript) · Tailwind CSS · PostgreSQL with Prisma · Vitest + Testing Library.

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

## Mockup

An interactive desktop and mobile mockup of Loadline is in
[`docs/mockups/loadline-mockup.html`](docs/mockups/loadline-mockup.html). Open it in a browser.
