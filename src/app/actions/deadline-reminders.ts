"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { teamOrOwnFilter } from "@/lib/authorization";
import { sendDeadlineReminderEmail } from "@/lib/email";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import type { FormState } from "@/app/actions/auth";

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

// The "Send reminder" button next to each deadline -- the ONLY way a
// reminder email goes out.
//
// There is deliberately no automatic pass: an earlier version sent these
// from the shared (app) layout on every page load, and the founder was
// explicit that email should only leave when they press the button. Nothing
// here runs on a schedule or as a side effect of navigation.
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
