import { prisma } from "@/lib/db";
import { selectRateForDate } from "@/lib/mileage-rate";

const STATE = "MI";

/**
 * Looks up the applicable Michigan mileage rate for a trip date.
 *
 * Fetches every rate rather than querying for one: this table holds a handful
 * of rows (one per rate change, ever), and doing the selection in the tested
 * pure function beats duplicating the "most recent on or before" logic in SQL
 * where it can't be unit-tested.
 *
 * Kept out of mileage-rate.ts so that pure module stays importable from
 * client components -- see the note at the top of that file.
 */
export async function getMileageRate(tripDate: Date): Promise<number> {
  const rows = await prisma.mileageRate.findMany({ where: { state: STATE } });

  const rate = selectRateForDate(
    rows.map((r) => ({ effectiveFrom: r.effectiveFrom, ratePerMile: Number(r.ratePerMile) })),
    tripDate,
  );

  if (rate === null) {
    throw new Error("No mileage rate configured for Michigan. Seed prisma/seed.ts first.");
  }
  return rate;
}
