// @vitest-environment node
import "dotenv/config";
import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import { POST as registerHandler } from "@/app/api/auth/register/route";
import { POST as loginHandler } from "@/app/api/auth/login/route";
import { POST as logoutHandler } from "@/app/api/auth/logout/route";
import { verifyPassword } from "@/lib/auth/password";
import { verifySessionToken } from "@/lib/auth/jwt";

const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});

function createJsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  test("creates user with hashed password in database and sets httpOnly cookie", async () => {
    const email = `test-reg-${crypto.randomUUID()}@example.com`;
    const password = "ValidPassword123!";

    const req = createJsonRequest("http://localhost:3000/api/auth/register", {
      email,
      password,
      name: "Alice Student",
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(email);
    expect(data.token).toBeUndefined(); // Token must never be in response body

    // Verify httpOnly cookie
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
    expect(setCookie?.toLowerCase()).toContain("httponly");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");

    // Verify database record
    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();
    createdUserIds.push(dbUser!.id);

    // Password must be hashed with bcryptjs, not stored plain
    expect(dbUser!.passwordHash).not.toBe(password);
    expect(await verifyPassword(password, dbUser!.passwordHash)).toBe(true);
  });

  test("rejects invalid input with VALIDATION_ERROR", async () => {
    const req = createJsonRequest("http://localhost:3000/api/auth/register", {
      email: "not-an-email",
      password: "short",
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects duplicate email with 409 EMAIL_EXISTS", async () => {
    const email = `dup-${crypto.randomUUID()}@example.com`;
    const password = "ValidPassword123!";

    const req1 = createJsonRequest("http://localhost:3000/api/auth/register", {
      email,
      password,
    });
    const res1 = await registerHandler(req1);
    expect(res1.status).toBe(201);
    const data1 = await res1.json();
    createdUserIds.push(data1.user.id);

    const req2 = createJsonRequest("http://localhost:3000/api/auth/register", {
      email,
      password,
    });
    const res2 = await registerHandler(req2);
    expect(res2.status).toBe(409);
    const data2 = await res2.json();
    expect(data2.error.code).toBe("EMAIL_EXISTS");
  });
});

describe("POST /api/auth/login", () => {
  test("issues JWT in an httpOnly cookie upon successful login and does not return JWT in body", async () => {
    const email = `login-${crypto.randomUUID()}@example.com`;
    const password = "CorrectPassword123!";

    const regReq = createJsonRequest("http://localhost:3000/api/auth/register", {
      email,
      password,
    });
    const regRes = await registerHandler(regReq);
    const regData = await regRes.json();
    createdUserIds.push(regData.user.id);

    const loginReq = createJsonRequest("http://localhost:3000/api/auth/login", {
      email,
      password,
    });
    const res = await loginHandler(loginReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.token).toBeUndefined(); // Never in response body

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("session=");
    expect(setCookie?.toLowerCase()).toContain("httponly");
    expect(setCookie?.toLowerCase()).toContain("samesite=lax");

    // Extract token and verify signature
    const match = setCookie?.match(/session=([^;]+)/);
    expect(match).toBeTruthy();
    const token = match![1];
    const payload = await verifySessionToken(token);
    expect(payload?.userId).toBe(regData.user.id);
  });

  test("shows clear error without revealing which field was wrong for bad password", async () => {
    const email = `badpass-${crypto.randomUUID()}@example.com`;
    const password = "CorrectPassword123!";

    const regReq = createJsonRequest("http://localhost:3000/api/auth/register", {
      email,
      password,
    });
    const regRes = await registerHandler(regReq);
    const regData = await regRes.json();
    createdUserIds.push(regData.user.id);

    const loginReq = createJsonRequest("http://localhost:3000/api/auth/login", {
      email,
      password: "WrongPassword999!",
    });
    const res = await loginHandler(loginReq);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error.message).toBe("Email or password is incorrect.");
  });

  test("shows identical error without revealing which field was wrong for non-existent email", async () => {
    const loginReq = createJsonRequest("http://localhost:3000/api/auth/login", {
      email: `nonexistent-${crypto.randomUUID()}@example.com`,
      password: "AnyPassword123!",
    });
    const res = await loginHandler(loginReq);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error.message).toBe("Email or password is incorrect.");
  });
});

describe("POST /api/auth/logout", () => {
  test("clears the session cookie", async () => {
    const req = new Request("http://localhost:3000/api/auth/logout", {
      method: "POST",
    });
    const res = await logoutHandler(req);
    expect(res.status).toBe(200);

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    // Cookie should be deleted or expired in the past
    expect(setCookie).toMatch(/(session=;|Max-Age=0|expires=Thu, 01 Jan 1970)/i);
  });
});
