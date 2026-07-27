"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { recurringTransactionSchema } from "@/lib/validation";
import { advanceDueDate } from "@/lib/recurring";
import type { FormState } from "@/app/actions/auth";

function parseRecurringForm(formData: FormData) {
  const type = formData.get("type");
  const scope = formData.get("scope") || "BUSINESS";
  return recurringTransactionSchema.safeParse({
    scope,
    type,
    category:
      scope === "BUSINESS" && type === "EXPENSE" ? (formData.get("category") ?? undefined) : undefined,
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
    frequency: formData.get("frequency"),
    nextDueDate: formData.get("nextDueDate"),
  });
}

export async function createRecurringTransactionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parseRecurringForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { scope, type, category, amount, description, frequency, nextDueDate } = parsed.data;

  await prisma.recurringTransactionTemplate.create({
    data: {
      userId: session.user.id,
      scope,
      type,
      category: scope === "BUSINESS" && type === "EXPENSE" ? (category ?? null) : null,
      amount,
      description,
      frequency,
      nextDueDate: new Date(nextDueDate),
    },
  });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteRecurringTransactionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.recurringTransactionTemplate.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
  revalidatePath("/dashboard");
}

// The "Log it" button on a due-now reminder card -- creates a real
// Transaction from the template and advances nextDueDate by one frequency
// interval (see src/lib/recurring.ts's advanceDueDate). Deliberately not
// automatic/silent: this is the one moment a recurring template actually
// becomes a real ledger entry, and it only happens on an explicit click.
export async function logRecurringTransactionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const template = await prisma.recurringTransactionTemplate.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!template) return;

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        userId: session.user.id,
        type: template.type,
        scope: template.scope,
        category: template.category,
        amount: template.amount,
        description: template.description,
        date: new Date(),
      },
    }),
    prisma.recurringTransactionTemplate.update({
      where: { id: template.id },
      data: {
        nextDueDate: advanceDueDate(template.nextDueDate, template.frequency),
        lastLoggedAt: new Date(),
      },
    }),
  ]);

  revalidatePath("/finances");
  revalidatePath("/dashboard");
}
