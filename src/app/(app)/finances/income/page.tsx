import Link from "next/link";
import { FileDown, Upload } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getMonthlyIncomeExpense } from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { dealDisplayName } from "@/app/(app)/transactions/types";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { RecurringTemplates, type RecurringTemplateDTO } from "./recurring-templates";
import type { DealOption, TransactionDTO } from "./types";

export default async function FinancesTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [transactions, mileageAgg, deals, recurringTemplates, monthlySeries] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    prisma.mileageLog.aggregate({
      _sum: { deduction: true },
      where: { userId: session!.user.id, isBusiness: true, date: { gte: start, lt: end } },
    }),
    prisma.deal.findMany({
      where: { userId: session!.user.id },
      select: { id: true, propertyAddress: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recurringTransactionTemplate.findMany({
      where: { userId: session!.user.id },
      orderBy: { nextDueDate: "asc" },
    }),
    getMonthlyIncomeExpense(session!.user.id, year, "ALL"),
  ]);

  const dealOptions: DealOption[] = deals.map((d) => ({
    id: d.id,
    propertyAddress: dealDisplayName(d.propertyAddress),
  }));

  const recurringDtos: RecurringTemplateDTO[] = recurringTemplates.map((t) => ({
    id: t.id,
    description: t.description,
    category: t.category,
    amount: Number(t.amount),
    scope: t.scope,
    type: t.type,
    frequency: t.frequency,
    nextDueDate: t.nextDueDate.toISOString().slice(0, 10),
    businessUsePercent: t.businessUsePercent ? Number(t.businessUsePercent) : null,
    updatedAt: t.updatedAt.toISOString(),
  }));

  const dtos: TransactionDTO[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    scope: t.scope,
    category: t.category,
    amount: Number(t.amount),
    description: t.description,
    date: t.date.toISOString().slice(0, 10),
    dealId: t.dealId,
  }));

  const businessIncome = dtos
    .filter((t) => t.scope === "BUSINESS" && t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const businessExpenses = dtos
    .filter((t) => t.scope === "BUSINESS" && t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
  const personalIncome = dtos
    .filter((t) => t.scope === "PERSONAL" && t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const personalExpenses = dtos
    .filter((t) => t.scope === "PERSONAL" && t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
  const mileageDeduction = Number(mileageAgg._sum.deduction ?? 0);

  const businessNet = businessIncome - businessExpenses - mileageDeduction;
  const personalNet = personalIncome - personalExpenses;
  const overallNet = businessNet + personalNet;

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];
  const hasMonthlyData = monthlySeries.some((p) => p.income > 0 || p.expenses > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Everything you earn and spend — business and personal, kept separate.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/finances/import"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
          >
            <Upload size={15} />
            Import from bank
          </Link>
          <a
            href={`/api/reports/pdf?year=${year}`}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
          >
            <FileDown size={15} />
            Report for my accountant
          </a>
          <YearSelect year={year} options={yearOptions} basePath="/finances/income" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Business net"
          value={formatCurrency(businessNet)}
          hint="What your business earned, minus business expenses and your mileage deduction."
        />
        <SummaryCard label="Personal net" value={formatCurrency(personalNet)} />
        <SummaryCard
          label="Mileage deduction"
          value={formatCurrency(mileageDeduction)}
          hint="What your logged business driving is worth as a tax deduction this year."
        />
        <SummaryCard label="Overall net" value={formatCurrency(overallNet)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Money in &amp; out by month</h2>
        {hasMonthlyData ? (
          <MonthlyBarChart data={monthlySeries} />
        ) : (
          <p className="text-sm text-muted">
            Log your first income or expense below and your month-by-month trend appears here.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Log income or an expense</h2>
        <p className="mb-6 text-sm text-muted">
          A one-time entry by default. If it&apos;s something that repeats every month, tick
          &quot;Make this a recurring cost&quot; and it&apos;ll log itself from now on.
        </p>
        <div className="max-w-md">
          <TransactionForm deals={dealOptions} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Latest entries</h2>
          <Link
            href={`/finances/income/history?year=${year}`}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            See everything →
          </Link>
        </div>
        <TransactionList transactions={dtos.slice(0, 5)} deals={dealOptions} />
      </section>

      <RecurringTemplates templates={recurringDtos} />
    </div>
  );
}
