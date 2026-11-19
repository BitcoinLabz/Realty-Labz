// Home office deduction engine (2026-11-19) -- the simplified method and the
// regular (actual-expense, Form 8829) method side by side, with depreciation
// and the income limit + carryover rules. Pure: no database, every rate
// comes from a TaxRules instance, so everything is unit-tested
// (home-office.test.ts) including loss years, partial years and multi-year
// carryover chains.
//
// Dates are date-only values stored at UTC midnight, so every year/month
// read here uses the UTC getters (see the parseDateOnlyLocal note in
// src/lib/recurring.ts for why local getters are a trap).
//
// Not modeled (said plainly in the UI rather than half-built): casualty
// losses, a change in office size partway through a year, improvements made
// after business use began, selling the home or ending business use, and
// more than one home office.

import { taxYearDate, type TaxRules } from "@/lib/tax-rules";

export type HomeOfficeMethod = "SIMPLIFIED" | "REGULAR";

export type ExpenseKind =
  | "MORTGAGE_INTEREST"
  | "REAL_ESTATE_TAX"
  | "INSURANCE"
  | "UTILITIES"
  | "RENT"
  | "REPAIRS"
  | "HOA"
  | "OTHER";

export type HomeOfficeProfile = {
  officeSqFt: number;
  homeSqFt: number | null;
  /** First day the space was used for business. Null: treat as in use all year. */
  businessUseStart: Date | null;
  ownership: "OWN" | "RENT";
  purchasePrice: number | null;
  landValue: number | null;
  improvementsCost: number | null;
  fairMarketValueAtStart: number | null;
};

export type HomeOfficeExpenseInput = {
  kind: ExpenseKind;
  /** DIRECT: only the office (painting it). INDIRECT: the whole home. */
  scope: "DIRECT" | "INDIRECT";
  /** MONTH: one month's bill dated in that month. YEAR: a full year's total. */
  period: "MONTH" | "YEAR";
  date: Date;
  amount: number;
};

// Mortgage interest and real estate taxes are deductible anyway (on
// Schedule A), so Form 8829 allows their business share regardless of
// profit. Everything else is an operating expense, limited to income.
export const TIER_ONE_KINDS: ExpenseKind[] = ["MORTGAGE_INTEREST", "REAL_ESTATE_TAX"];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function businessUsePercent(profile: Pick<HomeOfficeProfile, "officeSqFt" | "homeSqFt">): number | null {
  if (!profile.homeSqFt || profile.homeSqFt <= 0 || profile.officeSqFt <= 0) return null;
  return Math.min(1, profile.officeSqFt / profile.homeSqFt);
}

/** 0-based month business use began in `year`; 0 if earlier or unknown, null if later. */
function startMonthIn(year: number, start: Date | null): number | null {
  if (!start) return 0;
  const startYear = start.getUTCFullYear();
  if (startYear > year) return null;
  return startYear < year ? 0 : start.getUTCMonth();
}

/** Months of the year the regular method counts (any day of use counts the month). */
export function regularMonthsInUse(year: number, start: Date | null): number {
  const m = startMonthIn(year, start);
  return m === null ? 0 : 12 - m;
}

/**
 * Simplified method months: IRS counts a month only if the space was used
 * for business at least 15 days of it.
 */
export function simplifiedMonthsInUse(year: number, start: Date | null): number {
  const m = startMonthIn(year, start);
  if (m === null) return 0;
  if (!start || start.getUTCFullYear() < year) return 12;
  const daysInMonth = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
  const daysUsed = daysInMonth - start.getUTCDate() + 1;
  return 12 - m - (daysUsed >= 15 ? 0 : 1);
}

/**
 * The part of one expense that counts toward `year`: monthly bills before the
 * month business use began don't count at all; a full-year amount is
 * prorated by the months in use.
 */
export function countableAmount(expense: HomeOfficeExpenseInput, year: number, start: Date | null): number {
  if (expense.date.getUTCFullYear() !== year) return 0;
  const startMonth = startMonthIn(year, start);
  if (startMonth === null) return 0;
  if (expense.period === "MONTH") return expense.date.getUTCMonth() >= startMonth ? expense.amount : 0;
  return expense.amount * ((12 - startMonth) / 12);
}

// ---------------------------------------------------------------------------
// Simplified method
// ---------------------------------------------------------------------------

