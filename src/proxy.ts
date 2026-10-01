import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isOversightRole } from "@/lib/authorization";

// The agent-only parts of the app. A Broker or office Admin gets the
// oversight app instead (2026-10-01) and is sent to their Overview from any
// of these -- enforced here, before any page renders, rather than by hiding
// links. /transactions itself stays open: it's their list of agents' files.
const AGENT_ONLY_PREFIXES = ["/dashboard", "/clients", "/finances", "/transactions/new"];

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

  const user = req.auth?.user;
  if (
    user?.teamId &&
    isOversightRole(user.role) &&
    AGENT_ONLY_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  ) {
    return NextResponse.redirect(new URL("/team", req.nextUrl.origin));
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
