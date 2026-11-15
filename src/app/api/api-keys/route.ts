// /api/api-keys (US-12, #18): the signed-in user's personal API keys.
// Session cookie only: an API key cannot create or list keys.
// GET lists active keys (never the key itself). POST creates a key and returns
// the plaintext once, with status 201.
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createApiKey, listApiKeys, validateApiKeyName } from "@/lib/api-keys";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 },
    );
  }

  const apiKeys = await listApiKeys(user.id);
  return NextResponse.json({ apiKeys });
}

export async function POST(request: Request) {
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
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  const name = validateApiKeyName(
    typeof body === "object" && body !== null ? (body as Record<string, unknown>).name : undefined,
  );
  if (!name.ok) {
    return NextResponse.json({ error: name.error }, { status: 400 });
  }

  // The plaintext key is returned only in this response. It is not stored.
  const created = await createApiKey(user.id, name.value);
  return NextResponse.json({ key: created.key, apiKey: created.apiKey }, { status: 201 });
}
