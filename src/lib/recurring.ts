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
