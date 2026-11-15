import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { assertSessionSecret } from "@/lib/auth/jwt";
import { internalErrorResponse } from "@/lib/api/route-helpers";
import {
  createSession,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/session";

function isValidEmail(email: string): boolean {
  if (email.length > 254) {
    return false;
  }
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

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

  const { email, password, name } = body as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Email and password are required." } },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Please enter a valid email address." } },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Password must be at least 8 characters long." } },
      { status: 400 },
    );
  }

  try {
    // Checked before the account is created: if sessions can't be signed, a
    // created account would be one the user can never sign in to (#46).
    assertSessionSecret();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: { code: "EMAIL_EXISTS", message: "An account with this email already exists." } },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    const token = await createSession(user.id);
    const response = NextResponse.json({ user }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
    return response;
  } catch (error) {
    return internalErrorResponse("Registration failed", error);
  }
}
