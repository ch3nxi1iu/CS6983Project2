// @vitest-environment node
import "dotenv/config";
import { describe, expect, test } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { signSessionToken } from "@/lib/auth/jwt";

describe("Next.js proxy route protection", () => {
  test("redirects unauthenticated users from /dashboard to /login", async () => {
    const req = new NextRequest("http://localhost:3000/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  test("redirects unauthenticated users from /settings to /login", async () => {
    const req = new NextRequest("http://localhost:3000/settings");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  test("redirects unauthenticated users from /plan to /login", async () => {
    const req = new NextRequest("http://localhost:3000/plan");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  test("allows authenticated user to access /plan", async () => {
    const token = await signSessionToken({ userId: "user-123" });
    const req = new NextRequest("http://localhost:3000/plan", {
      headers: { cookie: `session=${token}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  test("allows authenticated user to access /dashboard", async () => {
    const token = await signSessionToken({ userId: "user-123" });
    const req = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: `session=${token}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  test("returns 401 without a valid token on protected API routes", async () => {
    const req = new NextRequest("http://localhost:3000/api/courses");
    const res = await proxy(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 on protected API route when token is invalid or tampered", async () => {
    const req = new NextRequest("http://localhost:3000/api/courses", {
      headers: { cookie: "session=invalid.tampered.token" },
    });
    const res = await proxy(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("allows public auth API routes without a session token", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/login");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  test("allows authenticated API requests with a valid session token", async () => {
    const token = await signSessionToken({ userId: "user-123" });
    const req = new NextRequest("http://localhost:3000/api/courses", {
      headers: { cookie: `session=${token}` },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });
});

// Public API (US-12, #18): a Bearer API key reaches the route, which verifies it.
describe("Next.js proxy with personal API keys", () => {
  test("lets a public API request with an Authorization Bearer header reach the route", async () => {
    const req = new NextRequest("http://localhost:3000/api/tasks", {
      headers: { authorization: "Bearer ll_" + "A".repeat(43) },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  test("lets a POST to a public API route with a Bearer header reach the route", async () => {
    const req = new NextRequest("http://localhost:3000/api/work-sessions/abc/complete", {
      method: "POST",
      headers: { authorization: "Bearer ll_" + "A".repeat(43) },
    });
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  test("returns 401 for an API route with an empty Bearer token", async () => {
    const req = new NextRequest("http://localhost:3000/api/tasks", {
      headers: { authorization: "Bearer " },
    });
    const res = await proxy(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  test("returns 401 for an API route with a non-Bearer Authorization header", async () => {
    const req = new NextRequest("http://localhost:3000/api/tasks", {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
    });
    const res = await proxy(req);

    expect(res.status).toBe(401);
  });

  test("keeps the public OpenAPI spec and docs page reachable without signing in", async () => {
    const spec = await proxy(new NextRequest("http://localhost:3000/openapi.json"));
    const docs = await proxy(new NextRequest("http://localhost:3000/docs/api"));

    expect(spec.status).toBe(200);
    expect(docs.status).toBe(200);
    expect(spec.headers.get("location")).toBeNull();
    expect(docs.headers.get("location")).toBeNull();
  });

  test("still redirects a signed-out user from the API key settings page to /login", async () => {
    const req = new NextRequest("http://localhost:3000/settings/api");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });
});
