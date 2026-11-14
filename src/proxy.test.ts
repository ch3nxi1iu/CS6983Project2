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
