// POST /api/work-sessions/[id]/complete (US-12, #18): marks one of the caller's
// work sessions DONE. Accepts the session cookie or an API key.
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/authenticate";
import { completeWorkSessionForUser } from "@/lib/api/public-data";

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/work-sessions/[id]/complete">,
) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const session = await completeWorkSessionForUser(auth.userId, id);
  if (!session) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Work session not found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ session });
}
