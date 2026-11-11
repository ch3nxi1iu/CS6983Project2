// @vitest-environment node
import "dotenv/config";
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { createDemoAccount, resetDemoAccount } from "@/lib/demo/demo-account";
import { buildDemoData } from "@/lib/demo/seed-data";
import { getForecastForUser } from "@/lib/forecast";
import { saveWeeklyHours } from "@/lib/availability";

const NOW = new Date("2026-11-18T15:00:00Z");
const createdUserIds: string[] = [];

async function newDemo() {
  const id = await createDemoAccount(NOW);
  createdUserIds.push(id);
  return id;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

async function countRows(userId: string) {
  const [courses, assignments, unavailable] = await Promise.all([
    prisma.course.count({ where: { userId } }),
    prisma.assignment.count({ where: { course: { userId } } }),
    prisma.unavailableDate.count({ where: { userId } }),
  ]);
  return { courses, assignments, unavailable };
}

describe("createDemoAccount", () => {
  test("creates a demo user loaded with the seed data", async () => {
    const userId = await newDemo();
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.isDemo).toBe(true);

    const seed = buildDemoData(NOW);
    expect(await countRows(userId)).toEqual({
      courses: seed.courses.length,
      assignments: seed.courses.reduce((total, course) => total + course.assignments.length, 0),
      unavailable: seed.unavailableDates.length,
    });
    expect(await prisma.availability.count({ where: { userId } })).toBe(1);
  });

  test("its forecast shows at least one crunch week", async () => {
    const userId = await newDemo();
    const weeks = await getForecastForUser(userId, { now: NOW });
    expect(weeks.some((week) => week.isCrunch)).toBe(true);
  });

  test("each visitor gets their own isolated account", async () => {
    const first = await newDemo();
    const second = await newDemo();
    expect(first).not.toBe(second);
    await prisma.course.deleteMany({ where: { userId: first } });
    expect((await countRows(second)).courses).toBeGreaterThan(0);
  });
});

describe("resetDemoAccount", () => {
  test("restores the seed data after changes", async () => {
    const userId = await newDemo();
    const before = await countRows(userId);

    await prisma.course.deleteMany({ where: { userId } });
    await saveWeeklyHours(userId, {
      monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0,
    });

    expect(await resetDemoAccount(userId, NOW)).toBe(true);
    expect(await countRows(userId)).toEqual(before);
    const availability = await prisma.availability.findUniqueOrThrow({ where: { userId } });
    expect(availability.monday).toBe(buildDemoData(NOW).weeklyHours.monday);
  });

  test("refuses to touch a real (non-demo) user", async () => {
    const real = await prisma.user.create({
      data: {
        email: `real-${crypto.randomUUID()}@test.local`,
        passwordHash: "x",
        courses: { create: { code: "REAL 1", name: "Real course" } },
      },
    });
    createdUserIds.push(real.id);

    expect(await resetDemoAccount(real.id, NOW)).toBe(false);
    expect(await prisma.course.count({ where: { userId: real.id } })).toBe(1);
  });

  test("returns false for a user that doesn't exist", async () => {
    expect(await resetDemoAccount("no-such-user", NOW)).toBe(false);
  });
});
