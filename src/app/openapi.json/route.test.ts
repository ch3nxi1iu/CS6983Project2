// @vitest-environment node
// GET /openapi.json (US-12, #18) must answer without a session.
import { describe, expect, test } from "vitest";
import { GET } from "@/app/openapi.json/route";
import { openApiSpec } from "@/lib/api/openapi";

describe("GET /openapi.json", () => {
  test("serves the OpenAPI document as JSON without signing in", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(openApiSpec);
  });
});
