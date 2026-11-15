import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { assertSessionSecret } from "@/lib/auth/jwt";
import { internalErrorResponse } from "@/lib/api/route-helpers";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";
import { createDemoAccount } from "@/lib/demo/demo-account";
import { regeneratePlanForUser } from "@/lib/work-plan";

// POST /api/auth/demo (US-04, #10). Opens a fresh demo account and signs the
// visitor in. The token stays in the httpOnly cookie, never the body.

export async function POST() {
  try {
    assertSessionSecret();
    const now = new Date();
    const id = await createDemoAccount(now);
    const plan = await regeneratePlanForUser(id, now);
    if (!plan.ok) {
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Something went wrong on our side. Please try again.",
          },
        },
        { status: 500 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, isDemo: true },
    });
    if (!user?.isDemo) {
      return NextResponse.json(
        {
          error: {
            code: "INTERNAL_ERROR",
            message: "Something went wrong on our side. Please try again.",
          },
        },
        { status: 500 },
      );
    }

    const token = await createSession(user.id);
    const response = NextResponse.json(
      { user: { id: user.id, name: user.name, isDemo: true } },
      { status: 201 },
    );
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    return internalErrorResponse("Demo sign-in failed", error);
  }
}
