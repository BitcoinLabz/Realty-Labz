import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Two lists that have to agree: `matcher` decides where this proxy runs at
// all, and `isProtected` decides what it does there. /clients was in the
// second list but not the first, so the check never ran and an
// unauthenticated visit fell through to a page that assumes a session.
// /deals was the reverse -- matched long after the route moved to
// /transactions. Keep them in sync.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/account",
  "/transactions",
  "/finances",
  "/forms",
  "/team",
  "/clients",
];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !isLoggedIn) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    // Read back by loginAction via safeRedirectTo, so someone bounced off an
    // invite link lands on the invite rather than the dashboard.
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
    "/forms/:path*",
    "/team/:path*",
    "/clients/:path*",
  ],
};
