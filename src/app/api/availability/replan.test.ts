// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addUnavailableDate, saveWeeklyHours } from "@/lib/availability";
import { regeneratePlanForUser } from "@/lib/work-plan";
import {
  DEFAULT_WEEKLY_HOURS,
  WEEKDAYS,
  addDays,
  dateKeyToDate,
  toDateKey,
} from "@/lib/planner/availability";
import { PUT } from "@/app/api/availability/route";
import { POST } from "@/app/api/unavailable-dates/route";
import { DELETE } from "@/app/api/unavailable-dates/[id]/route";

// US-06 (#45): changing study hours or unavailable dates rebuilds the stored
// work plan, through the real routes.

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
    data: { email: `replan-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  userId = user.id;
  await createSession(userId);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function todayKey(): string {
  return toDateKey(new Date());
}

/**
 * One 40-hour project due in 8 days: more than the hours available, so the
 * planner puts a session on every day from today until the day before it's due.
 */
async function addBigProject(): Promise<void> {
  await prisma.course.create({
    data: {
      userId,
      code: "CS 6983",
      name: "AI Coding",
      assignments: {
        create: {
          title: "Project 2",
          dueAt: dateKeyToDate(addDays(todayKey(), 8)),
          estimatedHours: 40,
          kind: "PROJECT",
        },
      },
    },
  });
}

async function scheduledSessions() {
  const rows = await prisma.workSession.findMany({
    where: { userId, status: "SCHEDULED" },
    select: { startAt: true, hours: true },
  });
  return rows.map((row) => ({ date: toDateKey(row.startAt), hours: row.hours }));
}

/** Saves the default hours and builds the first plan, as the app does today. */
async function planWithDefaultHours(): Promise<void> {
  await saveWeeklyHours(userId, DEFAULT_WEEKLY_HOURS);
  await regeneratePlanForUser(userId, new Date());
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/availability", () => {
  test("rebuilds the stored plan with the new hours", async () => {
    await addBigProject();
    await planWithDefaultHours();
    expect((await scheduledSessions()).some((s) => s.hours === 2)).toBe(true);

    const oneHourEveryDay = Object.fromEntries(WEEKDAYS.map((day) => [day, 1]));
    const res = await PUT(
      jsonRequest("http://localhost:3000/api/availability", "PUT", oneHourEveryDay),
    );

    expect(res.status).toBe(200);
    const sessions = await scheduledSessions();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.hours <= 1)).toBe(true);
  });

  test("still saves when the user has no assignments", async () => {
    const res = await PUT(
      jsonRequest("http://localhost:3000/api/availability", "PUT", DEFAULT_WEEKLY_HOURS),
    );

    expect(res.status).toBe(200);
    expect(await scheduledSessions()).toEqual([]);
  });
});

describe("POST /api/unavailable-dates", () => {
  test("moves planned work off the newly unavailable date", async () => {
    await addBigProject();
    await planWithDefaultHours();
    const date = addDays(todayKey(), 2);
    expect((await scheduledSessions()).some((s) => s.date === date)).toBe(true);

    const res = await POST(
      jsonRequest("http://localhost:3000/api/unavailable-dates", "POST", {
        date,
        reason: "Travel",
      }),
    );

    expect(res.status).toBe(201);
    expect((await scheduledSessions()).some((s) => s.date === date)).toBe(false);
  });

  test("still saves the date before study hours are set", async () => {
    await addBigProject();
    const res = await POST(
      jsonRequest("http://localhost:3000/api/unavailable-dates", "POST", {
        date: addDays(todayKey(), 2),
      }),
    );

    expect(res.status).toBe(201);
    expect(await scheduledSessions()).toEqual([]);
  });
});

describe("DELETE /api/unavailable-dates/[id]", () => {
  test("plans work on the date again once it is available", async () => {
    await addBigProject();
    const date = addDays(todayKey(), 2);
    const added = await addUnavailableDate(userId, { date });
    if (!added.ok) throw new Error(added.error.message);
    await planWithDefaultHours();
    expect((await scheduledSessions()).some((s) => s.date === date)).toBe(false);

    const res = await DELETE(
      new Request(`http://localhost:3000/api/unavailable-dates/${added.value.id}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: added.value.id }) },
    );

    expect(res.status).toBe(204);
    expect((await scheduledSessions()).some((s) => s.date === date)).toBe(true);
  });
});
