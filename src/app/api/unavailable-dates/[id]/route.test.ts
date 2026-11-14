// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { addUnavailableDate, getAvailabilitySettings } from "@/lib/availability";
import { DELETE } from "@/app/api/unavailable-dates/[id]/route";

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
    data: { email: `unavail-delete-${crypto.randomUUID()}@test.local`, passwordHash: "x" },
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

function deleteRequest(id: string) {
  return {
    request: new Request(`http://localhost:3000/api/unavailable-dates/${id}`, {
      method: "DELETE",
    }),
    context: { params: Promise.resolve({ id }) },
  };
}

describe("DELETE /api/unavailable-dates/[id]", () => {
  test("returns 401 and removes nothing when signed out", async () => {
    const added = await addUnavailableDate(userId, { date: "2026-11-20" });
    if (!added.ok) throw new Error("setup failed");

    const { request, context } = deleteRequest(added.value.id);
    const res = await DELETE(request, context);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect((await getAvailabilitySettings(userId)).unavailableDates).toHaveLength(1);
  });

  test("removes the user's own date and returns 204", async () => {
    await createSession(userId);
    const added = await addUnavailableDate(userId, { date: "2026-11-20" });
    if (!added.ok) throw new Error("setup failed");

    const { request, context } = deleteRequest(added.value.id);
    const res = await DELETE(request, context);
    expect(res.status).toBe(204);
    expect((await getAvailabilitySettings(userId)).unavailableDates).toEqual([]);
  });

  test("returns 404 NOT_FOUND for another user's date and leaves it alone", async () => {
    const otherUserId = await createUser();
    const added = await addUnavailableDate(otherUserId, { date: "2026-11-20" });
    if (!added.ok) throw new Error("setup failed");

    await createSession(userId);
    const { request, context } = deleteRequest(added.value.id);
    const res = await DELETE(request, context);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect((await getAvailabilitySettings(otherUserId)).unavailableDates).toHaveLength(1);
  });

  test("returns 404 NOT_FOUND for an id that does not exist", async () => {
    await createSession(userId);
    const { request, context } = deleteRequest("does-not-exist");
    const res = await DELETE(request, context);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });
});
