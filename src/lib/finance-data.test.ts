import { describe, expect, it } from "vitest";
import { calculateBudgetPercentUsed, calculateNetCommission, getHomeOfficeDeduction } from "./finance-data";

describe("getHomeOfficeDeduction (IRS Simplified method)", () => {
  it("computes $5/sq ft under the cap", () => {
    expect(getHomeOfficeDeduction(150)).toBe(750);
  });

  it("caps at 300 sq ft ($1,500 max)", () => {
    expect(getHomeOfficeDeduction(400)).toBe(1500);
  });

  it("returns 0 for null/undefined", () => {
    expect(getHomeOfficeDeduction(null)).toBe(0);
    expect(getHomeOfficeDeduction(undefined)).toBe(0);
  });

  it("returns 0 for 0 sq ft", () => {
    expect(getHomeOfficeDeduction(0)).toBe(0);
  });
});

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

describe("calculateBudgetPercentUsed", () => {
  it("computes a normal percentage", () => {
    expect(calculateBudgetPercentUsed(450, 500)).toBe(90);
  });

  it("can exceed 100% when over budget", () => {
    expect(calculateBudgetPercentUsed(600, 500)).toBe(120);
  });

  it("returns 0 when nothing has been spent", () => {
    expect(calculateBudgetPercentUsed(0, 500)).toBe(0);
  });

  it("returns 0 (not Infinity/NaN) for a 0 limit", () => {
    expect(calculateBudgetPercentUsed(100, 0)).toBe(0);
  });
});