export type SimplifiedResult = {
  method: "SIMPLIFIED";
  sqFtUsed: number;
  monthsInUse: number;
  ratePerSqFt: number;
  tentative: number;
  /** The gross income limit (business profit before home office), floored at 0. */
  incomeLimit: number;
  allowed: number;
  /** What the income limit cut off -- lost for good, the simplified method has no carryover. */
  lostToIncomeLimit: number;
};

export function computeSimplified(params: {
  profile: HomeOfficeProfile;
  year: number;
  tentativeProfit: number;
  rules: TaxRules;
}): SimplifiedResult {
  const on = taxYearDate(params.year);
  const rate = params.rules.get("US", "HOME_OFFICE_SIMPLIFIED_RATE", on);
  const maxSqFt = params.rules.get("US", "HOME_OFFICE_SIMPLIFIED_MAX_SQFT", on);
  const sqFtUsed = Math.min(Math.max(0, params.profile.officeSqFt), maxSqFt);
  const monthsInUse = simplifiedMonthsInUse(params.year, params.profile.businessUseStart);
  // IRS uses the average monthly square footage: months not in use count 0.
  const tentative = round2(rate * sqFtUsed * (monthsInUse / 12));
  const incomeLimit = Math.max(0, params.tentativeProfit);
  const allowed = Math.min(tentative, incomeLimit);
  return {
    method: "SIMPLIFIED",
    sqFtUsed,
    monthsInUse,
    ratePerSqFt: rate,
    tentative,
    incomeLimit,
    allowed,
    lostToIncomeLimit: round2(tentative - allowed),
  };
}

// ---------------------------------------------------------------------------
// Depreciation
// ---------------------------------------------------------------------------

export type DepreciationBasis = {
  /** Purchase price + improvements - land. */
  adjustedBasis: number;
  /** Fair market value when business use began, minus land. */
  fairMarketBuildingValue: number | null;
  /** The lesser of the two: what gets depreciated. */
  basis: number;
  businessPercent: number;
  /** basis x business-use %. */
  businessBasis: number;
};

export function depreciationBasis(profile: HomeOfficeProfile): DepreciationBasis | null {
  const pct = businessUsePercent(profile);
  if (profile.ownership !== "OWN" || pct === null || profile.purchasePrice == null) return null;
  const land = profile.landValue ?? 0;
  const adjustedBasis = Math.max(0, profile.purchasePrice + (profile.improvementsCost ?? 0) - land);
  const fairMarketBuildingValue =
    profile.fairMarketValueAtStart == null ? null : Math.max(0, profile.fairMarketValueAtStart - land);
  const basis = fairMarketBuildingValue == null ? adjustedBasis : Math.min(adjustedBasis, fairMarketBuildingValue);
  return { adjustedBasis, fairMarketBuildingValue, basis, businessPercent: pct, businessBasis: round2(basis * pct) };
}

/**
 * Straight-line depreciation for one year of a nonresidential real property
 * recovery period, mid-month convention: the first year counts the start
 * month as half a month. The total never exceeds the basis, and the final
 * year takes whatever is left (the IRS table's "year 40").
 */
export function depreciationForYear(params: {
  businessBasis: number;
  start: Date;
  year: number;
  recoveryYears: number;
}): number {
  const { businessBasis, start, year, recoveryYears } = params;
  if (businessBasis <= 0) return 0;
  const startYear = start.getUTCFullYear();
  if (year < startYear) return 0;
  const annual = businessBasis / recoveryYears;
  const firstYear = annual * ((12 - start.getUTCMonth() - 0.5) / 12);
  if (year === startYear) return round2(firstYear);
  const priorTotal = firstYear + annual * (year - startYear - 1);
  const remaining = businessBasis - priorTotal;
  if (remaining <= 0) return 0;
  return round2(Math.min(annual, remaining));
}

// ---------------------------------------------------------------------------
// Regular method (Form 8829)
// ---------------------------------------------------------------------------

export type Carryover = { operating: number; depreciation: number };

export type RegularResult = {
  method: "REGULAR";
  businessPercent: number;
  monthsInUse: number;
  /** Line 8: business profit before the home office, floored at 0. */
  incomeLimit: number;
  tierOne: { direct: number; indirect: number; businessShare: number };
  /** Line 15: income left after mortgage interest and taxes. */
  afterTierOne: number;
  tierTwo: { direct: number; indirect: number; businessShare: number; carryIn: number; total: number; allowed: number };
  /** Line 28: income left after operating expenses. */
  afterTierTwo: number;
  tierThree: { depreciation: number; carryIn: number; total: number; allowed: number };
  allowed: number;
  carryOut: Carryover;
};

