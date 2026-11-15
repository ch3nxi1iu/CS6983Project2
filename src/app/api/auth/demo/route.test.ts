// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { POST } from "@/app/api/auth/demo/route";

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

describe("POST /api/auth/demo", () => {
  test("opens a demo account, signs the visitor in, and returns no token", async () => {
    const res = await POST();
    expect(res.status).toBe(201);

    const body: unknown = await res.json();
    expect(body).toMatchObject({
      user: { name: "Demo student", isDemo: true },
    });
    const user = (body as { user: { id: string } }).user;
    expect(typeof user.id).toBe("string");
    expect(body).not.toHaveProperty("token");
    expect(JSON.stringify(body)).not.toMatch(/eyJ/);
    createdUserIds.push(user.id);

    const signedIn = await getCurrentUser();
    expect(signedIn?.id).toBe(user.id);
    expect(signedIn?.isDemo).toBe(true);

    expect(await prisma.course.count({ where: { userId: user.id } })).toBeGreaterThan(1);
    expect(await prisma.workSession.count({ where: { userId: user.id } })).toBeGreaterThan(0);
  });

  test("each Try the demo creates a separate account", async () => {
    const first = await POST();
    const second = await POST();
    const firstId = ((await first.json()) as { user: { id: string } }).user.id;
    const secondId = ((await second.json()) as { user: { id: string } }).user.id;
    createdUserIds.push(firstId, secondId);

    expect(firstId).not.toBe(secondId);
    expect(await prisma.course.count({ where: { userId: firstId } })).toBeGreaterThan(0);
    expect(await prisma.course.count({ where: { userId: secondId } })).toBeGreaterThan(0);
  });
});
