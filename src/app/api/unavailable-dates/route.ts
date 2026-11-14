import { NextResponse } from "next/server";
import { addUnavailableDate } from "@/lib/availability";
import { errorResponse, getApiUserId, unauthorizedResponse } from "@/lib/api/route-helpers";

// Marks one day as unavailable for the signed-in user (US-06, #12).

export async function POST(request: Request) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  // A body that isn't JSON becomes undefined, which addUnavailableDate rejects.
  const body: unknown = await request.json().catch(() => undefined);
  const result = await addUnavailableDate(userId, body);
  if (!result.ok) return errorResponse(result.error);
  return NextResponse.json(result.value, { status: 201 });
}
