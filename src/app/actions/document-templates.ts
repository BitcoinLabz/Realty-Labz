"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamSharedFilter } from "@/lib/authorization";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  deleteDocumentFile,
  saveDocumentFile,
} from "@/lib/document-storage";
import type { FormState } from "@/app/actions/auth";

export async function uploadTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!canManageSharedResources(session.user)) {
    return { error: "Only a manager can add team templates" };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { fieldErrors: { name: "Give this template a name" } };
  }

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

  const storageKey = await saveDocumentFile(session.user.id, file);

  await prisma.documentTemplate.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
    },
  });

  revalidatePath("/clients");
  return {};
}

export async function deleteTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  if (!canManageSharedResources(session.user)) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const template = await prisma.documentTemplate.findFirst({
    where: { id, ...teamSharedFilter(session.user) },
  });
  if (!template) return;

  await prisma.documentTemplate.delete({ where: { id: template.id } });
  await deleteDocumentFile(template.storageKey);

  revalidatePath("/clients");
}
