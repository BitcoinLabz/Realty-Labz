import { describe, expect, it } from "vitest";
import {
  businessUsePercent,
  computeHomeOfficeChain,
  computeRegular,
  computeSimplified,
  countableAmount,
  depreciationBasis,
  depreciationForYear,
  mortgageInterestForYear,
  recaptureEstimate,
  simplifiedMonthsInUse,
  splitMortgagePayment,
  type HomeOfficeExpenseInput,
  type HomeOfficeMethod,
  type HomeOfficeProfile,
} from "./home-office";
import { TaxRules, seedRowsToRules } from "./tax-rules";

const rules = new TaxRules(seedRowsToRules());
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

// A 12 x 15 office (180 sq ft) in an 1,800 sq ft home = 10% business use,
// in use from March 10, 2026. Basis: 300,000 + 20,000 - 60,000 land =
// 260,000 (less than the 290,000 building value) -> 26,000 business basis.
const profile: HomeOfficeProfile = {
  officeSqFt: 180,
  homeSqFt: 1800,
  businessUseStart: d("2026-03-10"),
  ownership: "OWN",
  purchasePrice: 300000,
  landValue: 60000,
  improvementsCost: 20000,
  fairMarketValueAtStart: 350000,
};

const expenses2026: HomeOfficeExpenseInput[] = [
  // Full-year amounts, prorated 10/12 for Mar-Dec:
  { kind: "MORTGAGE_INTEREST", scope: "INDIRECT", period: "YEAR", date: d("2026-01-01"), amount: 12000 }, // 10,000 -> 1,000
  { kind: "REAL_ESTATE_TAX", scope: "INDIRECT", period: "YEAR", date: d("2026-01-01"), amount: 4800 }, // 4,000 -> 400
  { kind: "INSURANCE", scope: "INDIRECT", period: "YEAR", date: d("2026-01-01"), amount: 1200 }, // 1,000 -> 100
  // Monthly bills: February is before business use began and doesn't count.
  { kind: "UTILITIES", scope: "INDIRECT", period: "MONTH", date: d("2026-02-01"), amount: 300 },
  { kind: "UTILITIES", scope: "INDIRECT", period: "MONTH", date: d("2026-03-01"), amount: 300 },
  { kind: "UTILITIES", scope: "INDIRECT", period: "MONTH", date: d("2026-04-01"), amount: 300 }, // 600 -> 60
  // Direct: 100% deductible.
  { kind: "REPAIRS", scope: "DIRECT", period: "MONTH", date: d("2026-05-01"), amount: 250 },
];
// So 2026: tier one 1,400; operating 410; depreciation 527.78.
const DEP_2026 = 527.78; // 26,000 / 39 x 9.5/12
const DEP_FULL = 666.67; // 26,000 / 39

const noCarry = { operating: 0, depreciation: 0 };

describe("basics", () => {
  it("computes business-use percent from square footage", () => {
    expect(businessUsePercent(profile)).toBeCloseTo(0.1, 10);
    expect(businessUsePercent({ officeSqFt: 180, homeSqFt: null })).toBeNull();
  });

  it("only counts monthly bills from the month business use began", () => {
    expect(countableAmount(expenses2026[3], 2026, profile.businessUseStart)).toBe(0); // Feb
    expect(countableAmount(expenses2026[4], 2026, profile.businessUseStart)).toBe(300); // Mar
  });

  it("prorates a full-year amount by months in use", () => {
    expect(countableAmount(expenses2026[0], 2026, profile.businessUseStart)).toBeCloseTo(10000, 6);
  });

  it("counts nothing for a year before business use began", () => {
    expect(countableAmount({ ...expenses2026[0], date: d("2025-01-01") }, 2025, profile.businessUseStart)).toBe(0);
  });
});

describe("simplified method", () => {
  it("is $5 x sq ft x months in use / 12", () => {
    // Started Mar 10: 22 days of March used, so March counts -> 10 months.
    const r = computeSimplified({ profile, year: 2026, tentativeProfit: 50000, rules });
    expect(r.monthsInUse).toBe(10);
    expect(r.allowed).toBe(750); // 5 x 180 x 10/12
  });

  it("caps the office at 300 sq ft ($1,500 a year)", () => {
    const r = computeSimplified({
      profile: { ...profile, officeSqFt: 400, businessUseStart: d("2025-01-01") },
      year: 2026,
      tentativeProfit: 50000,
      rules,
    });
    expect(r.allowed).toBe(1500);
  });

  it("skips a month used for business fewer than 15 days", () => {
    expect(simplifiedMonthsInUse(2026, d("2026-03-20"))).toBe(9); // 12 days of March
    expect(simplifiedMonthsInUse(2026, d("2026-02-14"))).toBe(11); // exactly 15 days of February
    expect(simplifiedMonthsInUse(2026, null)).toBe(12);
  });

  it("is limited to business income, and the excess is lost (no carryover)", () => {
    const r = computeSimplified({ profile, year: 2026, tentativeProfit: 600, rules });
    expect(r.allowed).toBe(600);
    expect(r.lostToIncomeLimit).toBe(150);
    expect(computeSimplified({ profile, year: 2026, tentativeProfit: -4000, rules }).allowed).toBe(0);
  });
});

