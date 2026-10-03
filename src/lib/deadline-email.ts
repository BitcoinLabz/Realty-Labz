// One-tap "email about this deadline" (2026-10-03): a mailto: link with the
// message already written, opened in the agent's own mail app. Free -- no
// email service, no AI -- and the agent can edit before sending. Pure and
// tested (deadline-email.test.ts).

export type EmailRecipient = { name: string; contactName: string | null; email: string };

export function deadlineEmailHref(params: {
  to: EmailRecipient;
  propertyLabel: string;
  deadlineLabel: string;
  dueDate: string; // yyyy-mm-dd
  agentName: string;
}): string {
  const due = new Date(`${params.dueDate}T00:00:00.000Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const greeting = params.to.contactName ? params.to.contactName.split(" ")[0] : params.to.name;
  const subject = `${params.propertyLabel} — ${params.deadlineLabel} (${due})`;
  const body = [
    `Hi ${greeting},`,
    "",
    `Quick note on ${params.propertyLabel}: ${params.deadlineLabel} is due ${due}.`,
    "",
    "Is there anything you need from us to stay on track?",
    "",
    "Thanks,",
    params.agentName,
  ].join("\n");

  return `mailto:${encodeURIComponent(params.to.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
