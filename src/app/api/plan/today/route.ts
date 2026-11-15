// GET /api/plan/today (US-12, #18): today's work sessions from the stored plan.
// Accepts the session cookie or an "Authorization: Bearer ll_..." API key.
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/authenticate";
import { getTodaySessionsForUser } from "@/lib/api/public-data";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const today = await getTodaySessionsForUser(auth.userId, new Date());
  if (!today.ok) {
    return NextResponse.json({ error: today.error }, { status: 409 });
  }
  return NextResponse.json(today.value);
}
