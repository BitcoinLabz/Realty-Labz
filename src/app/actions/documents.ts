"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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

  const resolved = await resolveClientId(formData.get("clientId"), session.user.id);
  if (!resolved.ok) return { error: resolved.error };

  const storageKey = await saveDocumentFile(session.user.id, file);

  await prisma.document.create({
    data: {
      userId: session.user.id,
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      clientId: resolved.clientId,
    },
  });

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  return {};
}

export async function updateDocumentClientAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const resolved = await resolveClientId(formData.get("clientId"), session.user.id);
  if (!resolved.ok) return;

  await prisma.document.updateMany({
    where: { id, userId: session.user.id },
    data: { clientId: resolved.clientId },
  });

  revalidatePath("/documents");
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

  revalidatePath("/documents");
  revalidatePath("/dashboard");
}
