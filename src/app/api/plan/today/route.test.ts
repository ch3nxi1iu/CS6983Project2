// @vitest-environment node
// Route tests for GET /api/plan/today (US-12, #18). Same setup as
// src/app/api/plan/route.test.ts: real session JWTs and real API keys, with
// only next/headers' cookie store replaced.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey } from "@/lib/api-keys";
import { toDateKey } from "@/lib/planner/availability";
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

import { GET } from "@/app/api/plan/today/route";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function getToday(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost:3000/api/plan/today", { headers }));
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("GET /api/plan/today", () => {
  test("returns 401 with the UNAUTHORIZED error shape with no credentials", async () => {
    const res = await getToday();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("returns 409 AVAILABILITY_NOT_SET when study hours have not been saved", async () => {
    const userId = await newUser();
    await createSession(userId);

    const res = await getToday();
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("AVAILABILITY_NOT_SET");
  });

  test("returns only today's sessions, with the task, course, hours and status", async () => {
    const userId = await newUser();
    await createSession(userId);
    await setStudyHours(userId);
    const assignment = await createAssignment(userId, {
      courseCode: "CS 6120",
      title: "Homework 3",
      dueAt: dueInDays(10),
      estimatedHours: 3,
    });
    await prisma.workSession.createMany({
      data: [
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(0), hours: 2, status: "SCHEDULED" },
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(0), hours: 1, status: "DONE" },
        { userId, assignmentId: assignment.id, startAt: startOfDayInDays(1), hours: 2, status: "SCHEDULED" },
      ],
    });

    const res = await getToday();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe(toDateKey(new Date()));
    expect(body.sessions).toHaveLength(2);
    expect(body.sessions.map((s: { status: string }) => s.status).sort()).toEqual([
      "DONE",
      "SCHEDULED",
    ]);
    expect(body.sessions[0]).toMatchObject({
      assignmentId: assignment.id,
      assignmentTitle: "Homework 3",
      courseCode: "CS 6120",
      date: toDateKey(new Date()),
    });
    expect(body.sessions[0]).toHaveProperty("id");
    expect(body.sessions[0]).toHaveProperty("hours");
  });

  test("accepts a Bearer API key", async () => {
    const userId = await newUser();
    await setStudyHours(userId, NO_STUDY_HOURS);
    const { key } = await createApiKey(userId, "Script");

    const res = await getToday({ Authorization: `Bearer ${key}` });
    expect(res.status).toBe(200);
    expect((await res.json()).sessions).toEqual([]);
  });
});
