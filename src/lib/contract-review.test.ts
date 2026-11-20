import { describe, expect, it } from "vitest";
import { extractedContractSchema, type ExtractedContractData } from "./ai-contract-analysis";
import { buildContractReview, computeReviewDates } from "./contract-review";
import { applyShifts, computeDeadlineDates, planExtension, type RuleDeadline } from "./deadline-rules";
import * as crookedLake from "./contract-fixtures/crooked-lake-road";
import { lakeview, mapleStreet } from "./contract-fixtures/other-samples";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (date: Date | undefined) => date?.toISOString().slice(0, 10);

// The review rows -> the rule deadlines that saving would create.
function asSaved(x: ExtractedContractData): RuleDeadline[] {
  const review = buildContractReview(x);
  return review.items.map((item, i) => ({
    id: String(i),
    label: item.label,
    rule: item.rule
      ? {
          baseEvent: item.rule.baseEvent,
          baseDeadlineId: item.rule.baseIndex == null ? null : String(item.rule.baseIndex),
          offsetDays: item.rule.offsetDays,
          dayType: item.rule.dayType,
        }
      : null,
    dueDate: d(item.dueDate!),
    extensionDays: 0,
    isClosing: item.category === "CLOSING",
  }));
}

describe("sample contracts match the reader's output format", () => {
  it.each([
    ["Crooked Lake Road", crookedLake.expected],
    ["Crooked Lake Road (missed option)", crookedLake.missedExtension],
    ["Maple Street", mapleStreet],
    ["Lakeview", lakeview],
  ])("%s parses", (_name, x) => {
    expect(() => extractedContractSchema.parse(x)).not.toThrow();
  });
});

describe("Crooked Lake Road", () => {
  const review = buildContractReview(crookedLake.expected);
  const byLabel = (label: string) => review.items.find((i) => i.label === label)!;

  it("captures every term: deposits, contingencies, due diligence, closing", () => {
    expect(review.acceptanceDate).toBe("2026-09-01");
    expect(review.items.map((i) => i.category)).toEqual(["EARNEST_MONEY", "FINANCING", "TITLE", "DUE_DILIGENCE", "CLOSING"]);
    expect(byLabel("Initial earnest money deposit").amount).toBe(2000);
  });

  it("stores each deadline as a rule, and the app's dates agree with the reader's", () => {
    expect(byLabel("Initial earnest money deposit").rule).toEqual({
      baseEvent: "ACCEPTANCE",
      baseIndex: null,
      offsetDays: 3,
      dayType: "BUSINESS",
    });
    expect(byLabel("Closing").rule?.baseEvent).toBe("DEADLINE");
    expect(review.items.every((i) => !i.dateMismatch)).toBe(true);
    expect(review.items.map((i) => i.dueDate)).toEqual(["2026-09-04", "2026-09-22", "2026-09-16", "2026-11-30", "2026-12-15"]);
  });

  it("captures the optional 60-day extension and the $5,000 deposit it needs", () => {
    expect(review.options).toHaveLength(1);
    const option = review.options[0];
    expect(option.days).toBe(60);
    expect(option.additionalDeposit).toBe(5000);
    expect(option.exercisableBy).toBe("Buyer");
    expect(option.noticeDate).toBe("2026-11-30");
    expect(option.targetIndexes.map((i) => review.items[i].label)).toEqual(["Due diligence period ends"]);
  });

  it("raises no warnings when everything was captured", () => {
    expect(review.warnings).toEqual([]);
  });

  it("recalculates every deadline correctly after the extension is used", () => {
    const saved = asSaved(crookedLake.expected);
    const dates = { acceptanceDate: d("2026-09-01"), closingDate: null };
    const ddIndex = String(review.options[0].targetIndexes[0]);
    const plan = planExtension({ deadlines: saved, dates, targetIds: [ddIndex], days: 60, dayType: "CALENDAR" });
    const after = computeDeadlineDates(applyShifts(saved, plan.shifts, 1), dates);
    expect([...after.values()].map(ymd)).toEqual([
      "2026-09-04", // deposit: unchanged
      "2026-09-22", // financing: unchanged
      "2026-09-16", // title: unchanged
      "2027-01-29", // due diligence: +60
      "2027-02-13", // closing: follows due diligence
    ]);
  });

  it("warns when the reader saw the extension but didn't capture it (the original bug)", () => {
    const missed = buildContractReview(crookedLake.missedExtension);
    expect(missed.options).toEqual([]);
    const missedWarnings = missed.warnings.filter((w) => w.kind === "missed");
    expect(missedWarnings.length).toBeGreaterThanOrEqual(1);
    expect(missedWarnings[0].text).toMatch(/extension/);
    expect(missedWarnings.some((w) => /\$5,000/.test(w.text))).toBe(true);
  });
});

