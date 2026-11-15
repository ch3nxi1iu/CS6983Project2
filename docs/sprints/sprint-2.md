# Sprint 2 · Nov 2 – Nov 10, extended to Nov 15

**Goal (from the [PRD](../PRD.md#sprint-timeline)):** re-planning, groups,
public API and docs (US-08 to US-15), with feature freeze at the end.

**What happened:** Sprint 1's MVP hadn't shipped, so on Nov 10 we cut the
sprint to a two-day plan: finish the MVP, the public API and the docs, and
drop Canvas (US-02, US-03), groups (US-10, US-11) and US-08, US-09,
US-13 to US-15. We asked for an extension; it was granted on Nov 12 (to
Sun Nov 15), and most of the work landed Nov 10 and Nov 13–14.

Dates and times are Pacific. Sources: commits, pull requests, reviews, the
project board, and our notes.

## Planned vs. done

| Item | Issue | Owner | Result |
|---|---|---|---|
| Database schema | #30 | Chenxi | Done, [#31](https://github.com/ch3nxi1iu/CS6983Project2/pull/31) |
| Issue-title rule (`AGENTS.md` v4) | #2 | Chenxi | Done, [#32](https://github.com/ch3nxi1iu/CS6983Project2/pull/32) |
| CI (lint, typecheck, tests on Postgres, build, audit, CodeQL) and branch protection | #4 | Chenxi | Done, [#36](https://github.com/ch3nxi1iu/CS6983Project2/pull/36) |
| US-06 study hours and days off | #12 | Brandy, Chenxi | Done: data layer [#33](https://github.com/ch3nxi1iu/CS6983Project2/pull/33) (Brandy); page and API [#42](https://github.com/ch3nxi1iu/CS6983Project2/pull/42), re-plan on change [#50](https://github.com/ch3nxi1iu/CS6983Project2/pull/50) (Chenxi) |
| US-05 workload forecast | #11 | Brandy | Done, [#34](https://github.com/ch3nxi1iu/CS6983Project2/pull/34) → [#37](https://github.com/ch3nxi1iu/CS6983Project2/pull/37); plain wording [#54](https://github.com/ch3nxi1iu/CS6983Project2/pull/54) (Chenxi) |
| US-04 demo data, reset and banner | #10 | Brandy | Data and banner done ([#35](https://github.com/ch3nxi1iu/CS6983Project2/pull/35) → [#37](https://github.com/ch3nxi1iu/CS6983Project2/pull/37)); landing page and "Try the demo" in progress |
| Deploy pipeline (Vercel + Neon, migrations on production only) | #5 | Chenxi | Done, [#38](https://github.com/ch3nxi1iu/CS6983Project2/pull/38) |
| US-01 sign-up and login | #7 | Chenxi | Done, [#39](https://github.com/ch3nxi1iu/CS6983Project2/pull/39); sign-up fix [#49](https://github.com/ch3nxi1iu/CS6983Project2/pull/49) (#46) |
| Architecture and database diagrams | #23 | Chenxi | Done, [#40](https://github.com/ch3nxi1iu/CS6983Project2/pull/40) |
| US-07 work plan | #13 | Chenxi | Done, [#41](https://github.com/ch3nxi1iu/CS6983Project2/pull/41) |
| US-12 public API with OpenAPI docs | #18 | Chenxi | Done, [#43](https://github.com/ch3nxi1iu/CS6983Project2/pull/43) |
| Dashboard (forecast, today's sessions, header) | #44 | Brandy | Done, [#48](https://github.com/ch3nxi1iu/CS6983Project2/pull/48) |
| README and setup/deployment guide | #22 | Chenxi | Done, [#51](https://github.com/ch3nxi1iu/CS6983Project2/pull/51); screenshots still to add |
| AI usage log | #24 | Chenxi | Done, [#52](https://github.com/ch3nxi1iu/CS6983Project2/pull/52) |
| Test coverage in CI | #47 | Chenxi | In progress (Brandy approved the dependency on #47) |
| Playwright E2E tests | #6 | Chenxi | In progress |
| Retrospectives, standups, contribution log | #24 | Both | This document |
| US-02, US-03 (Canvas), US-08, US-09, US-10, US-11, US-13–US-15 | #8, #9, #14–#17, #19–#21 | — | Cut on Nov 10; demo data stands in for Canvas |

## Standups

As in Sprint 1, we didn't keep written standups during the sprint. These
entries were written afterwards (Nov 14) from the commit, PR, review and
board history; each of us wrote or checked our own. Where the record doesn't
show something, the cell says so.

| Date | Who | Done | Next | Blockers |
|---|---|---|---|---|
| Nov 4 | Chenxi | Assigned all 24 issues (Chenxi: data in, planner, infra; Brandy: screens, groups, API) | Rules v3 (#29), then the database schema | Sprint 1 milestone closed with 10 open issues |
| Nov 10 | Chenxi | Cut the board to a two-day plan and asked for an extension; schema (#31) and issue-title rule (#32) merged; connected Vercel and Neon; opened CI (#36) and protected `main`; approved Brandy's #33 and #34 | Deploy pipeline (#5) and login (#7) | No feature code on `main` yet; Brandy's stacked PRs missed `main` (fixed by #37) |
| Nov 10 (evening) | Brandy | Set up my machine (Node 24, local database). Built US-06 weekly availability, test first (#33), then the US-05 forecast (#34) and the US-04 demo data, reset and banner (#35) as stacked PRs. They merged, but #34 and #35 landed in their base branches instead of `main`, so I opened recovery PR #37, which merged. Approved Chenxi's #31 and #32 | The routes and pages, once auth (#7) lands | Auth (#7) wasn't merged, so the screens couldn't be reached yet |
| Nov 12 | Chenxi | Extension granted to Sun Nov 15; re-planned to finish by Saturday night | Deploy pipeline (#5), login (#7) | Not recorded |
| Nov 13 | Chenxi | Merged the deploy pipeline (#38) and login (#39, written in Antigravity) with an exception noted on each PR, because Brandy was unavailable to review; opened the diagrams (#40); drafted the AI usage log; started the work plan (#13) in Antigravity | Work plan routes and page; settings page | Antigravity's free quota ran out mid-#13; production sign-up failed until `AUTH_SECRET` was set |
| Nov 14 | Chenxi | Opened and landed the work plan (#41), study hours page and API (#42, with Brandy's CodeQL fix), public API (#43), sign-up fix (#49), re-plan on changes (#50), README (#51), AI usage log (#52) and plain forecast wording (#54); reviewed and approved #48 | Sprint docs (#24), coverage (#47), E2E (#6), README screenshots, demo video | Playwright needs Brandy's OK as a new dependency |
| Nov 14 | Brandy | Reviewed #42 and found the CodeQL failure came from a regex in a test; suggested a one-line fix, which Chenxi committed. Wrote the failing tests for the dashboard (#44); Cursor wrote the implementation against them (#48, merged). Reviewed and approved #43, #49, #50, #51, #52 and #54; approved adding the coverage tool (#47) | The landing page and "Try the demo" (#10), then an end-to-end check on the live site | _(Brandy to fill)_ |
| _(date)_ | Brandy | _(Brandy to add any other Sprint 2 standups she posted elsewhere, with their real dates)_ | | |

## Retrospective

**What went well**
- Test-first held up: every feature PR has a `test:` commit with failing tests
  before its `feat:` or `fix:` commit (#33, #34, #35, #39, #41–#43, #48–#50, #54).
- CI and branch protection went in early (Nov 10), so every later PR was
  linted, type-checked, tested against a real Postgres, built, and scanned by
  CodeQL before merging.
- Reviews caught real problems: the CodeQL regex in #42's test, and the API
  key hashing in #43 (changed to HMAC-SHA256; the remaining alert was
  explained and dismissed as a false positive).
- Splitting files by owner on the last day (pages and layout for Brandy;
  tests, config and docs for Chenxi) meant no merge conflicts.
- Production deploys run migrations first, and previews never migrate, so an
  unmerged migration can't change the shared database.
- _(Brandy to add)_

**What didn't go well**
- Almost all feature work landed in the last days (Nov 10, 13, 14), and we
  needed an extension. Canvas sync, groups and five other stories were cut.
- Stacked PRs: #34 and #35 were based on the branches of #33 and #34. After
  #33 merged, #34 still targeted #33's branch, so merging it (and then #35)
  put the forecast and demo code into those branches instead of `main` until
  recovery PR #37.
- Screens waited on auth (#7), so the availability and forecast UI couldn't
  be tried in a browser for days.
- Several PRs merged without a recorded approval (#28, #35, #36, #38–#42),
  some as noted exceptions when the other partner was unavailable. Branch
  protection checks CI but doesn't require an approval.
- Production sign-up crashed after creating the account because `AUTH_SECRET`
  wasn't set in Vercel; fixed in config, then in code (#49).
- Antigravity's free quota ran out on Nov 13, so much of the remaining code
  was written with Claude Code rather than the AI IDE (see the
  [AI usage log](../ai-usage.md)).
- The README PR (#51) merged while still a draft, before its last fixes.
- _(Brandy to add)_

**Partner feedback**
- Chenxi on Brandy: _(Chenxi to write)_
- Brandy on Chenxi: _(Brandy to write)_

**Action items (for Project 3)**
- Don't stack PRs. If we must, retarget each PR to `main` after the one below
  it merges (or delete the merged branch so GitHub retargets it) before
  merging the next.
- Build auth and a deployed skeleton first, since every screen depends on it.
- Make GitHub require one approval on `main`, so "no recorded review" can't
  happen by accident.
- Set every environment variable in each Vercel environment before the first
  deploy, and have the app check them at startup.
- Keep a short written standup in the repo each working day, instead of
  reconstructing them.
- Plan AI IDE quota at the start of the project, so the primary harness
  doesn't run out mid-story.
- _(Brandy to add)_
