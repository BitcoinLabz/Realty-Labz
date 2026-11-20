"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { recalculateDealDeadlines } from "@/lib/deal-deadline-recalc";
import { dealDeadlineSchema } from "@/lib/validation";
import { ownerOnlyFilter } from "@/lib/authorization";
import type { FormState } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/enums";

async function assertDealAccess(
  dealId: string,
  sessionUser: { id: string; role: Role; teamId: string | null },
) {
  return prisma.deal.findFirst({
    where: { id: dealId, ...ownerOnlyFilter(sessionUser) },
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

  revalidatePath(`/transactions/${dealId}`);
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

  // Scoped by both id AND dealId -- id alone would let a user who owns/manages
  // ANY deal (to pass assertDealAccess above) mutate a deadline belonging to a
  // completely different tenant's deal, since DealDeadline.id carries no
  // ownership information of its own.
  await prisma.dealDeadline.updateMany({
    where: { id, dealId },
    data: { completedAt: isCompleted ? null : new Date() },
  });

  revalidatePath(`/transactions/${dealId}`);
}

export async function deleteDeadlineAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) return;

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return;

  const deal = await assertDealAccess(dealId, session.user);
  if (!deal) return;

  // Deadlines counted from this one keep their current date as a fixed date
  // rather than pointing at nothing.
  await prisma.dealDeadline.updateMany({
    where: { baseDeadlineId: id, dealId },
    data: { baseEvent: null, offsetDays: null, baseDeadlineId: null },
  });
  // Same cross-tenant guard as toggleDeadlineAction above -- id alone isn't
  // enough, dealId must be part of the actual where clause.
  await prisma.dealDeadline.deleteMany({ where: { id, dealId } });

  revalidatePath(`/transactions/${dealId}`);
}

// Edit a deadline after it's saved -- a contract reread can miss something,
// and a typo in a name or date shouldn't mean delete-and-retype.
export async function updateDeadlineAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return { error: "Missing deadline" };

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

  const existing = await prisma.dealDeadline.findFirst({
    where: { id, dealId },
    select: { dueDate: true },
  });
  if (!existing) return { error: "Deadline not found" };

  const rawNote = formData.get("clientNote");
  const clientNote = typeof rawNote === "string" && rawNote.trim() ? rawNote.trim().slice(0, 300) : null;
  const dueDate = new Date(parsed.data.dueDate);
  const dateMoved = existing.dueDate.getTime() !== dueDate.getTime();

  // Same compound {id, dealId} guard as toggle/delete above. A moved date
  // clears the automatic-reminder stamps so the client is reminded about the
  // new date rather than the job thinking it already did.
  await prisma.dealDeadline.updateMany({
    where: { id, dealId },
    data: {
      label: parsed.data.label,
      dueDate,
      clientNote,
      // Typing a date over a rule makes it a fixed date: it stops moving
      // with the acceptance date, and its extensions are folded into it.
      ...(dateMoved
        ? {
            autoReminderEarlySentAt: null,
            autoReminderFinalSentAt: null,
            baseEvent: null,
            offsetDays: null,
            baseDeadlineId: null,
            extensionDays: 0,
          }
        : {}),
    },
  });
  // Anything counted from this deadline follows it.
  if (dateMoved) await recalculateDealDeadlines(dealId);

  revalidatePath(`/transactions/${dealId}`);
  revalidatePath("/dashboard");
  return { success: "Saved" };
}
