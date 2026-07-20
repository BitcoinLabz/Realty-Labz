export type LoanType = "MORTGAGE" | "AUTO" | "OTHER";

export type LoanDTO = {
  id: string;
  name: string;
  type: LoanType;
  purchasePrice: number;
  downPayment: number;
  interestRate: number;
  termMonths: number;
  startDate: string; // yyyy-mm-dd
  annualPropertyTax: number;
  annualInsurance: number;
  appreciationRate: number;
  notes: string | null;
  updatedAt: string; // ISO

  // Derived at read-time via summarizeLoan() -- see src/lib/loan-calculations.ts
  loanAmount: number;
  monthlyPrincipalAndInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  remainingBalance: number;
  isPaidOff: boolean;
  payoffDate: string; // ISO
};