export function computeRegular(params: {
  profile: HomeOfficeProfile;
  expenses: HomeOfficeExpenseInput[];
  year: number;
  tentativeProfit: number;
  carryIn: Carryover;
  rules: TaxRules;
}): RegularResult {
  const { profile, year, rules } = params;
  const pct = businessUsePercent(profile) ?? 0;
  const start = profile.businessUseStart;

  const sum = (tier: "one" | "two", scope: "DIRECT" | "INDIRECT") =>
    params.expenses
      .filter((e) => e.scope === scope && TIER_ONE_KINDS.includes(e.kind) === (tier === "one"))
      .reduce((total, e) => total + countableAmount(e, year, start), 0);

  const t1Direct = round2(sum("one", "DIRECT"));
  const t1Indirect = round2(sum("one", "INDIRECT"));
  const t1Business = round2(t1Direct + t1Indirect * pct);

  const incomeLimit = Math.max(0, params.tentativeProfit);
  const afterTierOne = Math.max(0, round2(incomeLimit - t1Business));

  const t2Direct = round2(sum("two", "DIRECT"));
  const t2Indirect = round2(sum("two", "INDIRECT"));
  const t2Business = round2(t2Direct + t2Indirect * pct);
  const t2Total = round2(t2Business + params.carryIn.operating);
  const t2Allowed = Math.min(afterTierOne, t2Total);
  const afterTierTwo = round2(afterTierOne - t2Allowed);

  const basis = depreciationBasis(profile);
  const depreciation =
    basis && start
      ? depreciationForYear({
          businessBasis: basis.businessBasis,
          start,
          year,
          recoveryYears: rules.get("US", "HOME_OFFICE_RECOVERY_YEARS", taxYearDate(year)),
        })
      : 0;
  const t3Total = round2(depreciation + params.carryIn.depreciation);
  const t3Allowed = Math.min(afterTierTwo, t3Total);

  return {
    method: "REGULAR",
    businessPercent: pct,
    monthsInUse: regularMonthsInUse(year, start),
    incomeLimit,
    tierOne: { direct: t1Direct, indirect: t1Indirect, businessShare: t1Business },
    afterTierOne,
    tierTwo: {
      direct: t2Direct,
      indirect: t2Indirect,
      businessShare: t2Business,
      carryIn: params.carryIn.operating,
      total: t2Total,
      allowed: t2Allowed,
    },
    afterTierTwo,
    tierThree: { depreciation, carryIn: params.carryIn.depreciation, total: t3Total, allowed: t3Allowed },
    // Tier one is allowed in full even when it exceeds income.
    allowed: round2(t1Business + t2Allowed + t3Allowed),
    carryOut: { operating: round2(t2Total - t2Allowed), depreciation: round2(t3Total - t3Allowed) },
  };
}

// ---------------------------------------------------------------------------
// Multi-year chain, comparison and recommendation
// ---------------------------------------------------------------------------

export type HomeOfficeYearResult = {
  year: number;
  method: HomeOfficeMethod;
  methodWasChosen: boolean;
  recommended: HomeOfficeMethod;
  recommendationReason: string;
  simplified: SimplifiedResult;
  /** Computed with the carryovers that would apply, even in a simplified year. */
  regular: RegularResult;
  allowed: number;
  carryIn: Carryover;
  carryOut: Carryover;
  /** Depreciation actually deducted this year (regular years only). */
  depreciationTaken: number;
  accumulatedDepreciation: number;
  tentativeProfit: number;
};

export function recommendMethod(
  simplified: SimplifiedResult,
  regular: RegularResult,
): { method: HomeOfficeMethod; reason: string } {
  const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
  const regularCarry = regular.carryOut.operating + regular.carryOut.depreciation;
  const diff = regular.allowed - simplified.allowed;

  if (diff > 0) {
    return {
      method: "REGULAR",
      reason: `The regular method deducts ${fmt(diff)} more this year because your actual home costs are higher than the flat $5 per square foot.`,
    };
  }
  if (regularCarry > 0 && simplified.allowed <= regular.allowed) {
    return {
      method: "REGULAR",
      reason: `Your business didn't earn enough to use the full deduction this year. The regular method saves the unused ${fmt(regularCarry)} for a future profitable year; the simplified method would lose it.`,
    };
  }
  if (diff === 0 && simplified.allowed === 0) {
    return {
      method: "SIMPLIFIED",
      reason: "Neither method gives a deduction yet. Add your office size and home costs to compare.",
    };
  }
  return {
    method: "SIMPLIFIED",
    reason: `The simplified method deducts ${fmt(-diff)} more this year with far less record-keeping, and it takes no depreciation, so there's nothing to pay back when you sell your home.`,
  };
}

