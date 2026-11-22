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
import { Card } from "@/components/ui/card";
import { StatGrid } from "@/components/ui/stat-grid";
import { Sparkline } from "@/components/charts/sparkline";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
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
    documentCount,
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
    prisma.document.count({ where: { userId: session!.user.id } }),
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

  const hasMonthlyData = monthlySeries.some((p) => p.income > 0 || p.expenses > 0);
  const monthlyNets = monthlySeries.map((p) => p.income - p.expenses);
  const monthIndex = new Date().getFullYear() === currentYear ? new Date().getMonth() : monthlyNets.length - 1;
  const monthDelta =
    monthIndex > 0 ? monthlyNets[monthIndex] - monthlyNets[monthIndex - 1] : null;

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
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {session?.user?.name?.split(" ")[0] ?? "Welcome back"}
        </h1>
        <p className="text-xs text-muted">{team ? team.name : "Solo account"}</p>
      </div>

      <SetupChecklist steps={setupSteps} />

      <AttentionList items={attentionItems} />
      <RecurringReminders items={dueRecurring} />

      <section className="rounded-2xl border border-border bg-background px-4 py-4">
        <div className="flex items-start justify-between gap-3">
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
            {monthDelta != null && monthDelta !== 0 ? (
              <p className={`mt-1 text-xs tabular-nums ${monthDelta < 0 ? "text-danger" : "text-success"}`}>
                {monthDelta > 0 ? "+" : ""}
                {formatCurrency(monthDelta)} this month vs last
              </p>
            ) : null}
          </div>
          <Link href="/finances" className="pt-1" aria-label="Open income and expenses">
            <Sparkline values={monthlyNets} negative={netIncome < 0} />
          </Link>
        </div>
      </section>

      <StatGrid
        items={[
          { label: "Mileage saved", value: formatCurrency(mileageSaved), href: "/mileage" },
          { label: "Clients", value: clientCount.toString(), href: "/clients" },
          { label: "Documents", value: documentCount.toString(), href: "/clients" },
          {
            label: `Closed (${currentYear})`,
            value: closedDeals.count.toString(),
            href: "/transactions",
            hint: "Transactions marked Closed with a closing date this year.",
          },
          {
            label: `What you kept (${currentYear})`,
            value: formatCurrency(closedDeals.netCommission),
            href: "/transactions",
            hint: "Commission after the brokerage split, referral fees, team splits, and other deductions.",
          },
        ]}
      />

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
      </Card>
      ) : null}

      {hasMonthlyData ? (
        <Card title="Money in & out this year" icon={TrendingUp} tone="success">
          <MonthlyBarChart data={monthlySeries} />
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
  );
}
