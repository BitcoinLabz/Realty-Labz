"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { portalSessionExpiry } from "@/lib/client-portal";
import { sendPortalAccessEmail } from "@/lib/email";
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

  // Reuse a live session rather than minting a new one on every click. A
  // client who already has the link in their inbox keeps a working link, and
  // the copy-link affordance below always shows the same URL they were sent
  // instead of a different one each time the button is pressed.
  const existing = await prisma.clientPortalSession.findFirst({
    where: { clientId: client.id, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
  });
  const portalSession =
    existing ??
    (await prisma.clientPortalSession.create({
      data: { clientId: client.id, expiresAt: portalSessionExpiry() },
    }));

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
