import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

// Fixed dummy bcrypt hash used when an email is not found to prevent timing attacks.
const DUMMY_HASH = "$2a$10$e8k8y.mZ1qA490OomQ8HDeuQ9B3l3qH0Jm3fXWjZ0d8F.R4L1L6aG";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid JSON body." } },
      { status: 400 },
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Request body must be an object." } },
      { status: 400 },
    );
  }

  const { email, password } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Email and password are required." } },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Run verifyPassword against the real hash if the user exists, or against a fixed
  // dummy hash if not, so both failure paths take the same amount of time.
  const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
  const isPasswordValid = await verifyPassword(password, hashToVerify);

  // Never reveal whether the email exists or the password was wrong
  const CREDENTIALS_ERROR = {
    error: {
      code: "UNAUTHORIZED",
      message: "Email or password is incorrect.",
    },
  };

  if (!user || !isPasswordValid) {
    return NextResponse.json(CREDENTIALS_ERROR, { status: 401 });
  }

  const token = await createSession(user.id);
  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    },
    { status: 200 },
  );
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
