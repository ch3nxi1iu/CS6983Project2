import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth/jwt";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionToken ? await verifySessionToken(sessionToken) : null;

  // Protect /dashboard, /settings and /plan pages: redirect unauthenticated users to /login
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname === "/plan" ||
    pathname.startsWith("/plan/")
  ) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Protect API routes: any /api route except /api/auth/* returns 401 without a valid
  // session. A request with an "Authorization: Bearer" header goes to the route, which
  // checks the personal API key itself (#18).
  const hasBearerToken = /^Bearer\s+\S/i.test(request.headers.get("authorization") ?? "");
  if (pathname.startsWith("/api") && !pathname.startsWith("/api/auth")) {
    if (!session && !hasBearerToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
        { status: 401 },
      );
    }
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
