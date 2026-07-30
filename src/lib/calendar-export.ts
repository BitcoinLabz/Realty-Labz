import { createEvents, type EventAttributes } from "ics";

export type DeadlineForCalendar = {
  label: string;
  dueDate: Date;
  propertyAddress: string;
};

// All-day reminder events, one per deadline -- a deadline has no specific
// time of day in this app's model (DealDeadline.dueDate is a plain date), so
// this deliberately doesn't invent one.
export function buildDeadlineIcs(deadlines: DeadlineForCalendar[]): string {
  const events: EventAttributes[] = deadlines.map((d) => ({
    title: `${d.label} — ${d.propertyAddress}`,
    start: [d.dueDate.getFullYear(), d.dueDate.getMonth() + 1, d.dueDate.getDate()],
    duration: { days: 1 },
    description: `Realty Labz deadline for ${d.propertyAddress}`,
  }));

  const { error, value } = createEvents(events);
  if (error || !value) {
    throw new Error(error?.message ?? "Failed to build calendar file");
  }
  return value;
}
