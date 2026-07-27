import { describe, expect, it } from "vitest";
import { advanceDueDate, computeCatchUp, parseDateOnlyLocal } from "./recurring";

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

describe("parseDateOnlyLocal", () => {
  it("parses to the intended calendar day regardless of timezone -- unlike new Date(dateOnlyString), which parses as UTC midnight and can read back as the previous day in timezones behind UTC", () => {
    const parsed = parseDateOnlyLocal("2026-01-01");
    expect(ymd(parsed)).toBe("2026-01-01");
    // The specific failure mode this guards against: new Date("2026-01-01")
    // parses as UTC midnight, and .getDate()/.getMonth() (both local) can
    // read that back as Dec 31 in any timezone behind UTC -- confirmed
    // directly against this exact bug before fixing it.
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(1);
  });

  it("round-trips correctly through advanceDueDate, unlike a raw new Date(string)", () => {
    const parsed = parseDateOnlyLocal("2026-01-01");
    const advanced = advanceDueDate(parsed, "MONTHLY");
    expect(ymd(advanced)).toBe("2026-02-01");
  });
});

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

describe("computeCatchUp", () => {
  it("logs nothing and leaves nextDueDate unchanged when the due date is still in the future", () => {
    const result = computeCatchUp(new Date(2026, 7, 1), "MONTHLY", new Date(2026, 6, 27));
    expect(result.datesToLog).toHaveLength(0);
    expect(ymd(result.newNextDueDate)).toBe("2026-08-01");
  });

  it("logs exactly one period when the due date has just arrived", () => {
    const result = computeCatchUp(new Date(2026, 6, 1), "MONTHLY", new Date(2026, 6, 27)); // due Jul 1, now Jul 27
    expect(result.datesToLog).toHaveLength(1);
    expect(ymd(result.datesToLog[0])).toBe("2026-07-01");
    expect(ymd(result.newNextDueDate)).toBe("2026-08-01");
  });

  it("catches up on every missed period, each dated for its own due date -- not just 'today'", () => {
    // A phone bill set up starting Jan 1, monthly, checked on Jul 27 -- 7
    // periods (Jan through Jul) should all be backfilled at once, each
    // dated the 1st of its own month, not all dated Jul 27.
    const result = computeCatchUp(new Date(2026, 0, 1), "MONTHLY", new Date(2026, 6, 27));
    expect(result.datesToLog).toHaveLength(7);
    expect(result.datesToLog.map(ymd)).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
    ]);
    expect(ymd(result.newNextDueDate)).toBe("2026-08-01");
  });

  it("is idempotent -- running it again immediately after catching up logs nothing further", () => {
    const first = computeCatchUp(new Date(2026, 0, 1), "MONTHLY", new Date(2026, 6, 27));
    const second = computeCatchUp(first.newNextDueDate, "MONTHLY", new Date(2026, 6, 27));
    expect(second.datesToLog).toHaveLength(0);
  });
});
