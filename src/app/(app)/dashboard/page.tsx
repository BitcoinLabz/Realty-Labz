import Link from "next/link";
import { redirect } from "next/navigation";
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
  getAttentionItems,
  getUpcomingDeadlines,
} from "@/lib/finance-data";
import { CalendarClock, PiggyBank, TrendingUp } from "lucide-react";
import { Greeting } from "@/components/greeting";
import { Card } from "@/components/ui/card";
import { StatGrid } from "@/components/ui/stat-grid";
import { Sparkline } from "@/components/charts/sparkline";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { throughCurrentMonth } from "@/lib/months-to-date";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { RecurringReminders } from "@/app/(app)/finances/recurring-reminders";
import { AttentionList } from "./attention-list";
import { SetupChecklist, type SetupStep } from "./setup-checklist";

export default async function DashboardPage() {
  const session = await auth();
  const planState = await prisma.user.findUnique({
    where: { id: session!.user.id },
    select: { planChosen: true },
  });
  if (planState && !planState.planChosen) redirect("/choose-plan");
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
    upcomingDeadlines,
    assetBreakdown,
    pipeline,
    closedDeals,
    netWorthSeries,
    dueRecurring,
    monthlySeries,
    attentionItems,
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
    getUpcomingDeadlines(session!.user.id),
    getAssetBreakdown(session!.user.id),
    getPipelineValue(session!.user.id),
    getClosedDealsSummary(session!.user.id, currentYear),
    getNetWorthSeries(session!.user.id),
    getDueRecurringTemplates(session!.user.id),
    getMonthlyIncomeExpense(session!.user.id, currentYear, "ALL"),
    getAttentionItems(session!.user.id),
    // Only needed for the setup checklist -- cheap counts, and they let the
    // whole thing be computed rather than stored on the User row.
    prisma.deal.count({ where: { userId: session!.user.id } }),
    prisma.transaction.count({ where: { userId: session!.user.id } }),
    prisma.user.findUnique({
      where: { id: session!.user.id },
      select: { estimatedIncomeTaxRatePercent: true, homeOffice: { select: { id: true } } },
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

  const yearSeries = throughCurrentMonth(monthlySeries, currentYear);
  const hasMonthlyData = yearSeries.some((p) => p.income > 0 || p.expenses > 0);
  const monthlyNets = yearSeries.map((p) => p.income - p.expenses);
  const monthIndex = monthlyNets.length - 1;
  const monthDelta = monthIndex > 0 ? monthlyNets[monthIndex] - monthlyNets[monthIndex - 1] : null;
  const comparedWith =
    monthIndex > 0
      ? new Date(currentYear, monthIndex - 1, 1).toLocaleDateString("en-US", { month: "short" })
      : null;

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
      description: "So we can estimate what you should set aside each quarter, including Michigan and city tax.",
      actionLabel: "Set it",
      href: "/finances/taxes",
      done: taxSettings?.estimatedIncomeTaxRatePercent != null,
    },
    {
      id: "home-office",
      title: "Set up your home office",
      description: "Work from home? Measure the room and we'll work out the deduction, the simple way or the detailed way.",
      actionLabel: "Set it up",
      href: "/home-office",
      done: !!taxSettings?.homeOffice,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Greeting
        name={session?.user?.name?.split(" ")[0] || "there"}
        detail={team ? team.name : "Solo account"}
      />

      <SetupChecklist steps={setupSteps} />

      <div className="grid items-start gap-5 lg:grid-cols-12">
        <div className="order-2 flex min-w-0 flex-col gap-5 lg:order-1 lg:col-span-7">
          <section className="rounded-2xl border border-border bg-background px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs text-muted">Net income · {currentYear}</p>
                <p
                  className={`mt-1 text-3xl font-semibold tabular-nums tracking-tight ${
                    netIncome < 0 ? "text-danger" : "text-foreground"
                  }`}
                >
                  {formatCurrency(netIncome)}
                </p>
                <p className="mt-1 text-xs text-muted">After expenses and mileage.</p>
                {monthDelta != null && monthDelta !== 0 && comparedWith ? (
                  <p className="mt-2 inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs tabular-nums text-muted">
                    {monthDelta < 0 ? "▼" : "▲"} {formatCurrency(Math.abs(monthDelta))} vs {comparedWith}
                  </p>
                ) : null}
              </div>
              <Link href="/finances" className="w-28 shrink-0 pt-1 sm:w-40" aria-label="Open income and expenses">
                <Sparkline values={monthlyNets} />
              </Link>
            </div>
          </section>

          <StatGrid
            items={[
              {
                label: "Mileage saved",
                value: formatCurrency(mileageSaved),
                href: "/mileage",
                note: mileageSaved === 0 ? "Log a drive to start" : "This year's deduction",
              },
              {
                label: "Clients",
                value: clientCount.toString(),
                href: "/clients",
                note: clientCount === 0 ? "Add someone you're working with" : "People you work with",
              },
              {
                label: "In progress",
                value: formatCurrency(pipeline.value),
                href: "/transactions",
                note: pipeline.value === 0 ? "No open transactions" : "Still open",
              },
              {
                label: `Kept in ${currentYear}`,
                value: formatCurrency(closedDeals.netCommission),
                href: "/transactions",
                hint: "Commission after the brokerage split, referral fees, and other deductions.",
                note: closedDeals.netCommission === 0 ? "After your first closing" : `${closedDeals.count} closed`,
              },
            ]}
          />
        </div>

        <div className="order-1 flex min-w-0 flex-col gap-5 lg:order-2 lg:col-span-5">
          <AttentionList items={attentionItems} />
          <RecurringReminders items={dueRecurring} />
          {upcomingDeadlines.length > 0 ? (
            <Card
              title="Coming up"
              icon={CalendarClock}
              description="The next 7 days."
              action={
                <a href="/api/calendar/deadlines" className="text-sm font-medium text-accent hover:opacity-80">
                  Add to calendar
                </a>
              }
            >
              <div className="divide-y divide-border">
                {upcomingDeadlines.map((d) => (
                  <Link
                    key={d.id}
                    href={`/transactions/${d.dealId}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0 text-sm font-medium text-foreground">
                      {d.label}
                      <span className="mt-0.5 block truncate text-xs font-normal text-muted">{d.propertyAddress}</span>
                    </span>
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${d.isOverdue ? "text-danger" : "text-muted"}`}
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
            </Card>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {hasMonthlyData ? (
          <Card title="Money in & out" icon={TrendingUp}>
            <MonthlyBarChart data={yearSeries} />
          </Card>
        ) : null}
        {currentNetWorth !== null || financialPicture.length > 0 ? (
          <Card
            title="What you're worth"
            icon={PiggyBank}
            description="Everything you own, minus what you owe."
            action={
              <Link href="/finances/investments" className="text-sm font-medium text-accent hover:opacity-80">
                Manage
              </Link>
            }
          >
            {currentNetWorth !== null ? (
              <p
                className={`mb-3 text-2xl font-semibold tabular-nums tracking-tight ${
                  currentNetWorth < 0 ? "text-danger" : "text-foreground"
                }`}
              >
                {formatCurrency(currentNetWorth)}
              </p>
            ) : null}
            {netWorthSeries.length >= 2 ? (
              <NetWorthChart data={netWorthSeries} />
            ) : (
              <BreakdownDonutChart data={financialPicture} />
            )}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
