import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getNetWorthSeries } from "@/lib/finance-data";
import { Wallet } from "lucide-react";
import { SummaryCard } from "@/components/ui/summary-card";
import { Card } from "@/components/ui/card";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { NetWorthChart } from "@/components/charts/net-worth-chart";
import { AssetForm } from "./asset-form";
import { AssetList } from "./asset-list";
import { GoalsSection, type AssetOption, type FinancialGoalDTO } from "./goals-section";
import type { AssetDTO } from "./types";

export default async function FinancesInvestmentsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [assets, goals, netWorthSeries] = await Promise.all([
    prisma.asset.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.financialGoal.findMany({
      where: { userId },
      include: { linkedAsset: { select: { name: true, currentValue: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getNetWorthSeries(userId),
  ]);

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
    stockTicker: a.stockTicker,
    shareCount: a.shareCount ? Number(a.shareCount) : null,
    stockPricePerShare: a.stockPricePerShare ? Number(a.stockPricePerShare) : null,
    stockPriceCheckedAt: a.stockPriceCheckedAt ? a.stockPriceCheckedAt.toISOString() : null,
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

  const assetOptions: AssetOption[] = dtos.map((a) => ({ id: a.id, name: a.name }));

  const goalDtos: FinancialGoalDTO[] = goals.map((g) => ({
    id: g.id,
    name: g.name,
    targetAmount: Number(g.targetAmount),
    // A linked asset's live currentValue always wins over the stored
    // currentAmount -- see the goals-section.tsx comment on why this can't
    // go stale the way a plain copied number would.
    currentAmount: g.linkedAsset ? Number(g.linkedAsset.currentValue) : Number(g.currentAmount),
    targetDate: g.targetDate ? g.targetDate.toISOString().slice(0, 10) : null,
    linkedAssetId: g.linkedAssetId,
    linkedAssetName: g.linkedAsset?.name ?? null,
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
          <h2 className="mb-6 text-base font-semibold text-foreground">Where your money is</h2>
          <BreakdownDonutChart data={breakdown} />
        </section>
      ) : null}

      {netWorthSeries.length > 1 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">Net worth over time</h2>
          <p className="mb-6 text-sm text-muted">
            What you own, minus what you still owe on your loans. This starts from the first day
            you added something here — it can&apos;t look further back than that.
          </p>
          <NetWorthChart data={netWorthSeries} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add something you own</h2>
        <div className="max-w-md">
          <AssetForm />
        </div>
      </section>

      <Card title="What you own" icon={Wallet}>
        <AssetList assets={dtos} />
      </Card>

      <GoalsSection goals={goalDtos} assets={assetOptions} />
    </div>
  );
}
