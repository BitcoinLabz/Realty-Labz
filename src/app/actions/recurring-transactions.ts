"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { recurringTransactionSchema } from "@/lib/validation";
import { computeCatchUp, parseDateOnlyLocal, splitByBusinessUse } from "@/lib/recurring";
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
    // Only meaningful for EXPENSE -- see the schema comment on
    // RecurringTransactionTemplate.businessUsePercent.
    businessUsePercent: type === "EXPENSE" ? formData.get("businessUsePercent") || undefined : undefined,
  });
}

// Runs on every authenticated page load (see src/app/(app)/layout.tsx) --
// auto-logs any recurring cost whose due date has arrived, with no manual
// "Log it" click (2026-07-27 direct founder request, reversing the earlier
// reminder-only design). Each logged Transaction is dated the ACTUAL due
// date it was for (not "today"), and a template that's several periods
// behind -- e.g. just created with a start date months in the past --
// catches up on every missed period in one pass. See computeCatchUp in
// src/lib/recurring.ts for the (separately unit-tested) date math this
// builds on.
export async function autoLogDueRecurringTransactions(userId: string): Promise<void> {
  const templates = await prisma.recurringTransactionTemplate.findMany({
    where: { userId, nextDueDate: { lte: new Date() } },
  });

  for (const template of templates) {
    const { datesToLog, newNextDueDate } = computeCatchUp(template.nextDueDate, template.frequency);
    if (datesToLog.length === 0) continue;

    // A business-use split (2026-07-28, EXPENSE only) turns each due period
    // into TWO Transaction rows instead of one -- e.g. a phone bill that's
    // 60% business use logs a $60 business expense and a $40 personal
    // expense for that same period, via the separately unit-tested
    // splitByBusinessUse. 100%/0% collapse back to a single row rather than
    // creating a pointless $0 entry on the other side.
    const businessUsePercent =
      template.type === "EXPENSE" && template.businessUsePercent != null
        ? Number(template.businessUsePercent)
        : null;

    const templateAmount = Number(template.amount);

    const rows = datesToLog.flatMap((date) => {
      if (businessUsePercent == null || businessUsePercent === 100) {
        return [
          {
            userId,
            type: template.type,
            scope: businessUsePercent === 100 ? ("BUSINESS" as const) : template.scope,
            category: template.category,
            amount: templateAmount,
            description: template.description,
            date,
          },
        ];
      }
      if (businessUsePercent === 0) {
        return [
          {
            userId,
            type: template.type,
            scope: "PERSONAL" as const,
            category: null,
            amount: templateAmount,
            description: template.description,
            date,
          },
        ];
      }

      const { businessAmount, personalAmount } = splitByBusinessUse(templateAmount, businessUsePercent);
      const note = template.description ?? "Recurring cost";
      return [
        {
          userId,
          type: template.type,
          scope: "BUSINESS" as const,
          category: template.category,
          amount: businessAmount,
          description: `${note} (${businessUsePercent}% business)`,
          date,
        },
        {
          userId,
          type: template.type,
          scope: "PERSONAL" as const,
          category: null,
          amount: personalAmount,
          description: `${note} (${100 - businessUsePercent}% personal)`,
          date,
        },
      ];
    });

    await prisma.$transaction([
      prisma.transaction.createMany({ data: rows }),
      prisma.recurringTransactionTemplate.update({
        where: { id: template.id },
        data: { nextDueDate: newNextDueDate, lastLoggedAt: new Date() },
      }),
    ]);
  }
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

  const { scope, type, category, amount, description, frequency, nextDueDate, businessUsePercent } = parsed.data;

  await prisma.recurringTransactionTemplate.create({
    data: {
      userId: session.user.id,
      scope,
      type,
      category: scope === "BUSINESS" && type === "EXPENSE" ? (category ?? null) : null,
      amount,
      description,
      frequency,
      nextDueDate: parseDateOnlyLocal(nextDueDate),
      businessUsePercent: type === "EXPENSE" ? (businessUsePercent ?? null) : null,
    },
  });

  // A backdated start date (e.g. "this phone bill started 6 months ago")
  // catches up immediately, not on the next unrelated page visit.
  await autoLogDueRecurringTransactions(session.user.id);

  revalidatePath("/finances");
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
  return {};
}

export async function updateRecurringTransactionAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing recurring cost id" };

  const parsed = parseRecurringForm(formData);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { scope, type, category, amount, description, frequency, nextDueDate, businessUsePercent } = parsed.data;

  // Only affects future auto-logged Transactions from this point forward --
  // every Transaction already logged is its own independent row (see
  // autoLogDueRecurringTransactions above) and is never retroactively
  // changed by editing the template, e.g. a monthly amount going up $5, or
  // the business-use split changing, doesn't rewrite any prior months
  // already in the ledger.
  const result = await prisma.recurringTransactionTemplate.updateMany({
    where: { id, userId: session.user.id },
    data: {
      scope,
      type,
      category: scope === "BUSINESS" && type === "EXPENSE" ? (category ?? null) : null,
      amount,
      description,
      frequency,
      nextDueDate: parseDateOnlyLocal(nextDueDate),
      businessUsePercent: type === "EXPENSE" ? (businessUsePercent ?? null) : null,
    },
  });

  if (result.count === 0) return { error: "Recurring cost not found" };

  await autoLogDueRecurringTransactions(session.user.id);

  revalidatePath("/finances");
  revalidatePath("/finances/income");
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
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
}
