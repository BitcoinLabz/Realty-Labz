"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { budgetSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

function parseBudgetForm(formData: FormData) {
  return budgetSchema.safeParse({
    scope: formData.get("scope"),
    category: formData.get("category") || undefined,
    monthlyLimit: formData.get("monthlyLimit"),
  });
}

export async function createBudgetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseBudgetForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { scope, category, monthlyLimit } = parsed.data;

  try {
    await prisma.budget.create({
      data: { userId: session.user.id, scope, category: category ?? null, monthlyLimit },
    });
  } catch {
    // Unique constraint on [userId, scope, category] -- a budget for this
    // exact scope+category combo already exists.
    return { error: "A budget for this already exists — edit or delete it instead of adding another." };
  }

  revalidatePath("/finances");
  return {};
}

export async function updateBudgetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing budget id" };

  const monthlyLimit = formData.get("monthlyLimit");
  const parsed = budgetSchema.pick({ monthlyLimit: true }).safeParse({ monthlyLimit });
  if (!parsed.success) {
    return { fieldErrors: { monthlyLimit: parsed.error.issues[0]?.message ?? "Invalid amount" } };
  }

  const result = await prisma.budget.updateMany({
    where: { id, userId: session.user.id },
    data: { monthlyLimit: parsed.data.monthlyLimit },
  });

  if (result.count === 0) return { error: "Budget not found" };

  revalidatePath("/finances");
  return {};
}

export async function deleteBudgetAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.budget.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
}
