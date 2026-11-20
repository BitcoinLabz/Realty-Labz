import Link from "next/link";
import { ChevronRight, FolderOpen, House, Scale } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getBudgetUsage,
  getBusinessExpenseBreakdown,
  getBusinessNetByYear,
  getMonthlyIncomeExpense,
} from "@/lib/finance-data";
import { estimateTaxes, hobbyLossCheck } from "@/lib/estimated-tax";
import { loadTaxRules } from "@/lib/tax-rules-db";
import { Card } from "@/components/ui/card";
import { YearSelect } from "@/components/ui/year-select";
import { UnfiledDocuments } from "@/app/(app)/clients/unfiled-documents";
import { TaxEstimateCard } from "../tax-estimate-card";
import { BudgetsSection } from "../budgets-section";
import type { ClientOption, DocumentDTO } from "@/app/(app)/clients/types";

// Everything here used to live on the Overview tab, which meant scrolling
// past four settings forms to reach a chart. These are things you set up
// once (or revisit at tax time), not things you glance at.
export default async function TaxesAndBudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;
  const currentMonth = new Date().getMonth();

  const [businessSeries, expenseBreakdown, user, budgets, taxDocuments, clients, taxRules, netByYear] =
    await Promise.all([
      getMonthlyIncomeExpense(userId, year, "BUSINESS"),
      getBusinessExpenseBreakdown(userId, year),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          estimatedIncomeTaxRatePercent: true,
          residenceCity: true,
          workCity: true,
        },
      }),
      getBudgetUsage(userId, year, currentMonth),
      prisma.document.findMany({
        where: { userId, clientId: null, homeOfficeExpense: { is: null } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.client.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      loadTaxRules(),
      getBusinessNetByYear(userId, year - 4, year),
    ]);

  const businessNet = businessSeries.reduce((sum, m) => sum + m.income - m.expenses, 0);
  const homeOfficeDeduction = expenseBreakdown.find((p) => p.label === "Home office")?.value ?? 0;
  const mileageDeduction = expenseBreakdown.find((p) => p.label === "Mileage")?.value ?? 0;
  const netBusinessIncome = businessNet - homeOfficeDeduction - mileageDeduction;
  const federalRate =
    user?.estimatedIncomeTaxRatePercent != null ? Number(user.estimatedIncomeTaxRatePercent) : null;
  const taxSummary = estimateTaxes({
    netBusinessIncome,
    year,
    federalRatePercent: federalRate,
    residenceCity: user?.residenceCity,
    workCity: user?.workCity,
    rules: taxRules,
  });
  const hobby = hobbyLossCheck({ netByYear, currentYear: year, rules: taxRules });

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

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-end">
        <YearSelect year={year} options={yearOptions} basePath="/finances/taxes" />
      </div>

      {/* The home office has its own section now; this row says what it
          contributes and goes there. */}
      <Link
        href={`/home-office?year=${year}`}
        className="flex items-center gap-4 rounded-2xl border border-border bg-background p-6 transition-colors hover:bg-surface"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <House size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">Home office deduction</span>
          <span className="block text-sm text-muted">
            {homeOfficeDeduction > 0
              ? `${formatCurrency(homeOfficeDeduction)} in ${year} — already counted in the estimate below`
              : "Set up your home office to see what you can deduct"}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>

      <TaxEstimateCard
        estimatedIncomeTaxRatePercent={federalRate}
        residenceCity={user?.residenceCity ?? null}
        workCity={user?.workCity ?? null}
        summary={taxSummary}
      />

      {/* Only speaks up when there's something to know -- a quiet page in a
          profitable year is the right answer. */}
      {hobby.status !== "ok" ? (
        <Card
          title="Profit history"
          icon={Scale}
          tone="warning"
          description={
            hobby.status === "atRisk"
              ? `Your business shows a loss in ${hobby.lossYears} of the last ${hobby.windowYears} years. The IRS presumes a business is run for profit when it makes money in ${hobby.profitYearsNeeded} of ${hobby.windowYears} years; repeated losses can draw questions about whether it's a business or a hobby. Worth a conversation with your accountant.`
              : `A loss year is normal, especially early on. The IRS presumes a business is run for profit when it makes money in ${hobby.profitYearsNeeded} of any ${hobby.windowYears} years, so keep good records of the work you put in.`
          }
        >
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {hobby.years.map((y) => (
              <div key={y.year} className="rounded-xl border border-border px-1 py-2">
                <p className="font-medium text-muted">{y.year}</p>
                <p
                  className={`mt-0.5 font-semibold ${
                    y.net == null ? "text-muted" : y.net > 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {y.net == null ? "—" : y.net > 0 ? "Profit" : "Loss"}
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <BudgetsSection budgets={budgets} />

      <Card
        title="Tax documents"
        icon={FolderOpen}
        description="Receipts, statements, or anything else you want on hand at tax time. These aren't tied to a specific client."
      >
        <UnfiledDocuments documents={taxDocumentDtos} clients={clientOptions} />
      </Card>
    </div>
  );
}
