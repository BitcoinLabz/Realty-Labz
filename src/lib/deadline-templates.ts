// Pure date math for applying a deadline set to a transaction.
//
// NO database import: this is imported by client components, and pulling in a
// module that constructs a PrismaClient drags the server module graph into the
// browser bundle and fails the build (see the note atop mileage-rate.ts).
//
// ---------------------------------------------------------------------------
// WHY UTC, AND WHY NOT parseDateOnlyLocal
// ---------------------------------------------------------------------------
// The deadline pipeline is UTC-consistent end to end and must stay that way:
//   write   src/app/actions/deal-deadlines.ts -- new Date("2026-07-01")
//           parses as UTC midnight
//   read    transactions/[id]/page.tsx -- .toISOString().slice(0, 10),
//           i.e. read back in UTC
//   render  deadline-list.tsx -- new Date(d.dueDate + "T00:00:00"), local,
//           for display only
//
// parseDateOnlyLocal (src/lib/recurring.ts) exists for the recurring
// transactions pipeline, which is local-time throughout. Using it here would
// be actively wrong: an anchor parsed locally and stored as
// 2026-01-01T05:00:00Z reads back through .toISOString() as "2026-01-01" west
// of UTC but "2025-12-31" east of it -- two incompatible classes of row in one
// table. So everything below is UTC arithmetic.
//
// Date.UTC also handles overflow for us: Date.UTC(2026, 0, 31 + 10) rolls into
// February correctly, so month/year/leap-year boundaries need no special
// cases. Doing this with setDate() on a locally-parsed date is what drifts a
// day across a DST boundary.

export type DeadlineTemplateItemInput = {
  label: string;
  offsetDays: number;
};

export type BuiltDeadline = {
  label: string;
  dueDate: Date;
};

/** Adds (or subtracts, for a negative count) whole days to a date, in UTC. */
export function addDaysUtc(anchor: Date, days: number): Date {
  return new Date(
    Date.UTC(
      anchor.getUTCFullYear(),
      anchor.getUTCMonth(),
      anchor.getUTCDate() + days,
      0,
      0,
      0,
      0,
    ),
  );
}

/**
 * Parses a yyyy-mm-dd string to UTC midnight -- the same instant
 * `new Date("2026-07-01")` produces, but from explicit components so a
 * malformed string fails loudly here instead of silently becoming Invalid
 * Date deep in a database write.
 */
export function parseAnchorDateUtc(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;

  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  // Rejects real-looking but nonexistent dates (2026-02-30 would otherwise
  // roll silently into March).
  if (parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;

  return parsed;
}

/**
 * Turns a deadline set plus an anchor date into the concrete deadlines to
 * create. Returns [] for an unparseable anchor so the caller surfaces one
 * clear error rather than writing garbage dates.
 */
export function buildDeadlinesFromTemplate(
  items: DeadlineTemplateItemInput[],
  anchorDate: string,
): BuiltDeadline[] {
  const anchor = parseAnchorDateUtc(anchorDate);
  if (!anchor) return [];

  return items.map((item) => ({
    label: item.label,
    dueDate: addDaysUtc(anchor, item.offsetDays),
  }));
}

/** yyyy-mm-dd for previewing a computed date, read back in UTC to match. */
export function formatDeadlineDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