export function computeHomeOfficeChain(params: {
  profile: HomeOfficeProfile;
  expenses: HomeOfficeExpenseInput[];
  /** Business profit before home office, per year (see getBusinessNetByYear). */
  netByYear: Map<number, number>;
  /** The method the agent picked for a year; missing means "use the recommendation". */
  chosenMethods: Map<number, HomeOfficeMethod>;
  throughYear: number;
  rules: TaxRules;
}): HomeOfficeYearResult[] {
  const { profile, rules } = params;
  const firstYear = profile.businessUseStart ? profile.businessUseStart.getUTCFullYear() : params.throughYear;
  const results: HomeOfficeYearResult[] = [];
  let carry: Carryover = { operating: 0, depreciation: 0 };
  let accumulated = 0;

  for (let year = firstYear; year <= params.throughYear; year++) {
    const tentativeProfit = params.netByYear.get(year) ?? 0;
    const simplified = computeSimplified({ profile, year, tentativeProfit, rules });
    const regular = computeRegular({ profile, expenses: params.expenses, year, tentativeProfit, carryIn: carry, rules });
    const rec = recommendMethod(simplified, regular);
    const chosen = params.chosenMethods.get(year);
    const method = chosen ?? rec.method;

    // A simplified year deducts no depreciation and doesn't touch prior
    // carryovers -- they wait for the next regular year.
    const depreciationTaken = method === "REGULAR" ? regular.tierThree.allowed : 0;
    accumulated = round2(accumulated + depreciationTaken);
    const carryOut = method === "REGULAR" ? regular.carryOut : carry;

    results.push({
      year,
      method,
      methodWasChosen: chosen !== undefined,
      recommended: rec.method,
      recommendationReason: rec.reason,
      simplified,
      regular,
      allowed: method === "REGULAR" ? regular.allowed : simplified.allowed,
      carryIn: carry,
      carryOut,
      depreciationTaken,
      accumulatedDepreciation: accumulated,
      tentativeProfit,
    });
    carry = carryOut;
  }
  return results;
}

/** Depreciation that could be taxed when the home is sold, at the maximum rate. */
export function recaptureEstimate(accumulatedDepreciation: number, year: number, rules: TaxRules): number {
  return round2(accumulatedDepreciation * rules.get("US", "DEPRECIATION_RECAPTURE_MAX_RATE", taxYearDate(year)));
}

// ---------------------------------------------------------------------------
// Mortgage payment splitter
// ---------------------------------------------------------------------------

/**
 * Splits one monthly mortgage payment into principal, interest, and escrow
 * (taxes + insurance) for a given payment number (1 = first payment). Only
 * interest (and the taxes/insurance, entered separately) is deductible;
 * principal is paying down your own loan and never is.
 */
export function splitMortgagePayment(params: {
  loanAmount: number;
  annualRatePercent: number;
  termMonths: number;
  paymentNumber: number;
  annualPropertyTax: number;
  annualInsurance: number;
}): { principal: number; interest: number; tax: number; insurance: number; total: number } {
  const { loanAmount, annualRatePercent, termMonths } = params;
  const r = annualRatePercent / 100 / 12;
  const payment = r === 0 ? loanAmount / termMonths : (loanAmount * r) / (1 - Math.pow(1 + r, -termMonths));
  // Balance before payment n, from the closed-form amortization formula.
  const n = Math.min(Math.max(1, params.paymentNumber), termMonths) - 1;
  const balance = r === 0 ? loanAmount - payment * n : loanAmount * Math.pow(1 + r, n) - payment * ((Math.pow(1 + r, n) - 1) / r);
  const interest = balance * r;
  const principal = payment - interest;
  const tax = params.annualPropertyTax / 12;
  const insurance = params.annualInsurance / 12;
  return {
    principal: round2(principal),
    interest: round2(interest),
    tax: round2(tax),
    insurance: round2(insurance),
    total: round2(payment + tax + insurance),
  };
}
