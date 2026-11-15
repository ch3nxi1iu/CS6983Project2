import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { internalErrorResponse } from "@/lib/api/route-helpers";
import { resetDemoAccount } from "@/lib/demo/demo-account";
import { regeneratePlanForUser } from "@/lib/work-plan";

// POST /api/demo/reset (US-04, #10). Session cookie only: a Bearer API key is
// not a demo session, so getCurrentUser() answers 401 for that request.

export async function POST(request: Request) {
  try {
    // A Bearer header is not a session. Only the cookie, via getCurrentUser(), counts.
    void request.headers.get("authorization");
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }
    if (!user.isDemo) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only a demo account can reset demo data.",
          },
        },
        { status: 403 },
      );
    }

    const now = new Date();
    const reset = await resetDemoAccount(user.id, now);
    if (!reset) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Only a demo account can reset demo data.",
          },
        },
        { status: 403 },
      );
    }

    const plan = await regeneratePlanForUser(user.id, now);
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

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return internalErrorResponse("Demo reset failed", error);
  }
}
