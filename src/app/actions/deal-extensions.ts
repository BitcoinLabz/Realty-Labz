"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ownerOnlyFilter } from "@/lib/authorization";
import { applyShifts, planExtension, type DayType } from "@/lib/deadline-rules";
import { parseAnchorDateUtc } from "@/lib/deadline-templates";
import { loadRuleDeadlines, recalculateDealDeadlines } from "@/lib/deal-deadline-recalc";
import type { FormState } from "@/app/actions/auth";

// Acceptance date, one-tap extensions, manual extensions/amendments, and undo
// (2026-11-19). Every action is WRITE scope: ownerOnlyFilter, never the read
// filter -- a broker can see these on an agent's file but not change them
// (see "Read scope and write scope are different filters" in CLAUDE.md).

async function ownedDeal(dealId: unknown) {
  const session = await auth();
  if (!session?.user || typeof dealId !== "string" || !dealId) return null;
  const deal = await prisma.deal.findFirst({ where: { id: dealId, ...ownerOnlyFilter(session.user) }, select: { id: true } });
  return deal ? { deal, user: session.user } : null;
}

function revalidate(dealId: string) {
  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function setAcceptanceDateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owned = await ownedDeal(formData.get("dealId"));
  if (!owned) return { error: "Transaction not found" };
  const raw = formData.get("acceptanceDate");
  const date = typeof raw === "string" && raw ? parseAnchorDateUtc(raw) : null;
  if (typeof raw === "string" && raw && !date) return { fieldErrors: { acceptanceDate: "Pick a valid date" } };

  await prisma.deal.update({ where: { id: owned.deal.id }, data: { acceptanceDate: date } });
  await recalculateDealDeadlines(owned.deal.id);
  revalidate(owned.deal.id);
  return {};
}

/**
 * Shared by the one-tap option and the manual form: shifts the chosen
 * deadlines, adds a deposit deadline if one is due, and logs who did it.
 */
async function applyExtension(params: {
  dealId: string;
  user: { id: string; name?: string | null; email?: string | null };
  label: string;
  days: number;
  dayType: DayType;
  targetIds: string[];
  additionalDeposit: number | null;
  depositDueDate: Date | null;
  optionId: string | null;
  note: string | null;
}): Promise<string | null> {
  const { dates, deadlines } = await loadRuleDeadlines(params.dealId);
  const plan = planExtension({ deadlines, dates, targetIds: params.targetIds, days: params.days, dayType: params.dayType });
  if (Object.keys(plan.shifts).length === 0) return "Pick at least one open deadline to extend.";

  const after = applyShifts(deadlines, plan.shifts, 1);
  await prisma.$transaction(async (tx) => {
    for (const d of after) {
      const shift = plan.shifts[d.id];
      if (!shift) continue;
      await tx.dealDeadline.updateMany({
        where: { id: d.id, dealId: params.dealId },
        data: d.rule ? { extensionDays: d.extensionDays } : { dueDate: d.dueDate },
      });
    }

    let depositDeadlineId: string | null = null;
    if (params.additionalDeposit && params.depositDueDate) {
      const created = await tx.dealDeadline.create({
        data: {
          dealId: params.dealId,
          label: `Additional earnest money deposit (${params.label})`,
          dueDate: params.depositDueDate,
          category: "EARNEST_MONEY",
          amount: params.additionalDeposit,
        },
        select: { id: true },
      });
      depositDeadlineId = created.id;
    }

    await tx.dealExtension.create({
      data: {
        dealId: params.dealId,
        optionId: params.optionId,
        label: params.label,
        days: params.days,
        dayType: params.dayType,
        shifts: plan.shifts,
        additionalDeposit: params.additionalDeposit,
        depositDeadlineId,
        note: params.note,
        appliedById: params.user.id,
        appliedByName: params.user.name ?? params.user.email ?? "Agent",
      },
    });
  });

  await recalculateDealDeadlines(params.dealId);
  revalidate(params.dealId);
  return null;
}

