import { describe, expect, test } from "vitest";
import { buildDemoData } from "@/lib/demo/seed-data";
import { getForecast } from "@/lib/planner/forecast";
import { parseUnavailableDateInput, parseWeeklyHours } from "@/lib/planner/availability";

function forecastFor(now: Date) {
  const data = buildDemoData(now);
  return getForecast({
    now,
    weeklyHours: data.weeklyHours,
    unavailableDates: data.unavailableDates.map((item) => item.date),
    assignments: data.courses.flatMap((course) =>
      course.assignments.map((item) => ({
        id: item.title,
        title: item.title,
        courseId: course.code,
        courseCode: course.code,
        dueAt: item.dueAt,
        estimatedHours: item.estimatedHours,
        submitted: item.submitted,
      })),
    ),
  });
}

describe("buildDemoData", () => {
  const now = new Date("2026-11-18T15:00:00Z");
  const data = buildDemoData(now);

  test("has several fake courses, each with assignments", () => {
    expect(data.courses.length).toBeGreaterThanOrEqual(3);
    for (const course of data.courses) {
      expect(course.assignments.length).toBeGreaterThanOrEqual(2);
    }
    expect(new Set(data.courses.map((course) => course.code)).size).toBe(data.courses.length);
  });

  test("includes a submitted assignment, to show it's left out", () => {
    const all = data.courses.flatMap((course) => course.assignments);
    expect(all.some((item) => item.submitted)).toBe(true);
  });

  test("has valid availability and unavailable dates", () => {
    expect(parseWeeklyHours(data.weeklyHours).ok).toBe(true);
    for (const item of data.unavailableDates) {
      expect(parseUnavailableDateInput(item).ok).toBe(true);
    }
  });

  test.each([
    "2026-11-18T15:00:00Z",
    "2026-11-16T00:30:00Z", // Monday
    "2026-11-22T23:00:00Z", // Sunday
    "2027-03-03T12:00:00Z",
  ])("has at least one crunch week in the default forecast when now is %s", (iso) => {
    const weeks = forecastFor(new Date(iso));
    expect(weeks.some((week) => week.isCrunch)).toBe(true);
    expect(weeks.some((week) => !week.isCrunch)).toBe(true);
  });

  test("puts dates relative to now, so the demo never goes stale", () => {
    const later = buildDemoData(new Date("2027-03-03T12:00:00Z"));
    const firstDue = later.courses[0].assignments[0].dueAt.getTime();
    expect(firstDue).toBeGreaterThan(new Date("2027-02-20T00:00:00Z").getTime());
  });

  test("is the same for the same now, so a reset restores the seed exactly", () => {
    expect(buildDemoData(now)).toEqual(buildDemoData(now));
  });
});
