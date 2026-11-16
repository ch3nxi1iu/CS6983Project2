// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { saveWeeklyHours } from "@/lib/availability";
import { getForecastForUser } from "@/lib/forecast";
import { getTodaySessionsForUser } from "@/lib/api/public-data";
import { getWorkPlanForUser, regeneratePlanForUser } from "@/lib/work-plan";
import { buildDemoData } from "@/lib/demo/seed-data";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import { APP_TIME_ZONE } from "@/lib/time-zone";

// "Today" is the day in the app's time zone (Pacific by default), not in UTC.
// 03:00 UTC on Monday Nov 16 is 7pm on Sunday Nov 15 in Los Angeles: in UTC
// it's already the next day and the next week.
const NOW = new Date("2026-11-16T03:00:00Z");

const createdUserIds: string[] = [];
let userId: string;

beforeEach(async () => {
  const user = await prisma.user.create({
    data: { email: `app-tz-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  userId = user.id;
  await saveWeeklyHours(userId, DEFAULT_WEEKLY_HOURS);
  // More work than fits, so the planner fills every day from today on.
  await prisma.course.create({
    data: {
      userId,
      code: "CS 6983",
      name: "AI Coding",
      assignments: {
        create: {
          title: "Project 2",
          dueAt: new Date("2026-11-20T23:59:00Z"),
          estimatedHours: 20,
          kind: "PROJECT",
        },
      },
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("today in the app's time zone", () => {
  test("the app runs on Pacific time unless APP_TIME_ZONE is set", () => {
    expect(APP_TIME_ZONE).toBe(process.env.APP_TIME_ZONE || "America/Los_Angeles");
  });

  test("a rebuilt plan starts on the local day, not the UTC day", async () => {
    const plan = await regeneratePlanForUser(userId, NOW);
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.sessions.map((s) => s.date)).toContain("2026-11-15");
  });

  test("the stored plan's 7-day window starts on the local day", async () => {
    await regeneratePlanForUser(userId, NOW);
    const plan = await getWorkPlanForUser(userId, NOW);
    if (!plan.ok) throw new Error(plan.message);
    expect(plan.sessions[0].date).toBe("2026-11-15");
  });

  test("today's sessions are the local day's", async () => {
    await regeneratePlanForUser(userId, NOW);
    const today = await getTodaySessionsForUser(userId, NOW);
    if (!today.ok) throw new Error(today.error.message);
    expect(today.value.date).toBe("2026-11-15");
    expect(today.value.sessions.length).toBeGreaterThan(0);
  });

  test("the forecast starts on the local week", async () => {
    const weeks = await getForecastForUser(userId, { now: NOW });
    expect(weeks[0].weekStart).toBe("2026-11-09");
  });

  test("demo data is placed in the local week", () => {
    // The overloaded week is next week, with its Saturday unavailable.
    expect(buildDemoData(NOW).unavailableDates[0].date).toBe("2026-11-21");
  });
});
