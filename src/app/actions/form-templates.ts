"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageSharedResources, teamSharedFilter } from "@/lib/authorization";
import {
  MAX_FILE_SIZE_BYTES,
  copyDocumentFile,
  deleteDocumentFile,
  saveDocumentFile,
} from "@/lib/document-storage";
import type { FormState } from "@/app/actions/auth";

// Only PDFs — unlike DocumentTemplate (which also allows Word docs/images),
// a form template needs a real PDF for pdfjs to render and pdf-lib to
// finalize.
const FORM_TEMPLATE_ALLOWED_MIME_TYPES = ["application/pdf"];

export async function uploadFormTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  if (!canManageSharedResources(session.user)) {
    return { error: "Only a manager can add form templates" };
  }

  const name = formData.get("name");
  if (typeof name !== "string" || !name.trim()) {
    return { fieldErrors: { name: "Give this template a name" } };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { fieldErrors: { file: "Choose a PDF to upload" } };
  }
  if (!FORM_TEMPLATE_ALLOWED_MIME_TYPES.includes(file.type)) {
    return { fieldErrors: { file: "Only PDF files are supported" } };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { fieldErrors: { file: "File must be under 15MB" } };
  }

  const storageKey = await saveDocumentFile(session.user.id, file);

  const template = await prisma.formTemplate.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      fileName: file.name,
      storageKey,
      mimeType: file.type,
      size: file.size,
      // A template needs at least one signer role to place any field
      // against — start with one so the designer isn't a dead end.
      signers: { create: { order: 1, label: "Signer 1" } },
    },
  });

  revalidatePath("/forms/templates");
  redirect(`/forms/templates/${template.id}`);
}

export async function deleteFormTemplateAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  if (!canManageSharedResources(session.user)) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const template = await prisma.formTemplate.findFirst({
    where: { id, ...teamSharedFilter(session.user) },
  });
  if (!template) return;

  await prisma.formTemplate.delete({ where: { id: template.id } });
  await deleteDocumentFile(template.storageKey);

  revalidatePath("/forms/templates");
  redirect("/forms/templates");
}

// Promotes a raw library file (DocumentTemplate) into a new fillable
// FormTemplate — SkySlope's "start a template from a library form" flow.
// Copies the PDF to a fresh storage key (see copyDocumentFile) rather than
// pointing the new template at the library file's own key, so the two rows
// stay fully independent — deleting the library original later can't break
// a template already built from it, and vice versa.
export async function createFormTemplateFromLibraryAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  if (!canManageSharedResources(session.user)) return;

  const documentTemplateId = formData.get("documentTemplateId");
  if (typeof documentTemplateId !== "string" || !documentTemplateId) return;

  const libraryDoc = await prisma.documentTemplate.findFirst({
    where: { id: documentTemplateId, ...teamSharedFilter(session.user) },
  });
  if (!libraryDoc) return;
  // Only a PDF can go through the pdfjs/pdf-lib field designer — the
  // "Create fillable template" button is already hidden for non-PDF rows,
  // this is a defensive server-side re-check of the same rule.
  if (libraryDoc.mimeType !== "application/pdf") return;

  const storageKey = await copyDocumentFile(libraryDoc.storageKey, session.user.id, libraryDoc.mimeType);

  const template = await prisma.formTemplate.create({
    data: {
      userId: session.user.id,
      name: libraryDoc.name,
      fileName: libraryDoc.fileName,
      storageKey,
      mimeType: libraryDoc.mimeType,
      size: libraryDoc.size,
      signers: { create: { order: 1, label: "Signer 1" } },
    },
  });

  revalidatePath("/forms/templates");
  redirect(`/forms/templates/${template.id}`);
}

async function assertTemplateManageAccess(
  templateId: string,
  sessionUser: Parameters<typeof teamSharedFilter>[0],
) {
  if (!canManageSharedResources(sessionUser)) return null;
  return prisma.formTemplate.findFirst({
    where: { id: templateId, ...teamSharedFilter(sessionUser) },
  });
}

async function assertNotYetSent(templateId: string) {
  const count = await prisma.formSubmission.count({ where: { formTemplateId: templateId } });
  return count === 0;
}

export async function addTemplateSignerAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const templateId = formData.get("templateId");
  const label = formData.get("label");
  if (typeof templateId !== "string" || !templateId) return { error: "Missing template" };
  if (typeof label !== "string" || !label.trim()) {
    return { fieldErrors: { label: "Give this signer a label" } };
  }

  const template = await assertTemplateManageAccess(templateId, session.user);
  if (!template) return { error: "Template not found" };
  if (!(await assertNotYetSent(templateId))) {
    return { error: "This template has already been sent — create a new template to change signers" };
  }

  const maxOrder = await prisma.formTemplateSigner.aggregate({
    where: { formTemplateId: templateId },
    _max: { order: true },
  });

  await prisma.formTemplateSigner.create({
    data: {
      formTemplateId: templateId,
      order: (maxOrder._max.order ?? 0) + 1,
      label: label.trim(),
    },
  });

  revalidatePath(`/forms/templates/${templateId}`);
  return {};
}

