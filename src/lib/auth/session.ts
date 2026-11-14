import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { signSessionToken, verifySessionToken, type SessionPayload } from "@/lib/auth/jwt";

export const SESSION_COOKIE_NAME = "session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

/**
 * Creates a signed JWT session for userId and sets the httpOnly cookie.
 * Reusable for real logins and demo mode (#10).
 */
export async function createSession(userId: string): Promise<string> {
  const token = await signSessionToken({ userId });
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  } catch {
    // When called outside Next.js request context (e.g. testing or background scripts)
  }
  return token;
}

/**
 * Reads and verifies the session token from cookies.
 * Returns the session payload ({ userId }) or null if not authenticated.
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Clears the session cookie.
 */
export async function clearSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {
    // ignore
  }
}

/**
 * Ensures the user is authenticated. If authenticated, returns the user
 * from the database. If not authenticated, redirects to /login.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session?.userId) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user) {
    redirect("/login");
  }

  return user;
}
