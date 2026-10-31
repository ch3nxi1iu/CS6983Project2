# Product requirements (PRD)

A Canvas-connected planner that helps students see crunch weeks early and spread
their work out. Each detailed story below is one GitHub issue, and the
interactive mockup is in [`docs/mockup/index.html`](mockup/index.html).

> **AI usage:** first draft generated with Claude Code on 2026-10-23 from our
> brainstorming; both partners review and edit it. Sprint and priority are
> **proposals**, and estimates are left blank on purpose so we set them together
> in sprint planning.

Partners: [@ch3nxi1iu](https://github.com/ch3nxi1iu) · [@brandy-wang](https://github.com/brandy-wang)

---

## Project 2 idea: Turn Canvas Deadlines into a Calm Plan

### Problem
Every course has its own Canvas page, and their deadlines pile onto the same
few weeks. Canvas shows when work is due, but not when to start, how much a week
really holds, or what matters most. So we discover crunch weeks a day or two
ahead, too late to spread the work out, and not knowing whether we're behind
becomes its own stress. In group projects, we can't even see how busy our
partner is.

### Solution
See crunch weeks coming and start in time. Connect Canvas once, and the app
compares each week's workload with the time you have, then plans work sessions
backward from each due date, re-planning when you miss one. Each day shows just
your top three tasks, and study groups share progress live.

### Target users
Students juggling several Canvas courses, often alongside a job or job search,
who want to start earlier but don't know where to begin, and teammates who want
to stay in sync on group projects.

### Proposed user stories
1. As someone taking several courses, I want my Canvas deadlines in one place automatically, so I don't track them by hand.
2. As someone caught off guard by busy weeks, I want to see each week's workload against my free time, so I can spot crunch weeks early.
3. As someone who doesn't know when to start, I want a plan that schedules work backward from due dates and adjusts when I miss a session, so I stop cramming.
4. As someone feeling overwhelmed, I want today's top three tasks and why they matter, so I can just start.
5. As someone on a group project, I want to see my teammates' progress live, so we stay in sync without status meetings.
6. As someone who builds my own tools, I want a documented API for my plan, so I can use my data outside the app.

---

## Sprint timeline

20 days from kickoff to the P2 deadline (Thu 2026-11-12, 11:59pm).
HW3 (due Fri 2026-10-30) falls in the middle of Sprint 1.

| Phase | Dates | Goal |
|---|---|---|
| Sprint 1 planning | Sat Oct 24 | Together: review this PRD, estimate stories, split owners |
| **Sprint 1** | Sat Oct 24 – Sun Nov 1 (9 days) | Project setup + individual planner MVP (US-01 to US-07), deployed |
| Sprint 1 retro + Sprint 2 planning | Sun Nov 1 | Demo to each other, retrospective, plan Sprint 2 |
| **Sprint 2** | Mon Nov 2 – Tue Nov 10 (9 days) | Re-planning, groups, public API, docs (US-08 to US-15). Feature freeze at the end |
| Wrap-up | Wed Nov 11 – Thu Nov 12 | Sprint 2 retro, demo video, contribution log, reflections, submit |

GitHub milestone due dates: **Sprint 1 → 2026-11-01**, **Sprint 2 → 2026-11-10**.

Working rhythm:
- Each partner posts at least 3 standups per sprint, e.g. Mon/Wed/Fri
  (done, next, blockers).
- Every story gets its own branch and a PR reviewed by the other partner,
  which also builds toward the 5+ reviews each of us needs.
- Split stories so each partner owns about half, since grades are adjusted
  for unbalanced contributions.
- If we fall behind, cut US-15 first, then US-14, then US-13.

Why this split: Sprint 1 builds what everything else depends on (auth, Canvas
data, the planner), and two days of wrap-up keep the demo video and docs safe
from last-minute bugs.

## Story breakdown (for GitHub issues)

Each proposed story splits into smaller stories with acceptance criteria, one
GitHub issue each. Labels on every story: `feature` plus the priority shown.
Sprint and priority are proposals to confirm together.

| Proposed story | Detailed stories |
|---|---|
| 1. Deadlines in one place | US-01, US-02, US-03, US-04, US-14 |
| 2. See crunch weeks early | US-05, US-06 |
| 3. A plan that adapts | US-07, US-08, US-13 |
| 4. Today's top three tasks | US-09, US-15 |
| 5. Live group progress | US-10, US-11 |
| 6. Documented API | US-12 |

### Sprint 1 (Oct 24 – Nov 1): individual planner (MVP)

#### US-01 · Add sign-up and login with JWT (issue #7)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want to create an account and log in, so that my plan and
Canvas connection are private to me.

- [ ] User can register with email and password; passwords are stored hashed
- [ ] Login issues a JWT in an httpOnly cookie; logout clears it
- [ ] Protected pages redirect to login when not authenticated
- [ ] API routes return 401 without a valid token
- [ ] Wrong credentials show a clear error without revealing which field was wrong

#### US-02 · Connect a Canvas account (issue #8)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want to connect my Canvas account, so that the app can
import my deadlines without me typing them in.

- [ ] User can connect with their Canvas URL and a personal access token
- [ ] The token is checked against Canvas (`GET /api/v1/users/self`) before saving; invalid tokens show an error
- [ ] Token is encrypted at rest, never returned by any API response, and never logged
- [ ] User can disconnect, which deletes the stored token
- [ ] Fallback: if the school doesn't allow tokens, user can connect with their Canvas **calendar feed URL** (due dates only)

#### US-03 · Sync courses and assignments from Canvas (issue #9)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want my active courses and assignments synced, so that the
app always reflects what's really due.

- [ ] Imports active courses, and for each assignment: title, due date, points, assignment group weight, submission status
- [ ] Sync runs on login and from a "Sync now" button; last-synced time is shown
- [ ] All assignments appear in one list sorted by due date, filterable by course and by submitted / not submitted
- [ ] Re-syncing updates changed items and does not create duplicates
- [ ] An expired or revoked token prompts the user to reconnect instead of failing silently

#### US-04 · Add demo mode with sample data (issue #10)
Sprint 1 · priority: high · Estimate: (set together)

As a **demo visitor or grader**, I want to try the app without a Canvas
account, so that I can see every feature with realistic data.

- [ ] "Try the demo" on the landing page opens a demo account without sign-up
- [ ] Demo data includes several fake courses and assignments, including at least one crunch week
- [ ] Demo accounts are isolated from real users and can be reset to the seed data
- [ ] A visible banner marks demo data
- [ ] E2E tests run against demo mode (no real Canvas calls)

#### US-05 · Show a crunch-week forecast (issue #11)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want to see how much work each of the next few weeks holds,
so that I spot heavy weeks early.

- [ ] Shows the next 4 weeks (configurable default) with estimated hours of work per week and per day
- [ ] A week is flagged as a **crunch week** when estimated hours exceed the hours I said I have available
- [ ] Clicking a week or day lists the assignments behind it
- [ ] Submitted assignments are excluded
- [ ] Updates automatically after a sync or a change in availability

#### US-06 · Set weekly availability (issue #12)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want to tell the app how many hours I can study each day,
so that plans fit my actual life.

- [ ] User sets available hours for each day of the week
- [ ] User can mark specific dates as unavailable (e.g., travel, interviews)
- [ ] Availability is required before a plan is generated, with a sensible prefilled default
- [ ] Changes trigger the plan and forecast to recalculate

#### US-07 · Generate a work plan from deadlines (issue #13)
Sprint 1 · priority: high · Estimate: (set together)

As a **student**, I want the app to schedule work sessions for each assignment,
so that I know what to work on each day instead of cramming.

- [ ] Each unsubmitted assignment gets an estimated number of hours (configurable default by assignment type, editable per assignment)
- [ ] Work is split into sessions no longer than a configurable maximum and scheduled backwards from the due date, finishing a configurable buffer before it
- [ ] No day is scheduled beyond that day's available hours
- [ ] When assignments compete for the same time, the earlier deadline is scheduled first
- [ ] If an assignment can't fit, it's flagged **at risk** with the number of hours short

### Sprint 2 (Nov 2 – Nov 10): adapting, groups, and the public API

#### US-08 · Mark sessions done or missed and re-plan (issue #14)
Sprint 2 · priority: high · Estimate: (set together)

As a **student**, I want to check off or skip work sessions and have the plan
adjust, so that one bad day doesn't break the whole plan.

- [ ] User can mark a session as done or missed
- [ ] Missed hours are automatically redistributed across remaining available time before the deadline
- [ ] Each assignment shows progress (hours done / hours planned)
- [ ] If re-planning can't fit the remaining work, the assignment becomes **at risk**
- [ ] Undo is available for the last change

#### US-09 · Show today's top 3 priorities (issue #15)
Sprint 2 · priority: medium · Estimate: (set together)

As a **student**, I want one short list of what matters most today, so that I
start working instead of staring at every deadline.

- [ ] Dashboard shows up to 3 of today's sessions, ranked by grade weight, points, and days until due
- [ ] Each item shows a one-line reason (e.g., "worth 20% of the grade, due in 3 days")
- [ ] An "all done for today" state appears when today's sessions are complete
- [ ] Links to the full plan

#### US-10 · Create a study group and invite members (issue #16)
Sprint 2 · priority: high · Estimate: (set together)

As a **group lead**, I want to create a group and invite teammates, so that we
can coordinate shared work in one place.

- [ ] Any user can create a group and becomes its lead
- [ ] Lead gets an invite link that expires; a logged-in user who opens it joins as a member
- [ ] Lead can remove members; members can leave
- [ ] Role rules are enforced in the API, not just hidden in the UI (a member can't remove others)
- [ ] Members never see each other's private Canvas data

#### US-11 · Show live group progress on a shared board (issue #17)
Sprint 2 · priority: medium · Estimate: (set together)

As a **group member**, I want to see shared tasks and teammates' progress update
live, so that we stay in sync without status meetings.

- [ ] Lead or members can add shared tasks with an owner and a due date
- [ ] Status changes appear for every online member without refreshing (WebSocket or similar)
- [ ] The board shows who is online
- [ ] A member can choose to share one of their own assignments to the board; nothing is shared by default

#### US-12 · Provide a public API with OpenAPI docs (issue #18)
Sprint 2 · priority: high · Estimate: (set together)

As a **developer**, I want a documented API for my tasks, plan, and workload,
so that I can build my own tools on top of it.

- [ ] REST endpoints to read tasks, today's plan, and the weekly workload, and to mark sessions done
- [ ] Authenticated with the user's JWT or a personal API key the user can revoke
- [ ] OpenAPI spec with interactive docs (Swagger UI) at a public docs URL
- [ ] Consistent JSON error format and rate limiting

#### US-13 · Log actual time and learn my pace (issue #19)
Sprint 2 · priority: medium · Estimate: (set together)

As a **student**, I want the app to learn how long my work really takes, so that
future plans are more realistic.

- [ ] User can log actual hours when completing an assignment
- [ ] After several completed assignments of the same type, the app computes a personal pace factor (actual ÷ estimated)
- [ ] New default estimates use the pace factor and show the adjustment ("4h → 5.5h based on your pace")
- [ ] User can reset the pace factor

#### US-14 · Add custom tasks outside Canvas (issue #20)
Sprint 2 · priority: low · Estimate: (set together)

As a **student**, I want to add non-Canvas work like exam prep or job
applications, so that my plan reflects all of my workload.

- [ ] User can create, edit, and delete a task with title, due date, and estimated hours
- [ ] Custom tasks are included in the forecast and the work plan
- [ ] Custom tasks are visually distinct from Canvas assignments

#### US-15 · Suggest assignment steps with AI (stretch) (issue #21)
Sprint 2 · priority: low · Estimate: (set together)

As a **student**, I want a suggested breakdown of a big assignment, so that I
know how to start and how long each part might take.

- [ ] A "Suggest steps" button on an assignment sends its description to an AI model, only when clicked
- [ ] Returns 3–7 steps with hour estimates in a fixed JSON format
- [ ] User can accept, edit, or discard the steps; accepted steps become plan sessions
- [ ] The prompt forbids writing solution content; the feature only plans
- [ ] The UI says the description is sent to an AI provider

### Future ideas (not planned)
- Reminders when a session is missed or a crunch week is a week away
- "Focus together" sessions that show which group members are studying right now

---

## P2 requirement coverage

| P2 functional requirement | Covered by |
|---|---|
| Full stack (frontend, backend, database) | All stories |
| User authentication (JWT or OAuth) | US-01 |
| 3+ distinct features or roles | Features: forecast (US-05), planner (US-07), groups (US-10/11). Roles: student, group lead, group member |
| Real-time updates **or** complex state management | Complex state: US-07/08 re-planning. Real-time: US-11 |
| Public API with documentation | US-12 |
| Professional UI/UX | All stories; demo mode (US-04) for graders |

## Non-story work for the board
`chore` / `docs` issues, not user stories.

Sprint 1:
- Write `AGENTS.md` rules file (#2, for HW3 by Oct 30)
- Scaffold Next.js + Tailwind + database + auth (#1)
- CI: lint, tests on every PR, security scanning (#4)
- Deploy pipeline with PR preview deploys (#5)
- Set up Playwright E2E tests (#6)

Sprint 2:
- README and setup/deployment guide (#22)
- Architecture diagram and database schema diagram (#23)
- Sprint retrospectives and partner contribution log (#24)

Wrap-up (Nov 11–12): 10-minute demo video, individual reflections, submission.

## Scope and assumptions

### Out of scope
- Replacing Canvas (no submitting work, no grade predictions).
- Doing homework for the student: any AI help is limited to planning.
- A native mobile app (responsive web only).
- Instructor-facing features.

### Assumptions to validate
Per *The Mom Test*, check these by asking 3–5 classmates about their *last*
crunch week, not whether they'd use the app:
- Students find out about heavy weeks late, not just "feel busy".
- They currently plan across courses manually, or not at all.
- Seeing time needed vs. time available would change when they start work.

## Open questions
- **Can Northeastern students create Canvas access tokens?** Check Canvas → Account → Settings → "+ New Access Token". If not, only the calendar feed works, and it has **no** submission status, points, or assignment-group weights, which weakens US-03, US-05, and US-09.
- Default hour estimates per assignment type, session length, and buffer: decide together.
- Product name: **Loadline** is the working name in the mockup (`docs/mockup/index.html`). Confirm together.
