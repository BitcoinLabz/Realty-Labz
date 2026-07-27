// Parses a plain "YYYY-MM-DD" form value into a LOCAL-time Date matching the
// intended calendar day. `new Date("2026-01-01")` parses as UTC midnight,
// which getDate()/getMonth() (both local) then read as the *previous* day in
// any timezone behind UTC -- confirmed directly (not assumed): on a UTC-5
// machine, `new Date("2026-01-01").getDate()` returns 31 (December), a full
// day early. advanceDueDate below relies on those local getters, so feeding
// it a UTC-parsed date silently drifted every catch-up date back by a day.
// Every recurring-transaction date must go through this, never a bare
// `new Date(dateOnlyString)`.
export function parseDateOnlyLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

// Advances a recurring-transaction due date by one frequency interval,
// clamping the resulting day-of-month so month-end dates don't overflow into
// the wrong month — naively calling setMonth() on Jan 31 + 1 month lands on
// Mar 2/3 in JS's default date-overflow behavior, not the intended Feb
// 28/29. Verified by hand against Jan 31 -> Feb (monthly), Nov 30 -> Feb
// (quarterly, crossing a year boundary), and Feb 29 -> Feb 28 (annual, leap
// year to non-leap year) before this was trusted to drive real reminders.
export function advanceDueDate(
  current: Date,
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL",
): Date {
  const monthsToAdd = frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;
  const originalDay = current.getDate();

  // Anchoring on day 1 of the target month first (via the Date constructor,
  // which safely rolls the year forward on month overflow) avoids the
  // month-end overflow bug entirely -- only then do we clamp the day back to
  // the target month's real last day if the original day doesn't exist there.
  const firstOfTargetMonth = new Date(current.getFullYear(), current.getMonth() + monthsToAdd, 1);
  const daysInTargetMonth = new Date(
    firstOfTargetMonth.getFullYear(),
    firstOfTargetMonth.getMonth() + 1,
    0,
  ).getDate();

  const result = new Date(firstOfTargetMonth);
  result.setDate(Math.min(originalDay, daysInTargetMonth));
  return result;
}

// Safety cap against a runaway loop -- this only matters if a template's
// nextDueDate were ever wildly far in the past (e.g. bad data), since this
// runs unattended on every page load, not behind a manual click. 120 months
// is 10 years of monthly catch-up, far beyond any real recurring cost.
const MAX_CATCHUP_PERIODS = 120;

export type CatchUpResult = { datesToLog: Date[]; newNextDueDate: Date };

// Pure catch-up math, deliberately separated from the DB writes in
// src/app/actions/recurring-transactions.ts so it's directly unit-testable:
// given a template's current nextDueDate, returns every due date up to and
// including "now" -- each becomes one backdated Transaction, dated for that
// exact period, not "today" -- plus the nextDueDate once fully caught up.
// A template that's several periods behind (e.g. just created with a start
// date months in the past) catches up on every missed period in one pass,
// not just the most recent one.
export function computeCatchUp(
  nextDueDate: Date,
  frequency: "MONTHLY" | "QUARTERLY" | "ANNUAL",
  now: Date = new Date(),
): CatchUpResult {
  const datesToLog: Date[] = [];
  let cursor = nextDueDate;
  let iterations = 0;

  while (cursor <= now && iterations < MAX_CATCHUP_PERIODS) {
    datesToLog.push(cursor);
    cursor = advanceDueDate(cursor, frequency);
    iterations++;
  }

  return { datesToLog, newNextDueDate: cursor };
}

export type BusinessUseSplit = { businessAmount: number; personalAmount: number };

// Splits one amount into a business portion and a personal portion by a
// business-use percentage (2026-07-28, e.g. a phone bill that's 60%
// business use) -- computed in integer cents so the two portions always sum
// back to exactly the original amount, never a penny off from ordinary
// floating-point rounding (e.g. 33.33% of $10 must be $3.33 + $6.67, not
// $3.33 + $6.67000000000001 or similar drift).
export function splitByBusinessUse(amount: number, businessUsePercent: number): BusinessUseSplit {
  const totalCents = Math.round(amount * 100);
  const businessCents = Math.round((totalCents * businessUsePercent) / 100);
  const personalCents = totalCents - businessCents;
  return { businessAmount: businessCents / 100, personalAmount: personalCents / 100 };
}
