// @vitest-environment node
// Route tests for GET /api/workload (US-12, #18). Same setup as
// src/app/api/plan/route.test.ts: real session JWTs and real API keys, with
// only next/headers' cookie store replaced.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey } from "@/lib/api-keys";
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

import { GET } from "@/app/api/workload/route";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function getWorkload(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost:3000/api/workload", { headers }));
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("GET /api/workload", () => {
  test("returns 401 with the UNAUTHORIZED error shape with no credentials", async () => {
    const res = await getWorkload();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("returns the weekly forecast with the estimated hours of open assignments", async () => {
    const userId = await newUser();
    await createSession(userId);
    await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Project 1",
      dueAt: dueInDays(10),
      estimatedHours: 5,
    });

    const res = await getWorkload();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weeks.length).toBeGreaterThan(0);
    expect(body.weeks[0]).toEqual(
      expect.objectContaining({
        weekStart: expect.any(String),
        workHours: expect.any(Number),
        availableHours: expect.any(Number),
        isCrunch: expect.any(Boolean),
        byCourse: expect.any(Array),
        assignments: expect.any(Array),
      }),
    );
    const totalWorkHours = body.weeks.reduce(
      (sum: number, week: { workHours: number }) => sum + week.workHours,
      0,
    );
    expect(totalWorkHours).toBe(5);
  });

  test("accepts a Bearer API key", async () => {
    const userId = await newUser();
    const { key } = await createApiKey(userId, "Script");

    const res = await getWorkload({ Authorization: `Bearer ${key}` });
    expect(res.status).toBe(200);
    expect((await res.json()).weeks.length).toBeGreaterThan(0);
  });
});
