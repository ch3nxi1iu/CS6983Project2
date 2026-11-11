import { describe, expect, test } from "vitest";
import {
  DEFAULT_WEEKLY_HOURS,
  getAvailableHoursForDate,
  getWeekAvailableHours,
  getWeeklyTotal,
  parseUnavailableDateInput,
  parseWeeklyHours,
} from "@/lib/planner/availability";

describe("DEFAULT_WEEKLY_HOURS", () => {
  test("is 3h Mon–Thu, 2h Fri, 4h on weekends (22h a week)", () => {
    expect(DEFAULT_WEEKLY_HOURS).toEqual({
      monday: 3,
      tuesday: 3,
      wednesday: 3,
      thursday: 3,
      friday: 2,
      saturday: 4,
      sunday: 4,
    });
    expect(getWeeklyTotal(DEFAULT_WEEKLY_HOURS)).toBe(22);
  });
});

describe("parseWeeklyHours", () => {
  test("accepts hours for every day in 0.5-hour steps from 0 to 12", () => {
    const input = { ...DEFAULT_WEEKLY_HOURS, monday: 0, sunday: 12, friday: 2.5 };
    expect(parseWeeklyHours(input)).toEqual({ ok: true, value: input });
  });

  test.each([
    ["more than 12 hours", { ...DEFAULT_WEEKLY_HOURS, monday: 12.5 }],
    ["negative hours", { ...DEFAULT_WEEKLY_HOURS, monday: -1 }],
    ["steps smaller than 0.5", { ...DEFAULT_WEEKLY_HOURS, monday: 1.25 }],
    ["a missing day", { ...DEFAULT_WEEKLY_HOURS, sunday: undefined }],
    ["a non-number", { ...DEFAULT_WEEKLY_HOURS, monday: "3" }],
    ["not an object", null],
  ])("rejects %s", (_label, input) => {
    const result = parseWeeklyHours(input);
    expect(result.ok).toBe(false);
  });

  test("ignores unknown keys", () => {
    const result = parseWeeklyHours({ ...DEFAULT_WEEKLY_HOURS, extra: 5 });
    expect(result).toEqual({ ok: true, value: DEFAULT_WEEKLY_HOURS });
  });
});

describe("parseUnavailableDateInput", () => {
  test("accepts a YYYY-MM-DD date with an optional reason", () => {
    expect(parseUnavailableDateInput({ date: "2026-11-20", reason: " Interview " })).toEqual({
      ok: true,
      value: { date: "2026-11-20", reason: "Interview" },
    });
    expect(parseUnavailableDateInput({ date: "2026-11-20" })).toEqual({
      ok: true,
      value: { date: "2026-11-20", reason: null },
    });
  });

  test.each([
    ["an impossible date", { date: "2026-02-30" }],
    ["a date with a time", { date: "2026-11-20T10:00:00Z" }],
    ["a missing date", { reason: "Trip" }],
    ["a reason that is too long", { date: "2026-11-20", reason: "x".repeat(121) }],
  ])("rejects %s", (_label, input) => {
    expect(parseUnavailableDateInput(input).ok).toBe(false);
  });
});

describe("getAvailableHoursForDate", () => {
  test("uses the weekday's hours", () => {
    // 2026-11-16 is a Monday, 2026-11-21 a Saturday.
    expect(getAvailableHoursForDate(DEFAULT_WEEKLY_HOURS, [], "2026-11-16")).toBe(3);
    expect(getAvailableHoursForDate(DEFAULT_WEEKLY_HOURS, [], "2026-11-21")).toBe(4);
  });

  test("is zero on a date marked unavailable", () => {
    expect(getAvailableHoursForDate(DEFAULT_WEEKLY_HOURS, ["2026-11-21"], "2026-11-21")).toBe(0);
  });
});

describe("getWeekAvailableHours", () => {
  test("sums seven days from the week start", () => {
    expect(getWeekAvailableHours(DEFAULT_WEEKLY_HOURS, [], "2026-11-16")).toBe(22);
  });

  test("subtracts days marked unavailable in that week only", () => {
    const unavailable = ["2026-11-21", "2026-11-30"]; // Sat this week, Mon next week
    expect(getWeekAvailableHours(DEFAULT_WEEKLY_HOURS, unavailable, "2026-11-16")).toBe(18);
  });

  test("is zero when every day has zero hours", () => {
    const none = Object.fromEntries(
      Object.keys(DEFAULT_WEEKLY_HOURS).map((day) => [day, 0]),
    ) as typeof DEFAULT_WEEKLY_HOURS;
    expect(getWeekAvailableHours(none, [], "2026-11-16")).toBe(0);
  });
});
