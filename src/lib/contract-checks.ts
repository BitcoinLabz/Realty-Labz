import { formatDeadlineDate, isWeekendUtc, nextBusinessDayUtc } from "@/lib/deadline-templates";

// Plain-code checks run over the dates the contract reader found, before the
// agent saves them. Deliberately not left to the model: these are rules with
// one right answer, so they're computed and unit-tested
// (contract-checks.test.ts) rather than hoped for. The model's own
// "worth a second look" notes cover the judgement calls.

export type DeadlineFlag =
  | { kind: "weekend"; weekday: string; suggestedDate: string }
  | { kind: "afterClosing" }
  | { kind: "inPast" }
  | { kind: "duplicate" };

type Input = { label: string; dueDate: string };

// yyyy-mm-dd -> UTC midnight, the shape every deadline is stored in. Null
// for anything that isn't a real date, so a half-typed field just skips the
// checks instead of throwing.
function parseDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function checkDeadlines(params: {
  deadlines: Input[];
  closingDate: string | null;
  today: string; // yyyy-mm-dd, in Michigan (see todayInReminderZone)
}): DeadlineFlag[][] {
  const closing = parseDate(params.closingDate);
  const today = parseDate(params.today);

  // Same label on the same date means the reader listed one thing twice.
  const seen = new Map<string, number>();
  for (const d of params.deadlines) {
    const key = `${d.label.trim().toLowerCase()}|${d.dueDate}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  return params.deadlines.map((d) => {
    const flags: DeadlineFlag[] = [];
    const due = parseDate(d.dueDate);
    if (!due) return flags;

    if (isWeekendUtc(due)) {
      flags.push({
        kind: "weekend",
        weekday: due.getUTCDay() === 6 ? "Saturday" : "Sunday",
        suggestedDate: formatDeadlineDate(nextBusinessDayUtc(due)),
      });
    }
    // Closing itself is naturally on the closing date, so strictly after.
    if (closing && due.getTime() > closing.getTime()) flags.push({ kind: "afterClosing" });
    if (today && due.getTime() < today.getTime()) flags.push({ kind: "inPast" });
    if ((seen.get(`${d.label.trim().toLowerCase()}|${d.dueDate}`) ?? 0) > 1) {
      flags.push({ kind: "duplicate" });
    }
    return flags;
  });
}

// Short, calm wording for each flag in the review screen.
export function describeFlag(flag: DeadlineFlag): string {
  switch (flag.kind) {
    case "weekend":
      return `Falls on a ${flag.weekday}`;
    case "afterClosing":
      return "After the closing date";
    case "inPast":
      return "Already passed";
    case "duplicate":
      return "Listed twice";
  }
}

// Amended or countered contracts: a deadline the reader finds that already
// exists on the deal (same name, still open) should change that deadline's
// date, not add a duplicate beside it. Matching is by name only -- the date
// is exactly what's expected to differ. Completed deadlines are left alone:
// re-opening something the agent already checked off would be a surprise.
export type ExistingDeadline = { id: string; label: string; dueDate: string; completed: boolean };
export type DeadlineMatch = { existingId: string; oldDate: string; changed: boolean } | null;

function normaliseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export function matchExistingDeadlines(
  found: { label: string; dueDate: string }[],
  existing: ExistingDeadline[],
): DeadlineMatch[] {
  const open = existing.filter((e) => !e.completed);
  const claimed = new Set<string>();

  return found.map((f) => {
    const match = open.find((e) => !claimed.has(e.id) && normaliseLabel(e.label) === normaliseLabel(f.label));
    if (!match) return null;
    // Each existing deadline can absorb only one found row, so a contract
    // that genuinely lists two "Walkthrough" dates still adds the second.
    claimed.add(match.id);
    return { existingId: match.id, oldDate: match.dueDate, changed: match.dueDate !== f.dueDate };
  });
}
