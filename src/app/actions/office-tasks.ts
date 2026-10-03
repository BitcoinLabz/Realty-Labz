"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWorkOfficeChecklist, dealReadFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";
import { officeChecklistLabels } from "@/lib/office-checklist";
import type { Role } from "@/generated/prisma/enums";

// The brokerage's Office checklist on an agent's transaction (2026-10-01).
// Only a manager on the agent's team works it; the agent sees it read-only.
// The agent's own records (deadlines, documents, details) stay untouchable
// by a manager -- this is a separate, office-owned list.


type SessionUser = { id: string; role: Role; teamId: string | null };

// The deal must be one this manager can read (dealReadFilter -- so a file the
// agent hid can't be worked on) AND belong to an agent on their own team.
async function officeDeal(dealId: string, user: SessionUser) {
  if (!canWorkOfficeChecklist(user)) return null;
  return prisma.deal.findFirst({
    where: { id: dealId, ...dealReadFilter(user), user: { teamId: user.teamId } },
    select: { id: true },
  });
}

function revalidate(dealId: string) {
  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/team");
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function text(value: FormDataEntryValue | null, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

export async function addOfficeTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return { error: "Missing transaction" };
  const deal = await officeDeal(dealId, session.user);
  if (!deal) return { error: "Transaction not found" };

  const label = text(formData.get("label"), 120);
  if (!label) return { fieldErrors: { label: "Name the task" } };

  const last = await prisma.officeTask.findFirst({
    where: { dealId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  await prisma.officeTask.create({
    data: {
      dealId,
      label,
      dueDate: parseDate(formData.get("dueDate")),
      note: text(formData.get("note"), 500),
      order: (last?.order ?? -1) + 1,
      createdById: session.user.id,
    },
  });

  revalidate(dealId);
  return { success: "Added" };
}

export async function addStandardChecklistAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return;
  const deal = await officeDeal(dealId, session.user);
  if (!deal) return;

  const existing = await prisma.officeTask.findMany({
    where: { dealId },
    select: { label: true, order: true },
  });
  const have = new Set(existing.map((t) => t.label.trim().toLowerCase()));
  let order = existing.reduce((max, t) => Math.max(max, t.order), -1);

  // The office's own template (Office settings), or the standard six.
  const labels = await officeChecklistLabels(session.user.teamId!);
  const toAdd = labels.filter((label) => !have.has(label.toLowerCase()));
  if (toAdd.length === 0) return;

  await prisma.officeTask.createMany({
    data: toAdd.map((label) => ({ dealId, label, order: ++order, createdById: session.user.id })),
  });
  revalidate(dealId);
}

export async function toggleOfficeTaskAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;
  const deal = await officeDeal(dealId, session.user);
  if (!deal) return;

  const isDone = formData.get("isDone") === "true";
  // Compound {id, dealId}: an id alone carries no ownership.
  await prisma.officeTask.updateMany({
    where: { id, dealId },
    data: isDone
      ? { completedAt: null, completedById: null }
      : { completedAt: new Date(), completedById: session.user.id },
  });
  revalidate(dealId);
}

export async function updateOfficeTaskAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return { error: "Missing task" };
  const deal = await officeDeal(dealId, session.user);
  if (!deal) return { error: "Transaction not found" };

  const label = text(formData.get("label"), 120);
  if (!label) return { fieldErrors: { label: "Name the task" } };

  await prisma.officeTask.updateMany({
    where: { id, dealId },
    data: { label, dueDate: parseDate(formData.get("dueDate")), note: text(formData.get("note"), 500) },
  });
  revalidate(dealId);
  return { success: "Saved" };
}

export async function deleteOfficeTaskAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;
  const deal = await officeDeal(dealId, session.user);
  if (!deal) return;

  await prisma.officeTask.deleteMany({ where: { id, dealId } });
  revalidate(dealId);
}
