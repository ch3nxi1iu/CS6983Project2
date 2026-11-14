import { SignJWT, jwtVerify } from "jose";

export interface SessionPayload {
  userId: string;
}

const TEST_SECRET = "test-secret-key-cs6983-project2-auth-jwt";

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "test") {
      return new TextEncoder().encode(TEST_SECRET);
    }
    throw new Error("AUTH_SECRET environment variable is required.");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Signs a JWT containing the user session payload with HS256 and a 7-day expiration.
 */
export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

/**
 * Verifies a JWT token and returns the parsed payload, or null if invalid or expired.
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"],
    });
    if (typeof payload.userId !== "string") {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
