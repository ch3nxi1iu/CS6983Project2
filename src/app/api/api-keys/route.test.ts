// @vitest-environment node
// Route tests for /api/api-keys (US-12, #18). Key management uses the session
// cookie only, so these tests check that a Bearer API key is refused here.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey, hashApiKey } from "@/lib/api-keys";
import { createTestUser, deleteTestUsers } from "@/test/work-plan-fixtures";

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

import { GET, POST } from "@/app/api/api-keys/route";

const createdUserIds: string[] = [];

async function signIn(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  await createSession(userId);
  return userId;
}

function postKey(body: string, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost:3000/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body,
    }),
  );
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("GET /api/api-keys", () => {
  test("returns 401 with the UNAUTHORIZED error shape when signed out", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("lists only the signed-in user's keys, with name, prefix and dates but never the key", async () => {
    const userId = await signIn();
    const { key } = await createApiKey(userId, "Mine");
    const otherId = await createTestUser();
    createdUserIds.push(otherId);
    await createApiKey(otherId, "Theirs");

    const res = await GET();
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text) as { apiKeys: Record<string, unknown>[] };
    expect(body.apiKeys).toHaveLength(1);
    expect(body.apiKeys[0]).toMatchObject({ name: "Mine", prefix: key.slice(0, 11) });
    expect(body.apiKeys[0]).toHaveProperty("createdAt");
    expect(body.apiKeys[0]).toHaveProperty("lastUsedAt", null);
    expect(body.apiKeys[0]).not.toHaveProperty("keyHash");
    expect(body.apiKeys[0]).not.toHaveProperty("key");
    expect(text).not.toContain(key);
  });
});

describe("POST /api/api-keys", () => {
  test("returns 401 when signed out", async () => {
    const res = await postKey(JSON.stringify({ name: "Script" }));
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 to a Bearer API key", async () => {
    const userId = await createTestUser();
    createdUserIds.push(userId);
    const { key } = await createApiKey(userId, "Script");

    const res = await postKey(JSON.stringify({ name: "Second" }), {
      Authorization: `Bearer ${key}`,
    });
    expect(res.status).toBe(401);
  });

  test("creates a key for the signed-in user and returns the plaintext key once, with status 201", async () => {
    const userId = await signIn();

    const res = await postKey(JSON.stringify({ name: "  Laptop script  " }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.key).toMatch(/^ll_[A-Za-z0-9_-]{43}$/);
    expect(body.apiKey).toMatchObject({ name: "Laptop script", prefix: body.key.slice(0, 11) });
    expect(body.apiKey).not.toHaveProperty("keyHash");

    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: body.apiKey.id } });
    expect(row.userId).toBe(userId);
    expect(row.keyHash).toBe(hashApiKey(body.key));
  });

  test.each([
    ["a body that is not JSON", "not json"],
    ["a missing name", JSON.stringify({})],
    ["a blank name", JSON.stringify({ name: "   " })],
    ["a name longer than 60 characters", JSON.stringify({ name: "x".repeat(61) })],
  ])("returns 400 VALIDATION_ERROR for %s", async (_label, body) => {
    await signIn();
    const res = await postKey(body);
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
