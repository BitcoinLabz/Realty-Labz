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
import { storageBlockMessage } from "@/lib/user-plan";
import { homeOfficeExpenseSchema, homeOfficeSetupSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

// Home office actions (2026-11-19). Every read and write is scoped by the
// signed-in user's id -- a home office is personal data, never team-visible
// and never writable by a manager (see "Personal financial data is never
// team-visible" in CLAUDE.md).

function revalidateAll() {
  revalidatePath("/home-office");
  revalidatePath("/finances");
  revalidatePath("/finances/taxes");
  revalidatePath("/dashboard");
}

function fieldErrorsOf(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return fieldErrors;
}

// An empty input means "not set", written back as null so clearing a field
// actually clears it (Prisma skips undefined on update).
function blank(formData: FormData, name: string): FormDataEntryValue | undefined {
  const v = formData.get(name);
  return v === null || v === "" ? undefined : v;
}

export async function saveHomeOfficeSetupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = homeOfficeSetupSchema.safeParse({
    officeLengthFt: blank(formData, "officeLengthFt"),
    officeWidthFt: blank(formData, "officeWidthFt"),
    officeSqFt: blank(formData, "officeSqFt"),
    homeSqFt: blank(formData, "homeSqFt"),
    businessUseStart: blank(formData, "businessUseStart"),
    ownership: formData.get("ownership") === "RENT" ? "RENT" : "OWN",
    purchasePrice: blank(formData, "purchasePrice"),
    landValue: blank(formData, "landValue"),
    improvementsCost: blank(formData, "improvementsCost"),
    fairMarketValueAtStart: blank(formData, "fairMarketValueAtStart"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;

  // Length x width wins when both are given, so the square footage can't
  // disagree with the dimensions shown next to it.
  const officeSqFt =
    v.officeLengthFt && v.officeWidthFt ? Math.round(v.officeLengthFt * v.officeWidthFt) : (v.officeSqFt ?? null);
  if (officeSqFt && v.homeSqFt && officeSqFt > v.homeSqFt) {
    return { fieldErrors: { officeWidthFt: "The office can't be bigger than the home" } };
  }

  const owned = v.ownership === "OWN";
  const data = {
    officeLengthFt: v.officeLengthFt ?? null,
    officeWidthFt: v.officeWidthFt ?? null,
    officeSqFt,
    homeSqFt: v.homeSqFt ?? null,
    businessUseStart: v.businessUseStart ? new Date(`${v.businessUseStart}T00:00:00.000Z`) : null,
    ownership: v.ownership,
    // A renter has nothing to depreciate; clear stale purchase details.
    purchasePrice: owned ? (v.purchasePrice ?? null) : null,
    landValue: owned ? (v.landValue ?? null) : null,
    improvementsCost: owned ? (v.improvementsCost ?? null) : null,
    fairMarketValueAtStart: owned ? (v.fairMarketValueAtStart ?? null) : null,
  };

  await prisma.homeOffice.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });
  revalidateAll();
  return {};
}

export async function saveEligibilityAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const answer = (name: string) => {
    const v = formData.get(name);
    return v === "yes" ? true : v === "no" ? false : null;
  };
  const data = {
    regularUse: answer("regularUse"),
    exclusiveUse: answer("exclusiveUse"),
    principalPlace: answer("principalPlace"),
  };
  await prisma.homeOffice.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });
  revalidateAll();
  return {};
}

export async function chooseHomeOfficeMethodAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const year = Number(formData.get("year"));
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
  const raw = formData.get("method");
  const method = raw === "SIMPLIFIED" || raw === "REGULAR" ? raw : null; // null = follow the recommendation

  await prisma.homeOfficeYear.upsert({
    where: { userId_year: { userId: session.user.id, year } },
    update: { method },
    create: { userId: session.user.id, year, method },
  });
  revalidateAll();
}

export async function addHomeOfficeExpenseAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  const userId = session.user.id;

  const parsed = homeOfficeExpenseSchema.safeParse({
    kind: formData.get("kind"),
    scope: formData.get("scope") === "DIRECT" ? "DIRECT" : "INDIRECT",
    period: formData.get("period") === "YEAR" ? "YEAR" : "MONTH",
    month: blank(formData, "month"),
    year: blank(formData, "year"),
    amount: formData.get("amount"),
    description: blank(formData, "description"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error.issues) };
  const v = parsed.data;

  let date: Date;
  if (v.period === "MONTH") {
    if (!v.month) return { fieldErrors: { month: "Pick the month this bill is for" } };
    date = new Date(`${v.month}-01T00:00:00.000Z`);
  } else {
    if (!v.year) return { fieldErrors: { year: "Pick the year" } };
    date = new Date(Date.UTC(v.year, 0, 1));
  }

  // Optional receipt: same checks and storage limit as every other upload.
  const file = formData.get("receipt");
  let receiptId: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { fieldErrors: { receipt: "Only PDF, Word, and image files are supported" } };
    }
    if (file.size > MAX_FILE_SIZE_BYTES) return { fieldErrors: { receipt: "File must be under 15MB" } };
    const overLimit = await storageBlockMessage(userId, file.size);
    if (overLimit) return { fieldErrors: { receipt: overLimit } };
    try {
      const storageKey = await saveDocumentFile(userId, file);
      const doc = await prisma.document.create({
        data: { userId, fileName: file.name, storageKey, mimeType: file.type, size: file.size },
        select: { id: true },
      });
      receiptId = doc.id;
    } catch (err) {
      console.error("[home-office] receipt upload failed", err);
      return { fieldErrors: { receipt: "Couldn't save the receipt. Try again, or add it later." } };
    }
  }

  await prisma.homeOfficeExpense.create({
    data: {
      userId,
      kind: v.kind,
      scope: v.scope,
      period: v.period,
      date,
      amount: v.amount,
      description: v.description ?? null,
      receiptId,
    },
  });
  revalidateAll();
  return {};
}

export async function deleteHomeOfficeExpenseAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  const id = formData.get("id");
  if (typeof id !== "string") return;

  // Compound where: an id from the browser only ever reaches the caller's own row.
  const expense = await prisma.homeOfficeExpense.findFirst({
    where: { id, userId: session.user.id },
    include: { receipt: { select: { id: true, storageKey: true } } },
  });
  if (!expense) return;

  await prisma.homeOfficeExpense.delete({ where: { id: expense.id } });
  // The receipt only existed for this expense; remove it too.
  if (expense.receipt) {
    await prisma.document.deleteMany({ where: { id: expense.receipt.id, userId: session.user.id } });
    try {
      await deleteDocumentFile(expense.receipt.storageKey);
    } catch (err) {
      console.error("[home-office] receipt file delete failed", err);
    }
  }
  revalidateAll();
}
