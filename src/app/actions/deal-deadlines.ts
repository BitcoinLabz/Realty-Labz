"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { dealDeadlineSchema } from "@/lib/validation";
import { teamOrOwnFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/enums";

async function assertDealAccess(
  dealId: string,
  sessionUser: { id: string; role: Role; teamId: string | null },
) {
  return prisma.deal.findFirst({
    where: { id: dealId, ...teamOrOwnFilter(sessionUser) },
  });
}

export async function createDeadlineAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const dealId = formData.get("dealId");
  if (typeof dealId !== "string" || !dealId) return { error: "Missing deal id" };

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return { error: "Deal not found" };

  const parsed = dealDeadlineSchema.safeParse({
    label: formData.get("label"),
    dueDate: formData.get("dueDate"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  await prisma.dealDeadline.create({
    data: {
      dealId,
      label: parsed.data.label,
      dueDate: new Date(parsed.data.dueDate),
    },
  });

  revalidatePath(`/deals/${dealId}`);
  return {};
}

export async function toggleDeadlineAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  const isCompleted = formData.get("isCompleted") === "true";
  if (typeof id !== "string" || typeof dealId !== "string") return;

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return;

  await prisma.dealDeadline.update({
    where: { id },
    data: { completedAt: isCompleted ? null : new Date() },
  });

  revalidatePath(`/deals/${dealId}`);
}

export async function deleteDeadlineAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return;

  await prisma.dealDeadline.delete({ where: { id } });

  revalidatePath(`/deals/${dealId}`);
}
