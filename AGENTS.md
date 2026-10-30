# AGENTS.md

<!--
  Shared rules file for AI coding agents working in this repo (Antigravity is
  our primary harness). Both partners maintain it through reviewed PRs.
  Part A (project context, Scrum & workflow): @ch3nxi1iu
  Part B (PRD & design references, do's & don'ts): @brandy-wang
  Update this file whenever the AI repeats a mistake; log the change at the bottom.
-->

Rules for AI agents working on **CS6983 Project 2**, a Next.js app that connects
to Canvas and turns course deadlines into a weekly workload forecast and a work
plan. Read this whole file before writing code. If a rule here conflicts with a
request, point out the conflict instead of silently breaking the rule.

---

## 1. Project context

<!-- Why: pin exact versions so the AI doesn't write code for older APIs. -->

### Tech stack and versions

| Area | Choice | Version |
|---|---|---|
| Runtime | Node.js | 22 or newer (we use 24) |
| Framework | Next.js, App Router, Turbopack | 16.4.3 |
| UI | React | 19.3.0 |
| Language | TypeScript, `strict: true` | 5.9 |
| Styling | Tailwind CSS (CSS-first config in `globals.css`, no `tailwind.config.js`) | 4.3 |
| Database | PostgreSQL via Prisma ORM, `pg` driver adapter; local dev DB with `npx prisma dev` | Prisma 7.10.1 |
| Unit / component tests | Vitest + React Testing Library, jsdom | Vitest 5.0, RTL 16.3 |
| E2E tests | Playwright | planned (#6) |
| Lint | ESLint 9 with `eslint-config-next` | 9.39 |
| Auth | JWT in an httpOnly cookie | planned (#7) |

Next.js 16 differs from older versions you may have learned. **Before using a
Next.js API you're unsure of, read the matching guide in
`node_modules/next/dist/docs/`** (it ships with the installed version).

`cacheComponents` is enabled in `next.config.ts`. Our data is per-user and must
be fresh on every request, so:
- Wrap any component that reads the database, cookies, or headers in
  `<Suspense>` with a fallback.
- Do **not** add `"use cache"` to anything that returns user-specific data.

### Architecture

<!-- Why: tell the AI where new code goes so files don't end up scattered. -->

```
src/
  app/                 Routes only: page.tsx, layout.tsx, loading.tsx
    api/<resource>/    REST route handlers (route.ts), thin: validate → call lib → respond
  components/          Shared React components
  lib/                 App logic, no React
    db.ts              The only Prisma client; import { prisma } from "@/lib/db"
    canvas/            The only code that calls the Canvas API
    planner/           Pure scheduling logic (work plan, forecast, ranking)
  generated/prisma/    Generated Prisma client (gitignored, never edit)
prisma/
  schema.prisma        Data model; change it with `npx prisma migrate dev`
docs/                  PRD, mockups, diagrams, sprint retrospectives
e2e/                   Playwright tests (planned)
```

Key patterns:
- **Server Components by default.** Add `"use client"` only to components that
  need state, effects, or event handlers, and keep them as small as possible.
- **Logic lives in `src/lib`, not in components or route handlers.** Planner,
  forecast, and ranking code are pure functions (input → output, no database,
  no `Date.now()` inside; pass the current date in) so they're easy to test.
- **One database client.** Always import `prisma` from `@/lib/db`; never call
  `new PrismaClient()` anywhere else.
- **One Canvas client.** All Canvas requests go through `src/lib/canvas/`.
  Tests and demo mode use fixture data and never call the real Canvas API.
- **Environment variables** are read from `process.env` and every new one is
  added to `.env.example` with a comment. Never hard-code secrets.
- Import with the `@/` alias (`@/lib/db`), not long relative paths.

### Naming conventions and coding standards

| Thing | Convention | Example |
|---|---|---|
| React component files | PascalCase | `WeekForecast.tsx` |
| Other TypeScript files | kebab-case | `work-plan.ts` |
| Test files | next to the code, `.test.ts(x)` | `work-plan.test.ts` |
| Variables, functions | camelCase | `availableHours` |
| Types, interfaces | PascalCase, no `I` prefix | `WorkSession` |
| Constants | UPPER_SNAKE_CASE | `MAX_SESSION_HOURS` |
| Prisma models / fields | PascalCase singular / camelCase | `Assignment.dueAt` |
| API routes | plural nouns, kebab-case | `/api/assignments`, `/api/work-sessions` |

- No `any`. Use `unknown` and narrow it, especially for Canvas responses and
  request bodies.
- Store times in UTC (`DateTime` in Prisma); convert to the user's time zone
  only for display. Store durations as hours (number).
- API errors use one shape with a matching HTTP status (400, 401, 403, 404, 409, 500):
  `{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable reason" } }`
- Keep functions small and named for what they return (`getWeeklyWorkload`,
  not `processData`).

### Testing strategy

<!-- Why: P2 grades TDD visible in git history and 80%+ coverage. -->

- **TDD, red-green-refactor.** For every feature: write a failing test, commit
  it (`test: ...`), then write the code to make it pass (`feat: ...`), then
  refactor. The failing-test commit must come **before** the implementation
  commit in history.
- **Each acceptance criterion in the GitHub issue gets at least one test.**
- **Unit tests** (Vitest): every function in `src/lib/planner/` and
  `src/lib/canvas/`, including edge cases (no assignments, past due dates,
  zero available hours, assignments that can't fit).
- **Component tests** (Vitest + Testing Library): query by role or label text
  the way a user would (`getByRole("button", { name: "Save" })`), not by CSS
  class or test IDs.
- **Integration tests**: route handlers with a test database; Canvas is
  mocked with fixtures.
- **E2E tests** (Playwright, planned): main user flows against demo mode.
- **Coverage goal: 80%+** of `src/lib` and `src/app/api`.
- Before saying a task is done, run and pass: `npm test`, `npm run lint`,
  `npm run typecheck`.

---

## 2. PRD and design references

<!-- Part B (@brandy-wang): link docs/PRD.md, describe the mockups, key UI
     components and their behavior, user flows the AI should follow. -->

_To be written in part B._

---

## 3. Scrum and workflow

<!-- Why: keep every AI change tied to one issue and one reviewed PR. -->

Work is tracked on the GitHub board
([CS6983 Project 2](https://github.com/users/ch3nxi1iu/projects/1)), with
Sprint 1 and Sprint 2 milestones.

### When asked to implement an issue
1. Read the issue first (`gh issue view <number>`, or ask for it to be pasted), especially its acceptance criteria.
2. Work only on that issue. Don't refactor or reformat unrelated files.
3. Write failing tests for the acceptance criteria, then implement (see Testing strategy).
4. If an acceptance criterion is unclear or impossible, stop and ask instead of guessing.

### Branch naming
`<type>/<issue-number>-<short-description>`, lowercase, words joined by hyphens.
Types: `feature`, `fix`, `chore`, `docs`.

Examples: `feature/12-weekly-availability`, `fix/31-forecast-timezone`, `docs/2-agents-md`

### Commit messages
[Conventional Commits](https://www.conventionalcommits.org/) with the issue number:

```
<type>: <imperative summary, max 72 chars> (#<issue>)
```

Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `ci`.

Examples:
- `test: add failing tests for weekly availability (#12)`
- `feat: save weekly availability per day (#12)`

### Pull requests
- One PR per issue, opened from its branch into `main`. Never push to `main` directly.
- PR title: the issue title. PR body includes:
  - `Closes #<issue>`, which closes the issue and moves its card to Done on merge
  - what changed and how to test it
  - screenshots for UI changes
  - **AI usage**: which tool was used and what it generated
- CI must pass (once #4 is set up).
- **The other partner reviews and approves before merge.** Nobody merges their own PR.
- Merge with **"Create a merge commit"**, not squash, so the test-first commits
  stay visible in history. Delete the branch after merging.

### Board columns
Move the issue's card as work progresses:
`Sprint Todo` → `In Progress` (branch created) → `In Review` (PR opened) → `Done` (merged).

### Referencing issues
- In branch names and commit summaries, as shown above.
- In PR bodies with `Closes #<issue>`.
- In code, only for known follow-ups: `// TODO(#14): handle missed sessions`.

---

## 4. Do's and don'ts

<!-- Part B (@brandy-wang): patterns to follow and avoid, preferred
     dependencies and libraries, security and accessibility requirements. -->

_To be written in part B._

---

## Changelog

<!-- Record each revision and why it was made (HW3 part 4: refine and document). -->

| Version | Date | Change | Why |
|---|---|---|---|
| v1 (part A) | 2026-10-29 | Project context, architecture, naming, testing strategy, Scrum workflow | Initial rules for Sprint 1 |
