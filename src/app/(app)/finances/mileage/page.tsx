import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { getMileageRate } from "@/lib/mileage-rate";
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

  const [mileageLogs, rate, monthlySeries] = await Promise.all([
    prisma.mileageLog.findMany({
      where: { userId: session!.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "desc" },
    }),
    getMileageRate(start),
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

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {businessMiles.toLocaleString()} business miles · ${rate.toFixed(3)}/mi ({year})
        </p>
        <YearSelect year={year} options={yearOptions} basePath="/finances/mileage" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard label="Business miles" value={businessMiles.toLocaleString()} />
        <SummaryCard label="Mileage deduction" value={formatCurrency(mileageDeduction)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Deduction by month</h2>
        {hasData ? (
          <MileageTrendChart data={monthlySeries} />
        ) : (
          <p className="text-sm text-muted">Log a business trip to see your trend here.</p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Log a trip</h2>
        <div className="max-w-md">
          <MileageForm />
        </div>
      </section>

      <MileageList logs={dtos} />
    </div>
  );
}
