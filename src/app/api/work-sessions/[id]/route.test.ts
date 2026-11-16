// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { regeneratePlanForUser } from "@/lib/work-plan";
import {
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
  setStudyHours,
} from "@/test/work-plan-fixtures";
import { PATCH } from "@/app/api/work-sessions/[id]/route";

// US-08 (#14): mark a planned session done or missed, or undo that, and the
// plan is rebuilt around what's left.

const cookieJar = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieJar.get(name),
    set: (name: string, value: string) => {
      cookieJar.set(name, { value });
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

const createdUserIds: string[] = [];
let userId: string;
let assignmentId: string;

beforeEach(async () => {
  cookieJar.clear();
  userId = await createTestUser();
  createdUserIds.push(userId);
  await setStudyHours(userId);
  const assignment = await createAssignment(userId, {
    courseCode: "CS 6983",
    title: "Final reflection",
    dueAt: dueInDays(6),
    estimatedHours: 6,
  });
  assignmentId = assignment.id;
  await regeneratePlanForUser(userId, new Date());
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

async function firstScheduled() {
  return prisma.workSession.findFirstOrThrow({
    where: { userId, assignmentId, status: "SCHEDULED" },
    orderBy: { startAt: "asc" },
  });
}

async function hoursWith(status: "SCHEDULED" | "DONE" | "MISSED") {
  const rows = await prisma.workSession.findMany({ where: { userId, assignmentId, status } });
  return rows.reduce((sum, row) => sum + row.hours, 0);
}

function patch(id: string, body: unknown) {
  return PATCH(
    new Request(`http://localhost:3000/api/work-sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

describe("PATCH /api/work-sessions/[id]", () => {
  test("returns 401 when signed out", async () => {
    const session = await firstScheduled();
    const res = await patch(session.id, { status: "MISSED" });
    expect(res.status).toBe(401);
  });

  test("marking a session missed keeps it and plans its hours again", async () => {
    await createSession(userId);
    const session = await firstScheduled();

    const res = await patch(session.id, { status: "MISSED" });

    expect(res.status).toBe(200);
    expect((await prisma.workSession.findUnique({ where: { id: session.id } }))?.status).toBe(
      "MISSED",
    );
    // Nothing was done, so all 6 hours are still planned on other sessions.
    expect(await hoursWith("SCHEDULED")).toBe(6);
  });

  test("marking a session done plans only the hours left", async () => {
    await createSession(userId);
    const session = await firstScheduled();

    const res = await patch(session.id, { status: "DONE" });

    expect(res.status).toBe(200);
    expect(await hoursWith("DONE")).toBe(session.hours);
    expect(await hoursWith("SCHEDULED")).toBe(6 - session.hours);
  });

  test("undo puts a done session's hours back into the plan", async () => {
    await createSession(userId);
    const session = await firstScheduled();
    await patch(session.id, { status: "DONE" });

    const res = await patch(session.id, { status: "SCHEDULED" });

    expect(res.status).toBe(200);
    expect(await hoursWith("DONE")).toBe(0);
    expect(await hoursWith("SCHEDULED")).toBe(6);
  });

  test("rejects a status that isn't DONE, MISSED or SCHEDULED", async () => {
    await createSession(userId);
    const session = await firstScheduled();

    const res = await patch(session.id, { status: "SKIPPED" });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("returns 404 for another user's session", async () => {
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    await createSession(otherId);
    const session = await firstScheduled();

    const res = await patch(session.id, { status: "MISSED" });

    expect(res.status).toBe(404);
    expect((await prisma.workSession.findUnique({ where: { id: session.id } }))?.status).toBe(
      "SCHEDULED",
    );
  });
});
