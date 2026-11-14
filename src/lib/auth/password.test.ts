// @vitest-environment node
import { describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("password hashing", () => {
  test("hashes password with a salt so identical passwords yield different hashes", async () => {
    const password = "my-secret-password-123";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(password);
    expect(hash2).not.toBe(password);
    expect(hash1).not.toBe(hash2);
  });

  test("verifies matching password correctly", async () => {
    const password = "correct-password-456";
    const hash = await hashPassword(password);

    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
