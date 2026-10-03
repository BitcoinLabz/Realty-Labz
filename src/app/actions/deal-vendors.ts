"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canWorkOfficeChecklist, dealReadFilter } from "@/lib/authorization";
import type { Role } from "@/generated/prisma/enums";

// Vendors on a transaction (2026-10-02): the office's preferred title
// company, lender, inspector... attached to one file. Either the agent who
// owns the file or the office working it may attach or detach -- the vendor
// itself must come from the agent's own office's directory.

type SessionUser = { id: string; role: Role; teamId: string | null };

async function workableDeal(dealId: string, user: SessionUser) {
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...dealReadFilter(user) },
    select: { id: true, userId: true, user: { select: { teamId: true } } },
  });
  if (!deal || !deal.user.teamId) return null;
  const isOwner = deal.userId === user.id;
  const isOffice = canWorkOfficeChecklist(user) && deal.user.teamId === user.teamId;
  return isOwner || isOffice ? { id: deal.id, teamId: deal.user.teamId } : null;
}

export async function attachVendorAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const dealId = formData.get("dealId");
  const vendorId = formData.get("vendorId");
  if (typeof dealId !== "string" || typeof vendorId !== "string" || !vendorId) return;

  const deal = await workableDeal(dealId, session.user);
  if (!deal) return;
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, teamId: deal.teamId }, select: { id: true } });
  if (!vendor) return;

  // Unique (dealId, vendorId): attaching twice is a no-op, not an error.
  await prisma.dealVendor.upsert({
    where: { dealId_vendorId: { dealId: deal.id, vendorId: vendor.id } },
    create: { dealId: deal.id, vendorId: vendor.id },
    update: {},
  });
  revalidatePath(`/transactions/${deal.id}`);
}

export async function detachVendorAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const dealId = formData.get("dealId");
  const vendorId = formData.get("vendorId");
  if (typeof dealId !== "string" || typeof vendorId !== "string") return;

  const deal = await workableDeal(dealId, session.user);
  if (!deal) return;

  await prisma.dealVendor.deleteMany({ where: { dealId: deal.id, vendorId } });
  revalidatePath(`/transactions/${deal.id}`);
}
