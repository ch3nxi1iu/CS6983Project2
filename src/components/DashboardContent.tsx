import Link from "next/link";
import WeekForecast from "@/components/WeekForecast";
import { requireUser } from "@/lib/auth";
import { getForecastForUser } from "@/lib/forecast";
import { toDateKey } from "@/lib/planner/availability";
import { getWorkPlanForUser, type PlanSessionView } from "@/lib/work-plan";

// Reads cookies and the database, so the page renders this inside <Suspense>.
// requireUser() must run before new Date(): with cacheComponents on, reading
// cookies is what opts this render out of the static cache.

const STATUS_LABEL: Record<PlanSessionView["status"], string> = {
  SCHEDULED: "Scheduled",
  DONE: "Done",
  MISSED: "Missed",
};

function formatHours(hours: number): string {
  return String(Number(hours.toFixed(2)));
}

export default async function DashboardContent() {
  const user = await requireUser();
  const now = new Date();
  const [weeks, plan] = await Promise.all([
    getForecastForUser(user.id, { now }),
    getWorkPlanForUser(user.id, now),
  ]);

  const todaysSessions = plan.ok
    ? plan.sessions.filter((session) => session.date === toDateKey(now))
    : [];

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
        ) : (
          <ul
            aria-label="Today's sessions"
            className="divide-y divide-rule rounded-lg border border-rule bg-surface"
          >
            {todaysSessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3"
              >
                <p>
                  <span className="font-medium">{session.assignmentTitle}</span>{" "}
                  <span className="text-sm text-ink-2">{session.courseCode}</span>
                </p>
                <p className="text-sm text-ink-2">
                  <span className="tabular-nums">{formatHours(session.hours)}h</span>
                  {" · "}
                  <span
                    className={
                      session.status === "DONE"
                        ? "font-semibold text-ok"
                        : session.status === "MISSED"
                          ? "font-semibold text-line"
                          : "font-semibold"
                    }
                  >
                    {STATUS_LABEL[session.status]}
                  </span>
                </p>
              </li>
            ))}
          </ul>
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
