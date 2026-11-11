import { describe, expect, test } from "vitest";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import {
  DEFAULT_FORECAST_WEEKS,
  getForecast,
  startOfWeek,
  type ForecastAssignment,
} from "@/lib/planner/forecast";

// Wednesday 2026-11-18; its week starts Monday 2026-11-16.
const NOW = new Date("2026-11-18T15:00:00Z");

function assignment(overrides: Partial<ForecastAssignment> = {}): ForecastAssignment {
  return {
    id: crypto.randomUUID(),
    title: "Problem set",
    courseId: "c1",
    courseCode: "CS 5800",
    dueAt: new Date("2026-11-20T23:59:00Z"),
    estimatedHours: 4,
    submitted: false,
    ...overrides,
  };
}

function forecast(assignments: ForecastAssignment[], extra: Partial<Parameters<typeof getForecast>[0]> = {}) {
  return getForecast({
    now: NOW,
    weeklyHours: DEFAULT_WEEKLY_HOURS,
    unavailableDates: [],
    assignments,
    ...extra,
  });
}

describe("startOfWeek", () => {
  test("is the Monday of the date's week", () => {
    expect(startOfWeek("2026-11-18")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-16")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16"); // Sunday
  });
});

describe("getForecast", () => {
  test("shows the next 4 weeks by default, starting with this week", () => {
    const weeks = forecast([]);
    expect(DEFAULT_FORECAST_WEEKS).toBe(4);
    expect(weeks.map((week) => week.weekStart)).toEqual([
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
      "2026-12-07",
    ]);
    expect(weeks[0].days).toHaveLength(7);
  });

  test("the number of weeks is configurable", () => {
    expect(forecast([], { weeks: 6 })).toHaveLength(6);
  });

  test("with no assignments every week has zero work and no crunch", () => {
    for (const week of forecast([])) {
      expect(week.workHours).toBe(0);
      expect(week.availableHours).toBe(22);
      expect(week.isCrunch).toBe(false);
    }
  });

  test("counts each assignment's hours on its due day and in its week", () => {
    const weeks = forecast([
      assignment({ estimatedHours: 4, dueAt: new Date("2026-11-20T23:59:00Z") }),
      assignment({ estimatedHours: 2.5, dueAt: new Date("2026-11-25T12:00:00Z") }),
    ]);
    expect(weeks[0].workHours).toBe(4);
    expect(weeks[0].days.find((day) => day.date === "2026-11-20")?.workHours).toBe(4);
    expect(weeks[1].workHours).toBe(2.5);
  });

  test("splits each week's hours by course for the stacked bars", () => {
    const [week] = forecast([
      assignment({ courseId: "c1", courseCode: "CS 5800", estimatedHours: 3 }),
      assignment({ courseId: "c2", courseCode: "CS 6983", estimatedHours: 5 }),
      assignment({ courseId: "c1", courseCode: "CS 5800", estimatedHours: 1 }),
    ]);
    expect(week.byCourse).toEqual([
      { courseId: "c1", courseCode: "CS 5800", hours: 4 },
      { courseId: "c2", courseCode: "CS 6983", hours: 5 },
    ]);
  });

  test("flags a crunch week when work exceeds available hours", () => {
    const weeks = forecast([
      assignment({ estimatedHours: 22, dueAt: new Date("2026-11-20T12:00:00Z") }),
      assignment({ estimatedHours: 23, dueAt: new Date("2026-11-27T12:00:00Z") }),
    ]);
    expect(weeks[0].isCrunch).toBe(false); // equal is not over
    expect(weeks[1].isCrunch).toBe(true);
  });

  test("unavailable dates lower that week's hours and can cause a crunch", () => {
    const weeks = forecast([assignment({ estimatedHours: 20 })], {
      unavailableDates: ["2026-11-21", "2026-11-22"], // the weekend, 8h
    });
    expect(weeks[0].availableHours).toBe(14);
    expect(weeks[0].isCrunch).toBe(true);
    expect(weeks[0].days.find((day) => day.date === "2026-11-21")?.availableHours).toBe(0);
  });

  test("lists the assignments behind each week and day", () => {
    const due = assignment({ title: "Essay", dueAt: new Date("2026-11-20T12:00:00Z") });
    const [week] = forecast([due]);
    expect(week.assignments.map((item) => item.title)).toEqual(["Essay"]);
    expect(week.days.find((day) => day.date === "2026-11-20")?.assignments).toEqual([due]);
    expect(week.days.find((day) => day.date === "2026-11-19")?.assignments).toEqual([]);
  });

  test("excludes submitted assignments", () => {
    const [week] = forecast([assignment({ submitted: true, estimatedHours: 30 })]);
    expect(week.workHours).toBe(0);
    expect(week.assignments).toEqual([]);
  });

  test("leaves out work due before this week or after the window", () => {
    const weeks = forecast([
      assignment({ dueAt: new Date("2026-11-15T12:00:00Z") }), // last Sunday
      assignment({ dueAt: new Date("2026-12-14T12:00:00Z") }), // week 5
    ]);
    expect(weeks.reduce((total, week) => total + week.workHours, 0)).toBe(0);
  });

  test("puts a due date on the right day in the user's time zone", () => {
    // 03:00 UTC on Saturday is still Friday evening in New York.
    const [week] = forecast([assignment({ dueAt: new Date("2026-11-21T03:00:00Z") })], {
      timeZone: "America/New_York",
    });
    expect(week.days.find((day) => day.date === "2026-11-20")?.workHours).toBe(4);
  });

  test("a week with zero study hours and any work is a crunch week", () => {
    const zero = Object.fromEntries(
      Object.keys(DEFAULT_WEEKLY_HOURS).map((day) => [day, 0]),
    ) as typeof DEFAULT_WEEKLY_HOURS;
    const [week] = forecast([assignment({ estimatedHours: 0.5 })], { weeklyHours: zero });
    expect(week.isCrunch).toBe(true);
  });
});
