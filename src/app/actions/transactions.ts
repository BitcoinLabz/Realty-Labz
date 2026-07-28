"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { transactionSchema } from "@/lib/validation";
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
    dealId: scope === "BUSINESS" && type === "EXPENSE" ? formData.get("dealId") || undefined : undefined,
  });
}

// Unlike Document.dealId (which uses teamOrOwnFilter, since a manager
// organizes team paperwork), a Transaction is a strictly personal ledger
// entry (see the "never team-shared" comment atop finance-data.ts) -- you
// only ever link YOUR OWN expense to YOUR OWN deal, so this checks plain
// ownership, not team-wide visibility.
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
  revalidatePath("/finances/transactions");
  revalidatePath("/dashboard");
  if (resolvedDeal.dealId) revalidatePath(`/deals/${resolvedDeal.dealId}`);
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
  revalidatePath("/finances/transactions");
  revalidatePath("/dashboard");
  if (existing?.dealId) revalidatePath(`/deals/${existing.dealId}`);
  if (resolvedDeal.dealId && resolvedDeal.dealId !== existing?.dealId) {
    revalidatePath(`/deals/${resolvedDeal.dealId}`);
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
  revalidatePath("/finances/transactions");
  revalidatePath("/dashboard");
  if (existing?.dealId) revalidatePath(`/deals/${existing.dealId}`);
}
