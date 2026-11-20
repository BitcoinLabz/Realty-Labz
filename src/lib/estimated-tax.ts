// Estimated taxes on business income (rewritten 2026-11-19 on top of the
// tax rules table -- every rate comes from src/lib/tax-rules-data.ts via a
// TaxRules instance, none is written here).
//
// WHAT IT COMPUTES, and what it deliberately doesn't:
// - Self-employment tax exactly as Schedule SE does it: 92.35% of net profit,
//   Social Security (12.4%) up to the year's wage base, Medicare (2.9%) on
//   all of it. Assumes no W-2 wages (those would use up the wage base first).
//   The 0.9% Additional Medicare Tax is NOT included -- its threshold depends
//   on filing status, which the app doesn't ask for.
// - Federal income tax as the agent's OWN rate guess (from an accountant or a
//   prior return) on profit after the half-of-SE-tax deduction. A real
//   bracket calculation needs filing status, other income and deductions.
// - Michigan's flat income tax on profit after the half-SE deduction and one
//   personal exemption.
// - Michigan city income tax for the agent's home city (resident rate) and,
//   if different, the city their office is in (nonresident rate), with the
//   home city's credit for tax paid to the other one. Assumes all business
//   income is earned in the work city and ignores the city's small personal
//   exemption.
// Always shown as an ESTIMATE with a "not tax advice" disclaimer.

import { cityJurisdiction, cityName } from "@/lib/tax-rules-data";
import { taxYearDate, type TaxRules } from "@/lib/tax-rules";

export function quarterlyDueDates(year: number): { label: string; dueDate: Date }[] {
  return [
    { label: "Q1", dueDate: new Date(year, 3, 15) }, // Apr 15
    { label: "Q2", dueDate: new Date(year, 5, 15) }, // Jun 15
    { label: "Q3", dueDate: new Date(year, 8, 15) }, // Sep 15
    { label: "Q4", dueDate: new Date(year + 1, 0, 15) }, // Jan 15 of the following year
  ];
}

export type SelfEmploymentTax = {
  netEarnings: number;
  socialSecurity: number;
  medicare: number;
  total: number;
  /** Half of SE tax is deducted on Schedule 1 before income tax. */
  deductibleHalf: number;
};

export function selfEmploymentTax(netProfit: number, year: number, rules: TaxRules): SelfEmploymentTax {
  const on = taxYearDate(year);
  const factor = rules.get("US", "SE_NET_EARNINGS_FACTOR", on);
  const ssRate = rules.get("US", "SE_SOCIAL_SECURITY_RATE", on);
  const medicareRate = rules.get("US", "SE_MEDICARE_RATE", on);
  const wageBase = rules.get("US", "SOCIAL_SECURITY_WAGE_BASE", on);

  const netEarnings = Math.max(0, netProfit) * factor;
  // Schedule SE: under $400 of net earnings owes no SE tax at all.
  if (netEarnings < 400) {
    return { netEarnings, socialSecurity: 0, medicare: 0, total: 0, deductibleHalf: 0 };
  }
  const socialSecurity = Math.min(netEarnings, wageBase) * ssRate;
  const medicare = netEarnings * medicareRate;
  const total = socialSecurity + medicare;
  return { netEarnings, socialSecurity, medicare, total, deductibleHalf: total / 2 };
}

export type CityTax = { amount: number; label: string | null };

export function michiganCityTax(params: {
  base: number;
  year: number;
  residenceCity: string | null;
  workCity: string | null;
  rules: TaxRules;
}): CityTax {
  const { base, year, residenceCity, workCity, rules } = params;
  if (base <= 0) return { amount: 0, label: null };
  const on = taxYearDate(year);
  const rate = (code: string | null, key: "CITY_RESIDENT_RATE" | "CITY_NONRESIDENT_RATE") =>
    code ? rules.find(cityJurisdiction(code), key, on) : null;

  const homeResident = rate(residenceCity, "CITY_RESIDENT_RATE");
  const homeNonresident = rate(residenceCity, "CITY_NONRESIDENT_RATE");
  const workNonresident = workCity && workCity !== residenceCity ? rate(workCity, "CITY_NONRESIDENT_RATE") : null;

  const workTax = workNonresident != null ? base * workNonresident : 0;
  let homeTax = homeResident != null ? base * homeResident : 0;
  // A Michigan city gives its residents credit for tax paid to another
  // city, capped at what the home city would charge a nonresident.
  if (homeResident != null && workTax > 0) {
    homeTax -= Math.min(workTax, base * (homeNonresident ?? 0));
  }

  const names = [homeResident != null ? cityName(residenceCity) : null, workNonresident != null ? cityName(workCity) : null]
    .filter(Boolean)
    .join(" + ");
  return { amount: Math.max(0, homeTax) + workTax, label: names || null };
}

export type EstimatedTaxSummary = {
  netBusinessIncome: number;
  selfEmployment: SelfEmploymentTax;
  /** Kept for existing callers: the SE total. */
  selfEmploymentTax: number;
  federalIncomeTax: number | null;
  /** Kept for existing callers: federal income tax, or 0 with no rate set. */
  incomeTax: number;
  michiganIncomeTax: number;
  michiganRate: number;
  cityIncomeTax: number;
  cityLabel: string | null;
  totalEstimated: number;
  perQuarter: number;
  quarters: { label: string; dueDate: Date; amount: number }[];
};

