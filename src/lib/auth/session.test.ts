// @vitest-environment node
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession, getSession, requireUser, clearSession } from "@/lib/auth/session";
import { verifySessionToken } from "@/lib/auth/jwt";

const createdUserIds: string[] = [];

async function createUser() {
  const user = await prisma.user.create({
    data: {
      email: `session-${crypto.randomUUID()}@test.local`,
      passwordHash: "dummy-hash",
    },
  });
  createdUserIds.push(user.id);
  return user;
}

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("session helpers", () => {
  test("createSession signs JWT with 7-day expiry and sets httpOnly cookie", async () => {
    const user = await createUser();
    const token = await createSession(user.id);

    expect(token).toBeDefined();
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe(user.id);

    const session = await getSession();
    expect(session?.userId).toBe(user.id);
  });

  test("clearSession removes the session cookie", async () => {
    const user = await createUser();
    await createSession(user.id);
    expect((await getSession())?.userId).toBe(user.id);

    await clearSession();
    expect(await getSession()).toBeNull();
  });

  test("requireUser returns the user record from the database", async () => {
    const user = await createUser();
    await createSession(user.id);

    const loggedInUser = await requireUser();
    expect(loggedInUser.id).toBe(user.id);
    expect(loggedInUser.email).toBe(user.email);
  });
});
