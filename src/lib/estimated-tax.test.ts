import { describe, expect, it } from "vitest";
import {
  estimateTaxes,
  hobbyLossCheck,
  michiganCityTax,
  selfEmploymentTax,
  taxSetAside,
  upcomingQuarterlyPayment,
} from "./estimated-tax";
import { TaxRules, seedRowsToRules } from "./tax-rules";

const rules = new TaxRules(seedRowsToRules());

// Avoids toISOString() on a local-time Date, which shifts the calendar day
// in timezones ahead of UTC -- comparing local y/m/d fields directly is
// timezone-independent.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("selfEmploymentTax", () => {
  it("taxes 92.35% of profit at 12.4% + 2.9%", () => {
    // 40,000 x 0.9235 = 36,940; SS 4,580.56; Medicare 1,071.26
    const se = selfEmploymentTax(40000, 2026, rules);
    expect(se.netEarnings).toBeCloseTo(36940, 6);
    expect(se.socialSecurity).toBeCloseTo(4580.56, 6);
    expect(se.medicare).toBeCloseTo(1071.26, 6);
    expect(se.total).toBeCloseTo(5651.82, 6);
    expect(se.deductibleHalf).toBeCloseTo(2825.91, 6);
  });

  it("stops Social Security at the year's wage base but keeps Medicare", () => {
    // 300,000 x 0.9235 = 277,050. SS capped: 184,500 x 0.124 = 22,878.
    const se = selfEmploymentTax(300000, 2026, rules);
    expect(se.socialSecurity).toBeCloseTo(22878, 6);
    expect(se.medicare).toBeCloseTo(8034.45, 6);
  });

  it("uses the wage base for the year asked about", () => {
    // 2025 base 176,100 x 0.124 = 21,836.40
    expect(selfEmploymentTax(300000, 2025, rules).socialSecurity).toBeCloseTo(21836.4, 6);
  });

  it("owes nothing under $400 of net earnings, or on a loss", () => {
    expect(selfEmploymentTax(400, 2026, rules).total).toBe(0); // 369.40 net earnings
    expect(selfEmploymentTax(-5000, 2026, rules).total).toBe(0);
  });
});

describe("estimateTaxes", () => {
  it("adds federal (own rate), Michigan, and SE tax on $40,000", () => {
    // After half-SE: 40,000 - 2,825.91 = 37,174.09
    // Federal 12%: 4,460.8908
    // Michigan: (37,174.09 - 5,800) x 4.25% = 1,333.398825
    // Total: 5,651.82 + 4,460.8908 + 1,333.398825 = 11,446.109625
    const r = estimateTaxes({ netBusinessIncome: 40000, year: 2026, federalRatePercent: 12, rules });
    expect(r.federalIncomeTax).toBeCloseTo(4460.8908, 6);
    expect(r.michiganIncomeTax).toBeCloseTo(1333.398825, 6);
    expect(r.cityIncomeTax).toBe(0);
    expect(r.totalEstimated).toBeCloseTo(11446.109625, 6);
    expect(r.perQuarter).toBeCloseTo(11446.109625 / 4, 6);
  });

  it("still estimates SE and Michigan tax when no federal rate is set", () => {
    const r = estimateTaxes({ netBusinessIncome: 40000, year: 2026, federalRatePercent: null, rules });
    expect(r.federalIncomeTax).toBeNull();
    expect(r.totalEstimated).toBeCloseTo(5651.82 + 1333.398825, 6);
  });

  it("produces 4 quarters with the standard IRS due dates", () => {
    const r = estimateTaxes({ netBusinessIncome: 10000, year: 2026, federalRatePercent: 10, rules });
    expect(r.quarters.map((q) => ymd(q.dueDate))).toEqual([
      "2026-04-15",
      "2026-06-15",
      "2026-09-15",
      "2027-01-15", // Q4 falls in the FOLLOWING year
    ]);
  });

  it("is zero across the board in a loss year", () => {
    const r = estimateTaxes({
      netBusinessIncome: -5000,
      year: 2026,
      federalRatePercent: 15,
      residenceCity: "DETROIT",
      rules,
    });
    expect(r.totalEstimated).toBe(0);
  });

  it("doesn't charge Michigan tax below the personal exemption", () => {
    // 5,000 profit: SE 706.4775, half 353.23875 -> 4,646.76 < 5,800
    const r = estimateTaxes({ netBusinessIncome: 5000, year: 2026, federalRatePercent: null, rules });
    expect(r.michiganIncomeTax).toBe(0);
  });
});

