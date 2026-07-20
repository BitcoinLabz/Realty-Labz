import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { SummaryCard } from "@/components/ui/summary-card";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { AssetForm } from "./asset-form";
import { AssetList } from "./asset-list";
import type { AssetDTO } from "./types";

export default async function FinancesInvestmentsPage() {
  const session = await auth();

  const assets = await prisma.asset.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });

  const dtos: AssetDTO[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    currentValue: Number(a.currentValue),
    notes: a.notes,
    walletNetwork: a.walletNetwork,
    walletAddress: a.walletAddress,
    walletBalance: a.walletBalance ? Number(a.walletBalance) : null,
    walletBalanceCheckedAt: a.walletBalanceCheckedAt ? a.walletBalanceCheckedAt.toISOString() : null,
    updatedAt: a.updatedAt.toISOString(),
  }));

  const total = dtos.reduce((sum, a) => sum + a.currentValue, 0);
  const breakdown = Object.entries(
    dtos.reduce<Record<string, number>>((acc, a) => {
      acc[a.type] = (acc[a.type] ?? 0) + a.currentValue;
      return acc;
    }, {}),
  ).map(([type, value]) => ({
    label:
      { STOCKS: "Stocks", RETIREMENT: "Retirement", REAL_ESTATE: "Real estate", CRYPTO: "Crypto", SAVINGS: "Savings", OTHER: "Other" }[
        type
      ] ?? type,
    value,
  }));

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted">
        Personal investments and assets — enter a value by hand, or link a Bitcoin/Stacks wallet
        to track its balance automatically.
      </p>

      <SummaryCard label="Total value" value={formatCurrency(total)} />

      {breakdown.length > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-6 text-base font-semibold text-foreground">Allocation</h2>
          <BreakdownDonutChart data={breakdown} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add an asset</h2>
        <div className="max-w-md">
          <AssetForm />
        </div>
      </section>

      <AssetList assets={dtos} />
    </div>
  );
}
