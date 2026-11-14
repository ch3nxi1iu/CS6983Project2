// /api/plan (US-07, #13): the signed-in user's work plan.
// GET returns the next 7 days of sessions and the at-risk items.
// POST rebuilds the plan from the user's assignments and study hours.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getWorkPlanForUser, regeneratePlanForUser } from "@/lib/work-plan";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const plan = await getWorkPlanForUser(user.id, new Date());
  if (!plan.ok) {
    return NextResponse.json(
      { error: { code: "AVAILABILITY_NOT_SET", message: plan.message } },
      { status: 409 },
    );
  }
  return NextResponse.json({ sessions: plan.sessions, atRisk: plan.atRisk });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const plan = await regeneratePlanForUser(user.id, new Date());
  if (!plan.ok) {
    return NextResponse.json(
      { error: { code: "AVAILABILITY_NOT_SET", message: plan.message } },
      { status: 409 },
    );
  }
  return NextResponse.json({ sessions: plan.sessions, atRisk: plan.atRisk });
}
