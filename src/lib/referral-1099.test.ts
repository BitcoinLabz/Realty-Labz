import { describe, expect, it } from "vitest";
import { needs1099, referralTotalsForYear, reportingThreshold } from "./referral-1099";

const closed = (partner: string | null, date: string | null, gross: number, pct: number) => ({
  referralPartnerId: partner,
  closingDate: date ? new Date(`${date}T00:00:00.000Z`) : null,
  commissionAmount: gross,
  referralFeePercent: pct,
});

describe("referralTotalsForYear", () => {
  it("adds up each partner's fees from deals that closed that year", () => {
    const totals = referralTotalsForYear(
      [
        closed("a", "2026-03-01", 10000, 25),
        closed("a", "2026-11-15", 8000, 25),
        closed("b", "2026-05-01", 6000, 30),
      ],
      2026,
    );
    expect(totals.get("a")).toBe(4500);
    expect(totals.get("b")).toBe(1800);
  });

  it("counts a deal in the year it closed, not another", () => {
    const totals = referralTotalsForYear([closed("a", "2025-12-31", 10000, 25)], 2026);
    expect(totals.has("a")).toBe(false);
  });

  it("ignores deals with no partner, no closing date, or no fee", () => {
    const totals = referralTotalsForYear(
      [closed(null, "2026-01-01", 10000, 25), closed("a", null, 10000, 25), closed("a", "2026-01-01", 10000, 0)],
      2026,
    );
    expect(totals.size).toBe(0);
  });

  it("stays exact to the cent", () => {
    const totals = referralTotalsForYear(
      [closed("a", "2026-01-01", 3333.33, 33.33), closed("a", "2026-02-01", 3333.33, 33.33)],
      2026,
    );
    expect(totals.get("a")).toBe(2222.0);
  });
});

describe("1099 threshold", () => {
  it("is $600 through 2025 and $2,000 from 2026", () => {
    expect(reportingThreshold(2025)).toBe(600);
    expect(reportingThreshold(2026)).toBe(2000);
  });
  it("flags totals at or over the year's threshold", () => {
    expect(needs1099(2000, 2026)).toBe(true);
    expect(needs1099(1999.99, 2026)).toBe(false);
    expect(needs1099(600, 2025)).toBe(true);
  });
});
