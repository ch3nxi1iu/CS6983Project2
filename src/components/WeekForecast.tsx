"use client";

import { useState } from "react";
import type { ForecastWeek } from "@/lib/planner/forecast";

type Props = { weeks: ForecastWeek[] };

// Literal class names so Tailwind picks them up.
const COURSE_COLORS = ["bg-c1", "bg-c2", "bg-c3", "bg-c4"];

const shortDate = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const dayDate = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function fromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00Z`);
}

function hours(value: number) {
  return `${Math.round(value * 10) / 10}h`;
}

function crunchSummary(count: number) {
  if (count === 0) return "No crunch weeks ahead. Your study hours cover the work in every week.";
  return `${count} crunch ${count === 1 ? "week" : "weeks"} ahead`;
}

export default function WeekForecast({ weeks }: Props) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const courseIds = [...new Set(weeks.flatMap((week) => week.byCourse.map((c) => c.courseId)))];
  const colorFor = (courseId: string) =>
    COURSE_COLORS[courseIds.indexOf(courseId) % COURSE_COLORS.length];
  const scale = Math.max(1, ...weeks.flatMap((week) => [week.workHours, week.availableHours]));
  const crunchCount = weeks.filter((week) => week.isCrunch).length;
  const week = weeks.find((item) => item.weekStart === selectedWeek);
  const day = week?.days.find((item) => item.date === selectedDay);

  const listed = day ? day.assignments : (week?.assignments ?? []);
  const listLabel = day
    ? `Assignments due ${dayDate.format(fromKey(day.date))}`
    : week
      ? `Assignments due the week of ${shortDate.format(fromKey(week.weekStart))}`
      : "";

  return (
    <div className="space-y-6 text-ink">
      <p className={crunchCount > 0 ? "font-semibold text-line" : "text-ink-2"}>
        {crunchSummary(crunchCount)}
      </p>

      <ul className="space-y-3" aria-label="Hours of work per week">
        {weeks.map((item) => {
          const label = `Week of ${shortDate.format(fromKey(item.weekStart))}`;
          return (
            <li key={item.weekStart}>
              <button
                type="button"
                aria-pressed={item.weekStart === selectedWeek}
                onClick={() => {
                  setSelectedWeek(item.weekStart);
                  setSelectedDay(null);
                }}
                className={`w-full rounded-lg border bg-surface p-3 text-left focus-visible:outline-2 focus-visible:outline-edit ${
                  item.isCrunch ? "border-line bg-line-soft" : "border-rule"
                }`}
              >
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{label}</span>
                  <span className="text-sm tabular-nums text-ink-2">
                    {hours(item.workHours)} of work · {hours(item.availableHours)} study time
                  </span>
                  {item.isCrunch && (
                    <span className="rounded bg-line px-2 text-xs font-bold text-surface">
                      Crunch week
                    </span>
                  )}
                </span>
                {/* Visual bar; the numbers above are its text alternative. */}
                <span aria-hidden="true" className="relative mt-2 flex h-3 rounded bg-surface-2">
                  {item.byCourse.map((course) => (
                    <span
                      key={course.courseId}
                      className={`h-3 first:rounded-l last:rounded-r ${colorFor(course.courseId)}`}
                      style={{ width: `${(course.hours / scale) * 100}%` }}
                    />
                  ))}
                  <span
                    className="absolute -top-1 h-5 border-l-2 border-dashed border-line"
                    style={{ left: `${(item.availableHours / scale) * 100}%` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {week && (
        <section aria-label="Week details" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {week.days.map((item) => (
              <button
                key={item.date}
                type="button"
                aria-pressed={item.date === selectedDay}
                onClick={() => setSelectedDay(item.date)}
                className="rounded border border-rule bg-surface px-2 py-1 text-sm tabular-nums focus-visible:outline-2 focus-visible:outline-edit aria-pressed:border-edit"
              >
                {dayDate.format(fromKey(item.date))} · {hours(item.workHours)}
              </button>
            ))}
          </div>
          {listed.length === 0 ? (
            <p className="text-ink-2">{day ? "Nothing due this day." : "Nothing due this week."}</p>
          ) : (
            <ul aria-label={listLabel} className="divide-y divide-rule rounded border border-rule bg-surface">
              {listed.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true" className={`h-3 w-3 rounded-sm ${colorFor(item.courseId)}`} />
                    <span className="font-medium">{item.title}</span>
                    <span className="text-sm text-ink-2">{item.courseCode}</span>
                  </span>
                  <span className="text-sm tabular-nums text-ink-2">{hours(item.estimatedHours)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
