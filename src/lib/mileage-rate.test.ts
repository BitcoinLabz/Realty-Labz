import { describe, expect, it } from "vitest";
import { calculateMileageDeduction } from "./mileage-rate";

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
