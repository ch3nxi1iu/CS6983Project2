// @vitest-environment node
// Integration tests for src/lib/api-keys.ts (US-12, #18). They run against the
// real database; each test file deletes its own users in afterAll.
import "dotenv/config";
import { createHash } from "node:crypto";
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  createApiKey,
  findUserIdByApiKey,
  listApiKeys,
  revokeApiKey,
  validateApiKeyName,
} from "@/lib/api-keys";
import { createTestUser, deleteTestUsers } from "@/test/work-plan-fixtures";

const createdUserIds: string[] = [];

async function newUser(): Promise<string> {
  const userId = await createTestUser();
  createdUserIds.push(userId);
  return userId;
}

afterAll(async () => {
  await deleteTestUsers(createdUserIds);
  await prisma.$disconnect();
});

describe("createApiKey", () => {
  test("returns a plaintext key that starts with ll_ and carries 32 random bytes in base64url", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Grade script");

    // 32 bytes encoded as base64url is 43 characters.
    expect(key).toMatch(/^ll_[A-Za-z0-9_-]{43}$/);
    expect(apiKey.name).toBe("Grade script");
    expect(apiKey.prefix).toBe(key.slice(0, 11));
    expect(apiKey.revokedAt).toBeNull();
    expect(apiKey.lastUsedAt).toBeNull();
  });

  test("stores only the SHA-256 hash and the prefix, never the plaintext key", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Hashed");

    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.keyHash).toBe(createHash("sha256").update(key).digest("hex"));
    expect(row.prefix).toBe(key.slice(0, 11));
    expect(JSON.stringify(row)).not.toContain(key);
  });

  test("generates a different key each time", async () => {
    const userId = await newUser();
    const first = await createApiKey(userId, "One");
    const second = await createApiKey(userId, "Two");
    expect(first.key).not.toBe(second.key);
  });
});

describe("listApiKeys", () => {
  test("lists only the user's active keys, without the key or its hash", async () => {
    const userId = await newUser();
    const otherId = await newUser();
    const kept = await createApiKey(userId, "Kept");
    const revoked = await createApiKey(userId, "Revoked");
    await revokeApiKey(userId, revoked.apiKey.id);
    await createApiKey(otherId, "Someone else");

    const keys = await listApiKeys(userId);
    expect(keys.map((k) => k.id)).toEqual([kept.apiKey.id]);
    expect(keys[0]).not.toHaveProperty("key");
    expect(keys[0]).not.toHaveProperty("keyHash");
    expect(JSON.stringify(keys)).not.toContain(kept.key);
  });
});

describe("revokeApiKey", () => {
  test("sets revokedAt on the user's own key", async () => {
    const userId = await newUser();
    const { apiKey } = await createApiKey(userId, "To revoke");

    const revoked = await revokeApiKey(userId, apiKey.id);
    expect(revoked?.id).toBe(apiKey.id);
    expect(revoked?.revokedAt).toBeInstanceOf(Date);
  });

  test("returns null for another user's key and leaves that key active", async () => {
    const ownerId = await newUser();
    const intruderId = await newUser();
    const { key, apiKey } = await createApiKey(ownerId, "Owner's key");

    expect(await revokeApiKey(intruderId, apiKey.id)).toBeNull();
    expect(await findUserIdByApiKey(key)).toBe(ownerId);
  });
});

describe("findUserIdByApiKey", () => {
  test("returns the owner's id for a valid key and records when it was last used", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Used");

    expect(await findUserIdByApiKey(key)).toBe(userId);
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id: apiKey.id } });
    expect(row.lastUsedAt).toBeInstanceOf(Date);
  });

  test("returns null for a key that was never issued", async () => {
    expect(await findUserIdByApiKey("ll_" + "A".repeat(43))).toBeNull();
  });

  test("returns null for a malformed value", async () => {
    expect(await findUserIdByApiKey("not-a-key")).toBeNull();
    expect(await findUserIdByApiKey("")).toBeNull();
  });

  test("returns null once the key has been revoked", async () => {
    const userId = await newUser();
    const { key, apiKey } = await createApiKey(userId, "Revoked later");
    expect(await findUserIdByApiKey(key)).toBe(userId);

    await revokeApiKey(userId, apiKey.id);
    expect(await findUserIdByApiKey(key)).toBeNull();
  });
});

describe("validateApiKeyName", () => {
  test("trims the name and accepts 1 to 60 characters", () => {
    expect(validateApiKeyName("  Laptop  ")).toEqual({ ok: true, value: "Laptop" });
    expect(validateApiKeyName("x".repeat(60))).toEqual({ ok: true, value: "x".repeat(60) });
  });

  test.each([
    ["an empty string", ""],
    ["only spaces", "   "],
    ["a number", 42],
    ["more than 60 characters", "x".repeat(61)],
  ])("rejects %s with VALIDATION_ERROR", (_label, input) => {
    const result = validateApiKeyName(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});
