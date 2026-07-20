// Standard fixed-rate amortization math. Nothing here is persisted per-month
// (see the comment on the Loan model) — every value is derived fresh from
// the loan's stored terms whenever it's needed.

function monthlyRate(annualRatePct: number): number {
  return annualRatePct / 100 / 12;
}

export function monthlyPayment(principal: number, annualRatePct: number, termMonths: number): number {
  if (principal <= 0 || termMonths <= 0) return 0;
  if (annualRatePct === 0) return principal / termMonths;
  const r = monthlyRate(annualRatePct);
  const factor = Math.pow(1 + r, termMonths);
  return (principal * r * factor) / (factor - 1);
}

// Remaining balance after `monthsElapsed` payments have been made.
export function remainingBalanceAtMonth(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  monthsElapsed: number,
): number {
  if (monthsElapsed <= 0) return principal;
  if (monthsElapsed >= termMonths) return 0;
  if (annualRatePct === 0) return principal * (1 - monthsElapsed / termMonths);
  const r = monthlyRate(annualRatePct);
  const factorN = Math.pow(1 + r, termMonths);
  const factorK = Math.pow(1 + r, monthsElapsed);
  return principal * (factorN - factorK) / (factorN - 1);
}

export function monthsElapsedSince(startDate: Date, now = new Date()): number {
  const months = (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth());
  return Math.max(0, months);
}

export type LoanSummary = {
  loanAmount: number;
  monthlyPrincipalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  remainingBalance: number;
  isPaidOff: boolean;
  // The current month's split of the P&I payment between principal and
  // interest -- shifts over the life of the loan as the balance shrinks.
  currentPrincipalPortion: number;
  currentInterestPortion: number;
  totalInterestOverLife: number;
};

export function summarizeLoan(loan: {
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  termMonths: number;
  startDate: Date;
  annualPropertyTax: number;
  annualInsurance: number;
}): LoanSummary {
  const loanAmount = Math.max(0, loan.purchasePrice - loan.downPayment);
  const monthlyPrincipalAndInterest = monthlyPayment(loanAmount, loan.interestRate, loan.termMonths);
  const monthlyTax = loan.annualPropertyTax / 12;
  const monthlyInsurance = loan.annualInsurance / 12;

  const monthsElapsed = Math.min(monthsElapsedSince(loan.startDate), loan.termMonths);
  const balanceBeforeNextPayment = remainingBalanceAtMonth(
    loanAmount,
    loan.interestRate,
    loan.termMonths,
    monthsElapsed,
  );
  const isPaidOff = monthsElapsed >= loan.termMonths;

  const currentInterestPortion = isPaidOff ? 0 : balanceBeforeNextPayment * monthlyRate(loan.interestRate);
  const currentPrincipalPortion = isPaidOff ? 0 : monthlyPrincipalAndInterest - currentInterestPortion;

  const totalInterestOverLife = monthlyPrincipalAndInterest * loan.termMonths - loanAmount;

  return {
    loanAmount,
    monthlyPrincipalAndInterest,
    monthlyTax,
    monthlyInsurance,
    totalMonthlyPayment: monthlyPrincipalAndInterest + monthlyTax + monthlyInsurance,
    remainingBalance: balanceBeforeNextPayment,
    isPaidOff,
    currentPrincipalPortion,
    currentInterestPortion,
    totalInterestOverLife,
  };
}
