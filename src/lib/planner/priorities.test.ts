// Unit tests for today's top priorities (US-09, #15). Pure: fixed dates, and
// the time zone is passed in so the tests don't depend on the environment.
import { describe, expect, test } from "vitest";
import {
  getDaysUntilDue,
  getPriorityReason,
  rankTodaysSessions,
  type PriorityCandidate,
  type PrioritySession,
} from "@/lib/planner/priorities";

const TODAY = "2026-11-15";
const TZ = "America/Los_Angeles";

/** 20:00 UTC is midday in Los Angeles, so the local day is the same as the UTC day. */
function dueOn(dateKey: string): Date {
  return new Date(`${dateKey}T20:00:00Z`);
}

function candidate(
  title: string,
  points: number | null,
  dueAt: Date,
  status: PrioritySession["status"] = "SCHEDULED",
  id = title,
): PriorityCandidate<PrioritySession> {
  return { session: { id, assignmentTitle: title, status }, points, dueAt };
}

function titles(ranked: { session: PrioritySession }[]): string[] {
  return ranked.map((item) => item.session.assignmentTitle);
}

describe("getDaysUntilDue", () => {
  test("counts whole days between today and the due date", () => {
    expect(getDaysUntilDue(dueOn("2026-11-15"), TODAY, TZ)).toBe(0);
    expect(getDaysUntilDue(dueOn("2026-11-16"), TODAY, TZ)).toBe(1);
    expect(getDaysUntilDue(dueOn("2026-11-18"), TODAY, TZ)).toBe(3);
    expect(getDaysUntilDue(dueOn("2026-11-13"), TODAY, TZ)).toBe(-2);
  });

  test("uses the due date's day in the given time zone, not in UTC", () => {
    // 06:00 UTC on Nov 18 is still Nov 17 in Los Angeles.
    const dueAt = new Date("2026-11-18T06:00:00Z");
    expect(getDaysUntilDue(dueAt, TODAY, TZ)).toBe(2);
    expect(getDaysUntilDue(dueAt, TODAY, "UTC")).toBe(3);
  });

  test("counts across a month end", () => {
    expect(getDaysUntilDue(dueOn("2026-12-02"), "2026-11-29", TZ)).toBe(3);
  });
});

describe("getPriorityReason", () => {
  test("names the points and when the work is due", () => {
    expect(getPriorityReason(100, 3)).toBe("Worth 100 points, due in 3 days");
    expect(getPriorityReason(40, 0)).toBe("Worth 40 points, due today");
    expect(getPriorityReason(20, 1)).toBe("Worth 20 points, due tomorrow");
  });

  test("leaves out the points when there are none", () => {
    expect(getPriorityReason(null, 1)).toBe("Due tomorrow");
    expect(getPriorityReason(0, 0)).toBe("Due today");
    expect(getPriorityReason(null, 5)).toBe("Due in 5 days");
  });

  test("says 1 point, and keeps fractional points short", () => {
    expect(getPriorityReason(1, 2)).toBe("Worth 1 point, due in 2 days");
    expect(getPriorityReason(12.5, 2)).toBe("Worth 12.5 points, due in 2 days");
    expect(getPriorityReason(1 / 3, 2)).toBe("Worth 0.33 points, due in 2 days");
  });

  test("says when the due date has passed", () => {
    expect(getPriorityReason(null, -1)).toBe("Was due yesterday");
    expect(getPriorityReason(10, -3)).toBe("Worth 10 points, was due 3 days ago");
  });
});

describe("rankTodaysSessions", () => {
  test("ranks by points first, higher first", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("Reading notes", 10, dueOn("2026-11-15")),
        candidate("Final project", 100, dueOn("2026-11-20")),
        candidate("Essay draft", 40, dueOn("2026-11-16")),
      ],
      TODAY,
      TZ,
    );
    expect(titles(ranked)).toEqual(["Final project", "Essay draft", "Reading notes"]);
  });

  test("counts missing points as 0", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("No points", null, dueOn("2026-11-15")),
        candidate("Some points", 5, dueOn("2026-11-25")),
      ],
      TODAY,
      TZ,
    );
    expect(titles(ranked)).toEqual(["Some points", "No points"]);
  });

  test("breaks ties on points by the sooner due date, then by title", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("Lab report", 40, dueOn("2026-11-20")),
        candidate("Quiz prep", 40, dueOn("2026-11-16")),
        candidate("Bug fixes", null, dueOn("2026-11-18")),
        candidate("Answers", null, dueOn("2026-11-18")),
        candidate("Essay draft", 40, dueOn("2026-11-16")),
      ],
      TODAY,
      TZ,
    );
    expect(titles(ranked)).toEqual([
      "Essay draft",
      "Quiz prep",
      "Lab report",
      "Answers",
      "Bug fixes",
    ]);
  });

  test("breaks a full tie by session id, so the order doesn't change between loads", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("Essay draft", 40, dueOn("2026-11-16"), "SCHEDULED", "b"),
        candidate("Essay draft", 40, dueOn("2026-11-16"), "SCHEDULED", "a"),
      ],
      TODAY,
      TZ,
    );
    expect(ranked.map((item) => item.session.id)).toEqual(["a", "b"]);
  });

  test("gives each session a one-line reason", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("Reading notes", null, dueOn("2026-11-16")),
        candidate("Final project", 100, dueOn("2026-11-18")),
        candidate("Essay draft", 40, dueOn("2026-11-15")),
      ],
      TODAY,
      TZ,
    );
    expect(ranked.map((item) => item.reason)).toEqual([
      "Worth 100 points, due in 3 days",
      "Worth 40 points, due today",
      "Due tomorrow",
    ]);
  });

  test("leaves out sessions that are already done or missed", () => {
    const ranked = rankTodaysSessions(
      [
        candidate("Done one", 500, dueOn("2026-11-16"), "DONE"),
        candidate("Missed one", 400, dueOn("2026-11-16"), "MISSED"),
        candidate("Still to do", 10, dueOn("2026-11-16")),
      ],
      TODAY,
      TZ,
    );
    expect(titles(ranked)).toEqual(["Still to do"]);
  });

  test("returns nothing when there are no sessions", () => {
    expect(rankTodaysSessions([], TODAY, TZ)).toEqual([]);
  });

  test("keeps the whole session so the caller can show it", () => {
    const session = { id: "s1", assignmentTitle: "Essay draft", status: "SCHEDULED" as const, hours: 2 };
    const [first] = rankTodaysSessions(
      [{ session, points: 40, dueAt: dueOn("2026-11-15") }],
      TODAY,
      TZ,
    );
    expect(first.session).toBe(session);
  });
});
