import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/format";
import { summarizeLoan } from "@/lib/loan-calculations";
import { SummaryCard } from "@/components/ui/summary-card";
import { LoanBreakdownChart, type LoanBreakdownPoint } from "@/components/charts/loan-breakdown-chart";
import { LoanForm } from "./loan-form";
import { LoanList } from "./loan-list";
import type { LoanDTO } from "./types";

export default async function FinancesLoansPage() {
  const session = await auth();

  const loans = await prisma.loan.findMany({
    where: { userId: session!.user.id },
    include: { extraPayments: true },
    orderBy: { createdAt: "desc" },
  });

  const summaries = loans.map((l) =>
    summarizeLoan({
      purchasePrice: Number(l.purchasePrice),
      downPayment: Number(l.downPayment),
      interestRate: Number(l.interestRate),
      termMonths: l.termMonths,
      startDate: l.startDate,
      annualPropertyTax: Number(l.annualPropertyTax),
      annualInsurance: Number(l.annualInsurance),
      extraPayments: l.extraPayments.map((p) => ({ date: p.date, amount: Number(p.amount) })),
    }),
  );

  const dtos: LoanDTO[] = loans.map((l, i) => {
    const summary = summaries[i];
    return {
      id: l.id,
      name: l.name,
      type: l.type,
      purchasePrice: Number(l.purchasePrice),
      downPayment: Number(l.downPayment),
      interestRate: Number(l.interestRate),
      termMonths: l.termMonths,
      startDate: l.startDate.toISOString().slice(0, 10),
      annualPropertyTax: Number(l.annualPropertyTax),
      annualInsurance: Number(l.annualInsurance),
      appreciationRate: Number(l.appreciationRate),
      notes: l.notes,
      updatedAt: l.updatedAt.toISOString(),
      loanAmount: summary.loanAmount,
      monthlyPrincipalAndInterest: summary.monthlyPrincipalAndInterest,
      monthlyTax: summary.monthlyTax,
      monthlyInsurance: summary.monthlyInsurance,
      totalMonthlyPayment: summary.totalMonthlyPayment,
      remainingBalance: summary.remainingBalance,
      isPaidOff: summary.isPaidOff,
      payoffDate: summary.payoffDate.toISOString(),
    };
  });

  const activeLoans = dtos.filter((l) => !l.isPaidOff);
  const totalMonthlyPayment = activeLoans.reduce((sum, l) => sum + l.totalMonthlyPayment, 0);
  const totalRemainingBalance = dtos.reduce((sum, l) => sum + l.remainingBalance, 0);

  const breakdownData: LoanBreakdownPoint[] = dtos
    .map((dto, i) => {
      if (dto.isPaidOff) return null;
      const summary = summaries[i];
      return {
        name: dto.name,
        principal: summary.currentPrincipalPortion,
        interest: summary.currentInterestPortion,
        escrow: summary.monthlyEscrow,
      };
    })
    .filter((p): p is LoanBreakdownPoint => p !== null);

  return (
    <div className="flex flex-col gap-8">
      <p className="text-sm text-muted">
        Mortgages, auto loans, and other installment debt — all in one place.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SummaryCard label="Total monthly payments" value={formatCurrency(totalMonthlyPayment)} />
        <SummaryCard label="Total remaining balance" value={formatCurrency(totalRemainingBalance)} />
      </div>

      {breakdownData.length > 0 ? (
        <section className="rounded-2xl border border-border bg-background p-8">
          <h2 className="mb-6 text-base font-semibold text-foreground">
            Monthly payment breakdown
          </h2>
          <LoanBreakdownChart data={breakdownData} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-background p-8">
        <h2 className="mb-6 text-base font-semibold text-foreground">Add a loan</h2>
        <div className="max-w-md">
          <LoanForm />
        </div>
      </section>

      <LoanList loans={dtos} />
    </div>
  );
}
