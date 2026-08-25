"use server";

import { prisma } from "@/lib/db";
import { sendDeadlineReminderEmail } from "@/lib/email";
import { dealDisplayName } from "@/app/(app)/deals/types";

// How far ahead of a deadline the client gets their heads-up.
const REMINDER_LEAD_DAYS = 3;

// Runs on every authenticated page load (see src/app/(app)/layout.tsx),
// alongside autoLogDueRecurringTransactions. This app has no scheduled-job
// runner anywhere -- "catch up on your next visit" is the established
// pattern here, not new infrastructure, and it was an explicit founder
// decision for the recurring-transactions feature that this mirrors.
//
// emailReminderSentAt is stamped whether or not delivery actually succeeded,
// so a Resend outage can't turn into the same reminder being re-sent on
// every subsequent page view. That matches the fire-and-forget philosophy
// every other email send in this app already has (there's no retry queue
// anywhere in this codebase).
export async function sendDueDeadlineReminders(userId: string): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000);

  const deadlines = await prisma.dealDeadline.findMany({
    where: {
      completedAt: null,
      emailReminderSentAt: null,
      dueDate: { lte: soon },
      deal: {
        userId,
        client: { emailDeadlineReminders: true, email: { not: null } },
      },
    },
    include: {
      deal: {
        include: {
          client: { select: { name: true, email: true } },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  for (const deadline of deadlines) {
    const client = deadline.deal.client;
    if (!client?.email) continue;

    try {
      await sendDeadlineReminderEmail({
        to: client.email,
        clientName: client.name,
        agentName: deadline.deal.user.name ?? deadline.deal.user.email,
        deadlineLabel: deadline.label,
        propertyLabel: dealDisplayName(deadline.deal.propertyAddress, client.name),
        dueDate: deadline.dueDate.toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
      });
    } catch (err) {
      // Logged, not swallowed silently -- a Resend misconfiguration should be
      // visible in the function logs rather than looking like reminders that
      // simply never happen.
      console.error("[deadline-reminders] send failed", { deadlineId: deadline.id, err });
    }

    await prisma.dealDeadline.update({
      where: { id: deadline.id },
      data: { emailReminderSentAt: new Date() },
    });
  }
}