describe("depreciation", () => {
  it("uses the lesser of adjusted basis or market value, without land", () => {
    const b = depreciationBasis(profile)!;
    expect(b.adjustedBasis).toBe(260000);
    expect(b.fairMarketBuildingValue).toBe(290000);
    expect(b.businessBasis).toBe(26000);

    const lowerMarket = depreciationBasis({ ...profile, fairMarketValueAtStart: 250000 })!;
    expect(lowerMarket.basis).toBe(190000); // 250,000 - 60,000 land
  });

  it("doesn't depreciate a rented home", () => {
    expect(depreciationBasis({ ...profile, ownership: "RENT" })).toBeNull();
  });

  it("applies the mid-month convention in the first year", () => {
    const args = { businessBasis: 26000, start: d("2026-03-10"), recoveryYears: 39 };
    expect(depreciationForYear({ ...args, year: 2026 })).toBe(DEP_2026);
    expect(depreciationForYear({ ...args, year: 2027 })).toBe(DEP_FULL);
    expect(depreciationForYear({ ...args, year: 2025 })).toBe(0);
  });

  it("finishes exactly at the basis in year 40", () => {
    const args = { businessBasis: 39000, start: d("2000-01-15"), recoveryYears: 39 };
    let total = 0;
    for (let year = 2000; year <= 2045; year++) total += depreciationForYear({ ...args, year });
    expect(total).toBeCloseTo(39000, 1);
    expect(depreciationForYear({ ...args, year: 2039 })).toBe(41.67); // the leftover
    expect(depreciationForYear({ ...args, year: 2040 })).toBe(0);
  });

  it("estimates recapture at up to 25%", () => {
    expect(recaptureEstimate(1194.45, 2027, rules)).toBe(298.61);
  });
});

describe("regular method (Form 8829 ordering)", () => {
  const run = (tentativeProfit: number, carryIn = noCarry) =>
    computeRegular({ profile, expenses: expenses2026, year: 2026, tentativeProfit, carryIn, rules });

  it("allows everything in a profitable year", () => {
    const r = run(50000);
    expect(r.tierOne.businessShare).toBe(1400);
    expect(r.tierTwo.businessShare).toBe(410);
    expect(r.tierThree.depreciation).toBe(DEP_2026);
    expect(r.allowed).toBeCloseTo(1400 + 410 + DEP_2026, 6);
    expect(r.carryOut).toEqual(noCarry);
  });

  it("limits operating costs then depreciation to the income left, carrying the rest", () => {
    // 1,500 profit - 1,400 tier one = 100 left: 100 of 410 operating allowed.
    const r = run(1500);
    expect(r.afterTierOne).toBe(100);
    expect(r.tierTwo.allowed).toBe(100);
    expect(r.tierThree.allowed).toBe(0);
    expect(r.allowed).toBe(1500); // never more than the profit here
    expect(r.carryOut).toEqual({ operating: 310, depreciation: DEP_2026 });
  });

  it("still allows mortgage interest and taxes in a loss year", () => {
    const r = run(-8000);
    expect(r.incomeLimit).toBe(0);
    expect(r.allowed).toBe(1400);
    expect(r.carryOut).toEqual({ operating: 410, depreciation: DEP_2026 });
  });

  it("uses carried-over amounts first-come in their own tier", () => {
    const r = computeRegular({
      profile,
      expenses: [],
      year: 2027,
      tentativeProfit: 50000,
      carryIn: { operating: 310, depreciation: DEP_2026 },
      rules,
    });
    expect(r.tierTwo.allowed).toBe(310);
    expect(r.tierThree.allowed).toBeCloseTo(DEP_FULL + DEP_2026, 6);
    expect(r.carryOut).toEqual(noCarry);
  });
});

