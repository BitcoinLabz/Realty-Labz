import { describe, expect, it } from "vitest";
import { calculateCommissionAmount, calculateNetCommission } from "./commission";

describe("calculateNetCommission", () => {
  it("applies brokerage split, referral fee, team split, and other deductions together", () => {
    // $10,000 gross, 30% brokerage split ($3,000), $500 referral, $300 team
    // split, $0 other -> 10000 - 3000 - 500 - 300 = 6200
    const net = calculateNetCommission(10000, {
      brokerageSplitPercent: 30,
      referralFeeAmount: 500,
      teamSplitAmount: 300,
      otherDeductions: 0,
    });
    expect(net).toBe(6200);
  });

  it("defaults every missing split field to 0", () => {
    expect(calculateNetCommission(5000, {})).toBe(5000);
  });

  it("handles a 0% brokerage split (agent keeps everything before other deductions)", () => {
    const net = calculateNetCommission(8000, {
      brokerageSplitPercent: 0,
      referralFeeAmount: 200,
      teamSplitAmount: null,
      otherDeductions: null,
    });
    expect(net).toBe(7800);
  });
});

describe("calculateCommissionAmount", () => {
  it("computes a standard percentage of a sale price", () => {
    expect(calculateCommissionAmount(300000, 3)).toBe(9000);
  });

  it("handles a fractional rate", () => {
    expect(calculateCommissionAmount(285000, 2.5)).toBe(7125);
  });

  it("rounds to whole cents rather than leaving float noise", () => {
    // 333333 * 0.0325 = 10833.3225 in exact math, and floating point makes it
    // messier still -- a tax figure must not carry that through.
    expect(calculateCommissionAmount(333333, 3.25)).toBe(10833.32);
  });

  it("returns null when either input is missing", () => {
    expect(calculateCommissionAmount(null, 3)).toBeNull();
    expect(calculateCommissionAmount(300000, null)).toBeNull();
    expect(calculateCommissionAmount(undefined, undefined)).toBeNull();
  });

  // Null rather than 0: a confident "$0.00" suggestion would look like a real
  // answer when the agent simply hasn't filled the fields in.
  it("returns null for a zero or negative rate", () => {
    expect(calculateCommissionAmount(300000, 0)).toBeNull();
    expect(calculateCommissionAmount(300000, -3)).toBeNull();
  });

  it("returns null for a zero or negative price", () => {
    expect(calculateCommissionAmount(0, 3)).toBeNull();
    expect(calculateCommissionAmount(-300000, 3)).toBeNull();
  });

  it("returns null for NaN, which is what an empty number input coerces to", () => {
    expect(calculateCommissionAmount(Number("") || null, 3)).toBeNull();
    expect(calculateCommissionAmount(NaN, 3)).toBeNull();
  });
});
