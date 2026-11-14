import Link from "next/link";
import RebuildPlanButton from "@/components/RebuildPlanButton";
import { requireUser } from "@/lib/auth";
import { addDays, toDateKey } from "@/lib/planner/availability";
import { getWorkPlanForUser, type PlanSessionView } from "@/lib/work-plan";

// Reads the database, so it must sit inside a <Suspense> boundary (AGENTS.md).
// Dates are calendar days in UTC, so they format in UTC too.
const weekdayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const shortDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const STATUS_LABEL: Record<PlanSessionView["status"], string> = {
  SCHEDULED: "Scheduled",
  DONE: "Done",
  MISSED: "Missed",
};

function formatHours(hours: number): string {
  return String(Number(hours.toFixed(2)));
}

export default async function WorkPlanSection() {
  const user = await requireUser();
  const now = new Date();
  const plan = await getWorkPlanForUser(user.id, now);

  if (!plan.ok) {
    return (
      <section
        aria-labelledby="study-hours-needed-heading"
        className="max-w-xl space-y-3 rounded-lg border border-rule bg-surface p-6"
      >
        <h2 id="study-hours-needed-heading" className="text-lg font-bold">
          Study hours not set
        </h2>
        <p className="text-sm text-ink-2">
          A plan fits your work into the study hours you have each day. Save your hours first, then
          build the plan.
        </p>
        <Link
          href="/settings/availability"
          className="inline-block rounded bg-ink px-4 py-2 font-semibold text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-edit"
        >
          Set your study hours
        </Link>
      </section>
    );
  }

  const todayKey = toDateKey(now);
  const days = Array.from({ length: 7 }, (_, offset) => addDays(todayKey, offset));
  const sessionsByDay = new Map<string, PlanSessionView[]>();
  for (const session of plan.sessions) {
    const list = sessionsByDay.get(session.date) ?? [];
    list.push(session);
    sessionsByDay.set(session.date, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-2">The next 7 days, starting today.</p>
        <RebuildPlanButton />
      </div>

      <ol className="grid grid-cols-1 gap-3 md:grid-cols-7">
        {days.map((dateKey, index) => {
          const date = new Date(`${dateKey}T00:00:00Z`);
          const sessions = sessionsByDay.get(dateKey) ?? [];
          const label = `${weekdayFormat.format(date)}, ${shortDateFormat.format(date)}`;
          return (
            <li key={dateKey} className="flex flex-col rounded-lg border border-rule bg-surface">
              <h2
                className={`flex items-baseline gap-2 rounded-t-lg border-b border-rule px-3 py-2 ${
                  index === 0 ? "bg-ink text-surface" : "bg-surface-2"
                }`}
              >
                <span className="font-bold">{weekdayFormat.format(date)}</span>
                <time dateTime={dateKey} className="text-sm">
                  {shortDateFormat.format(date)}
                </time>
                {index === 0 && <span className="ml-auto text-xs font-semibold">Today</span>}
              </h2>
              <ul aria-label={`Sessions on ${label}`} className="flex flex-1 flex-col gap-2 p-2">
                {sessions.length === 0 && <li className="p-1 text-sm text-ink-3">No sessions</li>}
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className={`rounded border px-2 py-2 text-sm ${
                      session.status === "MISSED"
                        ? "border-dashed border-ink-3"
                        : "border-rule bg-surface-2"
                    }`}
                  >
                    <p className="text-xs font-semibold text-ink-2">
                      {STATUS_LABEL[session.status]}
                    </p>
                    <p
                      className={`font-medium ${
                        session.status === "MISSED" ? "text-ink-2 line-through" : "text-ink"
                      }`}
                    >
                      {session.assignmentTitle}
                    </p>
                    <p className="text-xs text-ink-2">
                      <span>{session.courseCode}</span> · <span className="tabular-nums">{formatHours(session.hours)}h</span>
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="at-risk-heading" className="space-y-3">
        <h2 id="at-risk-heading" className="text-lg font-bold">
          At risk
        </h2>
        {plan.atRisk.length === 0 ? (
          <p className="text-sm text-ink-2">Everything fits inside your study hours.</p>
        ) : (
          <ul className="divide-y divide-rule rounded-lg border border-line bg-line-soft">
            {plan.atRisk.map((item) => (
              <li
                key={item.assignmentId}
                className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{item.assignmentTitle}</span>{" "}
                  <span className="text-ink-2">{item.courseCode}</span>
                </span>
                <span className="font-semibold text-line tabular-nums">
                  {formatHours(item.hoursShort)}h short
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
