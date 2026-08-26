// Pure mileage math and formatting -- NO database import, deliberately.
//
// mileage-list.tsx is a client component and imports formatMileageRate from
// here; importing anything from a module that also constructs a PrismaClient
// drags the whole server module graph into the browser bundle and fails the
// build outright (this codebase has hit that exact trap before -- see the
// CATEGORY_LABELS note in CLAUDE.md). The DB-backed lookup lives in
// mileage-rate-db.ts instead.



// Pure math, deliberately separated from the DB-backed rate lookup below so
// it's directly unit-testable: personal trips are never deductible, business
// trips are miles x the rate that applied at the time of the trip.
export function calculateMileageDeduction(miles: number, ratePerMile: number, isBusiness: boolean): number {
  return isBusiness ? miles * ratePerMile : 0;
}

export type MileageRateRow = {
  effectiveFrom: Date;
  ratePerMile: number;
};

/**
 * Picks the rate that applied on a given trip date: the most recent one whose
 * effectiveFrom is on or before that date.
 *
 * Pure and synchronous on purpose -- this is the part that decides real dollar
 * amounts on a tax document, so it's unit-tested directly rather than only
 * through a database.
 *
 * Comparison is on raw timestamps, never on locally-extracted year/month/day.
 * Trip dates are stored as UTC midnight, and this codebase has already been
 * bitten once by `new Date("2026-01-01").getFullYear()` returning 2025 west of
 * UTC (see parseDateOnlyLocal in src/lib/recurring.ts) -- a boundary trip on
 * the exact changeover date is precisely where that would go wrong.
 *
 * Returns null only when there are no rates at all.
 */
export function selectRateForDate(rates: MileageRateRow[], tripDate: Date): number | null {
  if (rates.length === 0) return null;

  const trip = tripDate.getTime();
  let applicable: MileageRateRow | null = null;
  let earliest: MileageRateRow = rates[0];

  for (const rate of rates) {
    const from = rate.effectiveFrom.getTime();
    if (from <= trip && (!applicable || from > applicable.effectiveFrom.getTime())) {
      applicable = rate;
    }
    if (from < earliest.effectiveFrom.getTime()) earliest = rate;
  }

  // A trip predating every configured rate falls back to the earliest one --
  // better than refusing to save a back-dated trip.
  return (applicable ?? earliest).ratePerMile;
}

/**
 * Formats a stored rate for display next to a trip, e.g. "$0.725/mi". Kept
 * here so the mileage list, the PDF export, and anything added later all
 * render the rate identically -- it's IRS documentation, so it should look
 * the same everywhere it appears.
 */
export function formatMileageRate(ratePerMile: number): string {
  return `$${ratePerMile.toFixed(3)}/mi`;
}
