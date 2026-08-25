import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import {
  getAssetBreakdown,
  getClosedDealsSummary,
  getDueRecurringTemplates,
  getMonthlyIncomeExpense,
  getNetWorthSeries,
  getPipelineValue,
  getUpcomingDeadlines,
} from "@/lib/finance-data";
import { CalendarClock, PiggyBank, TrendingUp } from "lucide-react";
import { SummaryCard } from "@/components/ui/summary-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { RecurringReminders } from "@/app/(app)/finances/recurring-reminders";
import { SetupChecklist, type SetupStep } from "./setup-checklist";

export default async function DashboardPage() {
  const session = await auth();
  const team = session?.user?.teamId
    ? await prisma.team.findUnique({ where: { id: session.user.teamId } })
    : null;

  const currentYear = new Date().getFullYear();
  const start = new Date(Date.UTC(currentYear, 0, 1));
  const end = new Date(Date.UTC(currentYear + 1, 0, 1));

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
    monthlySeries,
    dealCount,
    ledgerCount,
    taxSettings,
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
    getUpcomingDeadlines(session!.user.id),
    getAssetBreakdown(session!.user.id),
    getPipelineValue(session!.user.id),
    getClosedDealsSummary(session!.user.id, currentYear),
    getNetWorthSeries(session!.user.id),
    getDueRecurringTemplates(session!.user.id),
    getMonthlyIncomeExpense(session!.user.id, currentYear, "ALL"),
    // Only needed for the setup checklist -- cheap counts, and they let the
    // whole thing be computed rather than stored on the User row.
    prisma.deal.count({ where: { userId: session!.user.id } }),
    prisma.transaction.count({ where: { userId: session!.user.id } }),
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { estimatedIncomeTaxRatePercent: true },
    }),
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

  const hasMonthlyData = monthlySeries.some((p) => p.income > 0 || p.expenses > 0);

  const setupSteps: SetupStep[] = [
    {
      id: "client",
      title: "Add your first client",
      description: "Everything else hangs off a client — buyers, sellers, renters.",
      actionLabel: "Add a client",
      href: "/clients",
      done: clientCount > 0,
    },
    {
      id: "transaction",
      title: "Start your first transaction",
      description: "A property you're working on. You don't need an address yet.",
      actionLabel: "Start one",
      href: "/transactions/new",
      done: dealCount > 0,
    },
    {
      id: "money",
      title: "Log some income or an expense",
      description: "This is what becomes your tax report at the end of the year.",
      actionLabel: "Log it",
      href: "/finances/income",
      done: ledgerCount > 0,
    },
    {
      id: "tax",
      title: "Set your tax rate",
      description: "So we can estimate what you should set aside each quarter.",
      actionLabel: "Set it",
      href: "/finances/taxes",
      done: taxSettings?.estimatedIncomeTaxRatePercent != null,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome back, ${session?.user?.name?.split(" ")[0] ?? ""}`}
        description={team ? `${team.name} · Team account` : "Solo account"}
      />

      <SetupChecklist steps={setupSteps} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/finances" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label={`Net income (${currentYear})`} value={formatCurrency(netIncome)} />
        </Link>
        <Link href="/finances/mileage" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Mileage saved" value={formatCurrency(mileageSaved)} />
        </Link>
        <Link href="/clients" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Clients" value={clientCount.toString()} />
        </Link>
        <Link href="/clients" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Documents" value={documentCount.toString()} />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/transactions" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard
            label={`Closed (${currentYear})`}
            value={closedDeals.count.toString()}
            hint="Transactions you've marked as Closed with a closing date this year."
          />
        </Link>
        <Link href="/transactions" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard
            label={`What you kept (${currentYear})`}
            value={formatCurrency(closedDeals.netCommission)}
            hint="Your commission after the brokerage's cut and any referral fees, team splits, or other deductions come out."
          />
        </Link>
      </div>

      <RecurringReminders items={dueRecurring} />

      <Card
        title="Coming up"
        icon={CalendarClock}
        description="Deadlines on your transactions in the next 7 days."
        action={
          upcomingDeadlines.length > 0 ? (
            <a
              href="/api/calendar/deadlines"
              className="text-sm font-medium text-accent hover:opacity-80"
            >
              Add to calendar
            </a>
          ) : null
        }
      >
        {upcomingDeadlines.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing due in the next 7 days"
            description="Deadlines you add to a transaction — inspection, financing, closing — show up here so nothing sneaks up on you."
            actionLabel="Go to your transactions"
            actionHref="/transactions"
          />
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingDeadlines.map((d) => (
              <Link
                key={d.id}
                href={`/transactions/${d.dealId}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3 hover:border-accent"
              >
                <span className="text-sm font-medium text-foreground">
                  {d.label} — {d.propertyAddress}
                </span>
                <span
                  className={`text-sm font-medium ${d.isOverdue ? "text-danger" : "text-muted"}`}
                >
                  {new Date(d.dueDate + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {d.isOverdue ? " · Overdue" : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {hasMonthlyData ? (
        <Card title="Money in & out this year" icon={TrendingUp}>
          <MonthlyBarChart data={monthlySeries} />
        </Card>
      ) : null}

      <Card
        title="What you're worth"
        icon={PiggyBank}
        description="Everything you own, minus what you owe."
        action={
          <Link
            href="/finances/investments"
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Manage
          </Link>
        }
      >
        {currentNetWorth !== null ? (
          <div className="mb-6">
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {formatCurrency(currentNetWorth)}
            </p>
          </div>
        ) : null}
        {netWorthSeries.length >= 2 ? (
          <NetWorthChart data={netWorthSeries} />
        ) : financialPicture.length > 0 ? (
          <BreakdownDonutChart data={financialPicture} />
        ) : (
          <EmptyState
            icon={PiggyBank}
            title="Nothing to show yet"
            description="Add savings, a retirement account, or a property you own and this becomes a picture of your whole financial life — personal and business together."
            actionLabel="Add what you own"
            actionHref="/finances/investments"
          />
        )}
      </Card>
    </div>
  );
}
