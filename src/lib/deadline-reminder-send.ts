import { sendDeadlineReminderEmail } from "@/lib/email";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import { APP_URL } from "@/lib/app-url";

// Shared by the manual "Send reminder" button (actions/deadline-reminders.ts)
// and the daily automatic job (api/cron/deadline-reminders). Deliberately NOT
// in the "use server" actions file: every export there becomes a callable
// endpoint, and this sends email with no ownership check of its own -- its
// callers do that.

// Where clients sign in to their portal.
export const PORTAL_URL = `${APP_URL}/portal`;

export function formatDueDate(dueDate: Date) {
  // Deadlines are date-only values stored at UTC midnight; formatting in UTC
  // keeps "Oct 1" from printing as "Sep 30" on a server west of Greenwich.
  return dueDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export const deadlineInclude = {
  deal: {
    select: {
      propertyAddress: true,
      client: { select: { name: true, email: true, emailDeadlineReminders: true } },
      user: { select: { name: true, email: true } },
    },
  },
} as const;

export type DeadlineWithContext = {
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
export async function sendRemindersFor(
  deadline: DeadlineWithContext,
  options: { when?: string } = {},
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
      when: options.when ?? null,
      portalUrl: includeClient ? PORTAL_URL : null,
    });
    return { sent: true, includedClient: includeClient };
  } catch (err) {
    console.error("[deadline-reminders] send failed", { deadlineId: deadline.id, err });
    return { sent: false, includedClient: false };
  }
}
