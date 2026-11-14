// @vitest-environment node
// Route tests for GET /api/tasks (US-12, #18). They call the handler directly
// against the test database. Signed-in requests use a real session JWT; API
// key requests use a real key from createApiKey. Only next/headers' cookie
// store is replaced, as in src/app/api/plan/route.test.ts.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { createAssignment, createTestUser, deleteTestUsers, dueInDays } from "@/test/work-plan-fixtures";

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

import { GET } from "@/app/api/tasks/route";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function getTasks(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost:3000/api/tasks", { headers }));
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("GET /api/tasks", () => {
  test("returns 401 with the UNAUTHORIZED error shape with no credentials", async () => {
    const res = await getTasks();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("returns the user's unsubmitted assignments with id, title, course code, dueAt, estimatedHours and kind", async () => {
    const userId = await newUser();
    await createSession(userId);
    const open = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Problem set 4",
      dueAt: dueInDays(3),
      estimatedHours: 2.5,
    });
    await prisma.assignment.update({ where: { id: open.id }, data: { kind: "HOMEWORK" } });
    const done = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Already submitted",
      dueAt: dueInDays(1),
      estimatedHours: 1,
    });
    await prisma.assignment.update({ where: { id: done.id }, data: { submitted: true } });

    const res = await getTasks();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toEqual([
      {
        id: open.id,
        title: "Problem set 4",
        courseCode: "CS 6120",
        dueAt: dueInDays(3).toISOString(),
        estimatedHours: 2.5,
        kind: "HOMEWORK",
      },
    ]);
  });

  test("does not return another user's assignments", async () => {
    const userId = await newUser();
    await createSession(userId);
    const otherId = await newUser();
    await createAssignment(otherId, {
      courseCode: "CS 1000",
      title: "Theirs",
      dueAt: dueInDays(3),
      estimatedHours: 2,
    });

    const body = await (await getTasks()).json();
    expect(body.tasks).toEqual([]);
  });

  test("accepts a Bearer API key and returns the key owner's tasks", async () => {
    const userId = await newUser();
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Via key",
      dueAt: dueInDays(3),
      estimatedHours: 2,
    });
    const { key } = await createApiKey(userId, "Script");

    const res = await getTasks({ Authorization: `Bearer ${key}` });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks.map((t: { title: string }) => t.title)).toEqual(["Via key"]);
  });

  test("returns 401 for a Bearer key that has been revoked", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Revoked");
    await revokeApiKey(userId, apiKey.id);

    const res = await getTasks({ Authorization: `Bearer ${key}` });
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });
});
