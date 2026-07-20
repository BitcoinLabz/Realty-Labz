"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { loanExtraPaymentSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function createExtraPaymentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const loanId = formData.get("loanId");
  if (typeof loanId !== "string" || !loanId) return { error: "Missing loan id" };

  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId: session.user.id } });
  if (!loan) return { error: "Loan not found" };

  const parsed = loanExtraPaymentSchema.safeParse({
    date: formData.get("date"),
    amount: formData.get("amount"),
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.loanExtraPayment.create({
    data: {
      loanId,
      date: new Date(parsed.data.date),
      amount: parsed.data.amount,
      notes: parsed.data.notes,
    },
  });

  revalidatePath(`/finances/loans/${loanId}`);
  revalidatePath("/finances");
  return {};
}

export async function deleteExtraPaymentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const loanId = formData.get("loanId");
  if (typeof id !== "string" || !id || typeof loanId !== "string" || !loanId) return;

  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId: session.user.id } });
  if (!loan) return;

  await prisma.loanExtraPayment.deleteMany({ where: { id, loanId } });

  revalidatePath(`/finances/loans/${loanId}`);
  revalidatePath("/finances");
}
