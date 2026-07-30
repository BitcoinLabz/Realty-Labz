import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PORTAL_COOKIE_NAME } from "@/lib/client-portal";

// Consumes a portal magic-link token: if it resolves to a real, unexpired
// ClientPortalSession, sets an HttpOnly cookie holding ONLY that opaque
// session id (never the clientId itself) and redirects to /portal. Every
// subsequent portal request re-resolves clientId from this same session row
// server-side (see resolvePortalClientId in src/lib/client-portal.ts).
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const origin = new URL(request.url).origin;

  const session = await prisma.clientPortalSession.findFirst({
    where: { id: token, expiresAt: { gt: new Date() } },
  });

  if (!session) {
    return NextResponse.redirect(`${origin}/portal?expired=1`);
  }

  const response = NextResponse.redirect(`${origin}/portal`);
  response.cookies.set(PORTAL_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: session.expiresAt,
  });
  return response;
}
