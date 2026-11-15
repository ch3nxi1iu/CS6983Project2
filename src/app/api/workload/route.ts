// GET /api/workload (US-12, #18): the weekly workload forecast (US-05, #11).
// Accepts the session cookie or an "Authorization: Bearer ll_..." API key.
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/authenticate";
import { getForecastForUser } from "@/lib/forecast";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const weeks = await getForecastForUser(auth.userId, { now: new Date() });
  return NextResponse.json({ weeks });
}