export async function deleteTemplateSignerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const templateId = formData.get("templateId");
  const signerId = formData.get("signerId");
  if (typeof templateId !== "string" || typeof signerId !== "string") return;

  const template = await assertTemplateManageAccess(templateId, session.user);
  if (!template) return;
  if (!(await assertNotYetSent(templateId))) return;

  const remaining = await prisma.formTemplateSigner.count({ where: { formTemplateId: templateId } });
  if (remaining <= 1) return;

  // Scoped by both id AND formTemplateId -- id alone would let a user who
  // manages ANY template (to pass assertTemplateManageAccess above) delete a
  // signer role belonging to a completely different tenant's template, since
  // FormTemplateSigner.id carries no ownership information of its own.
  await prisma.formTemplateSigner.deleteMany({ where: { id: signerId, formTemplateId: templateId } });

  revalidatePath(`/forms/templates/${templateId}`);
}

const FIELD_TYPES = ["TEXT", "DATE", "CHECKBOX", "SIGNATURE", "INITIALS"] as const;
const AUTO_FILL_SOURCES = [
  "CLIENT_NAME",
  "CLIENT_EMAIL",
  "CLIENT_PHONE",
  "DEAL_PROPERTY_ADDRESS",
  "DEAL_MLS_NUMBER",
  "DEAL_LIST_PRICE",
  "DEAL_SALE_PRICE",
  "DEAL_CLOSING_DATE",
] as const;

type FieldInput = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type: (typeof FIELD_TYPES)[number];
  label: string;
  required: boolean;
  order: number;
  signerId: string;
  autoFillSource: (typeof AUTO_FILL_SOURCES)[number] | null;
};

function isValidFieldInput(f: unknown): f is FieldInput {
  if (!f || typeof f !== "object") return false;
  const field = f as Record<string, unknown>;
  if (
    !(
      typeof field.page === "number" &&
      typeof field.x === "number" &&
      typeof field.y === "number" &&
      typeof field.width === "number" &&
      typeof field.height === "number" &&
      typeof field.label === "string" &&
      typeof field.required === "boolean" &&
      typeof field.order === "number" &&
      typeof field.signerId === "string" &&
      FIELD_TYPES.includes(field.type as (typeof FIELD_TYPES)[number])
    )
  ) {
    return false;
  }
  if (field.autoFillSource !== null && field.autoFillSource !== undefined) {
    if (!AUTO_FILL_SOURCES.includes(field.autoFillSource as (typeof AUTO_FILL_SOURCES)[number])) return false;
    // Only TEXT/DATE fields can be bound to an auto-fill source — a
    // signature/checkbox can't be populated from a string value.
    if (field.type !== "TEXT" && field.type !== "DATE") return false;
  }
  return true;
}

// Replaces every field on the template in one pass — simpler than diffing
// individual add/move/resize/delete operations from the interactive
// designer canvas, and safe because editing is blocked entirely once a
// template has been sent (see assertNotYetSent). The designer keeps field
// placement in local React state and submits the whole array as one JSON
// blob in a hidden input — the field-designer canvas isn't a good fit for
// per-field form submissions.
export async function saveFormFieldsAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const templateId = formData.get("templateId");
  const fieldsJson = formData.get("fields");
  if (typeof templateId !== "string" || !templateId) return { error: "Missing template" };
  if (typeof fieldsJson !== "string") return { error: "Missing fields" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(fieldsJson);
  } catch {
    return { error: "Malformed field data" };
  }
  if (!Array.isArray(parsed) || !parsed.every(isValidFieldInput)) {
    return { error: "Malformed field data" };
  }
  const fields = parsed;

  const template = await assertTemplateManageAccess(templateId, session.user);
  if (!template) return { error: "Template not found" };
  if (!(await assertNotYetSent(templateId))) {
    return { error: "This template has already been sent — create a new template to change its fields" };
  }

  const validSignerIds = new Set(
    (await prisma.formTemplateSigner.findMany({ where: { formTemplateId: templateId }, select: { id: true } })).map(
      (s) => s.id,
    ),
  );
  if (fields.some((f) => !validSignerIds.has(f.signerId))) {
    return { error: "One or more fields reference an unknown signer" };
  }

  await prisma.$transaction([
    prisma.formField.deleteMany({ where: { formTemplateId: templateId } }),
    prisma.formField.createMany({
      data: fields.map((f) => ({ ...f, formTemplateId: templateId })),
    }),
  ]);

  revalidatePath(`/forms/templates/${templateId}`);
  return {};
}