describe("michiganCityTax", () => {
  const base = 37174.09;

  it("charges a resident their own city's rate", () => {
    const r = michiganCityTax({ base, year: 2026, residenceCity: "DETROIT", workCity: null, rules });
    expect(r.amount).toBeCloseTo(892.17816, 6);
    expect(r.label).toBe("Detroit");
  });

  it("charges only the resident rate when home and office are the same city", () => {
    const r = michiganCityTax({ base, year: 2026, residenceCity: "DETROIT", workCity: "DETROIT", rules });
    expect(r.amount).toBeCloseTo(892.17816, 6);
  });

  it("charges a nonresident the work city's nonresident rate", () => {
    const r = michiganCityTax({ base, year: 2026, residenceCity: null, workCity: "DETROIT", rules });
    expect(r.amount).toBeCloseTo(446.08908, 6);
    expect(r.label).toBe("Detroit");
  });

  it("credits tax paid to the work city, capped at the home city's nonresident rate", () => {
    // Live Lansing (1% / 0.5%), office in Detroit (1.2% nonresident):
    // work 446.08908; home 371.7409 - min(446.08908, 185.87045) = 185.87045
    const r = michiganCityTax({ base, year: 2026, residenceCity: "LANSING", workCity: "DETROIT", rules });
    expect(r.amount).toBeCloseTo(631.95953, 5);
    expect(r.label).toBe("Lansing + Detroit");
  });

  it("is zero for a city with no income tax, or no income", () => {
    expect(michiganCityTax({ base, year: 2026, residenceCity: null, workCity: null, rules }).amount).toBe(0);
    expect(michiganCityTax({ base: 0, year: 2026, residenceCity: "DETROIT", workCity: null, rules }).amount).toBe(0);
  });
});

describe("taxSetAside", () => {
  it("applies the marginal SE + federal + Michigan rate", () => {
    // SE 0.9235 x 0.153 = 0.1412955; after half-SE 0.92935225
    // income 22% + 4.25% = 0.2625 -> 0.1412955 + 0.243954965625 = 0.385250465625
    expect(taxSetAside({ netCommission: 10000, year: 2026, federalRatePercent: 22, rules })).toBe(3853);
  });
  it("counts SE and Michigan only when no federal rate is set", () => {
    // 0.1412955 + 0.92935225 x 0.0425 = 0.180792970625
    expect(taxSetAside({ netCommission: 10000, year: 2026, federalRatePercent: null, rules })).toBe(1808);
  });
  it("adds city tax", () => {
    // + 0.92935225 x 0.024 = 0.022304454 -> 0.203097424625
    expect(
      taxSetAside({ netCommission: 10000, year: 2026, federalRatePercent: null, residenceCity: "DETROIT", rules }),
    ).toBe(2031);
  });
  it("is zero for a non-positive commission", () => {
    expect(taxSetAside({ netCommission: 0, year: 2026, federalRatePercent: 22, rules })).toBe(0);
    expect(taxSetAside({ netCommission: -500, year: 2026, federalRatePercent: 22, rules })).toBe(0);
  });
});

describe("hobbyLossCheck", () => {
  const check = (entries: [number, number][]) =>
    hobbyLossCheck({ netByYear: new Map(entries), currentYear: 2026, rules });

  it("is ok with profit in 3 of the last 5 years", () => {
    const r = check([[2022, -1000], [2023, -500], [2024, 100], [2025, 200], [2026, 300]]);
    expect(r.status).toBe("ok");
    expect(r.profitYears).toBe(3);
  });

  it("is at risk once 3 of 5 years are losses", () => {
    const r = check([[2022, -1000], [2023, -500], [2024, -1], [2025, 200]]);
    expect(r.status).toBe("atRisk");
  });

  it("is worth watching with a loss but the threshold still reachable", () => {
    expect(check([[2026, -2000]]).status).toBe("watch");
  });

  it("treats years with no records as unknown, not losses", () => {
    const r = check([]);
    expect(r.status).toBe("ok");
    expect(r.years.map((y) => y.year)).toEqual([2022, 2023, 2024, 2025, 2026]);
    expect(r.years.every((y) => y.net === null)).toBe(true);
  });
});

describe("upcomingQuarterlyPayment", () => {
  it("finds a payment due within two weeks", () => {
    const r = upcomingQuarterlyPayment(new Date(2026, 3, 5)); // Apr 5
    expect(r?.label).toBe("Q1");
    expect(r?.taxYear).toBe(2026);
    expect(r?.daysAway).toBe(10);
  });

  it("counts the due date itself", () => {
    expect(upcomingQuarterlyPayment(new Date(2026, 5, 15))?.daysAway).toBe(0);
  });

  it("finds last year's Q4 in early January", () => {
    const r = upcomingQuarterlyPayment(new Date(2027, 0, 3));
    expect(r?.label).toBe("Q4");
    expect(r?.taxYear).toBe(2026);
  });

  it("is quiet when nothing is due soon", () => {
    expect(upcomingQuarterlyPayment(new Date(2026, 6, 20))).toBeNull();
    expect(upcomingQuarterlyPayment(new Date(2026, 3, 16))).toBeNull(); // the day after
  });
});
