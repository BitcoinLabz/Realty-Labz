import { cache } from "react";
import { prisma } from "@/lib/db";
import { getBusinessNetByYear } from "@/lib/business-net";
import { loadTaxRules } from "@/lib/tax-rules-db";
import {
  computeHomeOfficeChain,
  type HomeOfficeExpenseInput,
  type HomeOfficeMethod,
  type HomeOfficeProfile,
  type HomeOfficeYearResult,
} from "@/lib/home-office";

// Server-side loader for the home office engine (src/lib/home-office.ts).
// Scoped by plain userId: a home office is personal data, never
// team-visible, with no sharing setting -- the same rule as Asset and Loan.

type HomeOfficeRow = NonNullable<Awaited<ReturnType<typeof prisma.homeOffice.findUnique>>>;

const num = (v: { toString(): string } | null | undefined) => (v == null ? null : Number(v));

/** Office square feet: entered directly, or length x width. */
export function officeSqFtOf(row: Pick<HomeOfficeRow, "officeSqFt" | "officeLengthFt" | "officeWidthFt">): number {
  if (row.officeSqFt != null) return row.officeSqFt;
  const l = num(row.officeLengthFt);
  const w = num(row.officeWidthFt);
  return l && w ? Math.round(l * w) : 0;
}

export function toProfile(row: HomeOfficeRow): HomeOfficeProfile | null {
  const officeSqFt = officeSqFtOf(row);
  if (officeSqFt <= 0) return null;
  return {
    officeSqFt,
    homeSqFt: row.homeSqFt,
    businessUseStart: row.businessUseStart,
    ownership: row.ownership,
    purchasePrice: num(row.purchasePrice),
    landValue: num(row.landValue),
    improvementsCost: num(row.improvementsCost),
    fairMarketValueAtStart: num(row.fairMarketValueAtStart),
  };
}

export type HomeOfficeData = {
  row: HomeOfficeRow | null;
  profile: HomeOfficeProfile | null;
  chain: HomeOfficeYearResult[];
  /** The selected year's result, or null with no setup or a year before business use. */
  current: HomeOfficeYearResult | null;
};

/**
 * Runs the full chain from the year business use began through `year`, so
 * carryovers flow forward from real records. Cached per request: the
 * breakdown, the dashboard and the PDF can all ask without recomputing.
 */
export const getHomeOfficeData = cache(async (userId: string, year: number): Promise<HomeOfficeData> => {
  const row = await prisma.homeOffice.findUnique({ where: { userId } });
  const profile = row ? toProfile(row) : null;
  if (!row || !profile) return { row, profile, chain: [], current: null };

  const firstYear = profile.businessUseStart ? profile.businessUseStart.getUTCFullYear() : year;
  if (firstYear > year) return { row, profile, chain: [], current: null };

  const [expenses, years, netByYear, rules] = await Promise.all([
    prisma.homeOfficeExpense.findMany({
      where: { userId, date: { gte: new Date(Date.UTC(firstYear, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
      select: { kind: true, scope: true, period: true, date: true, amount: true },
    }),
    prisma.homeOfficeYear.findMany({ where: { userId }, select: { year: true, method: true } }),
    getBusinessNetByYear(userId, firstYear, year),
    loadTaxRules(),
  ]);

  const chosenMethods = new Map<number, HomeOfficeMethod>();
  for (const y of years) if (y.method) chosenMethods.set(y.year, y.method);

  const chain = computeHomeOfficeChain({
    profile,
    expenses: expenses.map(
      (e): HomeOfficeExpenseInput => ({ kind: e.kind, scope: e.scope, period: e.period, date: e.date, amount: Number(e.amount) }),
    ),
    netByYear,
    chosenMethods,
    throughYear: year,
    rules,
  });
  return { row, profile, chain, current: chain.find((c) => c.year === year) ?? null };
});

/** The allowed deduction for a year -- what the finance breakdown, dashboard and PDF use. */
export async function getHomeOfficeDeductionForYear(userId: string, year: number): Promise<number> {
  return (await getHomeOfficeData(userId, year)).current?.allowed ?? 0;
}

/**
 * Stores each computed year's carryover snapshot (the "running carryover
 * balance" the agent and their accountant see). Called from the Home Office
 * page and its PDF, not from every page that shows the deduction.
 */
export async function saveHomeOfficeSnapshots(userId: string, chain: HomeOfficeYearResult[]): Promise<void> {
  const computedAt = new Date();
  await prisma.$transaction(
    chain.map((c) => {
      const data = {
        appliedMethod: c.method,
        allowedDeduction: c.allowed,
        operatingCarryoverIn: c.carryIn.operating,
        depreciationCarryoverIn: c.carryIn.depreciation,
        operatingCarryoverOut: c.carryOut.operating,
        depreciationCarryoverOut: c.carryOut.depreciation,
        depreciationTaken: c.depreciationTaken,
        computedAt,
      };
      return prisma.homeOfficeYear.upsert({
        where: { userId_year: { userId, year: c.year } },
        update: data,
        create: { userId, year: c.year, ...data },
      });
    }),
  );
}
