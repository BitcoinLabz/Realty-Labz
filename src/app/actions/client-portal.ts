"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { portalSessionExpiry } from "@/lib/client-portal";
import { sendPortalAccessEmail } from "@/lib/email";
import type { FormState } from "@/app/actions/auth";

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Clients aren't team-shared (see CLAUDE.md) -- plain userId ownership check,
// same as every other Client-scoped action.
export async function sendPortalAccessAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || !clientId) return { error: "Missing client id" };

  const client = await prisma.client.findFirst({ where: { id: clientId, userId: session.user.id } });
  if (!client) return { error: "Client not found" };
  if (!client.email) return { error: "This client has no email address on file" };

  const portalSession = await prisma.clientPortalSession.create({
    data: { clientId: client.id, expiresAt: portalSessionExpiry() },
  });

  const baseUrl = await getBaseUrl();
  try {
    await sendPortalAccessEmail({
      to: client.email,
      clientName: client.name,
      senderName: session.user.name ?? "Your agent",
      portalUrl: `${baseUrl}/portal/${portalSession.id}`,
    });
  } catch {
    // Same fallback philosophy as Forms/TeamInvite -- the session (and its
    // link) still exists even if email delivery isn't configured or fails;
    // nothing here surfaces the raw link back to the agent yet, matching
    // this being a lightweight first pass, not a full resend/copy-link UI.
    return { error: "Couldn't send the email — check Resend is configured" };
  }

  revalidatePath(`/clients/${clientId}`);
  return {};
}
