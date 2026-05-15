import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Next.js 16: middleware was renamed to proxy.
// Keep this lightweight — only cookie presence check, no JWT verification.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("refresh_token");
  const isLoginPage = pathname.startsWith("/login");

  if (!hasSession && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login"],
};
