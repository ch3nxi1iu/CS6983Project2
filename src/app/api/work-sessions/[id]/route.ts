// PATCH /api/work-sessions/[id] (US-08, #14): marks one of the signed-in user's
// sessions done or missed, or undoes that (back to scheduled). Every change
// alters what's left to plan, so the plan is rebuilt: missed hours move to
// other days, done hours come off the plan, undone hours go back on.
import { NextResponse } from "next/server";
import { regeneratePlanForUser, setWorkSessionStatus, type PlanSessionStatus } from "@/lib/work-plan";
import { errorResponse, getApiUserId, unauthorizedResponse } from "@/lib/api/route-helpers";

const STATUSES: readonly PlanSessionStatus[] = ["DONE", "MISSED", "SCHEDULED"];

function readStatus(body: unknown): PlanSessionStatus | null {
  if (typeof body !== "object" || body === null) return null;
  const { status } = body as Record<string, unknown>;
  return STATUSES.includes(status as PlanSessionStatus) ? (status as PlanSessionStatus) : null;
}

export async function PATCH(request: Request, { params }: RouteContext<"/api/work-sessions/[id]">) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  // A body that isn't JSON becomes undefined, which readStatus rejects.
  const body: unknown = await request.json().catch(() => undefined);
  const status = readStatus(body);
  if (!status) {
    return errorResponse({
      code: "VALIDATION_ERROR",
      message: "Send status as DONE, MISSED or SCHEDULED.",
    });
  }

  const { id } = await params;
  if (!(await setWorkSessionStatus(userId, id, status))) {
    return errorResponse({ code: "NOT_FOUND", message: "Work session not found." });
  }

  await regeneratePlanForUser(userId, new Date());
  return NextResponse.json({ session: { id, status } });
}
