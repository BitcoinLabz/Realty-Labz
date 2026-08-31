"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { createFileSchema, dealSchema } from "@/lib/validation";
import { ownerOnlyFilter } from "@/lib/authorization";
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
    referralFeePercent: formData.get("referralFeePercent") || undefined,
    teamSplitPercent: formData.get("teamSplitPercent") || undefined,
    otherDeductionsPercent: formData.get("otherDeductionsPercent") || undefined,
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
      where: { id: clientId, ...ownerOnlyFilter(session.user) },
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

  if (clientId) revalidatePath(`/clients/${clientId}`);
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
      where: { id: clientId, ...ownerOnlyFilter(session.user) },
    });
    if (!client) return { error: "Client not found" };
  }

  const resolvedPartner = await resolveReferralPartnerId(referralPartnerId, session.user.id);
  if (!resolvedPartner.ok) return { error: resolvedPartner.error };

  const result = await prisma.deal.updateMany({
    where: { id, ...ownerOnlyFilter(session.user) },
    data: {
      ...rest,
      closingDate: closingDate ? new Date(closingDate) : null,
      clientId: clientId || null,
      referralPartnerId: resolvedPartner.referralPartnerId,
    },
  });

  if (result.count === 0) return { error: "Deal not found" };

  revalidatePath(`/transactions/${id}`);
  if (clientId) revalidatePath(`/clients/${clientId}`);
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

// The guided "Create a file" wizard (/transactions/new) -- resolves the
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

  revalidatePath("/transactions");
  revalidatePath(`/clients/${resolvedClient.clientId}`);
  redirect(`/transactions/${deal.id}`);
}

export async function deleteDealAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const deal = await prisma.deal.findFirst({
    where: { id, ...ownerOnlyFilter(session.user) },
    select: { clientId: true },
  });

  await prisma.deal.deleteMany({ where: { id, ...ownerOnlyFilter(session.user) } });

  if (deal?.clientId) {
    revalidatePath(`/clients/${deal.clientId}`);
    redirect(`/clients/${deal.clientId}`);
  } else {
    redirect("/clients");
  }
}

/**
 * Starts a new transaction pre-filled from an existing one -- same client,
 * side, and commission structure, ready for a new property.
 *
 * Copies fields explicitly rather than spreading the source row, which would
 * carry id/createdAt/updatedAt across. Modelled on
 * createFormTemplateFromLibraryAction.
 *
 * Deliberately does NOT copy deadlines, documents, or signature requests.
 * Deadline dates are absolute and anchored to the old contract, so carrying
 * them over would silently produce a file full of wrong dates -- exactly the
 * mistake deadline sets exist to prevent. Apply a deadline set to the new
 * transaction instead. Documents and signed contracts belong to the
 * transaction they were executed for.
 */
export async function duplicateDealAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const source = await prisma.deal.findFirst({
    where: { id, ...ownerOnlyFilter(session.user) },
  });
  if (!source) return;

  const copy = await prisma.deal.create({
    data: {
      // Always the acting user, even when a manager duplicates a teammate's
      // transaction -- matches how new deals are created everywhere else.
      userId: session.user.id,
      side: source.side,
      clientId: source.clientId,
      referralPartnerId: source.referralPartnerId,
      // The commission structure is the tedious part worth carrying over.
      commissionRate: source.commissionRate,
      commissionAmount: source.commissionAmount,
      brokerageSplitPercent: source.brokerageSplitPercent,
      referralFeePercent: source.referralFeePercent,
      teamSplitPercent: source.teamSplitPercent,
      otherDeductionsPercent: source.otherDeductionsPercent,
      notes: source.notes,
      // Reset everything specific to the old property/contract.
      status: "ACTIVE",
      propertyAddress: null,
      mlsNumber: null,
      listPrice: null,
      salePrice: null,
      closingDate: null,
    },
  });

  revalidatePath("/transactions");
  if (copy.clientId) revalidatePath(`/clients/${copy.clientId}`);
  redirect(`/transactions/${copy.id}`);
}
