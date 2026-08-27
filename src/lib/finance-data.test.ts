import { beforeEach, describe, expect, it, vi } from "vitest";

// The async DB-aggregation functions below (getBudgetUsage, getPipelineValue,
// getClosedDealsSummary, getReferralPartnerTotals, getNetWorthSeries) mix a
// Prisma fetch with real branching/rounding logic, so they can't be tested as
// pure functions the way the math below already is. There's no separate test
// database for this project (see CLAUDE.md — local dev and production
// intentionally share one Supabase project), so this mocks @/lib/db's
// `prisma` export directly and asserts on the *computed* output, same
// discipline as this project's other math tests.
const mockPrisma = vi.hoisted(() => ({
  budget: { findMany: vi.fn() },
  transaction: { aggregate: vi.fn() },
  deal: { findMany: vi.fn() },
  referralPartner: { findMany: vi.fn() },
  asset: { findMany: vi.fn() },
  loan: { findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

beforeEach(() => {
  vi.clearAllMocks();
});

import {
  calculateBudgetPercentUsed,
  getBudgetUsage,
  getClosedDealsSummary,
  getHomeOfficeDeduction,
  getNetWorthSeries,
  getPipelineValue,
  getReferralPartnerTotals,
} from "./finance-data";

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

describe("getBudgetUsage", () => {
  it("computes spent/percentUsed per budget, category-scoped and overall", async () => {
    mockPrisma.budget.findMany.mockResolvedValue([
      { id: "b1", scope: "BUSINESS", category: "PHONE", monthlyLimit: 100 },
      { id: "b2", scope: "PERSONAL", category: null, monthlyLimit: 500 },
    ]);
    // budgets.map(async ...) issues these aggregate calls synchronously, in
    // array order, before either resolves — safe to chain with *Once here.
    mockPrisma.transaction.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 45 } })
      .mockResolvedValueOnce({ _sum: { amount: 600 } });

    const usage = await getBudgetUsage("u1", 2026, 7);

    expect(usage).toEqual([
      { budgetId: "b1", scope: "BUSINESS", category: "PHONE", monthlyLimit: 100, spent: 45, percentUsed: 45 },
      { budgetId: "b2", scope: "PERSONAL", category: null, monthlyLimit: 500, spent: 600, percentUsed: 120 },
    ]);
  });
});

describe("getPipelineValue", () => {
  it("sums sale price when set, falling back to list price, across active/under-contract/pending deals", async () => {
    mockPrisma.deal.findMany.mockResolvedValue([
      { listPrice: 300000, salePrice: null },
      { listPrice: 250000, salePrice: 260000 },
      { listPrice: null, salePrice: null },
    ]);

    const result = await getPipelineValue("u1");

    expect(result).toEqual({ value: 560000, count: 3 });
  });
});

describe("getClosedDealsSummary", () => {
  it("sums net commission (via calculateNetCommission) across closed deals in the year", async () => {
    mockPrisma.deal.findMany.mockResolvedValue([
      {
        commissionAmount: 10000,
        brokerageSplitPercent: 30,
        referralFeeAmount: 500,
        teamSplitAmount: 300,
        otherDeductions: 0,
      },
      {
        commissionAmount: 5000,
        brokerageSplitPercent: null,
        referralFeeAmount: null,
        teamSplitAmount: null,
        otherDeductions: null,
      },
    ]);

    const result = await getClosedDealsSummary("u1", 2026);

    expect(result).toEqual({ count: 2, netCommission: 11200 });
  });
});

describe("getReferralPartnerTotals", () => {
  it("sums referralFeeAmount across each partner's closed deals only", async () => {
    mockPrisma.referralPartner.findMany.mockResolvedValue([
      {
        id: "p1",
        name: "Jane",
        email: "jane@example.com",
        phone: null,
        deals: [{ referralFeeAmount: 500 }, { referralFeeAmount: 300 }],
      },
      { id: "p2", name: "Bob", email: null, phone: "555-1234", deals: [] },
    ]);

    const result = await getReferralPartnerTotals("u1");

    expect(result).toEqual([
      { id: "p1", name: "Jane", email: "jane@example.com", phone: null, totalOwed: 800 },
      { id: "p2", name: "Bob", email: null, phone: "555-1234", totalOwed: 0 },
    ]);
  });
});

describe("getNetWorthSeries", () => {
  it("returns 0 points when no asset has ever had a value snapshot", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([]);
    mockPrisma.loan.findMany.mockResolvedValue([]);

    expect(await getNetWorthSeries("u1")).toEqual([]);
  });

  it("nets assets minus loan balance as of the current month when history starts this month", async () => {
    const now = new Date();
    mockPrisma.asset.findMany.mockResolvedValue([
      { valueSnapshots: [{ value: 50000, recordedAt: now }] },
    ]);
    mockPrisma.loan.findMany.mockResolvedValue([]);

    const points = await getNetWorthSeries("u1");

    // Earliest snapshot and "now" fall in the same month, so the month-by-
    // month walk produces exactly one point.
    expect(points).toHaveLength(1);
    expect(points[0].assets).toBe(50000);
    expect(points[0].liabilities).toBe(0);
    expect(points[0].netWorth).toBe(50000);
  });
});

