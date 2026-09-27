"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ownerOnlyFilter } from "@/lib/authorization";
import { deadlineInclude, sendRemindersFor } from "@/lib/deadline-reminder-send";
import type { FormState } from "@/app/actions/auth";

// The "Send reminder" button next to each deadline -- an on-demand send on
// top of the automatic ones.
//
// Automatic reminders (3 days out and the day before) come from the daily
// job at src/app/api/cron/deadline-reminders, turned on by founder decision
// 2026-09-27. They never run on page loads: an earlier version sent from the
// shared (app) layout on every navigation, which is why that was removed.
//
// Repeatable by design -- press it as often as a client needs chasing.
// emailReminderSentAt is stamped purely so the UI can show when the last
// one went out; it never gates whether a send is allowed.
export async function sendDeadlineReminderNowAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const id = formData.get("id");
  const dealId = formData.get("dealId");
  if (typeof id !== "string" || typeof dealId !== "string") return { error: "Missing deadline" };

  // Ownership is checked against the parent transaction, then the deadline is
  // fetched scoped by BOTH its own id and that dealId -- an id alone carries
  // no ownership of its own, the same cross-tenant guard deal-deadlines.ts
  // already uses.
  const deal = await prisma.deal.findFirst({
    where: { id: dealId, ...ownerOnlyFilter(session.user) },
    select: { id: true },
  });
  if (!deal) return { error: "Transaction not found" };

  const deadline = await prisma.dealDeadline.findFirst({
    where: { id, dealId },
    include: deadlineInclude,
  });
  if (!deadline) return { error: "Deadline not found" };

  const { sent, includedClient } = await sendRemindersFor(deadline);
  if (!sent) {
    return { error: "Couldn't send right now — try again in a moment." };
  }

  await prisma.dealDeadline.updateMany({
    where: { id, dealId },
    data: { emailReminderSentAt: new Date() },
  });

  revalidatePath(`/transactions/${dealId}`);

  const client = deadline.deal.client;
  if (includedClient) return { success: `Sent to you and ${client!.name}.` };
  if (!client) return { success: "Sent to you. No client is attached to this transaction." };
  if (!client.email) return { success: `Sent to you. ${client.name} has no email address saved.` };
  return { success: `Sent to you. ${client.name} has reminder emails turned off.` };
}
