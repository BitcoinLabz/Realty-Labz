import Link from "next/link";
import { auth } from "@/auth";
import { formatCurrency } from "@/lib/format";
import {
  getAssetBreakdown,
  getBusinessExpenseBreakdown,
  getMonthlyIncomeExpense,
  getPipelineValue,
} from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";

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

  const [businessSeries, personalSeries, expenseBreakdown, assetBreakdown, pipeline] =
    await Promise.all([
      getMonthlyIncomeExpense(userId, year, "BUSINESS"),
      getMonthlyIncomeExpense(userId, year, "PERSONAL"),
      getBusinessExpenseBreakdown(userId, year),
      getAssetBreakdown(userId),
      getPipelineValue(userId),
    ]);

  const businessNet = businessSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const personalNet = personalSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const hasPersonalData = personalSeries.some((m) => m.income > 0 || m.expenses > 0);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end">
        <YearSelect year={year} options={yearOptions} basePath="/finances" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={`Business net (${year})`} value={formatCurrency(businessNet)} />
        <SummaryCard label={`Personal net (${year})`} value={formatCurrency(personalNet)} />
        <SummaryCard label="Active pipeline value" value={formatCurrency(pipeline.value)} />
        <SummaryCard label="Total invested" value={formatCurrency(assetBreakdown.total)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Business income &amp; expenses
        </h2>
        <MonthlyBarChart data={businessSeries} />
      </section>

      {expenseBreakdown.length > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-6 text-base font-semibold text-foreground">
            Business expenses by category
          </h2>
          <BreakdownDonutChart data={expenseBreakdown} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Personal income &amp; expenses
        </h2>
        {hasPersonalData ? (
          <MonthlyBarChart data={personalSeries} />
        ) : (
          <p className="text-sm text-muted">
            No personal transactions logged for {year} yet — add one on the{" "}
            <Link href="/finances/transactions" className="font-medium text-accent hover:opacity-80">
              Transactions
            </Link>{" "}
            tab.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Investments</h2>
          <Link
            href="/finances/investments"
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Manage investments
          </Link>
        </div>
        {assetBreakdown.points.length > 0 ? (
          <BreakdownDonutChart data={assetBreakdown.points} />
        ) : (
          <p className="text-sm text-muted">
            No assets added yet — track a brokerage account, retirement fund, or property on the
            Investments tab.
          </p>
        )}
      </section>
    </div>
  );
}
