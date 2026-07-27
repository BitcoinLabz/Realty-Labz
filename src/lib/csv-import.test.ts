import { describe, expect, it } from "vitest";
import { isDuplicateRow, parseCsv, toTransactionInput } from "./csv-import";

describe("parseCsv", () => {
  it("parses a single signed-amount column, quoted description with an embedded comma", () => {
    const csv = 'Date,Description,Amount\n2026-01-05,"MLS Dues, Annual",-150.00\n2026-01-10,Commission Payout,2500.00\n';
    const result = parseCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ date: "2026-01-05", description: "MLS Dues, Annual", amount: -150 });
    expect(result.rows[1]).toEqual({ date: "2026-01-10", description: "Commission Payout", amount: 2500 });
  });

  it("parses separate Debit/Credit columns (debit = expense, credit = income)", () => {
    const csv = "Date,Description,Debit,Credit\n2026-02-01,Office Depot,45.00,\n2026-02-03,Client Payment,,1200.00\n";
    const result = parseCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].amount).toBe(-45);
    expect(result.rows[1].amount).toBe(1200);
  });

  it("handles accounting-style parenthesized negatives and currency symbols", () => {
    const csv = "Date,Description,Amount\n2026-03-01,Refund Fee,\"($25.50)\"\n2026-03-02,Deposit,\"$1,000.00\"\n";
    const result = parseCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].amount).toBe(-25.5);
    expect(result.rows[1].amount).toBe(1000);
  });

  it("fails clearly when no date column is found", () => {
    const csv = "Description,Amount\nSomething,100\n";
    const result = parseCsv(csv);
    expect(result.ok).toBe(false);
  });

  it("fails clearly when no amount/debit/credit column is found", () => {
    const csv = "Date,Description\n2026-01-01,Something\n";
    const result = parseCsv(csv);
    expect(result.ok).toBe(false);
  });

  it("skips rows with an unparseable date or a zero amount", () => {
    const csv = "Date,Description,Amount\nnot-a-date,Bad row,50\n2026-01-01,Zero row,0\n2026-01-02,Good row,25\n";
    const result = parseCsv(csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].description).toBe("Good row");
  });
});

describe("toTransactionInput", () => {
  it("maps a positive amount to INCOME with an unsigned amount", () => {
    expect(toTransactionInput({ date: "2026-01-01", description: "x", amount: 500 })).toEqual({
      type: "INCOME",
      amount: 500,
      date: "2026-01-01",
      description: "x",
    });
  });

  it("maps a negative amount to EXPENSE with an unsigned amount", () => {
    expect(toTransactionInput({ date: "2026-01-01", description: "x", amount: -75 })).toEqual({
      type: "EXPENSE",
      amount: 75,
      date: "2026-01-01",
      description: "x",
    });
  });
});

describe("isDuplicateRow", () => {
  const existing = [{ date: new Date("2026-01-05T00:00:00Z"), amount: 150, description: "MLS Dues" }];

  it("flags a matching date+amount+description as a duplicate", () => {
    const row = { date: "2026-01-05", description: "MLS Dues", amount: -150 };
    expect(isDuplicateRow(row, existing)).toBe(true);
  });

  it("does not flag a different description as a duplicate", () => {
    const row = { date: "2026-01-05", description: "Something else", amount: -150 };
    expect(isDuplicateRow(row, existing)).toBe(false);
  });

  it("does not flag a different date as a duplicate", () => {
    const row = { date: "2026-01-06", description: "MLS Dues", amount: -150 };
    expect(isDuplicateRow(row, existing)).toBe(false);
  });
});
