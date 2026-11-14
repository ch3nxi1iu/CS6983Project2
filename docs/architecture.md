# Architecture

Loadline is one Next.js app on Vercel, backed by a Neon Postgres database.
Dashed boxes are planned but not built yet.

## System

```mermaid
flowchart LR
  browser(["Student's browser"])

  subgraph vercel["Vercel: Next.js 16 app"]
    proxy["proxy.ts<br/>checks the session cookie"]
    pages["Pages<br/>Server Components by default<br/>/login · /register · /dashboard · /settings · /plan"]
    api["API routes<br/>/api/auth/* · /api/plan · /api/assignments"]
    lib["src/lib<br/>auth · planner (pure functions)<br/>availability · forecast · demo"]
    db["Prisma client<br/>src/lib/db.ts"]
  end

  neon[("Neon Postgres")]
  canvas["Canvas API<br/>planned: #8, #9"]
  realtime["Real-time channel<br/>planned: #17"]

  browser -->|HTTPS| proxy
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
  from `/dashboard` and `/settings` to `/login`, and `/api` routes (except
  `/api/auth/*`) return 401. The session is a JWT in an httpOnly cookie.
- **Logic:** scheduling, forecast, and availability math live in
  `src/lib/planner/` as pure functions, so they're tested without a database.
- **Database:** every query goes through the one Prisma client in
  `src/lib/db.ts`. See [database.md](database.md) for the tables.
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
