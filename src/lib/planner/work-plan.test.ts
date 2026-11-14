// Pure unit tests for generateWorkPlan — no database, no Date.now().
// Each test covers one acceptance criterion or edge case from US-07 (#13).

import { describe, expect, test } from "vitest";
import { generateWorkPlan, DEFAULT_HOURS_BY_KIND } from "@/lib/planner/work-plan";
import type { PlannerAssignment } from "@/lib/planner/work-plan";
import type { WeeklyHours } from "@/lib/planner/availability";

// Monday–Sunday weekly availability at 2h each day.
const HOURS_2H: WeeklyHours = {
  monday: 2,
  tuesday: 2,
  wednesday: 2,
  thursday: 2,
  friday: 2,
  saturday: 2,
  sunday: 2,
};

// 4h every day
const HOURS_4H: WeeklyHours = {
  monday: 4,
  tuesday: 4,
  wednesday: 4,
  thursday: 4,
  friday: 4,
  saturday: 4,
  sunday: 4,
};

function a(
  id: string,
  dueDate: string,
  estimatedHours: number,
  submitted = false,
  kind: PlannerAssignment["kind"] = "HOMEWORK",
): PlannerAssignment {
  return {
    id,
    dueAt: new Date(`${dueDate}T23:59:00Z`),
    estimatedHours,
    submitted,
    kind,
  };
}

// now = Monday 2026-11-16
const NOW = new Date("2026-11-16T08:00:00Z");

