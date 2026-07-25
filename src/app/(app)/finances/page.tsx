import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import {
  getAssetBreakdown,
  getBusinessExpenseBreakdown,
  getMonthlyIncomeExpense,
  getPipelineValue,
} from "@/lib/finance-data";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { MonthlyBarChart } from "@/components/charts/monthly-bar-chart";
import { BreakdownDonutChart } from "@/components/charts/breakdown-donut-chart";
import { UnfiledDocuments } from "@/app/(app)/forms/unfiled-documents";
import type { ClientOption, DocumentDTO } from "@/app/(app)/forms/types";

export default async function FinancesOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;

  const [businessSeries, personalSeries, expenseBreakdown, assetBreakdown, pipeline, taxDocuments, clients] =
    await Promise.all([
      getMonthlyIncomeExpense(userId, year, "BUSINESS"),
      getMonthlyIncomeExpense(userId, year, "PERSONAL"),
      getBusinessExpenseBreakdown(userId, year),
      getAssetBreakdown(userId),
      getPipelineValue(userId),
      prisma.document.findMany({
        where: { userId, clientId: null },
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const businessNet = businessSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const personalNet = personalSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const hasPersonalData = personalSeries.some((m) => m.income > 0 || m.expenses > 0);
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const taxDocumentDtos: DocumentDTO[] = taxDocuments.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    mimeType: d.mimeType,
    size: d.size,
    clientId: d.clientId,
    dealId: d.dealId,
    createdAt: d.createdAt.toISOString(),
  }));
  const clientOptions: ClientOption[] = clients.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end">
        <YearSelect year={year} options={yearOptions} basePath="/finances" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label={`Business net (${year})`} value={formatCurrency(businessNet)} />
        <SummaryCard label={`Personal net (${year})`} value={formatCurrency(personalNet)} />
        <SummaryCard label="Active pipeline value" value={formatCurrency(pipeline.value)} />
        <SummaryCard label="Total invested" value={formatCurrency(assetBreakdown.total)} />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Business income &amp; expenses
        </h2>
        <MonthlyBarChart data={businessSeries} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Business expenses by category
        </h2>
        {expenseBreakdown.length > 0 ? (
          <BreakdownDonutChart data={expenseBreakdown} />
        ) : (
          <p className="text-sm text-muted">
            No business expenses logged for {year} yet — add one on the{" "}
            <Link href="/finances/transactions" className="font-medium text-accent hover:opacity-80">
              Transactions
            </Link>{" "}
            tab.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">
          Personal income &amp; expenses
        </h2>
        {hasPersonalData ? (
          <MonthlyBarChart data={personalSeries} />
        ) : (
          <p className="text-sm text-muted">
            No personal transactions logged for {year} yet — add one on the{" "}
            <Link href="/finances/transactions" className="font-medium text-accent hover:opacity-80">
              Transactions
            </Link>{" "}
            tab.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-foreground">Investments</h2>
          <Link
            href="/finances/investments"
            className="text-sm font-medium text-accent hover:opacity-80"
          >
            Manage investments
          </Link>
        </div>
        {assetBreakdown.points.length > 0 ? (
          <BreakdownDonutChart data={assetBreakdown.points} />
        ) : (
          <p className="text-sm text-muted">
            No assets added yet — track a brokerage account, retirement fund, or property on the
            Investments tab.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-1 text-base font-semibold text-foreground">Tax documents</h2>
        <p className="mb-6 text-sm text-muted">
          Receipts, statements, or anything else you want on hand for taxes — not tied to a
          specific client. The same list also shows as &quot;Unfiled documents&quot; on the{" "}
          <Link href="/forms" className="font-medium text-accent hover:opacity-80">
            Clients
          </Link>{" "}
          tab, under Forms.
        </p>
        <UnfiledDocuments documents={taxDocumentDtos} clients={clientOptions} />
      </section>
    </div>
  );
}
