import { prisma } from "@/lib/db";
import { buildAmortizationSchedule, scheduleAtDate } from "@/lib/loan-calculations";
import { CATEGORY_LABELS } from "@/lib/transaction-categories";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import { calculateNetCommission } from "@/lib/commission";

// Re-exported so existing server-side importers keep working; the definitions
// live in the prisma-free commission module so client components can use them.
export { calculateCommissionAmount, calculateNetCommission } from "@/lib/commission";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// IRS Simplified home-office-deduction method: $5 per sq ft, capped at 300 sq
// ft ($1,500/yr max). Deliberately not the Actual-Expense method (tracking
// home vs. office sq ft % applied to real utility/insurance/repair costs) —
// the Simplified method is what most self-employed filers actually use, and
// needs only the one input already on User.homeOfficeSqFt.
export function getHomeOfficeDeduction(homeOfficeSqFt: number | null | undefined): number {
  return Math.min(homeOfficeSqFt ?? 0, 300) * 5;
}

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
  scope: "BUSINESS" | "PERSONAL" | "ALL",
): Promise<MonthlySeriesPoint[]> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const rows = await prisma.transaction.findMany({
    where: { userId, ...(scope === "ALL" ? {} : { scope }), date: { gte: start, lt: end } },
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

  const [expenses, mileageAgg, user] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { userId, scope: "BUSINESS", type: "EXPENSE", date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.mileageLog.aggregate({
      where: { userId, isBusiness: true, date: { gte: start, lt: end } },
      _sum: { deduction: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { homeOfficeSqFt: true } }),
  ]);

  const points: BreakdownPoint[] = expenses
    .filter((e) => e.category)
    .map((e) => ({
      label: CATEGORY_LABELS[e.category!] ?? e.category!,
      value: Number(e._sum.amount ?? 0),
    }));

  const homeOfficeDeduction = getHomeOfficeDeduction(user?.homeOfficeSqFt);
  if (homeOfficeDeduction > 0) points.push({ label: "Home office", value: homeOfficeDeduction });

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

// "Deals closed this year" + net commission rollup for the individual
// agent's own /dashboard — the same figures the manager-only /team page
// already computes per-agent, now available to every agent for their own
// numbers, not just their manager.
export async function getClosedDealsSummary(
  userId: string,
  year: number,
): Promise<{ count: number; netCommission: number }> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const deals = await prisma.deal.findMany({
    where: { userId, status: "CLOSED", closingDate: { gte: start, lt: end } },
    select: {
      commissionAmount: true,
      brokerageSplitPercent: true,
      referralFeeAmount: true,
      teamSplitAmount: true,
      otherDeductions: true,
    },
  });

  const netCommission = deals.reduce(
    (sum, d) =>
      sum +
      calculateNetCommission(d.commissionAmount ? Number(d.commissionAmount) : 0, {
        brokerageSplitPercent: d.brokerageSplitPercent ? Number(d.brokerageSplitPercent) : null,
        referralFeeAmount: d.referralFeeAmount ? Number(d.referralFeeAmount) : null,
        teamSplitAmount: d.teamSplitAmount ? Number(d.teamSplitAmount) : null,
        otherDeductions: d.otherDeductions ? Number(d.otherDeductions) : null,
      }),
    0,
  );

  return { count: deals.length, netCommission };
}

// Running total owed to each referral partner (2026-07-29 audit follow-up) --
// scoped to CLOSED deals only, since a fee is realistically "owed" once a
// deal actually closes, not while it's still pending. Deliberately a simple
// lifetime total, not a per-year breakdown or a payment/disbursement ledger
// (see CLAUDE.md for why that's out of scope for this pass).
export async function getReferralPartnerTotals(
  userId: string,
): Promise<{ id: string; name: string; email: string | null; phone: string | null; totalOwed: number }[]> {
  const partners = await prisma.referralPartner.findMany({
    where: { userId },
    include: { deals: { where: { status: "CLOSED" }, select: { referralFeeAmount: true } } },
    orderBy: { createdAt: "desc" },
  });

  return partners.map((p) => ({
    id: p.id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    totalOwed: p.deals.reduce((sum, d) => sum + (d.referralFeeAmount ? Number(d.referralFeeAmount) : 0), 0),
  }));
}

// Pure math for a Budget's usage this month — separated from the DB fetch
// below so the percentage math itself is directly unit-testable.
export function calculateBudgetPercentUsed(spent: number, monthlyLimit: number): number {
  return monthlyLimit > 0 ? (spent / monthlyLimit) * 100 : 0;
}

export type BudgetUsage = {
  budgetId: string;
  scope: "BUSINESS" | "PERSONAL";
  category: string | null;
  monthlyLimit: number;
  spent: number;
  percentUsed: number;
};

// A null category means "overall" for that scope — the category filter is
// simply omitted, summing every expense in that scope for the month.
export async function getBudgetUsage(userId: string, year: number, month: number): Promise<BudgetUsage[]> {
  const budgets = await prisma.budget.findMany({ where: { userId } });
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 1));

  return Promise.all(
    budgets.map(async (b) => {
      const agg = await prisma.transaction.aggregate({
        where: {
          userId,
          scope: b.scope,
          type: "EXPENSE",
          date: { gte: start, lt: end },
          ...(b.category ? { category: b.category } : {}),
        },
        _sum: { amount: true },
      });
      const spent = Number(agg._sum.amount ?? 0);
      const monthlyLimit = Number(b.monthlyLimit);
      return {
        budgetId: b.id,
        scope: b.scope,
        category: b.category,
        monthlyLimit,
        spent,
        percentUsed: calculateBudgetPercentUsed(spent, monthlyLimit),
      };
    }),
  );
}

