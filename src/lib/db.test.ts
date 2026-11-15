// @vitest-environment node
import { afterEach, expect, test, vi } from "vitest";

// A production build can load this module more than once (the proxy and the
// route bundles each get a copy). Each copy used to open its own connection
// pool, which went over the local `prisma dev` limit of 10 connections.

const globalForPrisma = globalThis as unknown as { prisma?: unknown };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("reuses one Prisma client in production when the module is loaded twice", async () => {
  vi.stubEnv("NODE_ENV", "production");
  delete globalForPrisma.prisma;

  vi.resetModules();
  const first = (await import("@/lib/db")).prisma;
  vi.resetModules();
  const second = (await import("@/lib/db")).prisma;

  try {
    expect(second).toBe(first);
  } finally {
    await first.$disconnect();
    if (second !== first) await second.$disconnect();
    delete globalForPrisma.prisma;
  }
});
