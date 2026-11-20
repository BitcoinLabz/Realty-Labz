import { prisma } from "@/lib/db";

// Kept in its own module so both finance-data.ts and home-office-data.ts can
// use it without importing each other.
// Business profit per calendar year (income - expenses - mileage), for the
// hobby-loss check on Taxes (2026-11-19). Only years that have at least one
// business record are returned -- a year with nothing logged is unknown, not
// a loss. Home office isn't subtracted: this is the "profit before home
// office" that Form 8829's income limit is measured against (line 8).
export async function getBusinessNetByYear(
  userId: string,
  fromYear: number,
  toYear: number,
): Promise<Map<number, number>> {
  const start = new Date(Date.UTC(fromYear, 0, 1));
  const end = new Date(Date.UTC(toYear + 1, 0, 1));
  const [rows, trips] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, scope: "BUSINESS", date: { gte: start, lt: end } },
      select: { type: true, amount: true, date: true },
    }),
    prisma.mileageLog.findMany({
      where: { userId, isBusiness: true, date: { gte: start, lt: end } },
      select: { deduction: true, date: true },
    }),
  ]);
  const byYear = new Map<number, number>();
  const add = (date: Date, amount: number) => {
    const year = date.getUTCFullYear();
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
  };
  for (const r of rows) add(r.date, r.type === "INCOME" ? Number(r.amount) : -Number(r.amount));
  for (const t of trips) add(t.date, -Number(t.deduction));
  return byYear;
}