export type NetWorthPoint = { month: string; assets: number; liabilities: number; netWorth: number };

// Net worth over time = sum of the latest AssetValueSnapshot per asset as of
// each month's end, minus every Loan's balance as of that same date (via the
// already date-parameterized buildAmortizationSchedule/scheduleAtDate in
// loan-calculations.ts — no changes needed there). History only accrues from
// whenever the first snapshot was recorded forward (snapshots are written on
// every asset create/update, plus a one-time backfill for pre-existing
// assets) — there's no way to know past values before they were logged.
export async function getNetWorthSeries(userId: string): Promise<NetWorthPoint[]> {
  const [assets, loans] = await Promise.all([
    prisma.asset.findMany({
      where: { userId },
      include: { valueSnapshots: { orderBy: { recordedAt: "asc" } } },
    }),
    prisma.loan.findMany({
      where: { userId },
      include: { extraPayments: true },
    }),
  ]);

  const allSnapshotDates = assets.flatMap((a) => a.valueSnapshots.map((s) => s.recordedAt));
  if (allSnapshotDates.length === 0) return [];

  const earliest = new Date(Math.min(...allSnapshotDates.map((d) => d.getTime())));
  const now = new Date();

  const loanSchedules = loans.map((loan) => ({
    startDate: loan.startDate,
    schedule: buildAmortizationSchedule(
      Math.max(0, Number(loan.purchasePrice) - Number(loan.downPayment)),
      Number(loan.interestRate),
      loan.termMonths,
      loan.startDate,
      loan.extraPayments.map((p) => ({ date: p.date, amount: Number(p.amount) })),
    ),
  }));

  const points: NetWorthPoint[] = [];
  const cursor = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const endCursor = new Date(now.getFullYear(), now.getMonth(), 1);

  while (cursor <= endCursor) {
    // Half-open [start of month, start of next month) window, matching the
    // convention used elsewhere in this file — "asOf" is the last instant of
    // the current month, so an update recorded anywhere within the month
    // counts toward that month's point, not only the next one.
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const asOf = new Date(nextMonth.getTime() - 1);

    const assetsTotal = assets.reduce((sum, asset) => {
      const applicable = asset.valueSnapshots.filter((s) => s.recordedAt <= asOf);
      if (applicable.length === 0) return sum;
      return sum + Number(applicable[applicable.length - 1].value);
    }, 0);

    const liabilitiesTotal = loanSchedules.reduce((sum, { startDate, schedule }) => {
      if (asOf < startDate) return sum;
      return sum + scheduleAtDate(schedule, asOf).balance;
    }, 0);

    points.push({
      month: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      assets: assetsTotal,
      liabilities: liabilitiesTotal,
      netWorth: assetsTotal - liabilitiesTotal,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return points;
}

export type DueRecurringItem = {
  id: string;
  description: string | null;
  category: string | null;
  amount: number;
  scope: "BUSINESS" | "PERSONAL";
  type: "INCOME" | "EXPENSE";
  nextDueDate: string; // yyyy-mm-dd
  isOverdue: boolean;
};

// Purely informational as of 2026-07-27 -- anything actually due gets
// auto-logged on every page view (see autoLogDueRecurringTransactions in
// src/app/actions/recurring-transactions.ts, run from the shared (app)
// layout before this ever runs), so in normal operation nothing returned
// here should ever be overdue; isOverdue is kept only as a defensive
// fallback indicator. The 7-day window matches the existing DealDeadline
// alerts, for a consistent "what's coming up" feel across the app.
export async function getDueRecurringTemplates(userId: string): Promise<DueRecurringItem[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const templates = await prisma.recurringTransactionTemplate.findMany({
    where: { userId, nextDueDate: { lte: soon } },
    orderBy: { nextDueDate: "asc" },
  });

  return templates.map((t) => ({
    id: t.id,
    description: t.description,
    category: t.category,
    amount: Number(t.amount),
    scope: t.scope,
    type: t.type,
    nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
    isOverdue: t.nextDueDate < now,
  }));
}

export type UpcomingDeadline = {
  id: string;
  label: string;
  propertyAddress: string;
  dealId: string;
  dueDate: string; // yyyy-mm-dd
  isOverdue: boolean;
};

// Extracted from what was originally an inline query on the dashboard, now
// also used by the sidebar's notification bell (src/components/sidebar.tsx)
// -- one source of truth for "what's coming up," same 7-day window the
// dashboard already used. Deliberately DealDeadline only, not ClientDeadline
// -- see the ClientDeadline model's own comment for why that one stays
// isolated to the client detail page.
export async function getUpcomingDeadlines(userId: string, days = 7): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const soon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const deadlines = await prisma.dealDeadline.findMany({
    where: { completedAt: null, dueDate: { lte: soon }, deal: { userId } },
    include: { deal: true },
    orderBy: { dueDate: "asc" },
  });

  return deadlines.map((d) => ({
    id: d.id,
    label: d.label,
    propertyAddress: dealDisplayName(d.deal.propertyAddress),
    dealId: d.dealId,
    dueDate: d.dueDate.toISOString().slice(0, 10),
    isOverdue: d.dueDate < now,
  }));
}
