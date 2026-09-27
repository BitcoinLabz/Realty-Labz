"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PORTAL_COOKIE_NAME, getOrCreatePortalSession } from "@/lib/client-portal";
import { sendPortalAccessEmail, sendPortalSignInEmail } from "@/lib/email";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { APP_URL } from "@/lib/app-url";
import type { FormState } from "@/app/actions/auth";

// The link itself comes back to the agent so they can copy it and send it
// however they like -- a text message, in person, or a resend later. It also
// means a Resend outage or a missing API key degrades to "here's the link,
// share it yourself" instead of a dead end, exactly like TeamInvite.
export type PortalAccessState = FormState & { portalUrl?: string };

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Clients aren't team-shared (see CLAUDE.md) -- plain userId ownership check,
// same as every other Client-scoped action.
export async function sendPortalAccessAction(
  _prevState: PortalAccessState,
  formData: FormData,
): Promise<PortalAccessState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) return { error: "Missing client id" };

  const client = await prisma.client.findFirst({ where: { id: clientId, userId: session.user.id } });
  if (!client) return { error: "Client not found" };
  if (!client.email) return { error: "This client has no email address on file" };

  const portalSession = await getOrCreatePortalSession(client.id);

  const baseUrl = await getBaseUrl();
  const portalUrl = `${baseUrl}/portal/${portalSession.id}`;

  try {
    await sendPortalAccessEmail({
      to: client.email,
      clientName: client.name,
      senderName: session.user.name ?? "Your agent",
      portalUrl,
    });
  } catch {
    revalidatePath(`/clients/${clientId}`);
    return {
      portalUrl,
      error: `We couldn't email ${client.email}. The link below works — send it to them yourself.`,
    };
  }

  revalidatePath(`/clients/${clientId}`);
  return { portalUrl, success: `Sent to ${client.email}.` };
}

// Identical whatever happened -- matched one client, several, or nobody.
// Anything else would let a stranger test which email addresses belong to
// an agent's clients, the same reasoning as NEUTRAL_INVITE_RESULT for
// invite-by-license.
const NEUTRAL_SIGN_IN_RESULT: FormState = {
  success: "If that email is on file with your agent, a sign-in link is on its way. It can take a minute to arrive.",
};

// Self-serve portal sign-in (2026-09-27): a client types their email on
// /portal and gets a link, instead of having to ask their agent for a new
// one every time theirs expires. Any client an agent has saved with that
// email can sign in -- the agent entering it is the invitation.
export async function requestPortalSignInAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formData.get("email");
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!/^[^s@]+@[^s@]+.[^s@]+$/.test(email)) {
    return { fieldErrors: { email: "Enter the email address your agent has for you" } };
  }

  // Per IP stops one visitor spraying addresses; per email stops anyone
  // flooding one inbox with sign-in mail.
  const ip = await getClientIp();
  if (await isRateLimited(`portal-sign-in:${ip}`, { max: 10, windowMinutes: 60 })) {
    return { error: "Too many attempts. Try again in a little while." };
  }
  if (await isRateLimited(`portal-sign-in-email:${email}`, { max: 3, windowMinutes: 60 })) {
    return NEUTRAL_SIGN_IN_RESULT;
  }

  const clients = await prisma.client.findMany({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, user: { select: { name: true, email: true } } },
    take: 10,
  });
  if (clients.length === 0) return NEUTRAL_SIGN_IN_RESULT;

  // APP_URL, never getBaseUrl(): this action is public, see src/lib/app-url.ts.
  const links = [];
  for (const c of clients) {
    const portalSession = await getOrCreatePortalSession(c.id);
    links.push({
      agentName: c.user.name ?? c.user.email,
      url: `${APP_URL}/portal/${portalSession.id}`,
    });
  }

  try {
    await sendPortalSignInEmail({ to: email, clientName: clients[0].name, links });
  } catch (err) {
    // Still neutral: an error message here would confirm the address matched.
    console.error("[client-portal] sign-in email failed", err);
  }
  return NEUTRAL_SIGN_IN_RESULT;
}

// Clears this browser's portal cookie. The session row itself is left alone
// -- the link in the client's inbox should still sign them back in.
export async function portalSignOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(PORTAL_COOKIE_NAME);
  redirect("/portal");
}
