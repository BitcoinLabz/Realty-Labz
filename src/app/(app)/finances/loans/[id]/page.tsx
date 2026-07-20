import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import {
  summarizeLoan,
  buildAmortizationSchedule,
  buildHomeValueProjection,
  buildPaydownChartData,
  buildEquityChartData,
} from "@/lib/loan-calculations";
import { SummaryCard } from "@/components/ui/summary-card";
import { LoanPaydownChart } from "@/components/charts/loan-paydown-chart";
import { HomeEquityChart } from "@/components/charts/home-equity-chart";
import { LoanForm, type LoanFormValues } from "../loan-form";
import { ExtraPaymentList, type ExtraPaymentDTO } from "./extra-payment-list";
import { DeleteLoanButton } from "./delete-loan-button";
import { ScheduleTable } from "./schedule-table";

const PROJECTION_MONTHS = 360; // fixed 30-year horizon regardless of loan term

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const loan = await prisma.loan.findFirst({
    where: { id, userId: session!.user.id },
    include: { extraPayments: { orderBy: { date: "desc" } } },
  });

  if (!loan) notFound();

  const loanAmount = Number(loan.purchasePrice) - Number(loan.downPayment);
  const interestRate = Number(loan.interestRate);
  const extraPaymentsForCalc = loan.extraPayments.map((p) => ({ date: p.date, amount: Number(p.amount) }));

  const summary = summarizeLoan({
    purchasePrice: Number(loan.purchasePrice),
    downPayment: Number(loan.downPayment),
    interestRate,
    termMonths: loan.termMonths,
    startDate: loan.startDate,
    annualPropertyTax: Number(loan.annualPropertyTax),
    annualInsurance: Number(loan.annualInsurance),
    extraPayments: extraPaymentsForCalc,
  });

  const originalSchedule = buildAmortizationSchedule(
    loanAmount,
    interestRate,
    loan.termMonths,
    loan.startDate,
  );
  const actualSchedule = buildAmortizationSchedule(
    loanAmount,
    interestRate,
    loan.termMonths,
    loan.startDate,
    extraPaymentsForCalc,
  );
  const hasExtraPayments = loan.extraPayments.length > 0;
  const paydownData = buildPaydownChartData(originalSchedule, actualSchedule);

  const originalPayoff = originalSchedule[originalSchedule.length - 1].date;
  const actualPayoff = actualSchedule[actualSchedule.length - 1].date;
  const monthsSaved = hasExtraPayments
    ? (originalPayoff.getFullYear() - actualPayoff.getFullYear()) * 12 +
      (originalPayoff.getMonth() - actualPayoff.getMonth())
    : 0;

  const paydownTableColumns = hasExtraPayments
    ? [
        { key: "label", label: "Year" },
        { key: "original", label: "Original balance" },
        { key: "actual", label: "With extra payments" },
        { key: "difference", label: "Difference" },
      ]
    : [
        { key: "label", label: "Year" },
        { key: "original", label: "Balance" },
      ];
  const paydownTableRows = paydownData.map((p) => ({
    label: p.label,
    original: p.original,
    ...(hasExtraPayments ? { actual: p.actual, difference: p.original - p.actual } : {}),
  }));

  const isMortgage = loan.type === "MORTGAGE";
  const equityData = isMortgage
    ? buildEquityChartData(
        actualSchedule,
        buildHomeValueProjection(
          Number(loan.purchasePrice),
          Number(loan.appreciationRate),
          PROJECTION_MONTHS,
          loan.startDate,
        ),
        PROJECTION_MONTHS,
      )
    : [];
  const equityTableColumns = [
    { key: "label", label: "Year" },
    { key: "homeValue", label: "Home value" },
    { key: "balance", label: "Loan balance" },
    { key: "equity", label: "Equity" },
  ];

  const defaultValues: LoanFormValues = {
    id: loan.id,
    name: loan.name,
    type: loan.type,
    purchasePrice: String(loan.purchasePrice),
    downPayment: String(loan.downPayment),
    interestRate: String(loan.interestRate),
    termMonths: String(loan.termMonths),
    startDate: loan.startDate.toISOString().slice(0, 10),
    annualPropertyTax: String(loan.annualPropertyTax),
    annualInsurance: String(loan.annualInsurance),
    appreciationRate: String(loan.appreciationRate),
    notes: loan.notes ?? "",
  };

  const extraPaymentDtos: ExtraPaymentDTO[] = loan.extraPayments.map((p) => ({
    id: p.id,
    date: p.date.toISOString().slice(0, 10),
    amount: Number(p.amount),
    notes: p.notes,
  }));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/finances/loans"
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground"
        >
          ← Back to Loans
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{loan.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Manage this loan&apos;s details, extra payments, and projections.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Monthly payment"
          value={summary.isPaidOff ? "Paid off" : formatCurrency(summary.totalMonthlyPayment)}
        />
        <SummaryCard label="Remaining balance" value={formatCurrency(summary.remainingBalance)} />
        <SummaryCard
          label="Payoff date"
          value={actualPayoff.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        />
      </div>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Loan details</h2>
        <div className="max-w-md">
          <LoanForm key={loan.updatedAt.toISOString()} defaultValues={defaultValues} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-2 text-base font-semibold text-foreground">Paydown schedule</h2>
        <p className="mb-6 text-sm text-muted">
          {hasExtraPayments
            ? `Originally scheduled to pay off ${originalPayoff.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })} — with your extra payments, now on track for ${actualPayoff.toLocaleDateString(
                "en-US",
                { month: "long", year: "numeric" },
              )}${
                monthsSaved > 0
                  ? ` (${Math.floor(monthsSaved / 12)} yr ${monthsSaved % 12} mo earlier)`
                  : ""
              }.`
            : `On track to pay off ${actualPayoff.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}.`}
        </p>
        <LoanPaydownChart data={paydownData} showActual={hasExtraPayments} />
        <ScheduleTable columns={paydownTableColumns} rows={paydownTableRows} />
      </section>

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Extra payments</h2>
        <ExtraPaymentList loanId={loan.id} payments={extraPaymentDtos} />
      </section>

      {isMortgage ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-1 text-base font-semibold text-foreground">Home value &amp; equity</h2>
          <p className="mb-6 text-sm text-muted">
            30-year projection assuming {Number(loan.appreciationRate)}% annual appreciation — change
            it under Loan details above.
          </p>
          <HomeEquityChart data={equityData} />
          <ScheduleTable columns={equityTableColumns} rows={equityData} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Danger zone</h2>
        <p className="mb-4 text-sm text-muted">
          Deleting a loan also removes its logged extra payments.
        </p>
        <DeleteLoanButton loanId={loan.id} loanName={loan.name} />
      </section>
    </div>
  );
}
