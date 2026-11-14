import { NextResponse } from "next/server";
import { removeUnavailableDate } from "@/lib/availability";
import {
  errorResponse,
  getApiUserId,
  unauthorizedResponse,
} from "@/lib/api/route-helpers";

// Makes one unavailable date available again for the signed-in user (US-06, #12).

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/unavailable-dates/[id]">,
) {
  const userId = await getApiUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await context.params;
  const removed = await removeUnavailableDate(userId, id);
  if (!removed) {
    return errorResponse({ code: "NOT_FOUND", message: "That unavailable date was not found." });
  }
  return new NextResponse(null, { status: 204 });
}
