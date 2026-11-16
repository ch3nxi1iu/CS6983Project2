import { NextResponse } from "next/server";
import { createAssignmentForUser } from "@/lib/assignments";
import { regeneratePlanForUser } from "@/lib/work-plan";
import { errorResponse, getApiUserId, unauthorizedResponse } from "@/lib/api/route-helpers";

// POST /api/assignments (US-14, #20): adds one of the signed-in user's own
// assignments, then rebuilds their plan so it includes it.

export async function POST(request: Request) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  // A body that isn't JSON becomes undefined, which createAssignmentForUser rejects.
  const body: unknown = await request.json().catch(() => undefined);
  const result = await createAssignmentForUser(userId, body);
  if (!result.ok) return errorResponse(result.error);

  // Before study hours are saved there is no plan; the assignment is kept anyway.
  await regeneratePlanForUser(userId, new Date());
  return NextResponse.json({ assignment: result.value }, { status: 201 });
}
