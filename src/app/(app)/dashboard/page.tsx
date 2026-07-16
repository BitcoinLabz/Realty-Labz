import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { SummaryCard } from "@/components/ui/summary-card";

export default async function DashboardPage() {
  const session = await auth();
  const team = session?.user?.teamId
    ? await prisma.team.findUnique({ where: { id: session.user.teamId } })
    : null;

  const currentYear = new Date().getFullYear();
  const start = new Date(Date.UTC(currentYear, 0, 1));
  const end = new Date(Date.UTC(currentYear + 1, 0, 1));

  const [incomeAgg, expenseAgg, mileageAgg, clientCount] = await Promise.all([
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { userId: session!.user.id, type: "INCOME", date: { gte: start, lt: end } },
    }),
    prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { userId: session!.user.id, type: "EXPENSE", date: { gte: start, lt: end } },
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
  ]);

  const income = Number(incomeAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const netIncome = income - expenses;
  const mileageSaved = Number(mileageAgg._sum.deduction ?? 0);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/transactions" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label={`Net income (${currentYear})`} value={formatCurrency(netIncome)} />
        </Link>
        <Link href="/mileage" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Mileage saved" value={formatCurrency(mileageSaved)} />
        </Link>
        <Link href="/clients" className="block transition-transform hover:-translate-y-0.5">
          <SummaryCard label="Clients" value={clientCount.toString()} />
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-background p-8 text-center">
        <p className="text-sm text-muted">
          Document storage will show up here as it&apos;s built.
        </p>
      </div>
    </div>
  );
}
