"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { referralPartnerSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

// Referral partners live under Finances -> Referrals (2026-10-03). They used
// to be a tab inside every transaction, which showed the agent's whole list
// on each one. A transaction still picks its partner in its details.

function revalidate() {
  revalidatePath("/finances/referrals");
  revalidatePath("/transactions", "layout");
}

function parse(formData: FormData) {
  return referralPartnerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    notes: formData.get("notes") || undefined,
  });
}

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] = issue.message;
  return out;
}

export async function createReferralPartnerAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  await prisma.referralPartner.create({ data: { userId: session.user.id, ...parsed.data } });
  revalidate();
  return { success: "Added" };
}

export async function updateReferralPartnerAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Missing partner" };
  const parsed = parse(formData);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  await prisma.referralPartner.updateMany({
    where: { id, userId: session.user.id },
    // Blank optional fields clear rather than being ignored.
    data: {
      name: parsed.data.name,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      notes: parsed.data.notes ?? null,
    },
  });
  revalidate();
  return { success: "Saved" };
}

export async function setReferralW9Action(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.referralPartner.updateMany({
    where: { id, userId: session.user.id },
    data: { w9Received: formData.get("received") === "true" },
  });
  revalidate();
}

// Removing a partner never touches transactions: their link just clears
// (Deal.referralPartnerId onDelete: SetNull), and the referral percentage
// stays on each deal.
export async function deleteReferralPartnerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await prisma.referralPartner.deleteMany({ where: { id, userId: session.user.id } });
  revalidate();
}
