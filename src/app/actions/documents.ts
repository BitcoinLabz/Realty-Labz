"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  deleteDocumentFile,
  saveDocumentFile,
} from "@/lib/document-storage";
import type { FormState } from "@/app/actions/auth";

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
  sessionUser: Parameters<typeof teamOrOwnFilter>[0],
): Promise<{ ok: true; dealId: string | null } | { ok: false; error: string }> {
  if (typeof dealId !== "string" || dealId === "") {
    return { ok: true, dealId: null };
  }

  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...teamOrOwnFilter(sessionUser) },
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

  const storageKey = await saveDocumentFile(session.user.id, file);

  await prisma.document.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      clientId: resolvedClient.clientId,
      dealId: resolvedDeal.dealId,
    },
  });

  revalidatePath("/forms");
  revalidatePath("/finances");
  if (resolvedClient.clientId) revalidatePath(`/forms/${resolvedClient.clientId}`);
  revalidatePath("/dashboard");
  if (resolvedDeal.dealId) revalidatePath(`/deals/${resolvedDeal.dealId}`);
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
  revalidatePath("/forms");
  revalidatePath("/finances");
  if (existing.clientId) revalidatePath(`/forms/${existing.clientId}`);
  if (resolvedClient.clientId && resolvedClient.clientId !== existing.clientId) {
    revalidatePath(`/forms/${resolvedClient.clientId}`);
  }
  if (existing.dealId) revalidatePath(`/deals/${existing.dealId}`);
  if (resolvedDeal.dealId && resolvedDeal.dealId !== existing.dealId) {
    revalidatePath(`/deals/${resolvedDeal.dealId}`);
  }
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

  revalidatePath("/forms");
  revalidatePath("/finances");
  if (doc.clientId) revalidatePath(`/forms/${doc.clientId}`);
  revalidatePath("/dashboard");
  if (doc.dealId) revalidatePath(`/deals/${doc.dealId}`);
}
