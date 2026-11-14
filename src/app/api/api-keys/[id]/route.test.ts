// @vitest-environment node
// Route tests for DELETE /api/api-keys/[id] (US-12, #18). The revoke check uses
// the real GET /api/tasks handler, so the revoked key is tried on the public API.
import "dotenv/config";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { createApiKey } from "@/lib/api-keys";
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

import { DELETE } from "@/app/api/api-keys/[id]/route";
import { GET as getTasks } from "@/app/api/tasks/route";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

function revoke(id: string, headers: Record<string, string> = {}) {
  const request = new Request(`http://localhost:3000/api/api-keys/${id}`, {
    method: "DELETE",
    headers,
  });
  return DELETE(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  cookieJar.clear();
});

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("DELETE /api/api-keys/[id]", () => {
  test("returns 401 when signed out", async () => {
    const userId = await newUser();
    const { apiKey } = await createApiKey(userId, "Keep");

    const res = await revoke(apiKey.id);
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 to a Bearer API key, because keys cannot revoke keys", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Caller");

    const res = await revoke(apiKey.id, { Authorization: `Bearer ${key}` });
    expect(res.status).toBe(401);
  });

  test("returns 404 NOT_FOUND for another user's key and leaves it active", async () => {
    const ownerId = await newUser();
    const { apiKey } = await createApiKey(ownerId, "Owner");
    const intruderId = await newUser();
    await createSession(intruderId);

    const res = await revoke(apiKey.id);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.revokedAt).toBeNull();
  });

  test("revokes the key, and the same Bearer request is refused afterwards", async () => {
    const userId = await newUser();
    await createSession(userId);
    const { key, apiKey } = await createApiKey(userId, "Revocable");

    const before = await getTasks(
      new Request("http://localhost:3000/api/tasks", {
        headers: { Authorization: `Bearer ${key}` },
      }),
    );
    expect(before.status).toBe(200);

    const res = await revoke(apiKey.id);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toMatchObject({ id: apiKey.id, name: "Revocable" });
    expect(body.apiKey.revokedAt).not.toBeNull();

    const after = await getTasks(
      new Request("http://localhost:3000/api/tasks", {
        headers: { Authorization: `Bearer ${key}` },
      }),
    );
    expect(after.status).toBe(401);
  });
});
