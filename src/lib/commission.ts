// Pure commission math -- NO database import, deliberately.
//
// The deal form is a client component and needs calculateCommissionAmount for
// its live suggestion. Importing anything from a module that also constructs a
// PrismaClient drags the server module graph into the browser bundle and fails
// the build with "Can't resolve 'dns'/'fs'" -- which is exactly what happened
// when these lived in finance-data.ts. Same trap the CATEGORY_LABELS and
// mileage-rate extractions already solved.
//
// Both figures land on a tax document, which is this project's stated bar for
// a unit test; see commission.test.ts.

/**
 * Gross commission from a sale price and a percentage rate, rounded to cents.
 *
 * Returns null when either input is missing or nonsensical, so callers show
 * nothing rather than a confident $0.00 the agent might mistake for an answer.
 */
export function calculateCommissionAmount(
  price: number | null | undefined,
  ratePercent: number | null | undefined,
): number | null {
  if (price == null || ratePercent == null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(ratePercent)) return null;
  if (price <= 0 || ratePercent <= 0) return null;

  return Math.round(price * (ratePercent / 100) * 100) / 100;
}

/**
 * Net commission = gross, minus every split taken as a percentage of it.
 *
 * All four splits are percentages (2026-08-26). They used to be a mix -- a
 * brokerage percentage against three flat dollar figures -- which meant the
 * dollar ones silently went stale whenever the sale price or commission
 * changed.
 *
 * Deliberately neither clamped nor rounded: splits can legitimately exceed the
 * gross, and callers need to see that rather than have it silently floored at
 * zero. Anything writing this to the ledger must handle a non-positive result
 * itself (see logCommissionAsIncomeAction).
 */
export function calculateNetCommission(
  grossCommission: number,
  splits: {
    brokerageSplitPercent?: number | null;
    referralFeePercent?: number | null;
    teamSplitPercent?: number | null;
    otherDeductionsPercent?: number | null;
  },
): number {
  const totalPercent =
    (splits.brokerageSplitPercent ?? 0) +
    (splits.referralFeePercent ?? 0) +
    (splits.teamSplitPercent ?? 0) +
    (splits.otherDeductionsPercent ?? 0);

  return grossCommission - grossCommission * (totalPercent / 100);
}
