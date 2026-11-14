import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import type { ApiErrorCode } from "@/lib/planner/availability";

// Shared by the API route handlers (AGENTS.md: one error shape, matching status).

export type ApiError = { code: ApiErrorCode | "UNAUTHORIZED"; message: string };

const STATUS_BY_CODE: Record<ApiError["code"], number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
};

export function errorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    { error: { code: error.code, message: error.message } },
    { status: STATUS_BY_CODE[error.code] },
  );
}

export function unauthorizedResponse(): NextResponse {
  return errorResponse({ code: "UNAUTHORIZED", message: "Sign in to continue." });
}

/**
 * The signed-in user's id, or null. requireUser() redirects instead, which is
 * wrong for an API, so this does the same lookup and returns null. It also
 * checks the user still exists: a valid token for a deleted user would
 * otherwise fail later on a foreign key and return a 500.
 */
export async function getApiUserId(): Promise<string | null> {
  const session = await getSession();
  if (!session?.userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true },
  });
  return user?.id ?? null;
}
