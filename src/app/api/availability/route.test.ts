// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { getAvailabilitySettings } from "@/lib/availability";
import { DEFAULT_WEEKLY_HOURS } from "@/lib/planner/availability";
import { GET, PUT } from "@/app/api/availability/route";

// Stands in for the request's cookie store so the real session helpers run.
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

async function createUser() {
  const user = await prisma.user.create({
    data: { email: `avail-route-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
  });
  createdUserIds.push(user.id);
  return user.id;
}

let userId: string;

beforeEach(async () => {
  cookieJar.clear();
  userId = await createUser();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

function putRequest(body: string) {
  return new Request("http://localhost:3000/api/availability", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/availability", () => {
  test("returns 401 in the error shape when signed out", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  test("returns the prefilled defaults, marked as not set, for a new user", async () => {
    await createSession(userId);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      weeklyHours: DEFAULT_WEEKLY_HOURS,
      isSet: false,
      unavailableDates: [],
    });
  });
});

describe("PUT /api/availability", () => {
  test("returns 401 and saves nothing when signed out", async () => {
    const res = await PUT(putRequest(JSON.stringify(DEFAULT_WEEKLY_HOURS)));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await prisma.availability.count({ where: { userId } })).toBe(0);
  });

  test("saves every day's hours and returns them", async () => {
    await createSession(userId);
    const hours = { ...DEFAULT_WEEKLY_HOURS, monday: 5.5, sunday: 0 };

    const res = await PUT(putRequest(JSON.stringify(hours)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ weeklyHours: hours });

    const settings = await getAvailabilitySettings(userId);
    expect(settings.weeklyHours).toEqual(hours);
    expect(settings.isSet).toBe(true);
  });

  test("rejects hours above 12 with VALIDATION_ERROR and saves nothing", async () => {
    await createSession(userId);
    const res = await PUT(putRequest(JSON.stringify({ ...DEFAULT_WEEKLY_HOURS, monday: 13 })));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(await prisma.availability.count({ where: { userId } })).toBe(0);
  });

  test("rejects hours that are not in half-hour steps", async () => {
    await createSession(userId);
    const res = await PUT(putRequest(JSON.stringify({ ...DEFAULT_WEEKLY_HOURS, friday: 2.25 })));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("rejects a body that is not JSON with VALIDATION_ERROR", async () => {
    await createSession(userId);
    const res = await PUT(putRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});
