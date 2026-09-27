// When the daily job emails a deadline reminder. Pure, so the timing rules
// are unit-tested rather than trusted (see deadline-reminder-schedule.test.ts).
//
// Two emails per deadline: an early heads-up a few days out, and a final one
// the day before. Deadlines are stored as date-only values at UTC midnight
// (see deal-deadlines.ts), so "how many days away" is counted in whole
// calendar days against today's date *in Michigan* -- the job runs at a UTC
// hour, and using the UTC date would be a day off every evening.

export const REMINDER_TIME_ZONE = "America/Detroit";
export const EARLY_REMINDER_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderStage = "early" | "final";

// Today's calendar date in Michigan, as UTC midnight -- the same shape the
// deadlines themselves are stored in, so the two subtract cleanly.
export function todayInReminderZone(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // "2026-09-27"
  return new Date(`${parts}T00:00:00.000Z`);
}

export function daysUntilDue(dueDate: Date, today: Date): number {
  const due = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  return Math.round((due - today.getTime()) / DAY_MS);
}

// Which reminder, if any, is owed today. Catches up rather than skipping: if
// the job missed the day before, a deadline due today still gets its final
// reminder. Once the final one has gone, the early one is never sent late --
// two emails about the same date in one day would just be noise. Past-due
// deadlines get nothing; that's the agent's to chase, not an automated nag.
export function reminderStageFor(params: {
  daysUntil: number;
  earlySentAt: Date | null;
  finalSentAt: Date | null;
}): ReminderStage | null {
  const { daysUntil, earlySentAt, finalSentAt } = params;
  if (daysUntil < 0 || finalSentAt) return null;
  if (daysUntil <= 1) return "final";
  if (daysUntil <= EARLY_REMINDER_DAYS && !earlySentAt) return "early";
  return null;
}

// "today" / "tomorrow" / "in 3 days" -- for the email subject line.
export function describeDaysUntil(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}
