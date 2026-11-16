# AI usage log

The course asks us to document all AI usage and to only commit code we can
explain. This log records which AI tool did what, PR by PR, and what we did
ourselves. Every PR also has its own "AI usage" note. Add a row here when you
open a PR.

## Tools

| Tool | Kind | Used by | Used for |
|---|---|---|---|
| Antigravity | AI IDE (P2's primary harness) | Chenxi | HW3 before/after runs of US-06; US-01 login (#39); start of US-07 work plan (#13). Free plan; quota ran out on 2026-11-13 |
| GitHub Copilot (Free), VS Code | AI IDE | Chenxi | Set up on 2026-11-13 as the IDE fallback after the Antigravity quota ran out (rules check so far) |
| Claude Code | Terminal / desktop agent | Chenxi | Rules file drafts, PRD copy, schema, CI, deploy pipeline, diagrams, PR descriptions, merge-conflict fixes; a Haiku subagent finished the US-07 implementation (#13) after the Antigravity quota ran out |
| Claude Code | Cloud agent | Brandy | AGENTS.md part B; US-04 demo mode, US-05 forecast, US-06 availability |
| Claude (web, Artifacts) | Chat + artifacts | Brandy | The Loadline mockup |

All tools read the same rules file, [`AGENTS.md`](../AGENTS.md), so they follow
the same architecture, naming, TDD, and PR rules. Before using a tool on this
repo for the first time, we ask it to summarize the project rules to check it
has loaded `AGENTS.md`.

## By pull request

| PR | Issue | Author | AI tool | What the AI did | What we did |
|---|---|---|---|---|---|
| #25 | #2 | Chenxi | Claude Code | Drafted `AGENTS.md` part A | Reviewed the draft; Brandy approved |
| #26 | #3 | Brandy | Claude (Artifacts, Claude Code) | Built the mockup and committed it | Prompted and iterated on the design; Chenxi approved |
| #27 | #2 | Brandy | Claude Code | Drafted `AGENTS.md` part B | Brandy wrote "Using the mockup"; Chenxi approved |
| #28 | #3 | Chenxi | Claude Code | Copied the PRD into the repo; moved the mockup; rendered screenshots | Brainstormed the idea and edited the PRD together |
| #29 | #2 | Chenxi | Claude Code | Drafted rules v3 from the HW3 test results | Ran the test; approved the changes; Brandy approved |
| #31 | #30 | Chenxi | Claude Code | Drafted the schema and migration | Reviewed; Brandy approved |
| #32 | #2 | Chenxi | Claude Code | Drafted the issue-title rule; renamed issues | Chose the naming; Brandy approved |
| #33 | #12 | Brandy | Claude Code | Wrote failing tests, then the implementation | Chose to wait for login before adding routes; Chenxi approved |
| #34 | #11 | Brandy | Claude Code | Wrote failing tests, then the implementation | Chose to run test files one at a time; Chenxi approved |
| #35 | #10 | Brandy | Claude Code | Wrote failing tests, then the implementation | Left login-dependent parts for later; merged without a recorded review |
| #36 | #4 | Chenxi | Claude Code | Wrote the CI and CodeQL workflows; fixed the first CI failure | Turned on branch protection; merged by Brandy without a recorded review |
| #37 | #10, #11 | Brandy | Claude Code | Recovered the stranded #34/#35 merges into one PR | Chenxi approved and merged |
| #38 | #5 | Chenxi | Claude Code | Wrote the deploy script and docs | Set up Vercel and Neon; merged by Chenxi without review (exception noted on the PR) |
| #39 | #7 | Chenxi | Antigravity, Claude Code | Antigravity: tests, login, security fixes. Claude Code: reviewed the code, found two security issues, fixed a merge conflict | Wrote the prompts; set `AUTH_SECRET` in Vercel; review by Brandy pending |
| #40 | #23 | Chenxi | Claude Code | Drew the diagrams from the schema and code | Checked they render on GitHub; merged by Brandy without a recorded review |
| #41 | #13 | Chenxi | Antigravity, Claude Code (Haiku subagent) | Antigravity: failing tests and the `kind` migration. Haiku: the planner and data functions, then (after login merged) failing tests for and the `/api/plan`, `/api/assignments/[id]` routes and `/plan` page, and two strengthened tests | Chose to switch tools when the quota ran out; Claude Code reviewed the code, reran all checks, and tried the plan in a browser with sample data |
| #42 | #12 | Chenxi | Claude Code (Haiku subagent) | Failing tests, then `PUT`/`GET /api/availability`, `POST`/`DELETE /api/unavailable-dates` and the `/settings/availability` page wrapping Brandy's existing component | Asked for it when the settings screen turned out to be missing; Claude Code reviewed it, reran all checks, and tried saving hours and dates in a browser |
| #43 | #18 | Chenxi | Claude Code (Haiku subagent) | Two test-first rounds: API keys (hashed, revocable), cookie-or-Bearer auth, rate limiting, four public endpoints; then the OpenAPI spec, the Swagger UI docs page, and the API keys page. Wrote the `ApiKey` migration with `prisma migrate diff` when `migrate dev` failed locally | Chose the pinned-CDN Swagger UI to avoid a new dependency; Claude Code reviewed the migration and auth code, reran all checks, and tried docs and key create/revoke in a browser; after CodeQL flagged plain SHA-256 key hashing, Claude Code (Opus) switched it to HMAC-SHA256 keyed with the server secret, test first |
| #49 | #46 | Chenxi | Claude Code | Wrote failing tests, then the secret check before sign-up and 500 handling in register and login | Found the bug on production and set `AUTH_SECRET` in Vercel; reviewed before pushing |
| #50 | #45 | Chenxi | Claude Code | Wrote failing tests through the real routes, then the re-plan after each availability change | Reviewed before pushing |
| #51 | #22 | Chenxi | Claude Code | Wrote the README and the diagram updates; followed the setup steps on a fresh clone | Reviewed; screenshots added after the dashboard merges |
| #52 | #24 | Chenxi | Claude Code | Drafted this log from the PRs, commits, and our notes | Checked each row |
| #54 | #53 | Chenxi | Claude Code | Wrote failing tests, then replaced "Crunch week" with plain wording and a definition; added the plain-words rule to `AGENTS.md` | Asked for wording international students understand; chose "Overloaded week" |
| #55 | #24 | Chenxi | Claude Code | Drafted the sprint docs and contribution log from commits, PRs, reviews and our notes; folded in Brandy's own draft and corrected two details in it | Partner feedback and missing standup details written by each partner |
| #58 | #57 | Chenxi | Claude Code (subagent), Claude Code | Subagent: found the extra connection pools while setting up E2E. Claude Code: confirmed it by running E2E with and without the change, then wrote the failing test and the one-line fix | Reviewed before pushing |
| #59 | #47 | Chenxi | Claude Code (subagent), Claude Code | Subagent: coverage config, script, CI summary, README numbers. Claude Code: reviewed, rebased, reran coverage, updated the numbers | Approved the dependency with Brandy; reviewed before pushing |
| #60 | #6 | Chenxi | Claude Code (subagent), Claude Code | Subagent: Playwright config, smoke and first-visit tests, CI job. Claude Code: reviewed, rebased, added the demo-mode test | Approved the dependency (Brandy's OK pending); reviewed before pushing |
| #61 | #22 | Chenxi | Claude Code | Added screenshots, demo mode and the dashboard to the README, and the demo routes to the architecture diagram | Reviewed before pushing |
| #63 | #62 | Chenxi | Claude Code | Wrote failing tests pinned to an evening in Pacific time, then counted "today" in one app time zone; a second-model review shaped the design (one zone, convert only real instants) | Spotted that the app showed tomorrow in the evening; reviewed before pushing |
| #64 | #14 | Chenxi | Claude Code | Wrote failing tests, then the Mark done button on the plan and dashboard and rebuilds that subtract done hours; added an E2E test | Pointed out that marking work done needed the API; reviewed before pushing |
| #65 | #20 | Chenxi | Claude Code | Wrote failing tests, then POST /api/assignments and the Add an assignment form on /plan, with an E2E test | Found that a user couldn't add anything in the demo; reviewed before pushing |

## Prompts

The main prompts we gave the IDE agents, kept so we can see what worked.

<details>
<summary>US-01 login (#7), Antigravity</summary>

```text
Implement issue #7, "US-01: Add sign-up and login with JWT". Read the issue
(gh issue view 7) and AGENTS.md first, and follow them, including test-first
commits and the done check.

Context:
- Next.js 16 replaces middleware with proxy.ts. Before writing it, read
  node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md and
  node_modules/next/dist/docs/01-app/02-guides/authentication.md.
- The User model already exists (email, passwordHash, isDemo). Don't change
  prisma/schema.prisma.
- Both partners approved two new dependencies: bcryptjs (password hashing)
  and jose (JWT signing and verifying). Add them to the stack table in
  AGENTS.md. Don't add anything else.

What to build:
- src/lib/auth/: hashPassword / verifyPassword (bcryptjs), and session
  helpers: createSession(userId), getSession(), requireUser(), and
  clearSession(). createSession must be reusable: demo mode (#10) will call it
  to sign in a demo user.
- JWT signed with AUTH_SECRET (HS256, 7-day expiry), stored in an httpOnly,
  Secure (in production), SameSite=Lax cookie. Never in local storage or a
  response body. Add AUTH_SECRET to .env.example with a comment.
- API routes: POST /api/auth/register, POST /api/auth/login,
  POST /api/auth/logout. Validate input; use the error shape from AGENTS.md.
  Wrong email or password always returns the same message:
  "Email or password is incorrect."
- Pages: /login and /register, styled with the mockup's design tokens from
  AGENTS.md, with labeled inputs and errors announced to screen readers.
- src/proxy.ts: redirect signed-out users from /dashboard and /settings to
  /login. Any /api route except /api/auth/* returns 401 without a valid
  session.

Work on branch feature/7-sign-up-login. Commit failing tests first
(test: ... (#7)), then the implementation (feat: ... (#7)). Tests must cover
every acceptance criterion through the real code path; mock only fetch or
external services. When done, open a PR titled
"US-01: Add sign-up and login with JWT" with "Closes #7", how to test, and an
AI usage note saying Antigravity wrote it.
```

</details>

<details>
<summary>US-01 security fixes after review (#39), Antigravity</summary>

```text
Fix three security issues in PR #39 before review, test-first
(test: ... (#7), then fix: ... (#7)):

1. src/lib/auth/jwt.ts: remove DEFAULT_SECRET. If AUTH_SECRET is missing,
   throw an error, except when NODE_ENV is "test" (tests may use a fixed
   test secret). Add a test that signing fails without AUTH_SECRET outside
   tests.
2. src/app/api/auth/register/route.ts: CodeQL flags the email regex as
   polynomial ReDoS (js/polynomial-redos). Reject emails over 254
   characters first, and use a pattern without overlapping parts, e.g.
   /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/. Add tests for a valid email, an
   invalid one, and a very long malicious-looking one.
3. src/app/api/auth/login/route.ts: when the email doesn't exist, still run
   verifyPassword against a fixed dummy bcrypt hash, so both failure cases
   take about the same time.

Run the done check again, push to the same branch, and confirm the CodeQL
check on the PR passes.
```

</details>

<details>
<summary>US-07 work plan (#13), Antigravity</summary>

```text
Implement issue #13, "US-07: Generate a work plan from deadlines". Read the
issue (gh issue view 13) and AGENTS.md first, and follow them: test-first
commits, real-path tests, and the done check.

Context:
- Assignments, availability, and WorkSession tables already exist
  (prisma/schema.prisma). Reuse the existing helpers: getPlanningAvailability()
  in src/lib/availability.ts (returns null if the user hasn't set study hours),
  and the date and availability helpers in src/lib/planner/availability.ts and
  src/lib/planner/forecast.ts. Don't duplicate them.
- Acceptance criterion 1 needs an assignment type. You may add ONE migration
  with `npx prisma migrate dev`: an `AssignmentKind` enum (HOMEWORK, PROJECT,
  EXAM, READING, OTHER) and a `kind` field on Assignment, default OTHER.
  Update the demo seed data (src/lib/demo/seed-data.ts) to set kinds. No other
  schema changes.

What to build:
1. src/lib/planner/work-plan.ts: a pure function
   generateWorkPlan({ assignments, availability, now, options }) that returns
   { sessions: [{ assignmentId, date, hours }], atRisk: [{ assignmentId, hoursShort }] }.
   - Only unsubmitted assignments due after `now`.
   - Hours come from each assignment's estimatedHours. Defaults by kind
     (HOMEWORK 4, PROJECT 10, EXAM 6, READING 2, OTHER 3) live in options and
     are used when an assignment is created.
   - Options with defaults: maxSessionHours 2, bufferDays 1.
   - Earliest deadline first. Schedule each assignment backwards from
     (due date minus bufferDays) toward today, never past a day's remaining
     available hours (weekly hours minus unavailable dates).
   - Whatever doesn't fit is reported in atRisk with the hours short.
   No database access and no Date.now() inside: `now` is passed in.
2. src/lib/work-plan.ts: regeneratePlanForUser(userId, now) replaces the
   user's SCHEDULED work sessions with a fresh plan in one transaction, keeping
   DONE and MISSED ones, and returns sessions plus at-risk items. If
   availability isn't set, return a clear "set your study hours first" result.
   Also add updateEstimatedHours(userId, assignmentId, hours), which checks the
   assignment belongs to the user (criterion 1: editable per assignment).
3. Stop here if PR #39 (login) isn't merged into main yet, and tell me. If it
   is merged, run `git merge main` and continue:
   - POST /api/plan (regenerate), GET /api/plan (current sessions and at-risk
     items), PATCH /api/assignments/[id] (estimatedHours). All use
     requireUser() from src/lib/auth and the AGENTS.md error shape.
   - A /plan page matching the mockup's "Work plan" section: a 7-day grid of
     sessions per day with hours, at-risk assignments listed with hours short,
     and a "Rebuild plan" button. Use the design tokens.

Unit-test the planner with edge cases: no assignments, a past due date, zero
available hours, an unavailable date, two assignments competing for the same
days, and one that can't fit. Integration-test the data functions against the
test database.

Branch: feature/13-work-plan, from an up-to-date main. Commit failing tests
first (test: ... (#13)), then feat: ... (#13). Open a PR into main titled
"US-07: Generate a work plan from deadlines" with "Closes #13", how to test,
and an AI usage note saying Antigravity wrote it.
```

</details>

## Other AI use

- **HW3 before/after test:** US-06 built twice in Antigravity, without and with
  `AGENTS.md`, to measure what the rules file changes. Results and the rules
  changes that came from them (v3) are in our HW3 submission.
- **Planning and review:** Claude Code helped split the PRD into issues, plan
  the sprints, review PRs for security problems, and diagnose deploy errors
  from Vercel logs.
