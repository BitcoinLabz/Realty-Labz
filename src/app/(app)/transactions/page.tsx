import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getMileageRate } from "@/lib/mileage-rate";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import type { TransactionDTO } from "./types";
import { MileageForm } from "../mileage/mileage-form";
import { MileageList } from "../mileage/mileage-list";
import type { MileageLogDTO } from "../mileage/types";

export default async function TransactionsPage({
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

  const [transactions, mileageLogs, rate] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    prisma.mileageLog.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    getMileageRate(start),
  ]);

  const transactionDtos: TransactionDTO[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    description: t.description,
    date: t.date.toISOString().slice(0, 10),
  }));

  const mileageDtos: MileageLogDTO[] = mileageLogs.map((log) => ({
    id: log.id,
    date: log.date.toISOString().slice(0, 10),
    miles: Number(log.miles),
    isBusiness: log.isBusiness,
    note: log.note,
    ratePerMile: Number(log.ratePerMile),
    deduction: Number(log.deduction),
  }));

  const income = transactionDtos
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const expenses = transactionDtos
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
  const businessMiles = mileageDtos
    .filter((l) => l.isBusiness)
    .reduce((sum, l) => sum + l.miles, 0);
  const mileageDeduction = mileageDtos
    .filter((l) => l.isBusiness)
    .reduce((sum, l) => sum + l.deduction, 0);
  const net = income - expenses - mileageDeduction;

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Finances</h1>
          <p className="mt-1 text-sm text-muted">
            Income, expenses, and mileage — everything for tax time in one place.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/reports/pdf?year=${year}`}
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-border/40"
          >
            Download PDF report
          </a>
          <YearSelect year={year} options={yearOptions} basePath="/transactions" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Income" value={formatCurrency(income)} />
        <SummaryCard label="Expenses" value={formatCurrency(expenses)} />
        <SummaryCard label="Mileage deduction" value={formatCurrency(mileageDeduction)} />
        <SummaryCard label="Net" value={formatCurrency(net)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a transaction</h2>
        <div className="max-w-md">
          <TransactionForm />
        </div>
      </section>

      <TransactionList transactions={transactionDtos} />

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Log a trip</h2>
          <span className="text-sm text-muted">
            {businessMiles.toLocaleString()} business miles · ${rate.toFixed(3)}/mi ({year})
          </span>
        </div>
        <div className="max-w-md">
          <MileageForm />
        </div>
      </section>

      <MileageList logs={mileageDtos} />
    </div>
  );
}
