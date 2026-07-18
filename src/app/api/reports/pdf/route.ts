import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  FinancialReport,
  type FinancialReportData,
  type FinancialReportExpenseCategory,
} from "@/lib/pdf/financial-report";

const CATEGORY_LABELS: Record<string, string> = {
  HOME_OFFICE: "Home Office",
  PHONE: "Phone",
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

  const [user, transactions, mileageLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { team: true },
    }),
    prisma.transaction.findMany({
      where: { userId: session.user.id, date: { gte: start, lt: end } },
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

  const reportData: FinancialReportData = {
    userName: user?.name ?? "Realty Labs Agent",
    teamName: user?.team?.name ?? null,
    year,
    income,
    expenses,
    mileageDeduction,
    netIncome,
    incomeItems,
    expenseCategories,
    mileageTrips,
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
      "Content-Disposition": `attachment; filename="realty-labs-financial-summary-${year}.pdf"`,
    },
  });
}
