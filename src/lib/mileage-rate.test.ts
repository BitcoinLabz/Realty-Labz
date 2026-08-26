import { describe, expect, it } from "vitest";
import { calculateMileageDeduction, formatMileageRate, selectRateForDate } from "./mileage-rate";

describe("calculateMileageDeduction", () => {
  it("computes miles x rate for a business trip", () => {
    expect(calculateMileageDeduction(100, 0.725, true)).toBeCloseTo(72.5, 5);
  });

  it("is never deductible for a personal trip, regardless of rate", () => {
    expect(calculateMileageDeduction(100, 0.725, false)).toBe(0);
  });

  it("is 0 for a 0-mile trip", () => {
    expect(calculateMileageDeduction(0, 0.725, true)).toBe(0);
  });
});

// The real IRS history this app ships with: 0.725 from the start of 2026,
// raised to 0.760 on July 1st.
const RATES = [
  { effectiveFrom: new Date(Date.UTC(2026, 0, 1)), ratePerMile: 0.725 },
  { effectiveFrom: new Date(Date.UTC(2026, 6, 1)), ratePerMile: 0.76 },
];

// Trip dates are stored as UTC midnight (see the create action), so tests
// construct them the same way.
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("selectRateForDate", () => {
  it("uses the old rate for a trip before the change", () => {
    expect(selectRateForDate(RATES, utc(2026, 3, 15))).toBe(0.725);
  });

  it("uses the new rate for a trip after the change", () => {
    expect(selectRateForDate(RATES, utc(2026, 9, 2))).toBe(0.76);
  });

  // The boundary is the whole point of this feature: June 30 must stay on the
  // old rate and July 1 must take the new one, or a day's trips are misvalued
  // on a tax document.
  it("uses the old rate on the last day before the change", () => {
    expect(selectRateForDate(RATES, utc(2026, 6, 30))).toBe(0.725);
  });

  it("uses the new rate on the exact changeover date", () => {
    expect(selectRateForDate(RATES, utc(2026, 7, 1))).toBe(0.76);
  });

  it("keeps applying the newest rate to future trips, with no new config", () => {
    expect(selectRateForDate(RATES, utc(2029, 5, 20))).toBe(0.76);
  });

  it("falls back to the earliest rate for a trip predating every rate", () => {
    expect(selectRateForDate(RATES, utc(2019, 4, 10))).toBe(0.725);
  });

  it("does not depend on the order rows come back from the database", () => {
    const reversed = [...RATES].reverse();
    expect(selectRateForDate(reversed, utc(2026, 7, 1))).toBe(0.76);
    expect(selectRateForDate(reversed, utc(2026, 6, 30))).toBe(0.725);
  });

  it("handles a third, later rate without any code change", () => {
    const withFutureRate = [
      ...RATES,
      { effectiveFrom: new Date(Date.UTC(2027, 0, 1)), ratePerMile: 0.8 },
    ];
    expect(selectRateForDate(withFutureRate, utc(2026, 12, 31))).toBe(0.76);
    expect(selectRateForDate(withFutureRate, utc(2027, 1, 1))).toBe(0.8);
  });

  it("returns null when no rates are configured at all", () => {
    expect(selectRateForDate([], utc(2026, 7, 1))).toBeNull();
  });
});

describe("end-to-end deduction across the rate change", () => {
  it("values identical trips differently either side of July 1", () => {
    const june = selectRateForDate(RATES, utc(2026, 6, 30))!;
    const july = selectRateForDate(RATES, utc(2026, 7, 1))!;

    expect(calculateMileageDeduction(200, june, true)).toBeCloseTo(145, 5);
    expect(calculateMileageDeduction(200, july, true)).toBeCloseTo(152, 5);
  });
});

describe("formatMileageRate", () => {
  it("shows three decimals so 0.725 isn't rounded to 0.73", () => {
    expect(formatMileageRate(0.725)).toBe("$0.725/mi");
  });

  it("pads a shorter rate to the same shape", () => {
    expect(formatMileageRate(0.76)).toBe("$0.760/mi");
  });
});
