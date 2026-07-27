import { describe, expect, it } from "vitest";
import { estimateQuarterlyTax } from "./estimated-tax";

// Avoids toISOString() on a local-time Date, which shifts the calendar day
// in timezones ahead of UTC (e.g. local midnight in UTC+9 is still the
// previous day in UTC) -- comparing local y/m/d fields directly is
// timezone-independent, unlike the ISO-string round-trip.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("estimateQuarterlyTax", () => {
  it("computes SE tax (15.3%) + user's income tax rate, split into 4 equal quarters", () => {
    // $40,000 net business income, 15% estimated income tax rate:
    // SE tax = 40000 * 0.153 = 6120
    // income tax = 40000 * 0.15 = 6000
    // total = 12120, per quarter = 3030
    const result = estimateQuarterlyTax(40000, 15, 2026);
    expect(result.selfEmploymentTax).toBeCloseTo(6120, 5);
    expect(result.incomeTax).toBeCloseTo(6000, 5);
    expect(result.totalEstimated).toBeCloseTo(12120, 5);
    expect(result.perQuarter).toBeCloseTo(3030, 5);
  });

  it("produces 4 quarters with the standard IRS due dates", () => {
    const result = estimateQuarterlyTax(10000, 10, 2026);
    expect(result.quarters).toHaveLength(4);
    expect(ymd(result.quarters[0].dueDate)).toBe("2026-04-15");
    expect(ymd(result.quarters[1].dueDate)).toBe("2026-06-15");
    expect(ymd(result.quarters[2].dueDate)).toBe("2026-09-15");
    // Q4's due date is Jan 15 of the FOLLOWING year, not the same year.
    expect(ymd(result.quarters[3].dueDate)).toBe("2027-01-15");
  });

  it("clamps a net loss to $0 estimated tax rather than a negative figure", () => {
    const result = estimateQuarterlyTax(-5000, 15, 2026);
    expect(result.totalEstimated).toBe(0);
    expect(result.selfEmploymentTax).toBe(0);
    expect(result.incomeTax).toBe(0);
  });
});
