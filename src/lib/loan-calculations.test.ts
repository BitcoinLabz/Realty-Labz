import { describe, expect, it } from "vitest";
import { buildAmortizationSchedule, monthlyPayment, scheduleAtDate } from "./loan-calculations";

describe("monthlyPayment", () => {
  it("for 0% interest, is simply principal / term (no compounding to apply)", () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });

  it("for a real rate, matches the standard fixed-rate amortization formula", () => {
    // $300,000 at 6.5% for 30 years is a well-known reference figure
    // (~$1,896.20/mo) -- also independently derivable via the standard
    // M = P*r*(1+r)^n / ((1+r)^n - 1) formula, which is exactly what this
    // function implements.
    expect(monthlyPayment(300000, 6.5, 360)).toBeCloseTo(1896.2, 1);
  });
});

describe("buildAmortizationSchedule", () => {
  it("fully pays off a 0% loan in exactly termMonths, with equal principal every month", () => {
    const schedule = buildAmortizationSchedule(1200, 0, 12, new Date(2026, 0, 1));
    const last = schedule[schedule.length - 1];
    expect(last.monthIndex).toBe(12);
    expect(last.balance).toBeCloseTo(0, 2);
    expect(schedule[1].principalPaid).toBeCloseTo(100, 2);
  });

  it("the sum of every month's principal + extra payments equals the original loan amount", () => {
    const loanAmount = 300000;
    const schedule = buildAmortizationSchedule(loanAmount, 6.5, 360, new Date(2020, 0, 1));
    const totalPrincipalPaid = schedule.reduce((sum, p) => sum + p.principalPaid + p.extraPaid, 0);
    expect(totalPrincipalPaid).toBeCloseTo(loanAmount, 0);
  });

  it("an extra payment pulls the payoff date earlier without changing the required monthly payment", () => {
    const start = new Date(2020, 0, 1);
    const withoutExtra = buildAmortizationSchedule(300000, 6.5, 360, start);
    const withExtra = buildAmortizationSchedule(300000, 6.5, 360, start, [
      { date: new Date(2020, 6, 1), amount: 50000 },
    ]);
    expect(withExtra[withExtra.length - 1].monthIndex).toBeLessThan(
      withoutExtra[withoutExtra.length - 1].monthIndex,
    );
    // The scheduled P&I payment itself is unaffected by an extra payment --
    // only the balance (and therefore payoff date) changes.
    expect(withExtra[1].principalPaid + withExtra[1].interestPaid).toBeCloseTo(
      withoutExtra[1].principalPaid + withoutExtra[1].interestPaid,
      2,
    );
  });
});

describe("scheduleAtDate", () => {
  it("returns the most recent schedule point not after the given date", () => {
    const schedule = buildAmortizationSchedule(1200, 0, 12, new Date(2026, 0, 1));
    const point = scheduleAtDate(schedule, new Date(2026, 5, 15)); // mid-June, between month 5 and 6
    expect(point.monthIndex).toBe(5);
  });

  it("returns the origination point for a date before the loan started", () => {
    const schedule = buildAmortizationSchedule(1200, 0, 12, new Date(2026, 0, 1));
    const point = scheduleAtDate(schedule, new Date(2025, 0, 1));
    expect(point.monthIndex).toBe(0);
    expect(point.balance).toBe(1200);
  });
});
