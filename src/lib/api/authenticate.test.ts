// @vitest-environment node
// Tests for authenticateRequest (US-12, #18). Real API keys and real session
// JWTs are created in the test database; only next/headers' cookie store is
// replaced, because there is no request cookie jar in these tests.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey, revokeApiKey } from "@/lib/api-keys";
import { authenticateRequest } from "@/lib/api/authenticate";
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

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function requestWith(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost:3000/api/tasks", { headers });
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("authenticateRequest", () => {
  test("returns 401 UNAUTHORIZED when there is neither a session cookie nor a Bearer key", async () => {
    const result = await authenticateRequest(requestWith());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.response.status).toBe(401);
    expect(await result.response.json()).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  });

  test("identifies the user from the session cookie", async () => {
    const userId = await newUser();
    await createSession(userId);

    const result = await authenticateRequest(requestWith());
    expect(result).toEqual({ ok: true, userId, method: "session" });
  });

  test("identifies the owner of a valid Bearer API key", async () => {
    const userId = await newUser();
    const { key } = await createApiKey(userId, "Script");

    const result = await authenticateRequest(requestWith({ Authorization: `Bearer ${key}` }));
    expect(result).toEqual({ ok: true, userId, method: "api_key" });
  });

  test("returns 401 for a Bearer key that is unknown", async () => {
    const result = await authenticateRequest(
      requestWith({ Authorization: `Bearer ll_${"B".repeat(43)}` }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  test("returns 401 for a Bearer key that was revoked, even with a valid session cookie", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Revoked");
    await revokeApiKey(userId, apiKey.id);
    await createSession(userId);

    const result = await authenticateRequest(requestWith({ Authorization: `Bearer ${key}` }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  test("returns 429 RATE_LIMITED with Retry-After after 60 requests in a minute", async () => {
    const userId = await newUser();
    const { key } = await createApiKey(userId, "Busy");
    const headers = { Authorization: `Bearer ${key}` };

    for (let i = 0; i < 60; i += 1) {
      const result = await authenticateRequest(requestWith(headers));
      expect(result.ok).toBe(true);
    }

    const limited = await authenticateRequest(requestWith(headers));
    expect(limited.ok).toBe(false);
    if (limited.ok) return;
    expect(limited.response.status).toBe(429);
    const retryAfter = Number(limited.response.headers.get("Retry-After"));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(await limited.response.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
  });
});
