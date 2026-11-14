// GET /api/tasks (US-12, #18): the caller's unsubmitted assignments.
// Accepts the session cookie or an "Authorization: Bearer ll_..." API key.
import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/authenticate";
import { getOpenTasksForUser } from "@/lib/api/public-data";

export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth.response;

  const tasks = await getOpenTasksForUser(auth.userId);
  return NextResponse.json({ tasks });
}
