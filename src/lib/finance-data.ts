import { prisma } from "@/lib/db";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const CATEGORY_LABELS: Record<string, string> = {
  HOME_OFFICE: "Home office",
  PHONE: "Phone",
  OTHER: "Other",
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCKS: "Stocks",
  RETIREMENT: "Retirement",
  REAL_ESTATE: "Real estate",
  CRYPTO: "Crypto",
  SAVINGS: "Savings",
  OTHER: "Other",
};

export type MonthlySeriesPoint = { month: string; income: number; expenses: number };

// Every function here is deliberately scoped by plain userId, never
// teamOrOwnFilter/teamSharedFilter — this is "your own financial picture"
// (dashboard + /finances), not a team-visibility surface. Managers don't get
// a wider view of a teammate's personal or business financial numbers here;
// /team is the (already existing) place for team-wide deal/commission stats.
export async function getMonthlyIncomeExpense(
  userId: string,
  year: number,
  scope: "BUSINESS" | "PERSONAL",
): Promise<MonthlySeriesPoint[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const rows = await prisma.transaction.findMany({
    where: { userId, scope, date: { gte: start, lt: end } },
    select: { type: true, amount: true, date: true },
  });

  const points: MonthlySeriesPoint[] = MONTH_LABELS.map((month) => ({
    month,
    income: 0,
    expenses: 0,
  }));

  for (const row of rows) {
    const point = points[row.date.getUTCMonth()];
    const amount = Number(row.amount);
    if (row.type === "INCOME") point.income += amount;
    else point.expenses += amount;
  }

  return points;
}

export type BreakdownPoint = { label: string; value: number };

export async function getBusinessExpenseBreakdown(
  userId: string,
  year: number,
): Promise<BreakdownPoint[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [expenses, mileageAgg] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId, scope: "BUSINESS", type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.mileageLog.aggregate({
      where: { userId, isBusiness: true, date: { gte: start, lt: end } },
      _sum: { deduction: true },
    }),
  ]);

  const points: BreakdownPoint[] = expenses
    .filter((e) => e.category)
    .map((e) => ({
      label: CATEGORY_LABELS[e.category!] ?? e.category!,
      value: Number(e._sum.amount ?? 0),
    }));

  const mileageDeduction = Number(mileageAgg._sum.deduction ?? 0);
  if (mileageDeduction > 0) points.push({ label: "Mileage", value: mileageDeduction });

  return points.filter((p) => p.value > 0);
}

export type MileageMonthlyPoint = { month: string; miles: number; deduction: number };

export async function getMileageMonthlySeries(
  userId: string,
  year: number,
): Promise<MileageMonthlyPoint[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const rows = await prisma.mileageLog.findMany({
    where: { userId, isBusiness: true, date: { gte: start, lt: end } },
    select: { miles: true, deduction: true, date: true },
  });

  const points: MileageMonthlyPoint[] = MONTH_LABELS.map((month) => ({
    month,
    miles: 0,
    deduction: 0,
  }));

  for (const row of rows) {
    const point = points[row.date.getUTCMonth()];
    point.miles += Number(row.miles);
    point.deduction += Number(row.deduction);
  }

  return points;
}

export async function getAssetBreakdown(
  userId: string,
): Promise<{ points: BreakdownPoint[]; total: number }> {
  const grouped = await prisma.asset.groupBy({
    by: ["type"],
    where: { userId },
    _sum: { currentValue: true },
  });

  const points = grouped
    .map((g) => ({
      label: ASSET_TYPE_LABELS[g.type] ?? g.type,
      value: Number(g._sum.currentValue ?? 0),
    }))
    .filter((p) => p.value > 0);

  const total = points.reduce((sum, p) => sum + p.value, 0);
  return { points, total };
}

// "Real estate business value" here means active pipeline value — the sum
// of sale price (or list price, if not yet sold) across deals that are
// still ACTIVE/UNDER_CONTRACT/PENDING. It's a stock-like proxy for "what's
// currently tied up in the business," not a literal bank balance — there is
// no ledger of the business's own cash on hand, only the agent's personal
// income/expense transactions.
export async function getPipelineValue(userId: string): Promise<{ value: number; count: number }> {
  const deals = await prisma.deal.findMany({
    where: { userId, status: { in: ["ACTIVE", "UNDER_CONTRACT", "PENDING"] } },
    select: { listPrice: true, salePrice: true },
  });

  const value = deals.reduce((sum, d) => {
    const amount = d.salePrice ?? d.listPrice;
    return sum + (amount ? Number(amount) : 0);
  }, 0);

  return { value, count: deals.length };
}
