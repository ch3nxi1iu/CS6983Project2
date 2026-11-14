// Personal API keys for the public API (US-12, #18).
// A key is "ll_" plus 32 random bytes in base64url. Only its SHA-256 hash is
// stored, so the plaintext can be shown once and never read back. Every query
// filters by userId so one user can never see or revoke another user's keys.
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import type { Result } from "@/lib/planner/availability";

export const API_KEY_PREFIX = "ll_";
/** The part of the key shown in the UI: "ll_" and the first 8 characters. */
const DISPLAY_PREFIX_LENGTH = 11;
const API_KEY_FORMAT = /^ll_[A-Za-z0-9_-]{43}$/;
const MAX_NAME_LENGTH = 60;

export type ApiKeyView = {
  id: string;
  name: string;
  prefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

const viewSelect = {
  id: true,
  name: true,
  prefix: true,
  createdAt: true,
  lastUsedAt: true,
  revokedAt: true,
} as const;

/** SHA-256 of the plaintext key, hex encoded. This is what the database stores. */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Checks the name a user typed for a new key: trimmed, 1 to 60 characters. */
export function validateApiKeyName(input: unknown): Result<string> {
  const name = typeof input === "string" ? input.trim() : "";
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Give the key a name of 1 to ${MAX_NAME_LENGTH} characters.`,
      },
    };
  }
  return { ok: true, value: name };
}

/**
 * Creates a key and returns the plaintext once. The caller must show it to the
 * user now; it cannot be recovered later.
 */
export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ key: string; apiKey: ApiKeyView }> {
  const key = API_KEY_PREFIX + randomBytes(32).toString("base64url");
  const row = await prisma.apiKey.create({
    data: {
      userId,
      name,
      prefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
      keyHash: hashApiKey(key),
    },
    select: viewSelect,
  });
  return { key, apiKey: row };
}

/** The user's active (not revoked) keys, newest first. Never includes the key or its hash. */
export async function listApiKeys(userId: string): Promise<ApiKeyView[]> {
  return prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: viewSelect,
  });
}

/**
 * Revokes one of the user's keys. Returns null when the key does not exist, is
 * already revoked, or belongs to another user, so the caller can answer 404.
 */
export async function revokeApiKey(userId: string, id: string): Promise<ApiKeyView | null> {
  const existing = await prisma.apiKey.findFirst({
    where: { id, userId, revokedAt: null },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() },
    select: viewSelect,
  });
}

/**
 * Returns the owner's user id for a valid, active key, and records when it was
 * used. Returns null for unknown, malformed or revoked keys.
 */
export async function findUserIdByApiKey(key: string): Promise<string | null> {
  if (!API_KEY_FORMAT.test(key)) return null;

  const row = await prisma.apiKey.findUnique({
    where: { keyHash: hashApiKey(key) },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!row || row.revokedAt) return null;

  // Guarded by revokedAt so a key revoked a moment ago is not accepted.
  const { count } = await prisma.apiKey.updateMany({
    where: { id: row.id, revokedAt: null },
    data: { lastUsedAt: new Date() },
  });
  return count > 0 ? row.userId : null;
}
