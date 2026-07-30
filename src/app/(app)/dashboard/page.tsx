import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import {
  getAssetBreakdown,
  getClosedDealsSummary,
  getDueRecurringTemplates,
  getNetWorthSeries,
  getPipelineValue,
} from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { RecurringReminders } from "@/app/(app)/finances/recurring-reminders";

export default async function DashboardPage() {
  const session = await auth();
  const team = session?.user?.teamId
    ? await prisma.team.findUnique({ where: { id: session.user.teamId } })
    : null;

  const currentYear = new Date().getFullYear();
  const start = new Date(Date.UTC(currentYear, 0, 1));
  const end = new Date(Date.UTC(currentYear + 1, 0, 1));
  const now = new Date();
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    incomeAgg,
    expenseAgg,
    mileageAgg,
    clientCount,
    documentCount,
    upcomingDeadlines,
    assetBreakdown,
    pipeline,
    closedDeals,
    netWorthSeries,
    dueRecurring,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { userId: session!.user.id, scope: "BUSINESS", type: "INCOME", date: { gte: start, lt: end } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { userId: session!.user.id, scope: "BUSINESS", type: "EXPENSE", date: { gte: start, lt: end } },
    }),
    prisma.mileageLog.aggregate({
      _sum: { deduction: true },
      where: {
        userId: session!.user.id,
        isBusiness: true,
        date: { gte: start, lt: end },
      },
    }),
    prisma.client.count({ where: { userId: session!.user.id } }),
    prisma.document.count({ where: { userId: session!.user.id } }),
    prisma.dealDeadline.findMany({
      where: {
        completedAt: null,
        dueDate: { lte: soon },
        deal: { userId: session!.user.id },
      },
      include: { deal: true },
      orderBy: { dueDate: "asc" },
    }),
    getAssetBreakdown(session!.user.id),
    getPipelineValue(session!.user.id),
    getClosedDealsSummary(session!.user.id, currentYear),
    getNetWorthSeries(session!.user.id),
    getDueRecurringTemplates(session!.user.id),
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const mileageSaved = Number(mileageAgg._sum.deduction ?? 0);
  const netIncome = income - expenses - mileageSaved;
  const currentNetWorth = netWorthSeries.length > 0 ? netWorthSeries[netWorthSeries.length - 1].netWorth : null;

  const financialPicture = [
    { label: "Personal investments", value: assetBreakdown.total },
    { label: "Real estate pipeline", value: pipeline.value },
  ].filter((p) => p.value > 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {team ? `${team.name} · Team account` : "Solo account"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/finances" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label={`Net income (${currentYear})`} value={formatCurrency(netIncome)} />
        </Link>
        <Link href="/finances/mileage" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Mileage saved" value={formatCurrency(mileageSaved)} />
        </Link>
        <Link href="/forms" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Clients" value={clientCount.toString()} />
        </Link>
        <Link href="/forms" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Documents" value={documentCount.toString()} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/deals" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label={`Deals closed (${currentYear})`} value={closedDeals.count.toString()} />
        </Link>
        <Link href="/deals" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard
            label={`Net commission (${currentYear})`}
            value={formatCurrency(closedDeals.netCommission)}
          />
        </Link>
      </div>

      <RecurringReminders items={dueRecurring} />

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Due dates &amp; reminders</h2>
          <a
            href="/api/calendar/deadlines"
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Add to calendar
          </a>
        </div>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-sm text-muted">Nothing due in the next 7 days.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((d) => {
              const isOverdue = d.dueDate < now;
              return (
                <Link
                  key={d.id}
                  href={`/deals/${d.dealId}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
                >
                  <span className="text-sm font-medium text-foreground">
                    {d.label} — {d.deal.propertyAddress}
                  </span>
                  <span
                    className={`text-sm font-medium ${isOverdue ? "text-danger" : "text-muted"}`}
                  >
                    {d.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {isOverdue ? " · Overdue" : ""}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Your financial picture</h2>
          <Link href="/finances/investments" className="text-sm font-medium text-accent hover:opacity-80">
            View Finances
          </Link>
        </div>
        {currentNetWorth !== null ? (
          <div className="mb-6">
            <p className="text-sm text-muted">Net worth</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(currentNetWorth)}
            </p>
          </div>
        ) : null}
        {financialPicture.length > 0 ? (
          <BreakdownDonutChart data={financialPicture} />
        ) : (
          <p className="text-sm text-muted">
            Add an investment or an active deal to see your combined personal + business value
            here.
          </p>
        )}
      </section>
    </div>
  );
}
