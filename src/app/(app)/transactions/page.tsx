import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { YearSelect } from "./year-select";
import type { TransactionDTO } from "./types";

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

  const transactions = await prisma.transaction.findMany({
    where: { userId: session!.user.id, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
  });

  const dtos: TransactionDTO[] = transactions.map((t) => ({
    id: t.id,
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    description: t.description,
    date: t.date.toISOString().slice(0, 10),
  }));

  const income = dtos.filter((t) => t.type === "INCOME").reduce((sum, t) => sum + t.amount, 0);
  const expenses = dtos.filter((t) => t.type === "EXPENSE").reduce((sum, t) => sum + t.amount, 0);
  const net = income - expenses;

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Income &amp; expenses
          </h1>
          <p className="mt-1 text-sm text-muted">Track what you earn and spend for tax time.</p>
        </div>
        <YearSelect year={year} options={yearOptions} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Income" value={formatCurrency(income)} />
        <SummaryCard label="Expenses" value={formatCurrency(expenses)} />
        <SummaryCard label="Net" value={formatCurrency(net)} />
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}
