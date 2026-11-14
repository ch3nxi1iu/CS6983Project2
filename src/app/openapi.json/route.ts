// GET /openapi.json (US-12, #18): the public API's OpenAPI 3.1 document.
// Public: it needs no session, so anyone can read the spec.
import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/api/openapi";

export async function GET() {
  return NextResponse.json(openApiSpec);
}
