// @vitest-environment node
// Route tests for /api/plan (US-07, #13). They call the handlers directly
// against the test database. The session is a real JWT created by createSession;
// only next/headers' cookie store is replaced, because there is no request here.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addDays, toDateKey } from "@/lib/planner/availability";
import {
  NO_STUDY_HOURS,
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
  setStudyHours,
  startOfDayInDays,
} from "@/test/work-plan-fixtures";

const cookieJar = new Map<string, { value: string; [key: string]: unknown }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string, options?: unknown) => {
      cookieJar.set(name, { value, ...(typeof options === "object" ? options : {}) });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { GET, POST } from "@/app/api/plan/route";

const createdUserIds: string[] = [];

/** Creates a user and signs them in by setting the session cookie. */
async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("GET /api/plan", () => {
  test("returns 401 with the UNAUTHORIZED error shape when signed out", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 409 AVAILABILITY_NOT_SET when study hours have not been saved", async () => {
    await signIn();
    const res = await GET();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("AVAILABILITY_NOT_SET");
  });

  test("returns sessions for the next 7 days with assignment title and course code, in date order", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 3",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(6), hours: 2, status: "SCHEDULED" },
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(0), hours: 1, status: "DONE" },
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(1), hours: 1, status: "MISSED" },
        // Day 7 is outside the window.
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(7), hours: 2, status: "SCHEDULED" },
      ],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessions.map((s: { status: string }) => s.status)).toEqual([
      "DONE",
      "MISSED",
      "SCHEDULED",
    ]);
    expect(body.sessions[0]).toMatchObject({
      assignmentId: assignment.id,
      assignmentTitle: "Homework 3",
      courseCode: "CS 6120",
      date: toDateKey(new Date()),
      hours: 1,
    });
    expect(body.sessions[2].date).toBe(addDays(toDateKey(new Date()), 6));
  });

  test("does not return another user's sessions", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const mine = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Mine",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });
    await prisma.workSession.create({
      data: { userId, assignmentId: mine.id, startAt: startOfDayInDays(2), hours: 2 },
    });

    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });
    await prisma.workSession.create({
      data: { userId: otherId, assignmentId: theirs.id, startAt: startOfDayInDays(2), hours: 2 },
    });

    const res = await GET();
    const body = await res.json();
    expect(body.sessions.map((s: { assignmentTitle: string }) => s.assignmentTitle)).toEqual([
      "Mine",
    ]);
  });

  test("returns at-risk assignments with hours short", async () => {
    const userId = await signIn();
    await setStudyHours(userId, NO_STUDY_HOURS);
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Project 1",
      dueAt: dueInDays(10),
      estimatedHours: 5,
    });

    const res = await GET();
    const body = await res.json();
    expect(body.atRisk).toHaveLength(1);
    expect(body.atRisk[0]).toMatchObject({
      assignmentTitle: "Project 1",
      courseCode: "CS 6120",
      hoursShort: 5,
    });
  });
});

describe("POST /api/plan", () => {
  test("returns 401 with the UNAUTHORIZED error shape when signed out", async () => {
    const res = await POST();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 409 AVAILABILITY_NOT_SET with the data layer's message when study hours are not set", async () => {
    const userId = await signIn();
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 1",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });

    const res = await POST();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toEqual({
      code: "AVAILABILITY_NOT_SET",
      message: "Set your study hours first.",
    });
  });

  test("regenerates the plan: saves SCHEDULED sessions and returns them with at-risk items", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 2",
      dueAt: dueInDays(10),
      estimatedHours: 4,
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = await res.json();

    const dbSessions = await prisma.workSession.findMany({
      where: { userId, status: "SCHEDULED" },
    });
    expect(dbSessions.reduce((sum, s) => sum + s.hours, 0)).toBe(4);
    expect(body.sessions.map((s: { id: string }) => s.id).sort()).toEqual(
      dbSessions.map((s) => s.id).sort(),
    );
    expect(body.sessions.reduce((sum: number, s: { hours: number }) => sum + s.hours, 0)).toBe(4);
    expect(body.atRisk).toEqual([]);
  });
});
