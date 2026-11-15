# Sprint 1 · Oct 24 – Nov 1

**Goal (from the [PRD](../PRD.md#sprint-timeline)):** project setup and the
individual planner MVP (US-01 to US-07), deployed.

**Result:** setup, rules file, mockup and PRD done; no product features
shipped. US-01 to US-07, CI and deploy moved to Sprint 2.

Dates and times are Pacific. Sources: commits, pull requests, the project
board, and our notes.

## Planned vs. done

| Item | Issue | Owner | Result |
|---|---|---|---|
| Repo, labels, project board (Backlog → Sprint Todo → In Progress → In Review → Done) | — | Chenxi | Done Oct 23 |
| Milestones Sprint 1 and 2, 24 issues from the PRD | — | Chenxi | Done Oct 29 |
| Scaffold Next.js, Tailwind, Prisma, Vitest | #1 | Chenxi | Done Oct 29 (issue closed Nov 10) |
| `AGENTS.md` rules file, part A (context, Scrum workflow) | #2 | Chenxi | Done, [#25](https://github.com/ch3nxi1iu/CS6983Project2/pull/25) |
| `AGENTS.md` rules file, part B (PRD and design references) | #2 | Brandy | Done, [#27](https://github.com/ch3nxi1iu/CS6983Project2/pull/27) |
| UI mockup | #3 | Brandy | Done, [#26](https://github.com/ch3nxi1iu/CS6983Project2/pull/26) |
| PRD and mockup screenshots in `docs/` | #3 | Chenxi | Done, [#28](https://github.com/ch3nxi1iu/CS6983Project2/pull/28) |
| HW3 before/after test of the rules file | #2 | Chenxi | Done Oct 30; findings became rules v3 ([#29](https://github.com/ch3nxi1iu/CS6983Project2/pull/29), merged Nov 5) |
| US-01 to US-07, CI (#4), deploy (#5), E2E (#6) | #4–#7, #10–#13 | Both | Not started; moved to Sprint 2 |

## Standups

We didn't keep written standups during this sprint; we coordinated by
message and on pull requests. The entries below were written afterwards
(Nov 14) from the commit, PR and board history, and each of us checked our
own. Where the record doesn't show a plan or a blocker, the cell says so.
The Oct 30 entries also use our Slack messages from that day.

| Date | Who | Done | Next | Blockers |
|---|---|---|---|---|
| Oct 23 | Chenxi | Created the repo, labels and project board; invited Brandy | Turn the PRD into issues | Waiting for Brandy to accept the repo invite |
| Oct 29 | Chenxi | Scaffolded the app; created Sprint 1 and 2 milestones and 24 issues from the PRD; wrote `AGENTS.md` part A | Finish the rules file and run the HW3 test | Issues not assigned yet |
| Oct 29 | Brandy | Accepted the repo invite | Mockup and `AGENTS.md` part B | Not recorded |
| Oct 30 | Chenxi | Opened #25 (rules part A) and #28 (PRD); reviewed Brandy's mockup on Slack: it covers all six proposal stories with desktop and mobile views and settles the name Loadline, but has no weekly-availability screen for US-06 (#12) and shows a calendar sync that no story covers; ran the HW3 before/after test in Antigravity | Rules v3 from the test results | The mockup didn't match US-06, the story the HW3 test uses; asked Brandy to add a Settings → Availability screen and say in `AGENTS.md` that calendar sync isn't planned |
| Oct 30 | Brandy | Added the Loadline UI mockup (#26) and wrote `AGENTS.md` part B, the PRD and design references, do's and don'ts (#27); approved Chenxi's part A (#25) | Agreed on Slack (✅) to add a Settings → Availability screen for US-06 to the mockup, and to cover three points in `AGENTS.md` part B: real data goes in the database, not the mockup's local storage; list the details that exist only in the mockup (12-hour daily limit, half-hour steps, default hours); the PRD is the source of truth for acceptance criteria | _(Brandy to fill)_ |
| _(date)_ | Brandy | _(Brandy to add any other Sprint 1 standups she posted elsewhere, with their real dates)_ | | |

## Retrospective

**What went well**
- _(Brandy to add)_
- One shared rules file (`AGENTS.md`) written by both of us, so every AI tool
  follows the same architecture, TDD and PR rules.
- The HW3 before/after test showed the rules file changed the generated code
  for the better (cleaner UI, our design tokens), and its findings went
  straight into rules v3.
- The mockup gave a concrete design target, which later pages followed.
- Reviewing the mockup against the PRD before the HW3 test caught two
  problems early: no screen for US-06, and a calendar-sync design that no
  story covers. Both were fixed the same day.
- The board and the 24 issues came straight from the PRD's user stories.

**What didn't go well**
- _(Brandy to add)_
- No feature code in Sprint 1. The sprint goal (MVP deployed) was missed, and
  the milestone closed with 10 open issues.
- The issues weren't assigned until Nov 4, so neither of us knew which
  stories to start.
- The rules file and HW3 took the whole sprint; we started building late.

**Partner feedback**
- Chenxi on Brandy: _(Chenxi to write)_
- Brandy on Chenxi: _(Brandy to write)_

**Action items for Sprint 2**
- [x] Assign every issue at sprint planning (done Nov 4).
- [x] Build the thinnest working slice first: schema, then CI, then login,
  so features have something to stand on (schema and CI landed Nov 10).
- [ ] Post a short written standup each working day. (Not kept up; see the
  Sprint 2 retrospective.)
