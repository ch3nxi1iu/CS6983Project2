// Fixed-window rate limiter for the public API (US-12, #18).
// The clock is passed in with each check (milliseconds since the epoch), so the
// logic is deterministic and unit-testable.
//
// The counters live in memory, so the limit applies per server instance. On a
// platform that runs several instances, each one counts separately. A shared
// store (for example Postgres or Redis) would be needed for a global limit.

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export type RateLimitDecision =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimiter = {
  check(key: string, now: number): RateLimitDecision;
};

type Window = { startedAt: number; count: number };

// Expired windows are dropped once this many keys are tracked, so memory stays bounded.
const PRUNE_THRESHOLD = 10_000;

export function createRateLimiter({ limit, windowMs }: RateLimitOptions): RateLimiter {
  const windows = new Map<string, Window>();

  function prune(now: number) {
    for (const [key, window] of windows) {
      if (now - window.startedAt >= windowMs) windows.delete(key);
    }
  }

  return {
    check(key, now) {
      if (windows.size >= PRUNE_THRESHOLD) prune(now);

      const current = windows.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        windows.set(key, { startedAt: now, count: 1 });
        return { allowed: true };
      }

      if (current.count < limit) {
        current.count += 1;
        return { allowed: true };
      }

      const retryAfterMs = current.startedAt + windowMs - now;
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
    },
  };
}
