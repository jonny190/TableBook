import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Edge-runtime middleware: uses only JWT decoding, no bcrypt/Prisma.
const { auth } = NextAuth(authConfig);

const PUBLIC = ["/", "/login", "/register", "/manifest.webmanifest", "/sw.js", "/offline"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/uploads")
  ) {
    return NextResponse.next();
  }
  const session = req.auth;
  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/dashboard/admin") && session.user.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  if (pathname.startsWith("/dashboard/reports") && !["ADMIN", "REPORTER"].includes(session.user.role)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
