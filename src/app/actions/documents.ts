"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWorkOfficeChecklist, dealReadFilter, ownerOnlyFilter } from "@/lib/authorization";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  deleteDocumentFile,
  saveDocumentFile,
} from "@/lib/document-storage";
import type { FormState } from "@/app/actions/auth";
import { storageBlockMessage } from "@/lib/user-plan";

// A paperwork-list item id from the browser, accepted only if it belongs to
// the given office. Anything else is dropped (the upload still succeeds, just
// isn't counted against an item).
async function resolveRequirementId(raw: FormDataEntryValue | null, teamId: string | null): Promise<string | null> {
  if (typeof raw !== "string" || !raw || !teamId) return null;
  const requirement = await prisma.requiredDocument.findFirst({ where: { id: raw, teamId }, select: { id: true } });
  return requirement?.id ?? null;
}

async function resolveClientId(
  clientId: FormDataEntryValue | null,
  userId: string,
): Promise<{ ok: true; clientId: string | null } | { ok: false; error: string }> {
  if (typeof clientId !== "string" || clientId === "") {
    return { ok: true, clientId: null };
  }

  const client = await prisma.client.findFirst({ where: { id: clientId, userId } });
  if (!client) return { ok: false, error: "Client not found" };

  return { ok: true, clientId };
}

async function resolveDealId(
  dealId: FormDataEntryValue | null,
  sessionUser: Parameters<typeof ownerOnlyFilter>[0],
): Promise<{ ok: true; dealId: string | null } | { ok: false; error: string }> {
  if (typeof dealId !== "string" || dealId === "") {
    return { ok: true, dealId: null };
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...ownerOnlyFilter(sessionUser) },
  });
  if (!deal) return { ok: false, error: "Deal not found" };

  return { ok: true, dealId };
}

export async function uploadDocumentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a file to upload" } };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { fieldErrors: { file: "Only PDF, Word, and image files are supported" } };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { fieldErrors: { file: "File must be under 15MB" } };
  }

  const resolvedClient = await resolveClientId(formData.get("clientId"), session.user.id);
  if (!resolvedClient.ok) return { error: resolvedClient.error };

  const resolvedDeal = await resolveDealId(formData.get("dealId"), session.user);
  if (!resolvedDeal.ok) return { error: resolvedDeal.error };

  // Uploaded next to an item on the office's paperwork list. Only counts on a
  // transaction, and only against the uploader's own office's list.
  const requirementId = await resolveRequirementId(
    formData.get("requirementId"),
    resolvedDeal.dealId ? session.user.teamId : null,
  );

  // Every failure in here used to be an uncaught throw: a missing Supabase
  // env var on the host, a missing bucket, and a file whose bytes don't match
  // its extension all crashed the action identically, so an upload just
  // appeared to do nothing at all. The real reason now goes to the server log
  // (readable in Vercel's function logs) and the user gets something
  // actionable instead of silence.
  // Free accounts hold 250 MB (src/lib/plan.ts); Pro is unlimited.
  const overLimit = await storageBlockMessage(session.user.id, file.size);
  if (overLimit) return { fieldErrors: { file: overLimit } };

  let storageKey: string;
  try {
    storageKey = await saveDocumentFile(session.user.id, file);
  } catch (err) {
    console.error("[documents] upload failed", err);
    return {
      fieldErrors: {
        file:
          err instanceof Error && err.message.includes("doesn't match")
            ? "That file's contents don't match its file type. Try re-saving or re-exporting it."
            : "Couldn't save the file — this is usually a storage setup problem, not your file.",
      },
    };
  }

  await prisma.document.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      clientId: resolvedClient.clientId,
      dealId: resolvedDeal.dealId,
      requirementId,
      // Forms that offer the choice send a "visibilityChoice" marker, since an
      // unchecked checkbox submits nothing at all and would be
      // indistinguishable from a form that never asked. Everywhere else keeps
      // the column default (visible).
      ...(formData.has("visibilityChoice")
        ? { visibleToClient: formData.get("visibleToClient") === "on" }
        : {}),
    },
  });

  revalidatePath("/clients");
  revalidatePath("/finances");
  if (resolvedClient.clientId) revalidatePath(`/clients/${resolvedClient.clientId}`);
  revalidatePath("/dashboard");
  if (resolvedDeal.dealId) revalidatePath(`/transactions/${resolvedDeal.dealId}`);
  return {};
}

