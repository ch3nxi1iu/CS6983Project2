// @vitest-environment node
// Route tests for POST /api/work-sessions/[id]/complete (US-12, #18). Same setup
// as src/app/api/plan/route.test.ts: real session JWTs and real API keys, with
// only next/headers' cookie store replaced.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import {
  createAssignment,
  createTestUser,
  deleteTestUsers,
  dueInDays,
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

import { POST } from "@/app/api/work-sessions/[id]/complete/route";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

async function createSessionFor(userId: string, status: "SCHEDULED" | "MISSED" = "SCHEDULED") {
  const assignment = await createAssignment(userId, {
    courseCode: "CS 6120",
    title: "Homework 5",
    dueAt: dueInDays(5),
    estimatedHours: 2,
  });
  return prisma.workSession.create({
    data: { userId, assignmentId: assignment.id, startAt: startOfDayInDays(0), hours: 2, status },
  });
}

function complete(id: string, headers: Record<string, string> = {}) {
  const request = new Request(`http://localhost:3000/api/work-sessions/${id}/complete`, {
    method: "POST",
    headers,
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("POST /api/work-sessions/[id]/complete", () => {
  test("returns 401 with the UNAUTHORIZED error shape with no credentials", async () => {
    const userId = await newUser();
    const session = await createSessionFor(userId);

    const res = await complete(session.id);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe("SCHEDULED");
  });

  test("marks the user's own session DONE in the database and returns it", async () => {
    const userId = await newUser();
    await createSession(userId);
    const session = await createSessionFor(userId);

    const res = await complete(session.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.session).toMatchObject({
      id: session.id,
      assignmentTitle: "Homework 5",
      courseCode: "CS 6120",
      status: "DONE",
      hours: 2,
    });
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe("DONE");
  });

  test("returns 404 NOT_FOUND and changes nothing for another user's session", async () => {
    const ownerId = await newUser();
    const session = await createSessionFor(ownerId);
    const intruderId = await newUser();
    await createSession(intruderId);

    const res = await complete(session.id);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe("SCHEDULED");
  });

  test("returns 404 NOT_FOUND for a session id that does not exist", async () => {
    const userId = await newUser();
    await createSession(userId);

    const res = await complete("does-not-exist");
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  test("marks a session DONE when called with a Bearer API key", async () => {
    const userId = await newUser();
    const session = await createSessionFor(userId, "MISSED");
    const { key } = await createApiKey(userId, "Script");

    const res = await complete(session.id, { Authorization: `Bearer ${key}` });
    expect(res.status).toBe(200);
    expect((await res.json()).session.status).toBe("DONE");
  });

  test("returns 401 for a Bearer API key that has been revoked", async () => {
    const userId = await newUser();
    const session = await createSessionFor(userId);
    const { key, apiKey } = await createApiKey(userId, "Revoked");
    await revokeApiKey(userId, apiKey.id);

    const res = await complete(session.id, { Authorization: `Bearer ${key}` });
    expect(res.status).toBe(401);
    const row = await prisma.workSession.findUniqueOrThrow({ where: { id: session.id } });
    expect(row.status).toBe("SCHEDULED");
  });
});
