import { describe, expect, it } from "vitest";
import { calculateCommissionAmount, calculateNetCommission } from "./commission";

describe("calculateNetCommission", () => {
  // The exact case that exposed the old mixed-units bug: 40% brokerage plus
  // 20% team on a $12,000 commission. When team split was a dollar field the
  // 20 was subtracted as $20, giving a plausible-looking $7,180 instead of
  // $4,800 -- wrong by $2,380 with nothing on screen to contradict it.
  it("treats every split as a percentage of the gross", () => {
    const net = calculateNetCommission(12000, {
      brokerageSplitPercent: 40,
      teamSplitPercent: 20,
    });
    expect(net).toBe(4800);
  });

  it("applies all four splits together", () => {
    // 30 + 5 + 3 + 2 = 40% of $10,000 -> keeps $6,000
    const net = calculateNetCommission(10000, {
      brokerageSplitPercent: 30,
      referralFeePercent: 5,
      teamSplitPercent: 3,
      otherDeductionsPercent: 2,
    });
    expect(net).toBe(6000);
  });

  it("defaults every missing split field to 0", () => {
    expect(calculateNetCommission(5000, {})).toBe(5000);
  });

  it("treats null the same as absent", () => {
    const net = calculateNetCommission(8000, {
      brokerageSplitPercent: 0,
      referralFeePercent: 10,
      teamSplitPercent: null,
      otherDeductionsPercent: null,
    });
    expect(net).toBe(7200);
  });

  it("keeps the whole commission when every split is zero", () => {
    const net = calculateNetCommission(9000, {
      brokerageSplitPercent: 0,
      referralFeePercent: 0,
      teamSplitPercent: 0,
      otherDeductionsPercent: 0,
    });
    expect(net).toBe(9000);
  });

  // Not clamped on purpose -- the form surfaces this as a warning rather than
  // hiding it behind a silent floor at zero.
  it("goes negative when the splits exceed 100%", () => {
    const net = calculateNetCommission(10000, {
      brokerageSplitPercent: 80,
      teamSplitPercent: 30,
    });
    expect(net).toBe(-1000);
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
