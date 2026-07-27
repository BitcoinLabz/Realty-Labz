// Estimated quarterly self-employment tax — deliberately NOT a real
// federal-bracket calculation (that needs filing status, other income,
// deductions, and state-specific rules well beyond what this app should
// demand from an agent). This is a clearly-labeled ESTIMATE: the real, fixed
// 15.3% self-employment tax rate applied to YTD net business income, plus
// the user's own single "estimated income tax rate" input (their federal +
// state combined guess, from an accountant or a prior-year return), split
// across the four standard IRS quarterly due dates. Always shown in the UI
// with an explicit "estimate, not tax advice" disclaimer.
export const SELF_EMPLOYMENT_TAX_RATE = 0.153;

export function quarterlyDueDates(year: number): { label: string; dueDate: Date }[] {
  return [
    { label: "Q1", dueDate: new Date(year, 3, 15) }, // Apr 15
    { label: "Q2", dueDate: new Date(year, 5, 15) }, // Jun 15
    { label: "Q3", dueDate: new Date(year, 8, 15) }, // Sep 15
    { label: "Q4", dueDate: new Date(year + 1, 0, 15) }, // Jan 15 of the following year
  ];
}

export type EstimatedTaxSummary = {
  selfEmploymentTax: number;
  incomeTax: number;
  totalEstimated: number;
  perQuarter: number;
  quarters: { label: string; dueDate: Date; amount: number }[];
};

export function estimateQuarterlyTax(
  ytdNetBusinessIncome: number,
  estimatedIncomeTaxRatePercent: number,
  year: number,
): EstimatedTaxSummary {
  // A net loss owes no self-employment/income tax estimate — never negative.
  const income = Math.max(0, ytdNetBusinessIncome);
  const selfEmploymentTax = income * SELF_EMPLOYMENT_TAX_RATE;
  const incomeTax = income * (Math.max(0, estimatedIncomeTaxRatePercent) / 100);
  const totalEstimated = selfEmploymentTax + incomeTax;
  const perQuarter = totalEstimated / 4;

  return {
    selfEmploymentTax,
    incomeTax,
    totalEstimated,
    perQuarter,
    quarters: quarterlyDueDates(year).map((q) => ({ ...q, amount: perQuarter })),
  };
}
