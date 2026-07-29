import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { TransactionHistory } from "./transaction-history";
import type { DealOption, TransactionDTO } from "../types";

export default async function TransactionHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const { year: yearParam } = await searchParams;

  const [transactions, deals] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId: session!.user.id },
      orderBy: { date: "desc" },
    }),
    prisma.deal.findMany({
      where: { userId: session!.user.id },
      select: { id: true, propertyAddress: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const dealOptions: DealOption[] = deals;

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

  const years = Array.from(new Set(dtos.map((t) => t.date.slice(0, 4)))).sort((a, b) =>
    b.localeCompare(a),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/finances/transactions"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Transactions
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          All transactions
        </h1>
        <p className="mt-1 text-sm text-muted">
          Every business and personal transaction you&apos;ve ever logged, searchable and
          filterable.
        </p>
      </div>

      <TransactionHistory
        transactions={dtos}
        deals={dealOptions}
        years={years}
        initialYear={yearParam ?? ""}
      />
    </div>
  );
}
