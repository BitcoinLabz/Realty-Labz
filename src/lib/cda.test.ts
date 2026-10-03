import { describe, expect, it } from "vitest";
import { computeCdaLines } from "./cda";

const sum = (l: ReturnType<typeof computeCdaLines>) =>
  Math.round((l.brokerage + l.referral + l.team + l.other + l.agentNet) * 100) / 100;

describe("computeCdaLines", () => {
  it("splits a simple commission", () => {
    expect(computeCdaLines(10000, { brokerageSplitPercent: 30, referralFeePercent: 25 })).toEqual({
      gross: 10000,
      brokerage: 3000,
      referral: 2500,
      team: 0,
      other: 0,
      agentNet: 4500,
    });
  });

  it("always adds back up to the gross, to the cent, even with awkward percentages", () => {
    const lines = computeCdaLines(8333.33, {
      brokerageSplitPercent: 33.33,
      referralFeePercent: 12.5,
      teamSplitPercent: 7.77,
      otherDeductionsPercent: 1.11,
    });
    expect(sum(lines)).toBe(8333.33);
  });

  it("gives the agent everything when there are no splits", () => {
    expect(computeCdaLines(7500, {}).agentNet).toBe(7500);
  });

  it("shows a negative agent net rather than hiding over-allocated splits", () => {
    expect(computeCdaLines(1000, { brokerageSplitPercent: 80, referralFeePercent: 30 }).agentNet).toBe(-100);
  });
});
