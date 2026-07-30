import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { calculateNetCommission, getHomeOfficeDeduction } from "@/lib/finance-data";
import {
  FinancialReport,
  type FinancialReportData,
  type FinancialReportDeal,
  type FinancialReportExpenseCategory,
} from "@/lib/pdf/financial-report";

// HOME_OFFICE is kept here (unlike transaction-form.tsx, where it's no
// longer offered) purely so any pre-2026-07-24 manually-entered rows still
// appear in the export instead of silently vanishing from the expense
// total — the new computed deduction is added separately below as its own
// distinctly-labeled line, not merged with old manual entries.
const CATEGORY_LABELS: Record<string, string> = {
  HOME_OFFICE: "Home Office (manual entries)",
  PHONE: "Phone",
  MARKETING_ADVERTISING: "Marketing & Advertising",
  MLS_DUES: "MLS / Association Dues",
  CONTINUING_EDUCATION: "Continuing Education",
  CLIENT_GIFTS: "Client Gifts",
  OFFICE_SUPPLIES: "Office Supplies",
  SOFTWARE_SUBSCRIPTIONS: "Software & Subscriptions",
  INSURANCE: "Insurance",
  LICENSING_FEES: "Licensing Fees",
  MEALS_ENTERTAINMENT: "Meals & Entertainment",
  PROFESSIONAL_SERVICES: "Professional Services",
  OTHER: "Other Business Expense",
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const yearParam = request.nextUrl.searchParams.get("year");
  const year = Number(yearParam) || new Date().getFullYear();

  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [user, transactions, mileageLogs, closedDealRows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { team: true },
    }),
    prisma.transaction.findMany({
      // Business-only: this report is the accountant/tax-time export, and
      // personal income/expenses (see Transaction.scope) have no place in a
      // real estate business's financial summary.
      where: { userId: session.user.id, scope: "BUSINESS", date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    }),
    prisma.mileageLog.findMany({
      where: {
        userId: session.user.id,
        isBusiness: true,
        date: { gte: start, lt: end },
      },
      orderBy: { date: "asc" },
    }),
    prisma.deal.findMany({
      where: { userId: session.user.id, status: "CLOSED", closingDate: { gte: start, lt: end } },
      include: { expenses: { where: { type: "EXPENSE" } } },
      orderBy: { closingDate: "asc" },
    }),
  ]);

  const incomeItems = transactions
    .filter((t) => t.type === "INCOME")
    .map((t) => ({
      date: t.date.toISOString().slice(0, 10),
      description: t.description ?? "",
      amount: Number(t.amount),
    }));

  const expenseTransactions = transactions.filter((t) => t.type === "EXPENSE");
  const expenseCategories: FinancialReportExpenseCategory[] = Object.entries(CATEGORY_LABELS)
    .map(([category, label]) => {
      const items = expenseTransactions
        .filter((t) => t.category === category)
        .map((t) => ({
          date: t.date.toISOString().slice(0, 10),
          description: t.description ?? "",
          amount: Number(t.amount),
        }));
      const total = items.reduce((sum, i) => sum + i.amount, 0);
      return { label, total, items };
    })
    .filter((cat) => cat.items.length > 0);

  // The computed Simplified-method deduction (see getHomeOfficeDeduction) is
  // a single number, not individual transactions — added as its own
  // one-line synthetic category, distinct from any real HOME_OFFICE-tagged
  // rows above, so nothing gets double-counted or merged incorrectly.
  const homeOfficeDeduction = getHomeOfficeDeduction(user?.homeOfficeSqFt);
  if (homeOfficeDeduction > 0) {
    expenseCategories.push({
      label: "Home Office (Simplified method)",
      total: homeOfficeDeduction,
      items: [
        {
          date: `${year}-12-31`,
          description: `${Math.min(user?.homeOfficeSqFt ?? 0, 300)} sq ft × $5/sq ft`,
          amount: homeOfficeDeduction,
        },
      ],
    });
  }

  const income = incomeItems.reduce((sum, i) => sum + i.amount, 0);
  const expenses = expenseCategories.reduce((sum, c) => sum + c.total, 0);

  const mileageTrips = mileageLogs.map((log) => ({
    date: log.date.toISOString().slice(0, 10),
    note: log.note,
    miles: Number(log.miles),
    ratePerMile: Number(log.ratePerMile),
    deduction: Number(log.deduction),
  }));
  const mileageDeduction = mileageTrips.reduce((sum, t) => sum + t.deduction, 0);

  const netIncome = income - expenses - mileageDeduction;

  const closedDeals: FinancialReportDeal[] = closedDealRows.map((deal) => {
    const grossCommission = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
    const netCommission = calculateNetCommission(grossCommission, {
      brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
      referralFeeAmount: deal.referralFeeAmount ? Number(deal.referralFeeAmount) : null,
      teamSplitAmount: deal.teamSplitAmount ? Number(deal.teamSplitAmount) : null,
      otherDeductions: deal.otherDeductions ? Number(deal.otherDeductions) : null,
    });
    const dealExpenses = deal.expenses.reduce((sum, t) => sum + Number(t.amount), 0);
    return {
      propertyAddress: deal.propertyAddress,
      closingDate: deal.closingDate ? deal.closingDate.toISOString().slice(0, 10) : `${year}-01-01`,
      grossCommission,
      netCommission,
      expenses: dealExpenses,
      profit: netCommission - dealExpenses,
    };
  });

  const reportData: FinancialReportData = {
    userName: user?.name ?? "Realty Labz Agent",
    teamName: user?.team?.name ?? null,
    year,
    income,
    expenses,
    mileageDeduction,
    netIncome,
    incomeItems,
    expenseCategories,
    mileageTrips,
    closedDeals,
    generatedAt: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };

  // @react-pdf/renderer's types require the element's props to literally be
  // DocumentProps, which a wrapper component like FinancialReport never satisfies
  // structurally — cast is the standard workaround for this ergonomic quirk.
  const element = createElement(FinancialReport, { data: reportData }) as Parameters<
    typeof renderToBuffer
  >[0];
  const buffer = await renderToBuffer(element);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="realty-labz-financial-summary-${year}.pdf"`,
    },
  });
}
