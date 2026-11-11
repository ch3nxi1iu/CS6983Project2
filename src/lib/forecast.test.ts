// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { addUnavailableDate, saveWeeklyHours } from "@/lib/availability";
import { getForecastForUser } from "@/lib/forecast";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";

const NOW = new Date("2026-11-18T15:00:00Z");
const createdUserIds: string[] = [];
let userId: string;

async function createUserWithCourse(code = "CS 5800") {
  const user = await prisma.user.create({
    data: {
      email: `forecast-${crypto.randomUUID()}@test.local`,
      passwordHash: "x",
      courses: { create: { code, name: "Algorithms" } },
    },
    include: { courses: true },
  });
  createdUserIds.push(user.id);
  return { userId: user.id, courseId: user.courses[0].id };
}

async function addAssignment(courseId: string, hours: number, dueAt: string, submitted = false) {
  await prisma.assignment.create({
    data: { courseId, title: `Task ${hours}h`, dueAt: new Date(dueAt), estimatedHours: hours, submitted },
  });
}

let courseId: string;

beforeEach(async () => {
  ({ userId, courseId } = await createUserWithCourse());
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("getForecastForUser", () => {
  test("uses the user's own assignments and skips submitted ones", async () => {
    await addAssignment(courseId, 6, "2026-11-19T12:00:00Z");
    await addAssignment(courseId, 9, "2026-11-19T12:00:00Z", true);
    const other = await createUserWithCourse();
    await addAssignment(other.courseId, 40, "2026-11-19T12:00:00Z");

    const weeks = await getForecastForUser(userId, { now: NOW });
    expect(weeks).toHaveLength(4);
    expect(weeks[0].workHours).toBe(6);
    expect(weeks[0].byCourse[0].courseCode).toBe("CS 5800");
  });

  test("uses the prefilled default hours until availability is saved", async () => {
    const [week] = await getForecastForUser(userId, { now: NOW });
    expect(week.availableHours).toBe(22);
  });

  test("recalculates after availability changes", async () => {
    await addAssignment(courseId, 15, "2026-11-19T12:00:00Z");
    expect((await getForecastForUser(userId, { now: NOW }))[0].isCrunch).toBe(false);

    await saveWeeklyHours(userId, { ...DEFAULT_WEEKLY_HOURS, saturday: 0, sunday: 0 });
    await addUnavailableDate(userId, { date: "2026-11-16" });

    const [week] = await getForecastForUser(userId, { now: NOW });
    expect(week.availableHours).toBe(11);
    expect(week.isCrunch).toBe(true);
  });

  test("recalculates after assignments change, such as a sync", async () => {
    await addAssignment(courseId, 30, "2026-11-26T12:00:00Z");
    expect((await getForecastForUser(userId, { now: NOW }))[1].isCrunch).toBe(true);
  });
});
