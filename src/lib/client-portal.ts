import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const PORTAL_COOKIE_NAME = "client_portal_session";
const PORTAL_SESSION_DAYS = 30;

export function portalSessionExpiry(): Date {
  return new Date(Date.now() + PORTAL_SESSION_DAYS * 24 * 60 * 60 * 1000);
}

// The one place a portal request is allowed to learn "which client is this."
// It resolves clientId FROM the server-side ClientPortalSession row keyed by
// the opaque cookie value -- never from any request parameter. This is the
// load-bearing invariant that keeps the client portal from repeating the
// exact IDOR pattern fixed elsewhere in this same audit pass (verify a
// parent, then trust a client-supplied child id): here there is no
// client-supplied id at all, only an unguessable bearer token.
export async function resolvePortalClientId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.clientPortalSession.findFirst({
    where: { id: token, expiresAt: { gt: new Date() } },
  });
  return session?.clientId ?? null;
}