export async function exerciseExtensionOptionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owned = await ownedDeal(formData.get("dealId"));
  if (!owned) return { error: "Transaction not found" };
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string") return { error: "Missing option" };

  // Compound where: the option must belong to this (owned) deal.
  const option = await prisma.dealExtensionOption.findFirst({ where: { id: optionId, dealId: owned.deal.id } });
  if (!option) return { error: "Option not found" };
  const alreadyUsed = await prisma.dealExtension.findFirst({ where: { optionId: option.id, undoneAt: null } });
  if (alreadyUsed) return { error: "This extension has already been used. Undo it first to use it again." };

  // The deposit is due by the notice deadline if the contract gives one,
  // otherwise on the day it's used.
  const today = parseAnchorDateUtc(new Date().toISOString().slice(0, 10))!;
  const error = await applyExtension({
    dealId: owned.deal.id,
    user: owned.user,
    label: option.label,
    days: option.days,
    dayType: option.dayType,
    targetIds: option.targetDeadlineIds,
    additionalDeposit: option.additionalDeposit ? Number(option.additionalDeposit) : null,
    depositDueDate: option.noticeDate ?? today,
    optionId: option.id,
    note: null,
  });
  return error ? { error } : {};
}

export async function applyManualExtensionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const owned = await ownedDeal(formData.get("dealId"));
  if (!owned) return { error: "Transaction not found" };

  const days = Number(formData.get("days"));
  if (!Number.isInteger(days) || days < -365 || days > 3650 || days === 0) {
    return { fieldErrors: { days: "Enter a number of days, e.g. 14" } };
  }
  const targetIds = formData.getAll("targetIds").filter((v): v is string => typeof v === "string");
  if (targetIds.length === 0) return { fieldErrors: { targetIds: "Pick the deadlines it moves" } };

  const depositRaw = formData.get("additionalDeposit");
  const additionalDeposit = typeof depositRaw === "string" && depositRaw ? Number(depositRaw) : null;
  if (additionalDeposit !== null && (!Number.isFinite(additionalDeposit) || additionalDeposit <= 0)) {
    return { fieldErrors: { additionalDeposit: "Enter an amount, or leave it blank" } };
  }
  const depositDateRaw = formData.get("depositDueDate");
  const depositDueDate = typeof depositDateRaw === "string" && depositDateRaw ? parseAnchorDateUtc(depositDateRaw) : null;
  if (additionalDeposit !== null && !depositDueDate) {
    return { fieldErrors: { depositDueDate: "When is the deposit due?" } };
  }

  const labelRaw = formData.get("label");
  const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim().slice(0, 120) : `Amendment: ${days} days`;
  const noteRaw = formData.get("note");

  // Only ids that are deadlines on this deal survive (planExtension ignores
  // anything else), so a forged id is inert.
  const error = await applyExtension({
    dealId: owned.deal.id,
    user: owned.user,
    label,
    days,
    dayType: formData.get("dayType") === "BUSINESS" ? "BUSINESS" : "CALENDAR",
    targetIds,
    additionalDeposit,
    depositDueDate,
    optionId: null,
    note: typeof noteRaw === "string" && noteRaw.trim() ? noteRaw.trim().slice(0, 500) : null,
  });
  return error ? { error } : {};
}

export async function undoExtensionAction(formData: FormData): Promise<void> {
  const owned = await ownedDeal(formData.get("dealId"));
  if (!owned) return;
  const extensionId = formData.get("extensionId");
  if (typeof extensionId !== "string") return;

  const extension = await prisma.dealExtension.findFirst({
    where: { id: extensionId, dealId: owned.deal.id, undoneAt: null },
  });
  if (!extension) return;

  const shifts = (extension.shifts ?? {}) as Record<string, number>;
  const { deadlines } = await loadRuleDeadlines(owned.deal.id);
  const reversed = applyShifts(deadlines, shifts, -1);

  await prisma.$transaction(async (tx) => {
    for (const d of reversed) {
      if (!shifts[d.id]) continue;
      await tx.dealDeadline.updateMany({
        where: { id: d.id, dealId: owned.deal.id },
        data: d.rule ? { extensionDays: d.extensionDays } : { dueDate: d.dueDate },
      });
    }
    if (extension.depositDeadlineId) {
      await tx.dealDeadline.deleteMany({ where: { id: extension.depositDeadlineId, dealId: owned.deal.id } });
    }
    await tx.dealExtension.update({
      where: { id: extension.id },
      data: { undoneAt: new Date(), undoneByName: owned.user.name ?? owned.user.email ?? "Agent" },
    });
  });

  await recalculateDealDeadlines(owned.deal.id);
  revalidate(owned.deal.id);
}

export async function deleteExtensionOptionAction(formData: FormData): Promise<void> {
  const owned = await ownedDeal(formData.get("dealId"));
  if (!owned) return;
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string") return;
  await prisma.dealExtensionOption.deleteMany({ where: { id: optionId, dealId: owned.deal.id } });
  revalidate(owned.deal.id);
}
