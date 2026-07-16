"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { transactionSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

function parseTransactionForm(formData: FormData) {
  const type = formData.get("type");
  return transactionSchema.safeParse({
    type,
    category: type === "EXPENSE" ? (formData.get("category") ?? undefined) : undefined,
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
    date: formData.get("date"),
  });
}

export async function createTransactionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseTransactionForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { type, category, amount, description, date } = parsed.data;

  await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type,
      category: type === "EXPENSE" ? category! : "OTHER",
      amount,
      description,
      date: new Date(date),
    },
  });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return {};
}

export async function updateTransactionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing transaction id" };

  const parsed = parseTransactionForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { type, category, amount, description, date } = parsed.data;

  const result = await prisma.transaction.updateMany({
    where: { id, userId: session.user.id },
    data: {
      type,
      category: type === "EXPENSE" ? category! : "OTHER",
      amount,
      description,
      date: new Date(date),
    },
  });

  if (result.count === 0) return { error: "Transaction not found" };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTransactionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.transaction.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}
