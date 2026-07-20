import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import type { TransactionDTO } from "./types";

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

  const [transactions, mileageAgg] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    prisma.mileageLog.aggregate({
      _sum: { deduction: true },
      where: { userId: session!.user.id, isBusiness: true, date: { gte: start, lt: end } },
    }),
  ]);

  const dtos: TransactionDTO[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    scope: t.scope,
    category: t.category,
    amount: Number(t.amount),
    description: t.description,
    date: t.date.toISOString().slice(0, 10),
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Income and expenses — business and personal, in one ledger.
        </p>
        <div className="flex items-center gap-3">
          <a
            href={`/api/reports/pdf?year=${year}`}
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
          >
            Download PDF report
          </a>
          <YearSelect year={year} options={yearOptions} basePath="/finances/transactions" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Business net" value={formatCurrency(businessNet)} />
        <SummaryCard label="Personal net" value={formatCurrency(personalNet)} />
        <SummaryCard label="Mileage deduction" value={formatCurrency(mileageDeduction)} />
        <SummaryCard label="Overall net" value={formatCurrency(overallNet)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a transaction</h2>
        <div className="max-w-md">
          <TransactionForm />
        </div>
      </section>

      <TransactionList transactions={dtos} />
    </div>
  );
}
