"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { sendDeadlineReminderEmail } from "@/lib/email";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import type { FormState } from "@/app/actions/auth";

// How far ahead of a deadline the reminder goes out.
const REMINDER_LEAD_DAYS = 3;

function formatDueDate(dueDate: Date) {
  return dueDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

type DeadlineWithContext = {
  id: string;
  label: string;
  dueDate: Date;
  dealId: string;
  deal: {
    propertyAddress: string | null;
    client: { name: string; email: string | null; emailDeadlineReminders: boolean } | null;
    user: { name: string | null; email: string };
  };
};

// One email to the agent and (when they have an address and haven't opted
// out) their client, so the agent always sees exactly what the client saw.
// The agent's own account email is always a recipient -- that's per-user, so
// every agent gets their own reminders with no configuration.
async function sendRemindersFor(
  deadline: DeadlineWithContext,
): Promise<{ sent: boolean; includedClient: boolean }> {
  const client = deadline.deal.client;
  const includeClient = !!client?.email && client.emailDeadlineReminders;

  const recipients = [deadline.deal.user.email];
  if (includeClient) recipients.push(client!.email!);

  try {
    await sendDeadlineReminderEmail({
      to: recipients,
      clientName: includeClient ? client!.name : null,
      agentName: deadline.deal.user.name ?? deadline.deal.user.email,
      deadlineLabel: deadline.label,
      propertyLabel: dealDisplayName(deadline.deal.propertyAddress, client?.name),
      dueDate: formatDueDate(deadline.dueDate),
    });
    return { sent: true, includedClient: includeClient };
  } catch (err) {
    console.error("[deadline-reminders] send failed", { deadlineId: deadline.id, err });
    return { sent: false, includedClient: false };
  }
}

const deadlineInclude = {
  deal: {
    select: {
      propertyAddress: true,
      client: { select: { name: true, email: true, emailDeadlineReminders: true } },
      user: { select: { name: true, email: true } },
    },
  },
} as const;

// Runs on every authenticated page load (see src/app/(app)/layout.tsx),
// alongside autoLogDueRecurringTransactions. This app has no scheduled-job
// runner anywhere -- "catch up on your next visit" is the established
// pattern here, not new infrastructure.
//
// Note the query no longer filters on the client's opt-in: the AGENT gets a
// reminder for every deadline, including ones on transactions with no client
// attached or whose client opted out. The opt-in only gates the client's copy
// (see sendRemindersFor).
//
// emailReminderSentAt is stamped whether or not delivery succeeded, so a
// Resend outage can't turn into the same reminder re-sending on every
// subsequent page view -- same fire-and-forget philosophy as every other
// email in this app (there's no retry queue anywhere here).
export async function sendDueDeadlineReminders(userId: string): Promise<void> {
  const now = new Date();
  const soon = new Date(now.getTime() + REMINDER_LEAD_DAYS * 24 * 60 * 60 * 1000);

  const deadlines = await prisma.dealDeadline.findMany({
    where: {
      completedAt: null,
      emailReminderSentAt: null,
      dueDate: { lte: soon },
      deal: { userId },
    },
    include: deadlineInclude,
  });

  for (const deadline of deadlines) {
    await sendRemindersFor(deadline);
    await prisma.dealDeadline.update({
      where: { id: deadline.id },
      data: { emailReminderSentAt: new Date() },
    });
  }
}

// The "Send reminder" button next to each deadline. Unlike the automatic
// pass above this does NOT check or stamp emailReminderSentAt -- it's a
// deliberate action the agent can repeat whenever a client needs chasing.
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
    where: { id: dealId, ...teamOrOwnFilter(session.user) },
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

  revalidatePath(`/transactions/${dealId}`);

  const client = deadline.deal.client;
  if (includedClient) return { success: `Sent to you and ${client!.name}.` };
  if (!client) return { success: "Sent to you. No client is attached to this transaction." };
  if (!client.email) return { success: `Sent to you. ${client.name} has no email address saved.` };
  return { success: `Sent to you. ${client.name} has reminder emails turned off.` };
}