export function estimateTaxes(params: {
  netBusinessIncome: number;
  year: number;
  federalRatePercent: number | null;
  residenceCity?: string | null;
  workCity?: string | null;
  rules: TaxRules;
}): EstimatedTaxSummary {
  const { netBusinessIncome, year, federalRatePercent, rules } = params;
  const on = taxYearDate(year);
  const se = selfEmploymentTax(netBusinessIncome, year, rules);

  // A net loss owes nothing -- never a negative estimate.
  const afterHalfSe = Math.max(0, netBusinessIncome - se.deductibleHalf);

  const federalIncomeTax =
    federalRatePercent == null ? null : afterHalfSe * (Math.max(0, federalRatePercent) / 100);

  const michiganRate = rules.get("MI", "STATE_INCOME_TAX_RATE", on);
  const exemption = rules.get("MI", "STATE_PERSONAL_EXEMPTION", on);
  const michiganIncomeTax = Math.max(0, afterHalfSe - exemption) * michiganRate;

  const city = michiganCityTax({
    base: afterHalfSe,
    year,
    residenceCity: params.residenceCity ?? null,
    workCity: params.workCity ?? null,
    rules,
  });

  const totalEstimated = se.total + (federalIncomeTax ?? 0) + michiganIncomeTax + city.amount;
  const perQuarter = totalEstimated / 4;

  return {
    netBusinessIncome,
    selfEmployment: se,
    selfEmploymentTax: se.total,
    federalIncomeTax,
    incomeTax: federalIncomeTax ?? 0,
    michiganIncomeTax,
    michiganRate,
    cityIncomeTax: city.amount,
    cityLabel: city.label,
    totalEstimated,
    perQuarter,
    quarters: quarterlyDueDates(year).map((q) => ({ ...q, amount: perQuarter })),
  };
}

// How much of one commission to set aside for taxes (2026-10-03, rates from
// the rules table since 2026-11-19): the marginal rate on one more dollar of
// profit -- SE tax on 92.35% of it, plus federal (the agent's guess),
// Michigan and city tax on what's left after the half-SE deduction. Ignores
// the wage-base cap and exemptions, so it errs slightly high, which is the
// right direction for a set-aside. Rounded to dollars: a nudge, not a return.
export function taxSetAside(params: {
  netCommission: number;
  year: number;
  federalRatePercent: number | null;
  residenceCity?: string | null;
  workCity?: string | null;
  rules: TaxRules;
}): number {
  const { netCommission, year, rules } = params;
  if (netCommission <= 0) return 0;
  const on = taxYearDate(year);
  const seRate =
    rules.get("US", "SE_NET_EARNINGS_FACTOR", on) *
    (rules.get("US", "SE_SOCIAL_SECURITY_RATE", on) + rules.get("US", "SE_MEDICARE_RATE", on));
  const afterHalfSe = 1 - seRate / 2;
  const cityRate = michiganCityTax({
    base: 1,
    year,
    residenceCity: params.residenceCity ?? null,
    workCity: params.workCity ?? null,
    rules,
  }).amount;
  const incomeRate =
    Math.max(0, params.federalRatePercent ?? 0) / 100 + rules.get("MI", "STATE_INCOME_TAX_RATE", on) + cityRate;
  return Math.round(netCommission * (seRate + afterHalfSe * incomeRate));
}

// Hobby-loss awareness (IRC 183(d)): a business is presumed to be run for
// profit if it made a profit in 3 of the last 5 years. Losses outside that
// presumption aren't automatically disallowed, but they draw scrutiny -- so
// this is a heads-up, worded that way in the UI. Years with no records are
// treated as unknown, not as losses.
export type HobbyLossStatus = {
  status: "ok" | "watch" | "atRisk";
  profitYears: number;
  lossYears: number;
  windowYears: number;
  profitYearsNeeded: number;
  years: { year: number; net: number | null }[];
};

export function hobbyLossCheck(params: {
  netByYear: Map<number, number>;
  currentYear: number;
  rules: TaxRules;
}): HobbyLossStatus {
  const on = taxYearDate(params.currentYear);
  const windowYears = params.rules.get("US", "HOBBY_LOSS_WINDOW_YEARS", on);
  const needed = params.rules.get("US", "HOBBY_LOSS_PROFIT_YEARS", on);

  const years = Array.from({ length: windowYears }, (_, i) => {
    const year = params.currentYear - (windowYears - 1) + i;
    return { year, net: params.netByYear.has(year) ? params.netByYear.get(year)! : null };
  });
  const profitYears = years.filter((y) => y.net != null && y.net > 0).length;
  const lossYears = years.filter((y) => y.net != null && y.net <= 0).length;

  // atRisk: even a profit in every unrecorded year can't reach the threshold.
  const status: HobbyLossStatus["status"] =
    profitYears >= needed ? "ok" : windowYears - lossYears < needed ? "atRisk" : lossYears > 0 ? "watch" : "ok";
  return { status, profitYears, lossYears, windowYears, profitYearsNeeded: needed, years };
}

// The next quarterly estimated payment due within `windowDays` of today, for
// the dashboard's "Needs your attention" list. Checks last year's dates too,
// because Q4 of last year is due Jan 15 of this one. `today` is a local
// midnight date (the due dates above are local dates).
export function upcomingQuarterlyPayment(
  today: Date,
  windowDays = 14,
): { label: string; taxYear: number; dueDate: Date; daysAway: number } | null {
  const year = today.getFullYear();
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const taxYear of [year - 1, year]) {
    for (const q of quarterlyDueDates(taxYear)) {
      const daysAway = Math.round((q.dueDate.getTime() - start) / dayMs);
      if (daysAway >= 0 && daysAway <= windowDays) return { label: q.label, taxYear, dueDate: q.dueDate, daysAway };
    }
  }
  return null;
}
