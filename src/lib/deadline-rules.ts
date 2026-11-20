// Deadlines as linked rules, not fixed dates (2026-11-19).
//
// A contract deadline is almost never a calendar date on its own: it's
// "10 days after acceptance", "3 business days before closing", or "5 days
// after the inspection period ends". Storing only the resulting date meant
// that changing the acceptance date or exercising an extension (the 0
// Crooked Lake Road case: an optional 60 more days for a further $5,000
// deposit) left every dependent date silently wrong. Here each deadline can
// carry its rule -- base event + number of days + calendar or business days
// -- and dates are recomputed from the rules whenever an input changes.
//
// Pure, no database: unit-tested in deadline-rules.test.ts and safe to import
// from client components (the review screen previews dates with it).
//
// Dates follow the deadline pipeline's UTC-midnight convention -- see the
// note at the top of src/lib/deadline-templates.ts for why.

import { addDaysUtc } from "@/lib/deadline-templates";

export type DayType = "CALENDAR" | "BUSINESS";
export type BaseEvent = "ACCEPTANCE" | "CLOSING" | "DEADLINE";

export type DeadlineRule = {
  baseEvent: BaseEvent;
  /** For baseEvent DEADLINE: the deadline this one counts from. */
  baseDeadlineId?: string | null;
  /** Negative counts backwards, e.g. -3 = three days before closing. */
  offsetDays: number;
  dayType: DayType;
};

export type RuleDeadline = {
  id: string;
  label: string;
  /** Null: a fixed date typed in by hand -- it moves only when extended. */
  rule: DeadlineRule | null;
  /** The stored date: the result last time, or the fixed date. */
  dueDate: Date;
  /** Calendar days added by extensions (rule deadlines only). */
  extensionDays: number;
  /** The closing deadline, if the contract counts closing from acceptance. */
  isClosing?: boolean;
  completed?: boolean;
};

// ---------------------------------------------------------------------------
// Business days
// ---------------------------------------------------------------------------

function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return new Date(Date.UTC(year, month, 1 + offset + (n - 1) * 7));
}

function lastWeekday(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const offset = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, -offset));
}

function observed(date: Date): Date {
  const day = date.getUTCDay();
  if (day === 6) return addDaysUtc(date, -1); // Saturday -> Friday
  if (day === 0) return addDaysUtc(date, 1); // Sunday -> Monday
  return date;
}

/**
 * Federal holidays as observed (when a fixed-date holiday lands on a weekend).
 * Most Michigan purchase agreements define business days as excluding
 * weekends and legal holidays; a specific contract may define it differently,
 * which the review screen asks the agent to confirm.
 */
export function federalHolidaysUtc(year: number): Date[] {
  return [
    observed(new Date(Date.UTC(year, 0, 1))), // New Year's Day
    nthWeekday(year, 0, 1, 3), // Martin Luther King Jr. Day
    nthWeekday(year, 1, 1, 3), // Presidents' Day
    lastWeekday(year, 4, 1), // Memorial Day
    observed(new Date(Date.UTC(year, 5, 19))), // Juneteenth
    observed(new Date(Date.UTC(year, 6, 4))), // Independence Day
    nthWeekday(year, 8, 1, 1), // Labor Day
    nthWeekday(year, 9, 1, 2), // Columbus Day
    observed(new Date(Date.UTC(year, 10, 11))), // Veterans Day
    nthWeekday(year, 10, 4, 4), // Thanksgiving
    observed(new Date(Date.UTC(year, 11, 25))), // Christmas
  ];
}

const holidayCache = new Map<number, Set<number>>();
export function isBusinessDayUtc(date: Date): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  const year = date.getUTCFullYear();
  if (!holidayCache.has(year)) {
    // Next year's New Year's Day can be observed on Dec 31 of this one.
    holidayCache.set(
      year,
      new Set([...federalHolidaysUtc(year), ...federalHolidaysUtc(year + 1)].map((d) => d.getTime())),
    );
  }
  return !holidayCache.get(year)!.has(date.getTime());
}

/** Counts business days forward (or back, for a negative count) from a date. */
export function addBusinessDaysUtc(start: Date, days: number): Date {
  let date = start;
  let remaining = Math.abs(days);
  const step = days < 0 ? -1 : 1;
  while (remaining > 0) {
    date = addDaysUtc(date, step);
    if (isBusinessDayUtc(date)) remaining--;
  }
  return date;
}

export function addDaysOfType(start: Date, days: number, dayType: DayType): Date {
  return dayType === "BUSINESS" ? addBusinessDaysUtc(start, days) : addDaysUtc(start, days);
}

