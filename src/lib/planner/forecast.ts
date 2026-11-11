// Pure crunch-week forecast for US-05 (#11): no database, no Date.now().
// Each assignment's estimated hours count on the day it's due (in the user's
// time zone) and in that day's Monday-to-Sunday week.

import {
  addDays,
  getAvailableHoursForDate,
  weekdayOf,
  WEEKDAYS,
  type WeeklyHours,
} from "@/lib/planner/availability";

export const DEFAULT_FORECAST_WEEKS = 4;

export type ForecastAssignment = {
  id: string;
  title: string;
  courseId: string;
  courseCode: string;
  dueAt: Date;
  estimatedHours: number;
  submitted: boolean;
};

export type ForecastDay = {
  date: string;
  workHours: number;
  availableHours: number;
  assignments: ForecastAssignment[];
};

export type ForecastWeek = {
  weekStart: string;
  workHours: number;
  availableHours: number;
  /** More hours of work than study hours that week. */
  isCrunch: boolean;
  byCourse: { courseId: string; courseCode: string; hours: number }[];
  assignments: ForecastAssignment[];
  days: ForecastDay[];
};

export type ForecastInput = {
  now: Date;
  weeklyHours: WeeklyHours;
  unavailableDates: readonly string[];
  assignments: readonly ForecastAssignment[];
  weeks?: number;
  /** IANA time zone used to decide which day something is due. */
  timeZone?: string;
};

/** The calendar day ("YYYY-MM-DD") of an instant in a time zone. */
export function toLocalDateKey(instant: Date, timeZone = "UTC"): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The Monday on or before a date. */
export function startOfWeek(dateKey: string): string {
  return addDays(dateKey, -WEEKDAYS.indexOf(weekdayOf(dateKey)));
}

function sumHours(assignments: readonly ForecastAssignment[]): number {
  return assignments.reduce((total, item) => total + item.estimatedHours, 0);
}

function groupByCourse(assignments: readonly ForecastAssignment[]): ForecastWeek["byCourse"] {
  const byCourse = new Map<string, ForecastWeek["byCourse"][number]>();
  for (const item of assignments) {
    const entry = byCourse.get(item.courseId) ?? {
      courseId: item.courseId,
      courseCode: item.courseCode,
      hours: 0,
    };
    entry.hours += item.estimatedHours;
    byCourse.set(item.courseId, entry);
  }
  return [...byCourse.values()];
}

export function getForecast({
  now,
  weeklyHours,
  unavailableDates,
  assignments,
  weeks = DEFAULT_FORECAST_WEEKS,
  timeZone = "UTC",
}: ForecastInput): ForecastWeek[] {
  const dueByDay = new Map<string, ForecastAssignment[]>();
  for (const item of assignments) {
    if (item.submitted) continue;
    const day = toLocalDateKey(item.dueAt, timeZone);
    dueByDay.set(day, [...(dueByDay.get(day) ?? []), item]);
  }

  const firstWeek = startOfWeek(toLocalDateKey(now, timeZone));
  return Array.from({ length: weeks }, (_, weekIndex) => {
    const weekStart = addDays(firstWeek, weekIndex * 7);
    const days: ForecastDay[] = Array.from({ length: 7 }, (_, dayIndex) => {
      const date = addDays(weekStart, dayIndex);
      const due = dueByDay.get(date) ?? [];
      return {
        date,
        workHours: sumHours(due),
        availableHours: getAvailableHoursForDate(weeklyHours, unavailableDates, date),
        assignments: due,
      };
    });
    const weekAssignments = days.flatMap((day) => day.assignments);
    const workHours = sumHours(weekAssignments);
    const availableHours = days.reduce((total, day) => total + day.availableHours, 0);
    return {
      weekStart,
      workHours,
      availableHours,
      isCrunch: workHours > availableHours,
      byCourse: groupByCourse(weekAssignments),
      assignments: weekAssignments,
      days,
    };
  });
}
