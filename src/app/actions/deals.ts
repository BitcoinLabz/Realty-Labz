"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createFileSchema, dealSchema } from "@/lib/validation";
import { teamOrOwnFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";

function parseDealForm(formData: FormData) {
  return dealSchema.safeParse({
    side: formData.get("side"),
    status: formData.get("status"),
    propertyAddress: formData.get("propertyAddress") || undefined,
    mlsNumber: formData.get("mlsNumber") || undefined,
    listPrice: formData.get("listPrice") || undefined,
    salePrice: formData.get("salePrice") || undefined,
    commissionRate: formData.get("commissionRate") || undefined,
    commissionAmount: formData.get("commissionAmount") || undefined,
    brokerageSplitPercent: formData.get("brokerageSplitPercent") || undefined,
    referralFeeAmount: formData.get("referralFeeAmount") || undefined,
    teamSplitAmount: formData.get("teamSplitAmount") || undefined,
    otherDeductions: formData.get("otherDeductions") || undefined,
    closingDate: formData.get("closingDate") || undefined,
    notes: formData.get("notes") || undefined,
    clientId: formData.get("clientId") || undefined,
    referralPartnerId: formData.get("referralPartnerId") || undefined,
  });
}

async function resolveReferralPartnerId(
  referralPartnerId: string | undefined,
  userId: string,
): Promise<{ ok: true; referralPartnerId: string | null } | { ok: false; error: string }> {
  if (!referralPartnerId) return { ok: true, referralPartnerId: null };
  // Referral partners are plain userId-scoped, not team-shared -- matches
  // Client's own scoping (see CLAUDE.md).
  const partner = await prisma.referralPartner.findFirst({ where: { id: referralPartnerId, userId } });
  if (!partner) return { ok: false, error: "Referral partner not found" };
  return { ok: true, referralPartnerId };
}

export async function createDealAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseDealForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { clientId, closingDate, referralPartnerId, ...rest } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...teamOrOwnFilter(session.user) },
    });
    if (!client) return { error: "Client not found" };
  }

  const resolvedPartner = await resolveReferralPartnerId(referralPartnerId, session.user.id);
  if (!resolvedPartner.ok) return { error: resolvedPartner.error };

  await prisma.deal.create({
    data: {
      ...rest,
      closingDate: closingDate ? new Date(closingDate) : null,
      clientId: clientId || null,
      referralPartnerId: resolvedPartner.referralPartnerId,
      userId: session.user.id,
    },
  });

  if (clientId) revalidatePath(`/forms/${clientId}`);
  return {};
}

export async function updateDealAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing deal id" };

  const parsed = parseDealForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { clientId, closingDate, referralPartnerId, ...rest } = parsed.data;

  if (clientId) {
    const client = await prisma.client.findFirst({
      where: { id: clientId, ...teamOrOwnFilter(session.user) },
    });
    if (!client) return { error: "Client not found" };
  }

  const resolvedPartner = await resolveReferralPartnerId(referralPartnerId, session.user.id);
  if (!resolvedPartner.ok) return { error: resolvedPartner.error };

  const result = await prisma.deal.updateMany({
    where: { id, ...teamOrOwnFilter(session.user) },
    data: {
      ...rest,
      closingDate: closingDate ? new Date(closingDate) : null,
      clientId: clientId || null,
      referralPartnerId: resolvedPartner.referralPartnerId,
    },
  });

  if (result.count === 0) return { error: "Deal not found" };

  revalidatePath(`/deals/${id}`);
  if (clientId) revalidatePath(`/forms/${clientId}`);
  return {};
}

// Resolves the wizard's client step -- either an existing client the user
// owns, or a brand-new one created inline. Mirrors resolveReferralPartnerId
// above: a discriminated { ok, ... } union the caller short-circuits on.
async function resolveOrCreateClientId(
  data: {
    clientMode: "existing" | "new";
    clientId?: string;
    newClientName?: string;
    newClientEmail?: string;
    newClientPhone?: string;
  },
  userId: string,
  emailDeadlineReminders: boolean,
): Promise<{ ok: true; clientId: string } | { ok: false; error: string }> {
  if (data.clientMode === "existing") {
    // Clients aren't team-shared (see CLAUDE.md) -- plain userId check, same
    // rule every other client-scoped action in this codebase follows.
    const client = await prisma.client.findFirst({ where: { id: data.clientId, userId } });
    if (!client) return { ok: false, error: "Client not found" };
    return { ok: true, clientId: client.id };
  }

  const created = await prisma.client.create({
    data: {
      userId,
      name: data.newClientName!,
      email: data.newClientEmail || null,
      phone: data.newClientPhone || null,
      emailDeadlineReminders,
    },
  });
  return { ok: true, clientId: created.id };
}

// The guided "Create a file" wizard (/forms/files/new) -- resolves the
// client (existing pick or inline create) and creates the Deal in one
// submit, rather than requiring a separate trip to a client's page first.
export async function createFileAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = createFileSchema.safeParse({
    side: formData.get("side"),
    propertyAddress: formData.get("propertyAddress") || undefined,
    mlsNumber: formData.get("mlsNumber") || undefined,
    clientMode: formData.get("clientMode"),
    clientId: formData.get("clientId") || undefined,
    newClientName: formData.get("newClientName") || undefined,
    newClientEmail: formData.get("newClientEmail") || undefined,
    newClientPhone: formData.get("newClientPhone") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const resolvedClient = await resolveOrCreateClientId(
    parsed.data,
    session.user.id,
    formData.get("emailDeadlineReminders") === "true",
  );
  if (!resolvedClient.ok) return { error: resolvedClient.error };

  const deal = await prisma.deal.create({
    data: {
      side: parsed.data.side,
      propertyAddress: parsed.data.propertyAddress || null,
      mlsNumber: parsed.data.mlsNumber || null,
      clientId: resolvedClient.clientId,
      userId: session.user.id,
    },
  });

  revalidatePath("/forms/files");
  revalidatePath(`/forms/${resolvedClient.clientId}`);
  redirect(`/deals/${deal.id}`);
}

export async function deleteDealAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const deal = await prisma.deal.findFirst({
    where: { id, ...teamOrOwnFilter(session.user) },
    select: { clientId: true },
  });

  await prisma.deal.deleteMany({ where: { id, ...teamOrOwnFilter(session.user) } });

  if (deal?.clientId) {
    revalidatePath(`/forms/${deal.clientId}`);
    redirect(`/forms/${deal.clientId}`);
  } else {
    redirect("/forms");
  }
}
