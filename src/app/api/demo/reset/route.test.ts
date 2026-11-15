// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createDemoAccount } from "@/lib/demo/demo-account";
import { buildDemoData } from "@/lib/demo/seed-data";
import { POST } from "@/app/api/demo/reset/route";

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

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

function resetRequest(headers?: HeadersInit) {
  return new Request("http://localhost/api/demo/reset", { method: "POST", headers });
}

describe("POST /api/demo/reset", () => {
  test("returns 401 when signed out", async () => {
    const res = await POST(resetRequest());
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  test("returns 401 when the request has only a Bearer API key", async () => {
    const res = await POST(
      resetRequest({ Authorization: `Bearer ll_${"A".repeat(43)}` }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  test("returns 403 for a real account and leaves its data alone", async () => {
    const user = await prisma.user.create({
      data: {
        email: `real-${crypto.randomUUID()}@test.local`,
        passwordHash: "x",
        courses: { create: { code: "REAL 1", name: "Real course" } },
      },
    });
    createdUserIds.push(user.id);
    await createSession(user.id);

    const res = await POST(resetRequest());
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(await prisma.course.count({ where: { userId: user.id } })).toBe(1);
  });

  test("returns 204 and restores a demo account's courses", async () => {
    const userId = await createDemoAccount(new Date());
    createdUserIds.push(userId);
    await prisma.course.deleteMany({ where: { userId } });
    expect(await prisma.course.count({ where: { userId } })).toBe(0);
    await createSession(userId);

    const res = await POST(resetRequest());
    expect(res.status).toBe(204);

    const seed = buildDemoData(new Date());
    expect(await prisma.course.count({ where: { userId } })).toBe(seed.courses.length);
  });
});
