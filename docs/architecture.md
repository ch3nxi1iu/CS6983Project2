# Architecture

Loadline is one Next.js app on Vercel, backed by a Neon Postgres database.
Dashed boxes are planned but not built yet.

## System

```mermaid
flowchart LR
  browser(["Student's browser"])
  client(["API client<br/>script or app with a personal API key"])

  subgraph vercel["Vercel: Next.js 16 app"]
    proxy["proxy.ts<br/>checks the session cookie"]
    pages["Pages<br/>Server Components by default<br/>/ (landing) · /login · /register · /dashboard · /settings · /plan<br/>/docs/api (Swagger UI)"]
    api["API routes<br/>app: /api/auth/* (incl. /api/auth/demo) · /api/demo/reset<br/>/api/plan · /api/assignments<br/>/api/availability · /api/unavailable-dates · /api/api-keys<br/>public: /api/tasks · /api/plan/today · /api/workload<br/>/api/work-sessions/{id}/complete · /openapi.json"]
    lib["src/lib<br/>auth · planner (pure functions)<br/>availability · work plan · forecast<br/>api keys · rate limit · demo"]
    db["Prisma client<br/>src/lib/db.ts"]
  end

  neon[("Neon Postgres")]
  canvas["Canvas API<br/>planned: #8, #9"]
  realtime["Real-time channel<br/>planned: #17"]

  browser -->|HTTPS, session cookie| proxy
  client -->|HTTPS, Bearer key| proxy
  proxy --> pages
  proxy --> api
  pages --> lib
  api --> lib
  lib --> db
  db --> neon
  lib -.-> canvas
  browser -.->|WebSocket| realtime
  realtime -.-> api

  classDef planned stroke-dasharray: 5 5
  class canvas,realtime planned
```

- **Frontend:** React Server Components render on the server. Only interactive
  parts (forms, steppers, buttons) are Client Components.
- **API:** route handlers in `src/app/api/` validate input, call `src/lib`, and
  return JSON. Errors use one shape: `{ "error": { "code", "message" } }`.
- **Auth:** `proxy.ts` runs before every request. Signed-out users are sent
  from `/dashboard`, `/settings` and `/plan` to `/login`, and `/api` routes
  (except `/api/auth/*`) return 401. The session is a JWT in an httpOnly cookie.
- **Public API:** a request with `Authorization: Bearer <key>` passes the proxy,
  and the route checks the personal API key itself (`src/lib/api/authenticate.ts`).
  Keys are created and revoked on `/settings/api`. Every caller is limited to 60
  requests a minute (429 with `Retry-After`); the limit is kept in memory, so it
  applies per server instance. The OpenAPI 3.1 spec is served at `/openapi.json`
  and shown at `/docs/api`.
- **Logic:** scheduling, forecast, and availability math live in
  `src/lib/planner/` as pure functions, so they're tested without a database.
- **Database:** every query goes through the one Prisma client in
  `src/lib/db.ts`. See [database.md](database.md) for the tables.
- **Demo mode:** "Try the demo" calls `POST /api/auth/demo`, which creates a
  fresh demo account (`isDemo`) with sample data, builds its plan, and signs
  the visitor in. `POST /api/demo/reset` restores the sample data and answers
  403 for accounts that aren't demo accounts.
- **Canvas (planned):** all Canvas calls will go through `src/lib/canvas/`.
  Until then, demo mode supplies sample courses and assignments.
- **Real-time (planned):** live group progress would add a WebSocket channel.

## Delivery pipeline

```mermaid
flowchart LR
  pr["Pull request"] --> ci["GitHub Actions CI<br/>lint and typecheck → tests → build<br/>npm audit · CodeQL"]
  pr --> preview["Vercel preview<br/>build only"]
  ci --> review["Partner review"]
  preview --> review
  review --> merge["Merge to main"]
  merge --> prod["Vercel production<br/>prisma migrate deploy → build"]
```

`main` is protected: a PR can't merge until the five CI checks pass.
