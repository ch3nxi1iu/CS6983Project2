// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { saveWeeklyHours } from "@/lib/availability";
import { addDays, DEFAULT_WEEKLY_HOURS, toDateKey } from "@/lib/planner/availability";
import { POST } from "@/app/api/assignments/route";

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

beforeEach(async () => {
  cookieJar.clear();
  const user = await prisma.user.create({
    data: { email: `assignments-route-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function postRequest(body: string) {
  return new Request("http://localhost:3000/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

const input = () => ({
  courseCode: "CS 6983",
  title: "Final reflection",
  dueDate: addDays(toDateKey(new Date()), 5),
  estimatedHours: 3,
});

describe("POST /api/assignments", () => {
  test("returns 401 and saves nothing when signed out", async () => {
    const res = await POST(postRequest(JSON.stringify(input())));

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await prisma.course.count({ where: { userId } })).toBe(0);
  });

  test("adds the assignment and plans it", async () => {
    await createSession(userId);
    await saveWeeklyHours(userId, DEFAULT_WEEKLY_HOURS);

    const res = await POST(postRequest(JSON.stringify(input())));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.assignment).toMatchObject({
      title: "Final reflection",
      courseCode: "CS 6983",
      estimatedHours: 3,
    });
    const sessions = await prisma.workSession.findMany({
      where: { userId, assignmentId: body.assignment.id },
    });
    expect(sessions.reduce((sum, s) => sum + s.hours, 0)).toBe(3);
  });

  test("still adds it before study hours are set; there's just no plan yet", async () => {
    await createSession(userId);

    const res = await POST(postRequest(JSON.stringify(input())));

    expect(res.status).toBe(201);
    expect(await prisma.workSession.count({ where: { userId } })).toBe(0);
  });

  test("rejects invalid input with VALIDATION_ERROR", async () => {
    await createSession(userId);

    const res = await POST(postRequest(JSON.stringify({ ...input(), estimatedHours: 0 })));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("rejects a body that isn't JSON", async () => {
    await createSession(userId);

    const res = await POST(postRequest("{not json"));

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
