// DELETE /api/api-keys/[id] (US-12, #18): revokes one of the signed-in user's
// API keys. Session cookie only. A revoked key stops working at once.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { revokeApiKey } from "@/lib/api-keys";

export async function DELETE(
  _request: Request,
  { params }: RouteContext<"/api/api-keys/[id]">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const { id } = await params;
  const apiKey = await revokeApiKey(user.id, id);
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "API key not found." } },
      { status: 404 },
    );
  }
  return NextResponse.json({ apiKey });
}
