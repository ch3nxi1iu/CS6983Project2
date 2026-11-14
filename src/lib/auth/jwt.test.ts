// @vitest-environment node
import { afterEach, describe, expect, test } from "vitest";
import { signSessionToken } from "@/lib/auth/jwt";

describe("JWT auth secret handling", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalSecret = process.env.AUTH_SECRET;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
    if (originalSecret !== undefined) {
      process.env.AUTH_SECRET = originalSecret;
    } else {
      delete process.env.AUTH_SECRET;
    }
  });

  test("throws error when AUTH_SECRET is missing outside test environment", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.AUTH_SECRET;

    await expect(signSessionToken({ userId: "user-123" })).rejects.toThrow(
      /AUTH_SECRET/i,
    );
  });
});