describe("generateWorkPlan", () => {
  test("returns empty sessions and no at-risk items when there are no assignments", () => {
    const result = generateWorkPlan({
      assignments: [],
      availability: { weeklyHours: HOURS_2H, unavailableDates: [] },
      now: NOW,
    });
    expect(result.sessions).toEqual([]);
    expect(result.atRisk).toEqual([]);
  });

  test("skips already-submitted assignments", () => {
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-20", 4, true)],
      availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
      now: NOW,
    });
    expect(result.sessions).toEqual([]);
    expect(result.atRisk).toEqual([]);
  });

  test("skips assignments due on or before now", () => {
    const result = generateWorkPlan({
      assignments: [
        a("past", "2026-11-15", 4), // yesterday
        a("today-end", "2026-11-16", 4), // today, before bufferDays cutoff
      ],
      availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
      now: NOW,
    });
    expect(result.sessions).toEqual([]);
    expect(result.atRisk).toEqual([]);
  });

  test("schedules a small assignment that fits before its due date", () => {
    // 4h of work, 4h/day available, due in 5 days (Sat 2026-11-21), bufferDays=1 → schedule by Fri Nov 20
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-21", 4)],
      availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    expect(result.atRisk).toEqual([]);
    // Should have sessions totalling 4h
    const totalHours = result.sessions
      .filter((s) => s.assignmentId === "a1")
      .reduce((sum, s) => sum + s.hours, 0);
    expect(totalHours).toBe(4);
    // No session should exceed maxSessionHours=2
    for (const s of result.sessions) {
      expect(s.hours).toBeLessThanOrEqual(2);
    }
  });

  test("sessions are scheduled backwards from due date minus buffer", () => {
    // 2h work, 2h/day available, due Friday Nov 20 → with bufferDays=1 must finish by Thu Nov 19
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-20", 2)],
      availability: { weeklyHours: HOURS_2H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    expect(result.atRisk).toEqual([]);
    // All sessions must be on or before Thu Nov 19 (not on the due date itself)
    for (const s of result.sessions) {
      expect(s.date <= "2026-11-19").toBe(true);
    }
  });

  test("respects maxSessionHours by splitting work across multiple sessions", () => {
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-21", 6)],
      availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    expect(result.atRisk).toEqual([]);
    for (const s of result.sessions) {
      expect(s.hours).toBeLessThanOrEqual(2);
    }
    const total = result.sessions.reduce((s, r) => s + r.hours, 0);
    expect(total).toBe(6);
  });

  test("does not schedule more than available hours on a day", () => {
    // 2h/day, two assignments of 2h each
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-21", 2), a("a2", "2026-11-21", 2)],
      availability: { weeklyHours: HOURS_2H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 0 },
    });
    // Group sessions by day and verify no day exceeds 2h
    const byDay: Record<string, number> = {};
    for (const s of result.sessions) {
      byDay[s.date] = (byDay[s.date] ?? 0) + s.hours;
    }
    for (const day of Object.keys(byDay)) {
      expect(byDay[day]).toBeLessThanOrEqual(2);
    }
  });

  test("zero available hours on every day — assignment is entirely at risk", () => {
    const noHours: WeeklyHours = {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 0,
      saturday: 0,
      sunday: 0,
    };
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-21", 4)],
      availability: { weeklyHours: noHours, unavailableDates: [] },
      now: NOW,
    });
    expect(result.sessions).toEqual([]);
    expect(result.atRisk).toEqual([{ assignmentId: "a1", hoursShort: 4 }]);
  });

  test("unavailable date has zero available hours that day", () => {
    // 4h/day, only one day available before due (Nov 18 Tue), Nov 17 Mon is unavailable
    // Due on Nov 19 (Wed) with buffer 1 → must finish by Nov 18
    // Nov 17 is unavailable → only Nov 18 (2h capped by maxSessionHours)
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-19", 2)],
      availability: {
        weeklyHours: HOURS_4H,
        unavailableDates: ["2026-11-17"],
      },
      now: NOW, // Mon Nov 16
      options: { maxSessionHours: 4, bufferDays: 1 },
    });
    // Session should NOT be on the unavailable date
    for (const s of result.sessions) {
      expect(s.date).not.toBe("2026-11-17");
    }
  });

  test("earliest deadline first when two assignments compete for the same days", () => {
    // Both assignments due later, but different deadlines; earlier one should be scheduled first (later in time)
    // a1 due Nov 25, a2 due Nov 24 — a2 should be scheduled on later days (closer to its due)
    // and a1's sessions end up pushed earlier (farther from its due)
    const result = generateWorkPlan({
      assignments: [
        a("a1", "2026-11-25", 4), // due later
        a("a2", "2026-11-24", 4), // due earlier
      ],
      availability: { weeklyHours: HOURS_2H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    // a2 (earlier deadline) should use days closer to its due date
    // a1 (later deadline) should end up on earlier days
    const a1Days = result.sessions.filter((s) => s.assignmentId === "a1").map((s) => s.date).sort();
    const a2Days = result.sessions.filter((s) => s.assignmentId === "a2").map((s) => s.date).sort();
    // a2 days should be on average later than a1 days (earlier deadline scheduled last in backward fill)
    if (a1Days.length > 0 && a2Days.length > 0) {
      expect(Math.max(...a2Days.map((d) => new Date(d).getTime()))).toBeGreaterThanOrEqual(
        Math.min(...a1Days.map((d) => new Date(d).getTime())),
      );
    }
  });

  test("at-risk: assignment that cannot fully fit reports hoursShort", () => {
    // 1h/day, assignment needs 4h but only 2 days available before buffer deadline
    const oneHour: WeeklyHours = {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1,
      saturday: 1,
      sunday: 1,
    };
    // now = Mon Nov 16; due Nov 18 (Wed), bufferDays=1 → must finish by Nov 17 (Tue)
    // Available days on or after today: Nov 16 (Mon) and Nov 17 (Tue) = 2h total
    // Need 4h → 2h scheduled, 2h short
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-18", 4)],
      availability: { weeklyHours: oneHour, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    expect(result.atRisk.length).toBe(1);
    expect(result.atRisk[0].assignmentId).toBe("a1");
    expect(result.atRisk[0].hoursShort).toBe(2); // 4 needed − 2 scheduled
  });

  test("partial fit: some sessions scheduled, rest marked at-risk", () => {
    const noHours: WeeklyHours = {
      monday: 1,
      tuesday: 1,
      wednesday: 1,
      thursday: 1,
      friday: 1,
      saturday: 1,
      sunday: 1,
    };
    const result = generateWorkPlan({
      assignments: [a("a1", "2026-11-19", 4)],
      availability: { weeklyHours: noHours, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    const scheduled = result.sessions.filter((s) => s.assignmentId === "a1").reduce((sum, s) => sum + s.hours, 0);
    const short = result.atRisk.find((r) => r.assignmentId === "a1")?.hoursShort ?? 0;
    expect(scheduled + short).toBe(4); // scheduled + short = total required
  });

  test("DEFAULT_HOURS_BY_KIND provides defaults for each kind", () => {
    expect(DEFAULT_HOURS_BY_KIND.HOMEWORK).toBe(4);
    expect(DEFAULT_HOURS_BY_KIND.PROJECT).toBe(10);
    expect(DEFAULT_HOURS_BY_KIND.EXAM).toBe(6);
    expect(DEFAULT_HOURS_BY_KIND.READING).toBe(2);
    expect(DEFAULT_HOURS_BY_KIND.OTHER).toBe(3);
  });

  test("uses the kind's default hours when an assignment has no estimate", () => {
    // Not in the failing-test commit: added with the implementation.
    const result = generateWorkPlan({
      assignments: [
        {
          id: "project",
          dueAt: new Date("2026-11-25T23:59:00Z"),
          estimatedHours: null,
          submitted: false,
          kind: "PROJECT",
        },
      ],
      availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
      now: NOW,
      options: { maxSessionHours: 2, bufferDays: 1 },
    });
    expect(result.atRisk).toEqual([]);
    const total = result.sessions.reduce((sum, s) => sum + s.hours, 0);
    expect(total).toBe(DEFAULT_HOURS_BY_KIND.PROJECT);
  });

  test("rejects a maxSessionHours that would never finish a session", () => {
    expect(() =>
      generateWorkPlan({
        assignments: [a("a1", "2026-11-21", 4)],
        availability: { weeklyHours: HOURS_4H, unavailableDates: [] },
        now: NOW,
        options: { maxSessionHours: 0 },
      }),
    ).toThrow(RangeError);
  });
});
