"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { transactionSchema } from "@/lib/validation";
import { calculateNetCommission } from "@/lib/finance-data";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import type { FormState } from "@/app/actions/auth";
import { createRecurringTransactionAction } from "@/app/actions/recurring-transactions";

function parseTransactionForm(formData: FormData) {
  const type = formData.get("type");
  const scope = formData.get("scope") || "BUSINESS";
  return transactionSchema.safeParse({
    type,
    scope,
    category:
      scope === "BUSINESS" && type === "EXPENSE" ? (formData.get("category") ?? undefined) : undefined,
    amount: formData.get("amount"),
    description: formData.get("description") || undefined,
    date: formData.get("date"),
    // Any BUSINESS row can link to a transaction, income included -- a closed
    // deal's commission is the clearest case of income belonging to one.
    dealId: scope === "BUSINESS" ? formData.get("dealId") || undefined : undefined,
  });
}

// Unlike Document.dealId (which uses teamOrOwnFilter, since a manager
// organizes team paperwork), a Transaction is a strictly personal ledger
// entry (see the "never team-shared" comment atop finance-data.ts) -- you
// only ever link YOUR OWN income or expense to YOUR OWN transaction, so this
// checks plain ownership, not team-wide visibility.
async function resolveDealId(
  dealId: string | undefined,
  userId: string,
): Promise<{ ok: true; dealId: string | null } | { ok: false; error: string }> {
  if (!dealId) return { ok: true, dealId: null };

  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId } });
  if (!deal) return { ok: false, error: "Deal not found" };

  return { ok: true, dealId };
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

  const { type, scope, category, amount, description, date, dealId } = parsed.data;

  const resolvedDeal = await resolveDealId(dealId, session.user.id);
  if (!resolvedDeal.ok) return { error: resolvedDeal.error };

  await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type,
      scope,
      category: scope === "BUSINESS" && type === "EXPENSE" ? category! : null,
      amount,
      description,
      date: new Date(date),
      dealId: resolvedDeal.dealId,
    },
  });

  revalidatePath("/finances");
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
  if (resolvedDeal.dealId) revalidatePath(`/transactions/${resolvedDeal.dealId}`);
  return {};
}

// The merged "Add a transaction" form's single stable action -- it offers a
// "Make this a recurring cost" checkbox that toggles LOCAL state within one
// mounted form instance, so which underlying action should run can change
// between renders of the SAME component. useActionState doesn't reliably
// pick up a swapped action reference across renders like that (confirmed
// live: toggling the checkbox on then off before submitting still invoked
// the recurring action) -- so instead there is exactly one stable action
// bound to the form, and it branches on a hidden "isRecurring" field in the
// submitted FormData itself, which is always read fresh per-request.
export async function createTransactionOrRecurringAction(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (formData.get("isRecurring") === "true") {
    return createRecurringTransactionAction(prevState, formData);
  }
  return createTransactionAction(prevState, formData);
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

  const { type, scope, category, amount, description, date, dealId } = parsed.data;

  const resolvedDeal = await resolveDealId(dealId, session.user.id);
  if (!resolvedDeal.ok) return { error: resolvedDeal.error };

  const existing = await prisma.transaction.findFirst({ where: { id, userId: session.user.id } });

  const result = await prisma.transaction.updateMany({
    where: { id, userId: session.user.id },
    data: {
      type,
      scope,
      category: scope === "BUSINESS" && type === "EXPENSE" ? category! : null,
      amount,
      description,
      date: new Date(date),
      dealId: resolvedDeal.dealId,
    },
  });

  if (result.count === 0) return { error: "Transaction not found" };

  revalidatePath("/finances");
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
  if (existing?.dealId) revalidatePath(`/transactions/${existing.dealId}`);
  if (resolvedDeal.dealId && resolvedDeal.dealId !== existing?.dealId) {
    revalidatePath(`/transactions/${resolvedDeal.dealId}`);
  }
  return {};
}

export async function deleteTransactionAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const existing = await prisma.transaction.findFirst({ where: { id, userId: session.user.id } });

  await prisma.transaction.deleteMany({ where: { id, userId: session.user.id } });

  revalidatePath("/finances");
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
  if (existing?.dealId) revalidatePath(`/transactions/${existing.dealId}`);
}

/**
 * Logs a closed transaction's net commission as a business income entry,
 * linked back to that transaction.
 *
 * Exists because closing a deal used to be three disconnected acts -- mark it
 * Closed, do the math, remember to go type the income in -- and forgetting the
 * third left the tax report quietly short with nothing to flag it.
 *
 * Plain (formData) => void, matching duplicateDealAction and the other
 * button-driven actions on the transaction page.
 */
export async function logCommissionAsIncomeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return;

  // Plain userId, not teamOrOwnFilter: a ledger entry is strictly personal
  // (see resolveDealId's comment above), so you only ever log YOUR commission
  // against YOUR transaction -- a manager viewing a teammate's transaction
  // must not create a row in their own books.
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, userId: session.user.id },
  });
  if (!deal || deal.status !== "CLOSED") return;

  // Idempotency: an indexed relational check rather than the CSV importer's
  // fuzzy date+amount+description heuristic. This one survives the agent
  // later editing the amount, and there's no unique constraint to lean on.
  const existing = await prisma.transaction.findFirst({
    where: { userId: session.user.id, dealId, type: "INCOME" },
    select: { id: true },
  });
  if (existing) return;

  const gross = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
  const net = calculateNetCommission(gross, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeePercent: deal.referralFeePercent ? Number(deal.referralFeePercent) : null,
    teamSplitPercent: deal.teamSplitPercent ? Number(deal.teamSplitPercent) : null,
    otherDeductionsPercent: deal.otherDeductionsPercent ? Number(deal.otherDeductionsPercent) : null,
  });

  // calculateNetCommission is neither clamped nor rounded, and an amount must
  // be positive -- splits can legitimately exceed the gross. Nothing to log in
  // that case; the page hides the button for it too.
  const amount = Math.round(net * 100) / 100;
  if (amount <= 0) return;

  await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: "INCOME",
      scope: "BUSINESS",
      // Null for every INCOME row -- the category enum is expense-only, and
      // the breakdown/budget code all assumes category implies expense.
      category: null,
      amount,
      description: `Commission — ${dealDisplayName(deal.propertyAddress)}`,
      date: deal.closingDate ?? new Date(),
      dealId,
    },
  });

  revalidatePath("/finances");
  revalidatePath("/finances/income");
  revalidatePath("/dashboard");
  revalidatePath(`/transactions/${dealId}`);
}
