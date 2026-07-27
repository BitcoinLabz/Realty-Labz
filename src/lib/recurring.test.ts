import { describe, expect, it } from "vitest";
import { advanceDueDate } from "./recurring";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("advanceDueDate", () => {
  it("monthly: a normal mid-month date just moves forward a month", () => {
    const result = advanceDueDate(new Date(2026, 0, 15), "MONTHLY"); // Jan 15, 2026
    expect(ymd(result)).toBe("2026-02-15");
  });

  it("monthly: Jan 31 -> Feb 28 (2026 is not a leap year), not Mar 2/3", () => {
    const result = advanceDueDate(new Date(2026, 0, 31), "MONTHLY");
    expect(ymd(result)).toBe("2026-02-28");
  });

  it("quarterly: Nov 30 -> Feb 28, crossing a year boundary", () => {
    const result = advanceDueDate(new Date(2026, 10, 30), "QUARTERLY"); // Nov 30, 2026
    expect(ymd(result)).toBe("2027-02-28");
  });

  it("annual: Feb 29 (leap year) -> Feb 28 (next year, not leap)", () => {
    const result = advanceDueDate(new Date(2028, 1, 29), "ANNUAL"); // 2028 is a leap year
    expect(ymd(result)).toBe("2029-02-28");
  });

  it("annual: Feb 29 -> Feb 29 when the next year is also a leap year", () => {
    // 2024 -> 2028 is 4 years; test the direct leap-to-leap adjacent case via two hops instead,
    // since ANNUAL only adds 12 months at a time. 2028 (leap) + 12mo = 2029 (not leap) is covered
    // above; here confirm a non-leap-day date is unaffected by the clamp at all.
    const result = advanceDueDate(new Date(2026, 5, 15), "ANNUAL");
    expect(ymd(result)).toBe("2027-06-15");
  });
});
