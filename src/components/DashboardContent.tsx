import Link from "next/link";
import MarkDoneButton from "@/components/MarkDoneButton";
import WeekForecast from "@/components/WeekForecast";
import { requireUser } from "@/lib/auth";
import { getForecastForUser } from "@/lib/forecast";
import { toLocalDateKey } from "@/lib/planner/forecast";
import { rankTodaysSessions, TOP_PRIORITY_COUNT } from "@/lib/planner/priorities";
import { APP_TIME_ZONE } from "@/lib/time-zone";
import { getSessionsWithDeadlines } from "@/lib/today";
import { getWorkPlanForUser } from "@/lib/work-plan";

// Reads cookies and the database, so the page renders this inside <Suspense>.
// requireUser() must run before new Date(): with cacheComponents on, reading
// cookies is what opts this render out of the static cache.

function formatHours(hours: number): string {
  return String(Number(hours.toFixed(2)));
}

function countSessions(count: number): string {
  return count === 1 ? "1 session" : `${count} sessions`;
}

export default async function DashboardContent() {
  const user = await requireUser();
  const now = new Date();
  const [weeks, plan] = await Promise.all([
    getForecastForUser(user.id, { now }),
    getWorkPlanForUser(user.id, now),
  ]);

  const todayKey = toLocalDateKey(now, APP_TIME_ZONE);
  const todaysSessions = plan.ok
    ? plan.sessions.filter((session) => session.date === todayKey)
    : [];
  // US-09 (#15): today's still-scheduled sessions, most important first.
  const ranked = rankTodaysSessions(
    await getSessionsWithDeadlines(user.id, todaysSessions),
    todayKey,
    APP_TIME_ZONE,
  );
  const topSessions = ranked.slice(0, TOP_PRIORITY_COUNT);
  const moreCount = ranked.length - topSessions.length;
  const doneCount = todaysSessions.filter((session) => session.status === "DONE").length;

  return (
    <div className="space-y-8">
      <section aria-label="Forecast" className="space-y-3">
        <h2 className="text-lg font-bold">Forecast</h2>
        <WeekForecast weeks={weeks} />
      </section>

      <section aria-label="Today" className="space-y-3">
        <h2 className="text-lg font-bold">Today</h2>
        {!plan.ok ? (
          <p className="text-sm text-ink-2">
            A plan fits your work into the study hours you have each day. Save your hours first.
          </p>
        ) : todaysSessions.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing planned for today.</p>
        ) : topSessions.length === 0 ? (
          <div role="status" className="space-y-1">
            <p className="font-semibold">
              {doneCount > 0 ? "All done for today." : "Nothing left for today."}
            </p>
            {doneCount > 0 && (
              <p className="text-sm text-ink-2">You finished {countSessions(doneCount)} today.</p>
            )}
          </div>
        ) : (
          <>
            <ol
              aria-label="Today's sessions"
              className="divide-y divide-rule rounded-lg border border-rule bg-surface"
            >
              {topSessions.map(({ session, reason }, index) => (
                <li
                  key={session.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
                >
                  <p>
                    <span aria-hidden="true" className="mr-2 font-bold tabular-nums text-ink-2">
                      {index + 1}
                    </span>
                    <span className="font-medium">{session.assignmentTitle}</span>{" "}
                    <span className="text-sm text-ink-2">{session.courseCode}</span>
                  </p>
                  <p className="text-sm text-ink-2">
                    <span className="tabular-nums">{formatHours(session.hours)}h</span>
                    {" · "}
                    <span>{reason}</span>
                  </p>
                  <MarkDoneButton
                    sessionId={session.id}
                    assignmentTitle={session.assignmentTitle}
                  />
                </li>
              ))}
            </ol>
            {moreCount > 0 && (
              <p>
                <Link
                  href="/plan"
                  className="inline-flex min-h-6 items-center text-sm font-semibold text-edit underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
                >
                  {moreCount} more {moreCount === 1 ? "session" : "sessions"} on the plan
                </Link>
              </p>
            )}
          </>
        )}
        {!plan.ok && (
          <Link
            href="/settings/availability"
            className="inline-flex min-h-6 items-center rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            Set your study hours
          </Link>
        )}
        <p>
          <Link
            href="/plan"
            className="inline-flex min-h-6 items-center font-semibold text-edit underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
          >
            See the full plan
          </Link>
        </p>
      </section>

      <section aria-label="Settings" className="space-y-3">
        <h2 className="text-lg font-bold">Settings</h2>
        <ul className="flex flex-wrap gap-3">
          <li>
            <Link
              href="/settings/availability"
              className="inline-flex min-h-6 items-center rounded border border-rule bg-surface px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
            >
              Study hours
            </Link>
          </li>
          <li>
            <Link
              href="/settings/api"
              className="inline-flex min-h-6 items-center rounded border border-rule bg-surface px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
            >
              API keys
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