describe("Maple Street (no options)", () => {
  const review = buildContractReview(mapleStreet);
  it("works out business-day and calendar-day deadlines and the walk-through before a fixed closing", () => {
    expect(review.items.map((i) => i.dueDate)).toEqual([
      "2026-08-18",
      "2026-08-24",
      "2026-09-04",
      "2026-09-13",
      "2026-09-30",
      "2026-09-29",
    ]);
    expect(review.items.find((i) => i.label === "Closing")!.rule).toBeNull();
    expect(review.warnings).toEqual([]);
  });

  it("recalculates from a corrected acceptance date", () => {
    const dates = computeReviewDates(review.items, "2026-08-17", "2026-09-30");
    expect(dates[0]).toBe("2026-08-19"); // 2 business days from Mon Aug 17
    expect(dates[1]).toBe("2026-08-27");
    expect(dates[4]).toBeNull(); // closing is a fixed date, not a rule
  });
});

describe("Lakeview (business days, fee-based extension)", () => {
  const review = buildContractReview(lakeview);

  it("skips Columbus Day when counting business days", () => {
    expect(review.items[0].dueDate).toBe("2026-10-15");
    expect(review.items.every((i) => !i.dateMismatch)).toBe(true);
  });

  it("captures a fee (not a deposit) and extends by business days", () => {
    const option = review.options[0];
    expect(option.cost).toBe(250);
    expect(option.additionalDeposit).toBeNull();
    const saved = asSaved(lakeview);
    const dates = { acceptanceDate: d("2026-10-05"), closingDate: null };
    const plan = planExtension({ deadlines: saved, dates, targetIds: ["0"], days: 5, dayType: "BUSINESS" });
    expect(ymd(plan.newDates.get("0"))).toBe("2026-10-22");
    expect(ymd(plan.newDates.get("3"))).toBe("2026-11-29"); // closing counts from the home sale, not inspection
  });
});

describe("checks on the reader's own work", () => {
  it("flags a date that disagrees with its own rule, and uses the rule's date", () => {
    const wrong: ExtractedContractData = {
      ...mapleStreet,
      deadlines: mapleStreet.deadlines.map((x, i) => (i === 1 ? { ...x, dueDate: "2026-08-25" } : x)),
    };
    const item = buildContractReview(wrong).items[1];
    expect(item.dateMismatch).toBe(true);
    expect(item.readerDate).toBe("2026-08-25");
    expect(item.dueDate).toBe("2026-08-24");
  });

  it("asks for the acceptance date when it's missing", () => {
    const noAcceptance: ExtractedContractData = {
      ...mapleStreet,
      acceptanceDate: null,
      deadlines: mapleStreet.deadlines.map((x) => (x.baseEvent === "ACCEPTANCE" ? { ...x, dueDate: null } : x)),
    };
    const review = buildContractReview(noAcceptance);
    expect(review.warnings.some((w) => /acceptance date/.test(w.text))).toBe(true);
  });

  it("flags an option that points at no deadline, and a deposit with no amount", () => {
    const broken: ExtractedContractData = {
      ...crookedLake.expected,
      deadlines: crookedLake.expected.deadlines.map((x) => (x.category === "EARNEST_MONEY" ? { ...x, amount: null } : x)),
      extensionOptions: [{ ...crookedLake.expected.extensionOptions[0], affectedDeadlineLabels: ["Feasibility period"] }],
    };
    const warnings = buildContractReview(broken).warnings;
    expect(warnings.some((w) => w.kind === "unlinked")).toBe(true);
    expect(warnings.some((w) => /no amount/.test(w.text))).toBe(true);
  });
});
