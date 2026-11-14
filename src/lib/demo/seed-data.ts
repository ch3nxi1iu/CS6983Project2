// Sample data for demo mode (US-04, #10). Pure: dates are placed relative to
// `now`, so the demo always shows the coming weeks and never goes stale.
// The courses are made up ("DEMO" codes) and aren't the mockup's sample data.

import {
  addDays,
  DEFAULT_WEEKLY_HOURS,
  dateKeyToDate,
  type WeeklyHours,
} from "@/lib/planner/availability";
import { startOfWeek, toLocalDateKey } from "@/lib/planner/forecast";
import type { AssignmentKind } from "@/lib/planner/work-plan";

export type DemoAssignment = {
  title: string;
  dueAt: Date;
  points: number;
  estimatedHours: number;
  kind: AssignmentKind;
  submitted: boolean;
};

export type DemoCourse = { code: string; name: string; assignments: DemoAssignment[] };

export type DemoData = {
  weeklyHours: WeeklyHours;
  unavailableDates: { date: string; reason: string }[];
  courses: DemoCourse[];
};

// [week, day (0=Mon), hours, title, points, kind, submitted?]
type Plan = [number, number, number, string, number, AssignmentKind, boolean?];

const COURSE_PLANS: { code: string; name: string; plan: Plan[] }[] = [
  {
    code: "DEMO 5010",
    name: "Database Systems",
    plan: [
      [0, 1, 3, "SQL warm-up quiz", 10, "HOMEWORK", true],
      [0, 3, 6, "Schema design homework", 50, "HOMEWORK"],
      [1, 2, 8, "Query optimization project", 100, "PROJECT"],
      [3, 4, 12, "Final project report", 150, "PROJECT"],
    ],
  },
  {
    code: "DEMO 5220",
    name: "Human-Computer Interaction",
    plan: [
      [0, 4, 4, "Interview notes", 20, "HOMEWORK"],
      [1, 3, 6, "Prototype critique", 40, "HOMEWORK"],
      [2, 2, 5, "Usability test plan", 40, "PROJECT"],
    ],
  },
  {
    code: "DEMO 6300",
    name: "Distributed Systems",
    plan: [
      [1, 4, 7, "Raft lab, part 1", 80, "PROJECT"],
      [2, 4, 3, "Reading response", 15, "READING"],
      [3, 2, 4, "Raft lab, part 2", 80, "PROJECT"],
    ],
  },
  {
    code: "DEMO 6120",
    name: "Research Methods",
    plan: [
      [1, 0, 5, "Literature review draft", 60, "HOMEWORK"],
      [3, 0, 2, "Peer review", 10, "READING"],
    ],
  },
];

function dueAt(weekStart: string, week: number, day: number): Date {
  const date = dateKeyToDate(addDays(weekStart, week * 7 + day));
  date.setUTCHours(23, 59, 0, 0);
  return date;
}

/**
 * Week 1 (next week) is the crunch week: 26h of work against 18h of study
 * time, because its Saturday is marked unavailable.
 */
export function buildDemoData(now: Date): DemoData {
  const weekStart = startOfWeek(toLocalDateKey(now));
  return {
    weeklyHours: { ...DEFAULT_WEEKLY_HOURS },
    unavailableDates: [{ date: addDays(weekStart, 7 + 5), reason: "Family visit" }],
    courses: COURSE_PLANS.map(({ code, name, plan }) => ({
      code,
      name,
      assignments: plan.map(
        ([week, day, estimatedHours, title, points, kind, submitted = false]) => ({
          title,
          dueAt: dueAt(weekStart, week, day),
          points,
          estimatedHours,
          kind,
          submitted,
        }),
      ),
    })),
  };
}