export async function updateDocumentLinksAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const existing = await prisma.document.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return;

  const resolvedClient = await resolveClientId(formData.get("clientId"), session.user.id);
  if (!resolvedClient.ok) return;

  const resolvedDeal = await resolveDealId(formData.get("dealId"), session.user);
  if (!resolvedDeal.ok) return;

  await prisma.document.updateMany({
    where: { id, userId: session.user.id },
    data: { clientId: resolvedClient.clientId, dealId: resolvedDeal.dealId },
  });

  // Revalidate both where the document used to show up and where it shows
  // up now — a plain updateMany() blind write doesn't know either side, so
  // we look the row up first specifically to get this right.
  revalidatePath("/clients");
  revalidatePath("/finances");
  if (existing.clientId) revalidatePath(`/clients/${existing.clientId}`);
  if (resolvedClient.clientId && resolvedClient.clientId !== existing.clientId) {
    revalidatePath(`/clients/${resolvedClient.clientId}`);
  }
  if (existing.dealId) revalidatePath(`/transactions/${existing.dealId}`);
  if (resolvedDeal.dealId && resolvedDeal.dealId !== existing.dealId) {
    revalidatePath(`/transactions/${resolvedDeal.dealId}`);
  }
}

// The "Visible to client" switch on a client's Documents tab. Owner-only,
// like every other document write (see ownerOnlyFilter in CLAUDE.md).
export async function setDocumentVisibilityAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;
  const visible = formData.get("visible") === "true";

  const doc = await prisma.document.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, clientId: true },
  });
  if (!doc) return;

  await prisma.document.updateMany({
    where: { id: doc.id, userId: session.user.id },
    data: { visibleToClient: visible },
  });

  if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);
}

export async function deleteDocumentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const doc = await prisma.document.findFirst({ where: { id, userId: session.user.id } });
  if (!doc) return;

  await prisma.document.delete({ where: { id: doc.id } });
  await deleteDocumentFile(doc.storageKey);

  revalidatePath("/clients");
  revalidatePath("/finances");
  if (doc.clientId) revalidatePath(`/clients/${doc.clientId}`);
  revalidatePath("/dashboard");
  if (doc.dealId) revalidatePath(`/transactions/${doc.dealId}`);
}

// The office files a document into an agent's transaction (2026-10-02).
// Brokers don't create transactions, but they keep paperwork organised.
// The deal must be one this manager can read (dealReadFilter -- never a file
// the agent hid) on their own team. Stored under the uploader, so the agent
// sees and downloads it but can't delete it; no clientId, because client
// files stay the agent's (and so it never appears in the client portal).
export async function uploadOfficeDocumentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!canWorkOfficeChecklist(session.user)) return { error: "Only your office can add documents here" };

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return { error: "Missing transaction" };
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...dealReadFilter(session.user), user: { teamId: session.user.teamId } },
    select: { id: true },
  });
  if (!deal) return { error: "Transaction not found" };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { fieldErrors: { file: "Choose a file to upload" } };
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { fieldErrors: { file: "Only PDF, Word, and image files are supported" } };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) return { fieldErrors: { file: "File must be under 15MB" } };

  // Free accounts hold 250 MB (src/lib/plan.ts); Pro is unlimited.
  const overLimit = await storageBlockMessage(session.user.id, file.size);
  if (overLimit) return { fieldErrors: { file: overLimit } };

  let storageKey: string;
  try {
    storageKey = await saveDocumentFile(session.user.id, file);
  } catch (err) {
    console.error("[documents] office upload failed", err);
    return { fieldErrors: { file: "Couldn't save the file. Try re-saving it and uploading again." } };
  }

  await prisma.document.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      dealId: deal.id,
      requirementId: await resolveRequirementId(formData.get("requirementId"), session.user.teamId),
    },
  });

  revalidatePath(`/transactions/${deal.id}`);
  revalidatePath("/team");
  return { success: "Uploaded" };
}

// "Counts as…": match a document already on a transaction to an item on the
// office's paperwork list, or clear it. Allowed for the transaction's owner,
// or for the office on a file it can read -- the two parties who see the list.
export async function setDocumentRequirementAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...dealReadFilter(session.user) },
    select: { id: true, userId: true, user: { select: { teamId: true } } },
  });
  if (!deal) return;

  const isOwner = deal.userId === session.user.id;
  const isOffice =
    canWorkOfficeChecklist(session.user) && !!deal.user.teamId && deal.user.teamId === session.user.teamId;
  if (!isOwner && !isOffice) return;

  // The list belongs to the agent's office.
  const requirementId = await resolveRequirementId(formData.get("requirementId"), deal.user.teamId);

  await prisma.document.updateMany({ where: { id, dealId: deal.id }, data: { requirementId } });
  revalidatePath(`/transactions/${deal.id}`);
  revalidatePath("/team");
}
