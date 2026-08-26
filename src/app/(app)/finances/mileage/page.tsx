import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { formatMileageRate } from "@/lib/mileage-rate";
import { getMileageMonthlySeries } from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { MileageTrendChart } from "@/components/charts/mileage-trend-chart";
import { MileageForm } from "./mileage-form";
import { MileageList } from "./mileage-list";
import type { MileageLogDTO } from "./types";

export default async function FinancesMileagePage({
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

  const [mileageLogs, monthlySeries] = await Promise.all([
    prisma.mileageLog.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    getMileageMonthlySeries(session!.user.id, year),
  ]);

  const dtos: MileageLogDTO[] = mileageLogs.map((log) => ({
    id: log.id,
    date: log.date.toISOString().slice(0, 10),
    miles: Number(log.miles),
    isBusiness: log.isBusiness,
    note: log.note,
    ratePerMile: Number(log.ratePerMile),
    deduction: Number(log.deduction),
  }));

  const businessMiles = dtos.filter((l) => l.isBusiness).reduce((sum, l) => sum + l.miles, 0);
  const mileageDeduction = dtos.filter((l) => l.isBusiness).reduce((sum, l) => sum + l.deduction, 0);
  const hasData = monthlySeries.some((p) => p.miles > 0);

  // Derived from the trips actually shown rather than a single lookup: the
  // IRS rate changed mid-2026, so one year can legitimately span two rates and
  // claiming a single "rate for the year" would be wrong on a tax document.
  const ratesUsed = [...new Set(dtos.filter((l) => l.isBusiness).map((l) => l.ratePerMile))].sort(
    (a, b) => a - b,
  );

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {businessMiles.toLocaleString()} business miles in {year}
          {ratesUsed.length > 0
            ? ` · IRS rate ${ratesUsed.map(formatMileageRate).join(" and ")}`
            : ""}
        </p>
        <YearSelect year={year} options={yearOptions} basePath="/finances/mileage" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard label="Business miles" value={businessMiles.toLocaleString()} />
        <SummaryCard label="Mileage deduction" value={formatCurrency(mileageDeduction)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Log a trip</h2>
        <div className="max-w-md">
          <MileageForm />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Deduction by month</h2>
        {hasData ? (
          <MileageTrendChart data={monthlySeries} />
        ) : (
          <p className="text-sm text-muted">Log a business trip to see your trend here.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Recent trips</h2>
          <Link
            href={`/finances/mileage/history?year=${year}`}
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            View all trips →
          </Link>
        </div>
        <MileageList logs={dtos.slice(0, 5)} />
      </section>
    </div>
  );
}
