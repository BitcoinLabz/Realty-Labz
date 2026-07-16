import { prisma } from "@/lib/db";

const STATE = "MI";

/**
 * Looks up the applicable mileage rate for a trip date, falling back to the
 * most recent configured rate at or before that year (rates are set annually
 * and may not exist yet for a future year).
 */
export async function getMileageRate(tripDate: Date): Promise<number> {
  const year = tripDate.getFullYear();

  const exact = await prisma.mileageRate.findUnique({
    where: { state_year: { state: STATE, year } },
  });
  if (exact) return Number(exact.ratePerMile);

  const priorOrEqual = await prisma.mileageRate.findFirst({
    where: { state: STATE, year: { lte: year } },
    orderBy: { year: "desc" },
  });
  if (priorOrEqual) return Number(priorOrEqual.ratePerMile);

  const earliest = await prisma.mileageRate.findFirst({
    where: { state: STATE },
    orderBy: { year: "asc" },
  });
  if (earliest) return Number(earliest.ratePerMile);

  throw new Error("No mileage rate configured for Michigan. Seed prisma/seed.ts first.");
}
