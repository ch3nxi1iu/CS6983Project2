// Authentication for the public API (US-12, #18). A request is identified either
// by the session cookie (the web app) or by an "Authorization: Bearer ll_..."
// API key. If a Bearer header is present it decides alone, so a bad key is not
// quietly replaced by the cookie. Every identified request counts against the
// rate limit: 60 requests a minute per API key or per signed-in user.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findUserIdByApiKey, hashApiKey } from "@/lib/api-keys";
import { createRateLimiter } from "@/lib/api/rate-limit";

export type AuthMethod = "session" | "api_key";

export type AuthenticationResult =
  | { ok: true; userId: string; method: AuthMethod }
  | { ok: false; response: NextResponse };

export const API_RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

// One limiter per server instance; see rate-limit.ts.
const rateLimiter = createRateLimiter(API_RATE_LIMIT);

/** The token from "Authorization: Bearer <token>", or null when there is none. */
function readBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

function unauthorized(message: string): AuthenticationResult {
  return {
    ok: false,
    response: NextResponse.json(
      { error: { code: "UNAUTHORIZED", message } },
      { status: 401 },
    ),
  };
}

function rateLimited(retryAfterSeconds: number): AuthenticationResult {
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: `Too many requests. Try again in ${retryAfterSeconds} seconds.`,
        },
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    ),
  };
}

/**
 * Identifies the caller of a public API route and applies the rate limit.
 * Routes return `auth.response` when `auth.ok` is false.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticationResult> {
  const token = readBearerToken(request.headers.get("authorization"));

  let userId: string;
  let method: AuthMethod;
  let rateLimitKey: string;

  if (token !== null) {
    const keyOwnerId = await findUserIdByApiKey(token);
    if (!keyOwnerId) return unauthorized("Invalid or revoked API key.");
    userId = keyOwnerId;
    method = "api_key";
    // Keyed by the hash, so the plaintext key is never held in the limiter.
    rateLimitKey = `key:${hashApiKey(token)}`;
  } else {
    const user = await getCurrentUser();
    if (!user) return unauthorized("Authentication required.");
    userId = user.id;
    method = "session";
    rateLimitKey = `user:${user.id}`;
  }

  const decision = rateLimiter.check(rateLimitKey, Date.now());
  if (!decision.allowed) return rateLimited(decision.retryAfterSeconds);

  return { ok: true, userId, method };
}
