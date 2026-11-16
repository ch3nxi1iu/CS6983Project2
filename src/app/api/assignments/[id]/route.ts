// PATCH /api/assignments/[id] (US-07, #13; US-14, #20): saves an edit to one of
// the signed-in user's assignments (any of title, dueDate, estimatedHours), then
// rebuilds their plan around it.
// DELETE /api/assignments/[id] (US-14, #20): deletes the assignment and its work
// sessions, then rebuilds the plan.
import { NextResponse } from "next/server";
import { deleteAssignmentForUser, updateAssignmentForUser } from "@/lib/assignments";
import { regeneratePlanForUser } from "@/lib/work-plan";
import { errorResponse, getApiUserId, unauthorizedResponse } from "@/lib/api/route-helpers";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/assignments/[id]">,
) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  // A body that isn't JSON becomes undefined, which updateAssignmentForUser rejects.
  const body: unknown = await request.json().catch(() => undefined);
  const { id } = await params;
  const updated = await updateAssignmentForUser(userId, id, body);
  if (!updated.ok) return errorResponse(updated.error);

  // The edit is saved even when the plan can't be rebuilt yet (no study hours),
  // so plan is null in that case instead of failing the request.
  const plan = await regeneratePlanForUser(userId, new Date());
  return NextResponse.json({
    assignment: updated.value,
    plan: plan.ok ? { sessions: plan.sessions, atRisk: plan.atRisk } : null,
  });
}

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/assignments/[id]">,
) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  const deleted = await deleteAssignmentForUser(userId, id);
  if (!deleted) {
    return errorResponse({ code: "NOT_FOUND", message: "Assignment not found." });
  }
  // Before study hours are saved there is no plan, and this does nothing.
  await regeneratePlanForUser(userId, new Date());
  return new NextResponse(null, { status: 204 });
}
