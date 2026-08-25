import { NextResponse } from "next/server";
import { auth } from "@/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/finances") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/team") ||
    pathname.startsWith("/clients");

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/account/:path*",
    "/transactions/:path*",
    "/finances/:path*",
    "/deals/:path*",
    "/team/:path*",
    "/forms/:path*",
  ],
};
