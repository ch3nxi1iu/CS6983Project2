// PATCH /api/assignments/[id] (US-07, #13): saves an assignment's estimated
// hours, then rebuilds the signed-in user's plan around the new estimate.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { regeneratePlanForUser, updateEstimatedHours } from "@/lib/work-plan";

function readEstimatedHours(body: unknown): number | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).estimatedHours;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function validationError(message: string) {
  return NextResponse.json({ error: { code: "VALIDATION_ERROR", message } }, { status: 400 });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/assignments/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError("Invalid JSON body.");
  }

  const estimatedHours = readEstimatedHours(body);
  if (estimatedHours === null) {
    return validationError("Send estimatedHours as a number of hours.");
  }

  const { id } = await params;
  const updated = await updateEstimatedHours(user.id, id, estimatedHours);
  if (!updated.ok) {
    const status = updated.error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: updated.error }, { status });
  }

  // The estimate is saved even when the plan can't be rebuilt yet (no study hours),
  // so plan is null in that case instead of failing the request.
  const plan = await regeneratePlanForUser(user.id, new Date());
  return NextResponse.json({
    assignment: updated.value,
    plan: plan.ok ? { sessions: plan.sessions, atRisk: plan.atRisk } : null,
  });
}
