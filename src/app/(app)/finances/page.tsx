import Link from "next/link";
import { BarChart3, PieChart, TrendingUp, Wallet } from "lucide-react";
import { auth } from "@/auth";
import { formatCurrency } from "@/lib/format";
import {
  getAssetBreakdown,
  getBusinessExpenseBreakdown,
  getDueRecurringTemplates,
  getMonthlyIncomeExpense,
  getPipelineValue,
} from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { RecurringReminders } from "./recurring-reminders";

// Overview is read-only on purpose. It used to carry ten stacked sections,
// four of which were settings forms (home office size, tax rate, budgets,
// document upload) -- those are now on the Taxes & budgets tab, where you go
// deliberately rather than scroll past every time you want to see a number.
export default async function FinancesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;

  const [businessSeries, personalSeries, expenseBreakdown, assetBreakdown, pipeline, dueRecurring] =
    await Promise.all([
      getMonthlyIncomeExpense(userId, year, "BUSINESS"),
      getMonthlyIncomeExpense(userId, year, "PERSONAL"),
      getBusinessExpenseBreakdown(userId, year),
      getAssetBreakdown(userId),
      getPipelineValue(userId),
      getDueRecurringTemplates(userId),
    ]);

  const businessNet = businessSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const personalNet = personalSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const hasBusinessData = businessSeries.some((m) => m.income > 0 || m.expenses > 0);
  const hasPersonalData = personalSeries.some((m) => m.income > 0 || m.expenses > 0);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end">
        <YearSelect year={year} options={yearOptions} basePath="/finances" />
      </div>

      <RecurringReminders items={dueRecurring} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={`Business net (${year})`} value={formatCurrency(businessNet)} />
        <SummaryCard label={`Personal net (${year})`} value={formatCurrency(personalNet)} />
        <SummaryCard
          label="Work in progress"
          value={formatCurrency(pipeline.value)}
          hint="The combined price of every transaction you have going right now that hasn't closed yet."
        />
        <SummaryCard label="Total invested" value={formatCurrency(assetBreakdown.total)} />
      </div>

      <Card title="Business money in & out" icon={BarChart3}>
        {hasBusinessData ? (
          <MonthlyBarChart data={businessSeries} />
        ) : (
          <EmptyState
            icon={BarChart3}
            title="No business income or expenses yet"
            description={`Once you log what you earn and spend on your real estate business, ${year} shows up here month by month.`}
            actionLabel="Log income or an expense"
            actionHref="/finances/income"
          />
        )}
      </Card>

      <Card title="Where your business money goes" icon={PieChart}>
        {expenseBreakdown.length > 0 ? (
          <BreakdownDonutChart data={expenseBreakdown} />
        ) : (
          <EmptyState
            icon={PieChart}
            title="No business expenses yet"
            description="Log expenses like marketing, MLS dues, or client gifts and you'll see what's costing you the most."
            actionLabel="Add an expense"
            actionHref="/finances/income"
          />
        )}
      </Card>

      <Card title="Personal money in & out" icon={TrendingUp}>
        {hasPersonalData ? (
          <MonthlyBarChart data={personalSeries} />
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No personal income or expenses yet"
            description="Track your personal side here too — it stays completely separate from your business numbers and never appears on tax exports."
            actionLabel="Log something personal"
            actionHref="/finances/income"
          />
        )}
      </Card>

      <Card
        title="Where your money is"
        icon={Wallet}
        action={
          <Link
            href="/finances/investments"
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Manage
          </Link>
        }
      >
        {assetBreakdown.points.length > 0 ? (
          <BreakdownDonutChart data={assetBreakdown.points} />
        ) : (
          <EmptyState
            icon={Wallet}
            title="Nothing tracked yet"
            description="Add savings, a retirement account, a rental property, or anything else you own to see it all in one picture."
            actionLabel="Add what you own"
            actionHref="/finances/investments"
          />
        )}
      </Card>
    </div>
  );
}
