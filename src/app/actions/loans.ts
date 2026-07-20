"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loanSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

function parseLoanForm(formData: FormData) {
  return loanSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    purchasePrice: formData.get("purchasePrice"),
    downPayment: formData.get("downPayment") || undefined,
    interestRate: formData.get("interestRate"),
    termMonths: formData.get("termMonths"),
    startDate: formData.get("startDate"),
    annualPropertyTax: formData.get("annualPropertyTax") || undefined,
    annualInsurance: formData.get("annualInsurance") || undefined,
    appreciationRate: formData.get("appreciationRate") || undefined,
    currentHomeValue: formData.get("currentHomeValue") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

export async function createLoanAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseLoanForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { startDate, ...rest } = parsed.data;

  await prisma.loan.create({
    data: { userId: session.user.id, ...rest, startDate: new Date(startDate) },
  });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return {};
}

export async function updateLoanAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing loan id" };

  const parsed = parseLoanForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { startDate, currentHomeValue, ...rest } = parsed.data;

  const result = await prisma.loan.updateMany({
    where: { id, userId: session.user.id },
    // currentHomeValue is explicitly nulled rather than spread with the rest
    // -- Prisma skips `undefined` fields on update, so clearing the field in
    // the form (to go back to "just use the appreciation estimate") would
    // otherwise silently do nothing.
    data: { ...rest, startDate: new Date(startDate), currentHomeValue: currentHomeValue ?? null },
  });

  if (result.count === 0) return { error: "Loan not found" };

  revalidatePath("/finances");
  revalidatePath(`/finances/loans/${id}`);
  revalidatePath("/dashboard");
  return {};
}

export async function deleteLoanAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.loan.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  redirect("/finances/loans");
}
