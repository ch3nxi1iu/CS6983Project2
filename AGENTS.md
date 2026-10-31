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

<!-- Why: P2 grades TDD visible in git history and 80%+ coverage.
     v3: in the HW3 test, every test passed but marked dates were never saved,
     because the component test swapped our own save code for a mock. -->

- **TDD, red-green-refactor.** For every feature: write a failing test, commit
  it (`test: ...`), then write the code to make it pass (`feat: ...`), then
  refactor. The failing-test commit must come **before** the implementation
  commit in history.
- **Each acceptance criterion in the GitHub issue gets at least one test that
  runs the real path a user takes**: the component's own save action, the
  route handler, and the database. A criterion isn't covered if the test
  replaces our own code on that path with a mock.
- **Don't add props or options only so a test can swap out behavior** (for
  example an `onSave` prop the page never passes). Mock `fetch` or the
  external service instead, so the real code runs.
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
- **Done check.** Before saying a task is done:
  1. Run and pass `npm test`, `npm run lint`, `npm run typecheck`, and
     `npm run build` (the build catches `cacheComponents` mistakes the dev
     server doesn't).
  2. Start the app (`npm run dev`) and try every acceptance criterion in the
     browser. For anything that saves, reload the page and check the change is
     still there.
  3. In your final message, list each acceptance criterion with how you checked
     it, and say plainly which ones you couldn't check.

---

## 2. PRD and design references

<!-- Why: tell the AI what to build and which document wins when sources disagree. -->

### Where the requirements live

| Source | What it holds |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, target users, the six proposal stories, user stories US-01 to US-15, sprint timeline (added in #3) |
| GitHub issues #7–#21 | One issue per user story, each with its acceptance criteria |
| [`docs/mockups/loadline-mockup.html`](docs/mockups/loadline-mockup.html) | Interactive desktop and mobile mockup (added in #3); open it in a browser |
| `docs/mockups/*.png` | Screenshots of the dashboard, availability settings, and plan view |

Order of authority: **issue acceptance criteria → PRD → mockup.** If the PRD
isn't in `docs/` yet, use the issue. Where the issue and PRD are silent, the
mockup's behavior is the intended design. If they still don't answer the
question, ask.

### User stories at a glance

| Proposal story | User stories (issue) | Sprint |
|---|---|---|
| 1. Canvas deadlines in one place | US-01 login (#7), US-02 connect Canvas (#8), US-03 sync (#9), US-04 demo mode (#10), US-14 custom tasks (#20) | 1, 2 |
| 2. Crunch-week forecast | US-05 forecast (#11), US-06 availability (#12) | 1 |
| 3. Work plan that adapts | US-07 generate plan (#13), US-08 done / missed and re-plan (#14), US-13 learn my pace (#19) | 1, 2 |
| 4. Today's top three | US-09 top 3 (#15), US-15 AI step suggestions, stretch (#21) | 2 |
| 5. Live group progress | US-10 groups and invites (#16), US-11 live board (#17) | 2 |
| 6. Developer API | US-12 public API with OpenAPI docs (#18) | 2 |

The mockup labels its badges "Story 1" to "Story 6" by **proposal story**
(its "Story 6" is the developer API), and "US-06" by user story. Its wording
of US-06 differs from the issue; the issue's wording is the one to test.

### Using the mockup (docs/mockups/loadline-mockup.html)

The mockup shows the intended layout and behavior. It is not production code.
Follow its screens and flows, but don't copy its implementation.

#### Data and persistence
- The mockup keeps its edits in the browser's local storage. That is only there
  so the standalone HTML file works on its own.
- Do not use local storage, session storage, or any other browser-only storage
  for real data. All real data (availability hours, unavailable dates, tasks,
  plans) is saved in the Postgres database through the backend.
- Everything in the mockup's sample data is illustrative: course names,
  teammates, assignments, dates, hours of work, and the seven-week window
  (Nov 2 to Dec 20, 2026). Don't hard-code any of it.

#### Availability (US-06): details that exist only in the mockup
These are intended behavior, not sample data. Implement them:
- Each day's study hours are limited to 0–12 hours.
- Hours change in 0.5-hour steps.
- Default hours: 3h Monday to Thursday, 2h Friday, 4h Saturday and Sunday
  (22h a week).
- A date marked unavailable has no study hours that day. A week's available
  hours are the sum of its daily hours minus any unavailable days.
- Any change to hours or unavailable dates recalculates the plan and forecast.
- Not planned: calendar sync. Study hours come only from what the user sets.
  Don't add calendar integration or imply it in the UI.

### Screens

Desktop has a left sidebar (Today, Forecast, Work plan, Deadlines, Group
projects, Developer API, Settings, plus the user's Canvas courses and sync
status). Mobile has a bottom tab bar (Today, Forecast, Plan, Team, Settings).
Every screen must work at both sizes.

| Screen | Key components and behavior | Story |
|---|---|---|
| Today (dashboard) | Top three cards with rank, title, course, time and a one-line reason; links to the full plan | US-09 |
| | Week stats: work planned, study hours, difference, crunch weeks ahead | US-05 |
| Forecast | Stacked bars of hours per week by course, a dashed line for study hours, crunch weeks marked in red with a label (not color alone); clicking a week lists its assignments | US-05, US-06 |
| Deadlines | One list from Canvas sorted by due date, course color swatch, hours estimate, plan status, "new" tag on newly synced items, done items struck through | US-03 |
| Work plan | Seven-day grid of sessions with time, task and course; done, missed (dashed) and scheduled states; "due" and "moved" tags; a banner after a missed session with Undo and Pick other times | US-07, US-08 |
| Group project | Members with role, progress bar and percent, a live indicator, and an activity feed that highlights blockers | US-10, US-11 |
| Developer API | Token shown masked with Copy and New token, endpoint list, example request and response, links to the API reference and OpenAPI spec | US-12 |
| Settings → Availability | Per-day steppers, unavailable dates with optional reason, live effect on the week and forecast | US-06 |

### Main user flows
1. **First visit:** landing page → sign up (or "Try the demo") → connect Canvas
   → first sync → set availability (prefilled defaults) → plan and forecast
   appear on Today.
2. **Daily use:** open Today → work through the top three → mark sessions done
   or missed → the plan re-plans and Today updates.
3. **Plan ahead:** Forecast → spot a crunch week → open it to see the
   assignments → change availability or estimates → forecast redraws.
4. **Group work:** create a group → share the invite link → teammates join →
   add shared tasks → everyone sees status changes live.

### Where the mockup and the issues differ (follow the issue)
- **Top three ranking:** the mockup says "deadline, hours left and what it
  unblocks"; #15 ranks by grade weight, points and days until due.
- **Forecast window:** the mockup shows 7 weeks; #11 defaults to 4, configurable.
- **Sync:** the mockup says "every 30 minutes"; #9 syncs on login and from
  "Sync now".
- **API paths:** the mockup shows `/v1/...` on `api.loadline.app`; real routes
  follow the architecture above (`/api/<resource>`). The mockup's token is the
  revocable personal API key from #18.
- **"Move 8h earlier" button** on the forecast advice isn't in any issue.
  Don't build it unless an issue asks for it.

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
5. Finish with the done check (see Testing strategy) before opening a PR.

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

<!-- Why: list the mistakes we want the AI to avoid before it makes them. -->

### Patterns to follow
- **Do** keep planner, forecast and ranking code pure and pass in "now",
  availability and assignments as arguments (see Architecture).
- **Do** validate every request body and Canvas response at the boundary:
  parse `unknown` into a typed value, and return a `VALIDATION_ERROR` on bad
  input.
- **Do** check ownership on every query: filter by the signed-in user's id, so
  one user can never read or change another user's rows.
- **Do** handle the empty, loading and error states of every screen (no Canvas
  connected, no assignments, sync failed, nothing left today).
- **Do** recalculate the plan and forecast on the server after anything they
  depend on changes (sync, availability, estimates, session done or missed).
- **Do** use Tailwind utility classes. Define colors once as theme tokens in
  `globals.css` (`@theme`), with dark-mode values, and use those tokens instead
  of raw hex values, so light and dark mode stay consistent.

### Patterns to avoid
- **Don't** put business logic in React components or route handlers.
- **Don't** fetch from the client what a Server Component can load on the server.
- **Don't** call the real Canvas API in tests, demo mode or seed scripts.
- **Don't** store real data in `localStorage`, `sessionStorage` or cookies
  (other than the auth cookie).
- **Don't** hard-code the mockup's sample data, dates or week window.
- **Don't** add features, settings or buttons that no issue asks for.
- **Don't** disable lint rules, use `@ts-ignore`, or skip or delete failing
  tests to make a check pass. Fix the cause or ask.

### Dependencies
- Use what's already installed: Next.js, React, Tailwind, Prisma with the `pg`
  adapter, Vitest and Testing Library. Playwright comes with #6.
- **Ask before adding any new dependency**, and say why it's needed. When a
  partner approves one, add it to the stack table above.
- No UI component kits, CSS-in-JS, global state libraries, or alternative ORMs.
- Use the platform first: `fetch`, `Intl` for date and time display, the
  Web Crypto or Node `crypto` module for tokens and encryption.
- Never write your own password hashing or crypto; use a well-known library
  approved by a partner.

### Security
- **Passwords** are hashed with a slow, salted algorithm; never stored or
  logged in plain text (#7).
- **JWT** lives in an httpOnly, `Secure`, `SameSite=Lax` cookie. Never put it in
  local storage or return it in a response body (#7).
- **Canvas tokens and calendar feed URLs** are encrypted at rest, never
  returned by any API, never logged, and deleted on disconnect (#8).
- **Authorization is enforced in the API**, not just hidden in the UI. Group
  members never see each other's private Canvas data, and nothing is shared to
  a group unless the member chooses to share it (#16, #17).
- **API keys** are shown once, stored hashed, revocable, and rate-limited (#18).
- **Secrets** come from environment variables and are listed in `.env.example`
  without real values. Never commit `.env`.
- **AI step suggestions** send an assignment description to an AI provider only
  when the user clicks, say so in the UI, and never generate solution content
  (#21).
- Errors shown to users never reveal stack traces, tokens, or which login
  field was wrong.

### Accessibility
- Target **WCAG 2.2 AA**.
- Use semantic HTML: real `<button>`, `<a>`, `<label>` and headings in order.
  Every input has a visible label or an `aria-label`.
- Everything works with the keyboard alone, with a visible focus outline.
- **Never use color alone** to show meaning. Crunch weeks, at-risk work, missed
  and moved sessions also get a text label, tag or pattern (as the mockup does).
- Text and controls meet AA contrast in both light and dark mode.
- Charts have a text alternative (an `aria-label` summary or a table of the
  same numbers).
- Changes that happen without a page load (re-plan results, live group
  updates, sync status) are announced with `aria-live` or `role="status"`.
- Respect `prefers-reduced-motion` for animations such as the live indicator.
- Layouts work from 360px wide up, with touch targets at least 24×24px.
- Component tests query by role and label (see Testing strategy), which also
  checks that elements are accessible.

---

## Changelog

<!-- Record each revision and why it was made (HW3 part 4: refine and document). -->

| Version | Date | Change | Why |
|---|---|---|---|
| v1 (part A) | 2026-10-29 | Project context, architecture, naming, testing strategy, Scrum workflow | Initial rules for Sprint 1 |
| v2 (part B) | 2026-10-31 | PRD and design references, mockup rules, screens and flows, do's and don'ts, security, accessibility | Give the AI the product spec and the rules for using the mockup |
| v3 (part A) | 2026-10-30 | Acceptance-criterion tests must run the real user path; no test-only props; done check adds `npm run build`, trying each criterion in the browser with a reload, and reporting how each was checked | HW3 with-rules run: all 36 tests passed, but marked dates were never saved because the component test mocked our own `onSave` |