/** Calendar days between two UTC-midnight dates (b - a). */
export function daysBetweenUtc(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

// ---------------------------------------------------------------------------
// Recalculation
// ---------------------------------------------------------------------------

export type DealDates = { acceptanceDate: Date | null; closingDate: Date | null };

/**
 * Works out every deadline's date from its rule. Returns the new date per
 * deadline id; a deadline whose rule can't be resolved (no acceptance date
 * yet, a missing base deadline, or a loop) keeps its stored date.
 */
export function computeDeadlineDates(deadlines: RuleDeadline[], dates: DealDates): Map<string, Date> {
  const byId = new Map(deadlines.map((d) => [d.id, d]));
  const result = new Map<string, Date>();
  const visiting = new Set<string>();
  const closingDeadline = deadlines.find((d) => d.isClosing);

  const resolve = (d: RuleDeadline): Date => {
    const known = result.get(d.id);
    if (known) return known;
    if (!d.rule) {
      result.set(d.id, d.dueDate); // a fixed date
      return d.dueDate;
    }
    if (visiting.has(d.id)) return d.dueDate; // a loop: fall back to the stored date
    visiting.add(d.id);

    let base: Date | null = null;
    if (d.rule.baseEvent === "ACCEPTANCE") base = dates.acceptanceDate;
    else if (d.rule.baseEvent === "CLOSING") {
      // Counted from the closing deadline when there is one (it may itself
      // move), else from the deal's closing date.
      base = closingDeadline && closingDeadline.id !== d.id ? resolve(closingDeadline) : dates.closingDate;
    } else {
      const parent = d.rule.baseDeadlineId ? byId.get(d.rule.baseDeadlineId) : undefined;
      base = parent ? resolve(parent) : null;
    }

    const date = base
      ? addDaysUtc(addDaysOfType(base, d.rule.offsetDays, d.rule.dayType), d.extensionDays)
      : d.dueDate;
    visiting.delete(d.id);
    result.set(d.id, date);
    return date;
  };

  for (const d of deadlines) resolve(d);
  return result;
}

/** Ids whose stored date differs from what the rules now say. */
export function changedDeadlines(deadlines: RuleDeadline[], dates: DealDates): { id: string; dueDate: Date }[] {
  const computed = computeDeadlineDates(deadlines, dates);
  return deadlines
    .filter((d) => computed.get(d.id)!.getTime() !== d.dueDate.getTime())
    .map((d) => ({ id: d.id, dueDate: computed.get(d.id)! }));
}

/** Every deadline that counts (directly or through others) from `id`. */
export function dependentsOf(deadlines: RuleDeadline[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (parent: string) => {
    for (const d of deadlines) {
      if (d.rule?.baseEvent === "DEADLINE" && d.rule.baseDeadlineId === parent && !out.has(d.id)) {
        out.add(d.id);
        walk(d.id);
      }
    }
    // Deadlines counted from closing move with the closing deadline.
    const parentDeadline = deadlines.find((d) => d.id === parent);
    if (parentDeadline?.isClosing) {
      for (const d of deadlines) {
        if (d.rule?.baseEvent === "CLOSING" && d.id !== parent && !out.has(d.id)) {
          out.add(d.id);
          walk(d.id);
        }
      }
    }
  };
  walk(id);
  return out;
}

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

export type ExtensionPlan = {
  /** Calendar days each directly-extended deadline moves by (what undo reverses). */
  shifts: Record<string, number>;
  /** Deadline ids that move only because they count from an extended one. */
  movedWithIt: string[];
  /** New dates for every deadline after the extension. */
  newDates: Map<string, Date>;
};

/**
 * Plans an extension of `days` (calendar or business) on the chosen
 * deadlines. A chosen deadline that already counts from another chosen one
 * isn't shifted twice: it moves with its parent. Business days are turned
 * into a calendar shift from each deadline's current date, so the exact same
 * shift can be undone later.
 */
export function planExtension(params: {
  deadlines: RuleDeadline[];
  dates: DealDates;
  targetIds: string[];
  days: number;
  dayType: DayType;
}): ExtensionPlan {
  const { deadlines, dates, days, dayType } = params;
  const current = computeDeadlineDates(deadlines, dates);
  const targets = new Set(params.targetIds.filter((id) => deadlines.some((d) => d.id === id && !d.completed)));

  const covered = new Set<string>();
  for (const id of targets) for (const dep of dependentsOf(deadlines, id)) covered.add(dep);
  const direct = [...targets].filter((id) => !covered.has(id));

  const shifts: Record<string, number> = {};
  for (const id of direct) {
    const from = current.get(id)!;
    shifts[id] = daysBetweenUtc(from, addDaysOfType(from, days, dayType));
  }

  const after = applyShifts(deadlines, shifts, 1);
  const newDates = computeDeadlineDates(after, dates);
  const movedWithIt = deadlines
    .filter((d) => !shifts[d.id] && newDates.get(d.id)!.getTime() !== current.get(d.id)!.getTime())
    .map((d) => d.id);
  return { shifts, movedWithIt, newDates };
}

/**
 * Applies (direction 1) or reverses (direction -1) a set of shifts: a rule
 * deadline's extensionDays changes; a fixed deadline's date itself moves.
 */
export function applyShifts(deadlines: RuleDeadline[], shifts: Record<string, number>, direction: 1 | -1): RuleDeadline[] {
  return deadlines.map((d) => {
    const shift = shifts[d.id];
    if (!shift) return d;
    return d.rule
      ? { ...d, extensionDays: d.extensionDays + direction * shift }
      : { ...d, dueDate: addDaysUtc(d.dueDate, direction * shift) };
  });
}

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------

export function describeRule(rule: DeadlineRule, labelOf: (id: string) => string | undefined): string {
  const n = Math.abs(rule.offsetDays);
  const unit = `${rule.dayType === "BUSINESS" ? "business day" : "day"}${n === 1 ? "" : "s"}`;
  const base =
    rule.baseEvent === "ACCEPTANCE"
      ? "acceptance"
      : rule.baseEvent === "CLOSING"
        ? "closing"
        : (rule.baseDeadlineId && labelOf(rule.baseDeadlineId)) || "another deadline";
  if (rule.offsetDays === 0) return `On the day of ${base}`;
  return `${n} ${unit} ${rule.offsetDays < 0 ? "before" : "after"} ${base}`;
}