describe("multi-year chain", () => {
  const chain = (net: [number, number][], through: number, chosen: [number, HomeOfficeMethod][] = []) =>
    computeHomeOfficeChain({
      profile,
      expenses: expenses2026,
      netByYear: new Map(net),
      chosenMethods: new Map(chosen),
      throughYear: through,
      rules,
    });

  it("applies a loss year's carryover automatically in the next profitable year", () => {
    const [y26, y27] = chain([[2026, 1500], [2027, 50000]], 2027);
    expect(y26.method).toBe("REGULAR");
    expect(y26.carryOut).toEqual({ operating: 310, depreciation: DEP_2026 });
    expect(y27.carryIn).toEqual(y26.carryOut);
    expect(y27.allowed).toBeCloseTo(310 + DEP_FULL + DEP_2026, 6);
    expect(y27.carryOut).toEqual(noCarry);
    expect(y27.accumulatedDepreciation).toBeCloseTo(DEP_FULL + DEP_2026, 6);
  });

  it("keeps carrying across two loss years, then uses what it can", () => {
    const [y26, y27, y28] = chain([[2026, 0], [2027, 0], [2028, 1000]], 2028);
    expect(y26.carryOut).toEqual({ operating: 410, depreciation: DEP_2026 });
    // 2027: nothing earned, so nothing is used; depreciation keeps piling up.
    expect(y27.method).toBe("REGULAR"); // recommended because it preserves the carryover
    expect(y27.carryOut.operating).toBe(410);
    expect(y27.carryOut.depreciation).toBeCloseTo(DEP_2026 + DEP_FULL, 6);
    // 2028: 1,000 profit covers the 410 operating, then 590 of depreciation.
    expect(y28.allowed).toBe(1000);
    expect(y28.carryOut.operating).toBe(0);
    expect(y28.carryOut.depreciation).toBeCloseTo(DEP_2026 + DEP_FULL * 2 - 590, 6);
  });

  it("holds carryovers through a simplified year without using them", () => {
    const [, y27, y28] = chain([[2026, 0], [2027, 50000], [2028, 50000]], 2028, [[2027, "SIMPLIFIED"]]);
    expect(y27.method).toBe("SIMPLIFIED");
    expect(y27.methodWasChosen).toBe(true);
    expect(y27.allowed).toBe(900); // full year, 180 sq ft
    expect(y27.carryOut).toEqual({ operating: 410, depreciation: DEP_2026 });
    expect(y27.depreciationTaken).toBe(0);
    expect(y28.carryIn).toEqual({ operating: 410, depreciation: DEP_2026 });
    expect(y28.accumulatedDepreciation).toBeCloseTo(DEP_FULL + DEP_2026, 6);
  });

  it("recommends simplified when the actual costs are small", () => {
    const [y] = computeHomeOfficeChain({
      profile: { ...profile, ownership: "RENT" },
      expenses: [],
      netByYear: new Map([[2026, 50000]]),
      chosenMethods: new Map(),
      throughYear: 2026,
      rules,
    });
    expect(y.recommended).toBe("SIMPLIFIED");
    expect(y.allowed).toBe(750);
    expect(y.recommendationReason).toMatch(/simplified method deducts \$750 more/);
  });

  it("recommends regular when it deducts more, and says by how much", () => {
    const [y] = chain([[2026, 50000]], 2026);
    expect(y.recommended).toBe("REGULAR");
    expect(y.recommendationReason).toMatch(/\$1,588 more/); // 2,337.78 - 750
  });
});

describe("splitMortgagePayment", () => {
  it("splits the first payment of a 30-year loan", () => {
    // 300,000 at 6%: payment 1,798.65; first month's interest 1,500.
    const r = splitMortgagePayment({
      loanAmount: 300000,
      annualRatePercent: 6,
      termMonths: 360,
      paymentNumber: 1,
      annualPropertyTax: 4800,
      annualInsurance: 1200,
    });
    expect(r.interest).toBe(1500);
    expect(r.principal).toBe(298.65);
    expect(r.tax).toBe(400);
    expect(r.insurance).toBe(100);
    expect(r.total).toBe(2298.65);
  });

  it("shifts toward principal later in the loan", () => {
    const base = { loanAmount: 300000, annualRatePercent: 6, termMonths: 360, annualPropertyTax: 0, annualInsurance: 0 };
    const late = splitMortgagePayment({ ...base, paymentNumber: 300 });
    expect(late.principal).toBeGreaterThan(late.interest);
    expect(late.principal + late.interest).toBeCloseTo(1798.65, 1);
  });
});

describe("mortgageInterestForYear", () => {
  const loan = { loanAmount: 300000, annualRatePercent: 6, termMonths: 360 };

  it("adds up the year's twelve interest payments", () => {
    // Closed form: 12 x 1,798.65 paid, balance falls to ~296,315.5 -> ~17,899 interest.
    const r = mortgageInterestForYear({ ...loan, firstPaymentMonth: d("2026-01-01"), year: 2026 });
    expect(r).toBeGreaterThan(17895);
    expect(r).toBeLessThan(17905);
  });

  it("counts only the payments made in that year", () => {
    // First payment in October: Oct, Nov, Dec ~ 1,500 + 1,498.51 + 1,497.01
    const r = mortgageInterestForYear({ ...loan, firstPaymentMonth: d("2026-10-01"), year: 2026 });
    expect(r).toBeCloseTo(4495.52, 0);
    expect(mortgageInterestForYear({ ...loan, firstPaymentMonth: d("2026-10-01"), year: 2025 })).toBe(0);
  });
});
