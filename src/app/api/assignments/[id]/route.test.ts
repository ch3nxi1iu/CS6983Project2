// @vitest-environment node
// Route tests for PATCH /api/assignments/[id] (US-07, #13; title and due date
// added in US-14, #20) and DELETE /api/assignments/[id] (US-14, #20). They call
// the handlers directly against the test database with a real session cookie
// (see src/app/api/plan/route.test.ts for why only the cookie store is replaced).
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
  startOfDayInDays,
} from "@/test/work-plan-fixtures";
import { toDateKey } from "@/lib/planner/availability";

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

import { DELETE, PATCH } from "@/app/api/assignments/[id]/route";

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

function del(id: string) {
  const request = new Request(`http://localhost:3000/api/assignments/${id}`, { method: "DELETE" });
  return DELETE(request, { params: Promise.resolve({ id }) });
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

describe("PATCH /api/assignments/[id] with title and due date (#20)", () => {
  test("saves only the fields sent and rebuilds the plan", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });
    const newDueDate = toDateKey(dueInDays(6));

    const res = await patch(
      assignment.id,
      JSON.stringify({ title: " Final essay ", dueDate: newDueDate }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.assignment).toEqual({
      id: assignment.id,
      title: "Final essay",
      dueAt: `${newDueDate}T23:59:00.000Z`,
    });
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(saved.title).toBe("Final essay");
    expect(saved.dueAt.toISOString()).toBe(`${newDueDate}T23:59:00.000Z`);
    expect(saved.estimatedHours).toBe(3);
    // The plan was rebuilt: all 3 hours are scheduled, none after the new due date.
    const scheduled = await prisma.workSession.findMany({
      where: { userId, assignmentId: assignment.id, status: "SCHEDULED" },
    });
    expect(scheduled.reduce((sum, s) => sum + s.hours, 0)).toBe(3);
    for (const session of scheduled) {
      expect(toDateKey(session.startAt) <= newDueDate).toBe(true);
    }
  });

  // One bad field stops the whole edit, so the valid title isn't saved either.
  test.each([
    ["an empty title", { title: "" }],
    ["a title longer than 120 characters", { title: "T".repeat(121) }],
    ["a due date that doesn't exist", { title: "Renamed", dueDate: "2026-02-30" }],
    ["more than 100 hours", { title: "Renamed", estimatedHours: 101 }],
    ["only fields that can't be edited", { courseCode: "CS 1" }],
  ])("returns 400 VALIDATION_ERROR and saves nothing for %s", async (_label, input) => {
    const userId = await signIn();
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });

    const res = await patch(assignment.id, JSON.stringify(input));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(saved.title).toBe("Essay");
    expect(saved.dueAt).toEqual(assignment.dueAt);
    expect(saved.estimatedHours).toBe(3);
  });

  test("returns 404 and keeps the title of another user's assignment", async () => {
    await signIn();
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(10),
      estimatedHours: 4,
    });

    const res = await patch(theirs.id, JSON.stringify({ title: "Mine now" }));

    expect(res.status).toBe(404);
    const saved = await prisma.assignment.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(saved.title).toBe("Theirs");
  });
});

describe("DELETE /api/assignments/[id]", () => {
  test("returns 401 and deletes nothing when signed out", async () => {
    const userId = await createTestUser();
    createdUserIds.push(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });

    const res = await del(assignment.id);

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await prisma.assignment.findUnique({ where: { id: assignment.id } })).not.toBeNull();
  });

  test("returns 404 NOT_FOUND and keeps an assignment that belongs to another user", async () => {
    await signIn();
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    const theirs = await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(10),
      estimatedHours: 4,
    });

    const res = await del(theirs.id);

    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await prisma.assignment.findUnique({ where: { id: theirs.id } })).not.toBeNull();
  });

  test("returns 404 NOT_FOUND for an assignment that does not exist", async () => {
    await signIn();
    const res = await del("no-such-assignment");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  test("returns 204, deletes the assignment with its sessions, and rebuilds the plan", async () => {
    const userId = await signIn();
    await setStudyHours(userId);
    const doomed = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });
    const kept = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Project",
      dueAt: dueInDays(8),
      estimatedHours: 2,
    });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: doomed.id, startAt: startOfDayInDays(1), hours: 2, status: "SCHEDULED" },
        { userId, assignmentId: doomed.id, startAt: startOfDayInDays(0), hours: 1, status: "DONE" },
      ],
    });

    const res = await del(doomed.id);

    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await prisma.assignment.findUnique({ where: { id: doomed.id } })).toBeNull();
    expect(await prisma.workSession.count({ where: { assignmentId: doomed.id } })).toBe(0);
    // The rebuilt plan schedules the assignment that is left.
    const scheduled = await prisma.workSession.findMany({
      where: { userId, assignmentId: kept.id, status: "SCHEDULED" },
    });
    expect(scheduled.reduce((sum, s) => sum + s.hours, 0)).toBe(2);
  });

  test("still deletes before study hours are set; there's just no plan to rebuild", async () => {
    const userId = await signIn();
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6983",
      title: "Essay",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });

    const res = await del(assignment.id);

    expect(res.status).toBe(204);
    expect(await prisma.assignment.findUnique({ where: { id: assignment.id } })).toBeNull();
  });
});
