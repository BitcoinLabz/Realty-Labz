import { FolderOpen } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  getBudgetUsage,
  getBusinessExpenseBreakdown,
  getMonthlyIncomeExpense,
} from "@/lib/finance-data";
import { estimateQuarterlyTax } from "@/lib/estimated-tax";
import { Card } from "@/components/ui/card";
import { YearSelect } from "@/components/ui/year-select";
import { UnfiledDocuments } from "@/app/(app)/clients/unfiled-documents";
import { HomeOfficeCard } from "../home-office-card";
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

  const [businessSeries, expenseBreakdown, user, budgets, taxDocuments, clients] =
    await Promise.all([
      getMonthlyIncomeExpense(userId, year, "BUSINESS"),
      getBusinessExpenseBreakdown(userId, year),
      prisma.user.findUnique({
        where: { id: userId },
        select: { homeOfficeSqFt: true, estimatedIncomeTaxRatePercent: true },
      }),
      getBudgetUsage(userId, year, currentMonth),
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
  const homeOfficeDeduction = expenseBreakdown.find((p) => p.label === "Home office")?.value ?? 0;
  const mileageDeduction = expenseBreakdown.find((p) => p.label === "Mileage")?.value ?? 0;
  const netBusinessIncome = businessNet - homeOfficeDeduction - mileageDeduction;
  const taxSummary =
    user?.estimatedIncomeTaxRatePercent != null
      ? estimateQuarterlyTax(netBusinessIncome, Number(user.estimatedIncomeTaxRatePercent), year)
      : null;

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

      <HomeOfficeCard homeOfficeSqFt={user?.homeOfficeSqFt ?? null} deduction={homeOfficeDeduction} />

      <TaxEstimateCard
        estimatedIncomeTaxRatePercent={
          user?.estimatedIncomeTaxRatePercent != null
            ? Number(user.estimatedIncomeTaxRatePercent)
            : null
        }
        summary={taxSummary}
      />

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
