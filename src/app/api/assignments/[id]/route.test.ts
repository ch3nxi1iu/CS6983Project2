// @vitest-environment node
// Route tests for PATCH /api/assignments/[id] (US-07, #13). They call the handler
// directly against the test database with a real session cookie (see
// src/app/api/plan/route.test.ts for why only the cookie store is replaced).
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import {
  NO_STUDY_HOURS,
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
  setStudyHours,
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

import { PATCH } from "@/app/api/assignments/[id]/route";

const createdUserIds: string[] = [];

async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

function patch(id: string, body: string) {
  const request = new Request(`http://localhost:3000/api/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return PATCH(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("PATCH /api/assignments/[id]", () => {
  test("returns 401 with the UNAUTHORIZED error shape when signed out", async () => {
    const res = await patch("any-id", JSON.stringify({ estimatedHours: 3 }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test.each([
    ["a body that is not JSON", "not json"],
    ["a missing estimatedHours field", JSON.stringify({})],
    ["a string estimatedHours", JSON.stringify({ estimatedHours: "4" })],
    ["zero hours", JSON.stringify({ estimatedHours: 0 })],
    ["negative hours", JSON.stringify({ estimatedHours: -1 })],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    const userId = await signIn();
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 1",
      dueAt: dueInDays(10),
      estimatedHours: 4,
    });

    const res = await patch(assignment.id, body);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");

    const unchanged = await prisma.assignment.findUnique({ where: { id: assignment.id } });
    expect(unchanged?.estimatedHours).toBe(4);
  });

  test("returns 404 NOT_FOUND for an assignment that belongs to another user", async () => {
    await signIn();
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(10),
      estimatedHours: 4,
    });

    const res = await patch(theirs.id, JSON.stringify({ estimatedHours: 9 }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");

    const unchanged = await prisma.assignment.findUnique({ where: { id: theirs.id } });
    expect(unchanged?.estimatedHours).toBe(4);
  });

  test("returns 404 NOT_FOUND for an assignment that does not exist", async () => {
    await signIn();
    const res = await patch("no-such-assignment", JSON.stringify({ estimatedHours: 3 }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  test("saves the new estimate and regenerates the plan around it", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Project 1",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });

    const res = await patch(assignment.id, JSON.stringify({ estimatedHours: 6 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignment).toEqual({ id: assignment.id, estimatedHours: 6 });
    expect(body.plan.atRisk).toEqual([]);
    expect(body.plan.sessions.reduce((sum: number, s: { hours: number }) => sum + s.hours, 0)).toBe(6);

    const updated = await prisma.assignment.findUnique({ where: { id: assignment.id } });
    expect(updated?.estimatedHours).toBe(6);
    const scheduled = await prisma.workSession.findMany({
      where: { userId, status: "SCHEDULED", assignmentId: assignment.id },
    });
    expect(scheduled.reduce((sum, s) => sum + s.hours, 0)).toBe(6);
  });

  test("saves the estimate and returns plan: null when study hours are not set yet", async () => {
    const userId = await signIn();
    await setStudyHours(userId, NO_STUDY_HOURS);
    await prisma.availability.delete({ where: { userId } });
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Reading 1",
      dueAt: dueInDays(10),
      estimatedHours: 2,
    });

    const res = await patch(assignment.id, JSON.stringify({ estimatedHours: 3 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignment.estimatedHours).toBe(3);
    expect(body.plan).toBeNull();
  });
});
