// @vitest-environment node
// Integration tests for src/lib/work-plan.ts (US-07, #13).
// Runs against the real database; each test cleans up its own rows.

import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { getWorkPlanForUser, regeneratePlanForUser, updateEstimatedHours } from "@/lib/work-plan";

const createdUserIds: string[] = [];

async function createUser() {
  const user = await prisma.user.create({
    data: { email: `work-plan-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  return user.id;
}

async function setAvailability(userId: string) {
  await prisma.availability.create({
    data: {
      userId,
      monday: 4,
      tuesday: 4,
      wednesday: 4,
      thursday: 4,
      friday: 4,
      saturday: 4,
      sunday: 4,
    },
  });
}

async function createCourseWithAssignment(
  userId: string,
  dueAt: Date,
  estimatedHours: number,
  kind: "HOMEWORK" | "PROJECT" | "EXAM" | "READING" | "OTHER" = "HOMEWORK",
) {
  const course = await prisma.course.create({
    data: { userId, code: `C-${crypto.randomUUID().slice(0, 6)}`, name: "Test Course" },
  });
  const assignment = await prisma.assignment.create({
    data: { courseId: course.id, title: "Test Assignment", dueAt, estimatedHours, kind },
  });
  return { course, assignment };
}

let userId: string;
// now = Monday 2026-11-16
const NOW = new Date("2026-11-16T08:00:00Z");

beforeEach(async () => {
  userId = await createUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("regeneratePlanForUser", () => {
  test("returns a needs-availability result when the user has not set study hours", async () => {
    const result = await regeneratePlanForUser(userId, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("availability_not_set");
    }
  });

  test("returns empty sessions and no at-risk items when there are no assignments", async () => {
    await setAvailability(userId);
    const result = await regeneratePlanForUser(userId, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessions).toEqual([]);
      expect(result.atRisk).toEqual([]);
    }
  });

  test("creates SCHEDULED sessions in the database for unsubmitted assignments", async () => {
    await setAvailability(userId);
    const dueAt = new Date("2026-11-21T23:59:00Z"); // Sat, 5 days away
    await createCourseWithAssignment(userId, dueAt, 4);

    const result = await regeneratePlanForUser(userId, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessions.length).toBeGreaterThan(0);
    }

    // Verify sessions are in the database
    const dbSessions = await prisma.workSession.findMany({ where: { userId, status: "SCHEDULED" } });
    expect(dbSessions.length).toBeGreaterThan(0);
  });

  test("replaces existing SCHEDULED sessions but keeps DONE and MISSED ones", async () => {
    await setAvailability(userId);
    const dueAt = new Date("2026-11-21T23:59:00Z");
    const { assignment } = await createCourseWithAssignment(userId, dueAt, 2);

    // Create one DONE and one MISSED session manually
    await prisma.workSession.create({
      data: {
        userId,
        assignmentId: assignment.id,
        startAt: new Date("2026-11-14T10:00:00Z"),
        hours: 1,
        status: "DONE",
      },
    });
    await prisma.workSession.create({
      data: {
        userId,
        assignmentId: assignment.id,
        startAt: new Date("2026-11-15T10:00:00Z"),
        hours: 1,
        status: "MISSED",
      },
    });
    // Also create a SCHEDULED session that should be replaced
    const oldScheduled = await prisma.workSession.create({
      data: {
        userId,
        assignmentId: assignment.id,
        startAt: new Date("2026-11-16T10:00:00Z"),
        hours: 2,
        status: "SCHEDULED",
      },
    });

    await regeneratePlanForUser(userId, NOW);

    const all = await prisma.workSession.findMany({ where: { userId } });
    const done = all.filter((s) => s.status === "DONE");
    const missed = all.filter((s) => s.status === "MISSED");
    expect(done.length).toBe(1);
    expect(missed.length).toBe(1);

    // The old SCHEDULED session is gone, not just shadowed by new rows.
    expect(await prisma.workSession.findUnique({ where: { id: oldScheduled.id } })).toBeNull();
    // What remains as SCHEDULED is exactly the new plan for the 2h assignment.
    const scheduled = all.filter((s) => s.status === "SCHEDULED");
    expect(scheduled.reduce((sum, s) => sum + s.hours, 0)).toBe(2);
  });

  test("respects unavailable dates set by the user", async () => {
    await setAvailability(userId);
    // Mark all days except Nov 20 (Thu) unavailable
    const datesExceptNov20 = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((d) => ({
      userId,
      date: new Date(`${d}T00:00:00Z`),
    }));
    await prisma.unavailableDate.createMany({ data: datesExceptNov20 });

    const dueAt = new Date("2026-11-21T23:59:00Z");
    await createCourseWithAssignment(userId, dueAt, 2); // 2h, fits on Nov 20

    const result = await regeneratePlanForUser(userId, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Only sessions on Nov 20 (the one available day before the Nov 21 due date - bufferDays)
      for (const s of result.sessions) {
        expect(["2026-11-20"]).toContain(s.date);
      }
    }
  });
});

describe("updateEstimatedHours", () => {
  test("updates estimatedHours on an assignment that belongs to the user", async () => {
    const dueAt = new Date("2026-11-25T23:59:00Z");
    const { assignment } = await createCourseWithAssignment(userId, dueAt, 4);

    const result = await updateEstimatedHours(userId, assignment.id, 8);
    expect(result.ok).toBe(true);

    const updated = await prisma.assignment.findUnique({ where: { id: assignment.id } });
    expect(updated?.estimatedHours).toBe(8);
  });

  test("returns NOT_FOUND when the assignment doesn't exist", async () => {
    const result = await updateEstimatedHours(userId, "nonexistent-id", 5);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("returns NOT_FOUND when the assignment belongs to a different user", async () => {
    // Create a second user with an assignment
    const otherId = await createUser();
    const dueAt = new Date("2026-11-25T23:59:00Z");
    const { assignment } = await createCourseWithAssignment(otherId, dueAt, 4);

    // Try to update from userId (a different user)
    const result = await updateEstimatedHours(userId, assignment.id, 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });

  test("returns VALIDATION_ERROR for invalid hours (negative)", async () => {
    const dueAt = new Date("2026-11-25T23:59:00Z");
    const { assignment } = await createCourseWithAssignment(userId, dueAt, 4);

    const result = await updateEstimatedHours(userId, assignment.id, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  test("returns VALIDATION_ERROR for zero hours", async () => {
    const dueAt = new Date("2026-11-25T23:59:00Z");
    const { assignment } = await createCourseWithAssignment(userId, dueAt, 4);

    const result = await updateEstimatedHours(userId, assignment.id, 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("getWorkPlanForUser", () => {
  test("returns a needs-availability result when the user has not set study hours", async () => {
    const result = await getWorkPlanForUser(userId, NOW);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("availability_not_set");
    }
  });

  test("returns only sessions from today through the next 6 days, with title and course code", async () => {
    await setAvailability(userId);
    const assignment = await prisma.assignment.create({
      data: {
        course: { create: { userId, code: "CS 6120", name: "NLP" } },
        title: "Homework 3",
        dueAt: new Date("2026-11-30T23:59:00Z"),
        estimatedHours: 2,
      },
    });
    const day = (dateKey: string) => new Date(`${dateKey}T00:00:00Z`);
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: assignment.id, startAt: day("2026-11-16"), hours: 1, status: "DONE" },
        { userId, assignmentId: assignment.id, startAt: day("2026-11-17"), hours: 1, status: "MISSED" },
        { userId, assignmentId: assignment.id, startAt: day("2026-11-22"), hours: 2, status: "SCHEDULED" },
        // Outside the window: 7 days after today, and yesterday.
        { userId, assignmentId: assignment.id, startAt: day("2026-11-23"), hours: 2, status: "SCHEDULED" },
        { userId, assignmentId: assignment.id, startAt: day("2026-11-15"), hours: 2, status: "DONE" },
      ],
    });

    const result = await getWorkPlanForUser(userId, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sessions.map((s) => [s.date, s.status])).toEqual([
        ["2026-11-16", "DONE"],
        ["2026-11-17", "MISSED"],
        ["2026-11-22", "SCHEDULED"],
      ]);
      expect(result.sessions[0]).toMatchObject({
        assignmentId: assignment.id,
        assignmentTitle: "Homework 3",
        courseCode: "CS 6120",
        hours: 1,
      });
    }
  });

  test("returns at-risk assignments with their title, course code and hours short", async () => {
    await setAvailability(userId);
    // Due Wed Nov 18 with a one-day buffer, so work must finish by Tue Nov 17.
    // Mon Nov 16 and Tue Nov 17 offer 4h each: 8h of room for a 30h estimate, so 22h is short.
    const assignment = await prisma.assignment.create({
      data: {
        course: { create: { userId, code: "CS 6120", name: "NLP" } },
        title: "Project 1",
        dueAt: new Date("2026-11-18T23:59:00Z"),
        estimatedHours: 30,
      },
    });

    const result = await getWorkPlanForUser(userId, NOW);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.atRisk).toEqual([
        {
          assignmentId: assignment.id,
          assignmentTitle: "Project 1",
          courseCode: "CS 6120",
          hoursShort: 30 - 8,
        },
      ]);
    }
  });

  test("does not write to the database", async () => {
    await setAvailability(userId);
    await createCourseWithAssignment(userId, new Date("2026-11-21T23:59:00Z"), 4);
    const before = await prisma.workSession.count({ where: { userId } });

    await getWorkPlanForUser(userId, NOW);

    expect(await prisma.workSession.count({ where: { userId } })).toBe(before);
  });
});
