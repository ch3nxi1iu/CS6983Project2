import { NextResponse } from "next/server";
import { getAvailabilitySettings, saveWeeklyHours } from "@/lib/availability";
import { errorResponse, getApiUserId, unauthorizedResponse } from "@/lib/api/route-helpers";

// Weekly study hours for the signed-in user (US-06, #12).

export async function GET() {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();
  return NextResponse.json(await getAvailabilitySettings(userId));
}

export async function PUT(request: Request) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  // A body that isn't JSON becomes undefined, which saveWeeklyHours rejects.
  const body: unknown = await request.json().catch(() => undefined);
  const result = await saveWeeklyHours(userId, body);
  if (!result.ok) return errorResponse(result.error);
  return NextResponse.json({ weeklyHours: result.value });
}
