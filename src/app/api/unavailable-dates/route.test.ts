// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addUnavailableDate, getAvailabilitySettings } from "@/lib/availability";
import { POST } from "@/app/api/unavailable-dates/route";

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
    data: { email: `unavail-route-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
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

function postRequest(body: string) {
  return new Request("http://localhost:3000/api/unavailable-dates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/unavailable-dates", () => {
  test("returns 401 and saves nothing when signed out", async () => {
    const res = await POST(postRequest(JSON.stringify({ date: "2026-11-20" })));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect((await getAvailabilitySettings(userId)).unavailableDates).toEqual([]);
  });

  test("creates the date and returns it in the shape the settings component reads", async () => {
    await createSession(userId);
    const res = await POST(
      postRequest(JSON.stringify({ date: "2026-11-20", reason: "Interview" })),
    );
    expect(res.status).toBe(201);

    const item = await res.json();
    expect(item).toEqual({ id: expect.any(String), date: "2026-11-20", reason: "Interview" });
    expect((await getAvailabilitySettings(userId)).unavailableDates).toEqual([item]);
  });

  test("stores a missing reason as null", async () => {
    await createSession(userId);
    const res = await POST(postRequest(JSON.stringify({ date: "2026-11-21", reason: "" })));
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ date: "2026-11-21", reason: null });
  });

  test("rejects a date that is not a real YYYY-MM-DD day with VALIDATION_ERROR", async () => {
    await createSession(userId);
    const res = await POST(postRequest(JSON.stringify({ date: "not-a-date" })));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("rejects a body that is not JSON with VALIDATION_ERROR", async () => {
    await createSession(userId);
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("returns 409 CONFLICT when the date is already marked", async () => {
    await createSession(userId);
    await addUnavailableDate(userId, { date: "2026-11-20" });

    const res = await POST(postRequest(JSON.stringify({ date: "2026-11-20" })));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect((await getAvailabilitySettings(userId)).unavailableDates).toHaveLength(1);
  });
});
