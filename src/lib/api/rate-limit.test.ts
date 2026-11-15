// Unit tests for the fixed-window rate limiter (US-12, #18). The clock is passed
// in, so no test waits for real time.
import { describe, expect, test } from "vitest";
import { createRateLimiter } from "@/lib/api/rate-limit";

const T0 = Date.parse("2026-11-16T08:00:00Z");

describe("createRateLimiter", () => {
  test("allows up to the limit inside one window, then rejects with Retry-After seconds", () => {
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });

    expect(limiter.check("key-a", T0)).toEqual({ allowed: true });
    expect(limiter.check("key-a", T0 + 100)).toEqual({ allowed: true });
    expect(limiter.check("key-a", T0 + 200)).toEqual({ allowed: true });
    expect(limiter.check("key-a", T0 + 1_000)).toEqual({
      allowed: false,
      retryAfterSeconds: 59,
    });
  });

  test("starts a new window once windowMs has passed", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("key-a", T0)).toEqual({ allowed: true });
    expect(limiter.check("key-a", T0 + 59_000)).toMatchObject({ allowed: false });
    expect(limiter.check("key-a", T0 + 60_000)).toEqual({ allowed: true });
  });

  test("counts each key separately", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    expect(limiter.check("key-a", T0)).toEqual({ allowed: true });
    expect(limiter.check("key-a", T0)).toMatchObject({ allowed: false });
    expect(limiter.check("key-b", T0)).toEqual({ allowed: true });
  });

  test("reports at least one second of Retry-After, even just before the window ends", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 60_000 });

    limiter.check("key-a", T0);
    expect(limiter.check("key-a", T0 + 59_999)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });
});
