import { describe, expect, it } from "vitest";
import {
  addBusinessDaysUtc,
  applyShifts,
  changedDeadlines,
  computeDeadlineDates,
  dependentsOf,
  describeRule,
  federalHolidaysUtc,
  isBusinessDayUtc,
  planExtension,
  type RuleDeadline,
} from "./deadline-rules";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const ymd = (date: Date | undefined) => date?.toISOString().slice(0, 10);

describe("business days", () => {
  it("knows the federal holidays, as observed", () => {
    const h2026 = federalHolidaysUtc(2026).map(ymd);
    expect(h2026).toContain("2026-07-03"); // July 4 is a Saturday -> Friday
    expect(h2026).toContain("2026-09-07"); // Labor Day
    expect(h2026).toContain("2026-11-26"); // Thanksgiving
    expect(h2026).toContain("2026-01-19"); // MLK Day
  });

  it("skips weekends and holidays", () => {
    expect(isBusinessDayUtc(d("2026-11-26"))).toBe(false); // Thanksgiving
    expect(ymd(addBusinessDaysUtc(d("2026-11-25"), 1))).toBe("2026-11-27");
    expect(ymd(addBusinessDaysUtc(d("2026-07-02"), 1))).toBe("2026-07-06"); // past observed July 4 + weekend
    expect(ymd(addBusinessDaysUtc(d("2026-09-04"), 1))).toBe("2026-09-08"); // past Labor Day
  });

  it("treats next year's New Year's Day observed on Dec 31 as a holiday", () => {
    // Jan 1, 2028 is a Saturday, observed Friday Dec 31, 2027.
    expect(isBusinessDayUtc(d("2027-12-31"))).toBe(false);
  });

  it("counts backwards for a negative number", () => {
    expect(ymd(addBusinessDaysUtc(d("2026-09-08"), -1))).toBe("2026-09-04"); // back over Labor Day
  });
});

// Modeled on the 0 Crooked Lake Road purchase agreement (vacant land):
// - accepted Tuesday, September 1, 2026
// - initial $2,000 deposit within 3 business days of acceptance
// - 90-day due diligence period from acceptance
// - financing within 21 days of acceptance
// - title objections within 15 days of acceptance
// - closing within 15 days after due diligence ends
// - buyer may extend due diligence by 60 days with a further $5,000 deposit
const crookedLake = (): RuleDeadline[] => [
  {
    id: "emd",
    label: "Initial earnest money deposit ($2,000)",
    rule: { baseEvent: "ACCEPTANCE", offsetDays: 3, dayType: "BUSINESS" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
  },
  {
    id: "dd",
    label: "Due diligence period ends",
    rule: { baseEvent: "ACCEPTANCE", offsetDays: 90, dayType: "CALENDAR" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
  },
  {
    id: "fin",
    label: "Financing contingency",
    rule: { baseEvent: "ACCEPTANCE", offsetDays: 21, dayType: "CALENDAR" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
  },
  {
    id: "title",
    label: "Title objections",
    rule: { baseEvent: "ACCEPTANCE", offsetDays: 15, dayType: "CALENDAR" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
  },
  {
    id: "closing",
    label: "Closing",
    rule: { baseEvent: "DEADLINE", baseDeadlineId: "dd", offsetDays: 15, dayType: "CALENDAR" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
    isClosing: true,
  },
  {
    id: "walk",
    label: "Final walkthrough",
    rule: { baseEvent: "CLOSING", offsetDays: -1, dayType: "CALENDAR" },
    dueDate: d("2026-01-01"),
    extensionDays: 0,
  },
];

const dates = { acceptanceDate: d("2026-09-01"), closingDate: null };

describe("computeDeadlineDates (Crooked Lake Road)", () => {
  it("works every date out from acceptance", () => {
    const r = computeDeadlineDates(crookedLake(), dates);
    expect(ymd(r.get("emd"))).toBe("2026-09-04"); // Wed, Thu, Fri
    expect(ymd(r.get("dd"))).toBe("2026-11-30");
    expect(ymd(r.get("fin"))).toBe("2026-09-22");
    expect(ymd(r.get("title"))).toBe("2026-09-16");
    expect(ymd(r.get("closing"))).toBe("2026-12-15");
    expect(ymd(r.get("walk"))).toBe("2026-12-14"); // counted from the closing deadline
  });

  it("moves everything when the acceptance date changes", () => {
    const r = computeDeadlineDates(crookedLake(), { ...dates, acceptanceDate: d("2026-09-08") });
    expect(ymd(r.get("emd"))).toBe("2026-09-11");
    expect(ymd(r.get("dd"))).toBe("2026-12-07");
    expect(ymd(r.get("closing"))).toBe("2026-12-22");
    expect(ymd(r.get("walk"))).toBe("2026-12-21");
  });

  it("keeps the stored date when there's no acceptance date yet", () => {
    const r = computeDeadlineDates(crookedLake(), { acceptanceDate: null, closingDate: null });
    expect(ymd(r.get("dd"))).toBe("2026-01-01");
  });

  it("counts from the deal's closing date when no deadline is the closing", () => {
    const list: RuleDeadline[] = [
      { id: "w", label: "Walkthrough", rule: { baseEvent: "CLOSING", offsetDays: -2, dayType: "CALENDAR" }, dueDate: d("2026-01-01"), extensionDays: 0 },
    ];
    expect(ymd(computeDeadlineDates(list, { acceptanceDate: null, closingDate: d("2026-10-30") }).get("w"))).toBe("2026-10-28");
  });

  it("survives a loop by keeping stored dates", () => {
    const loop: RuleDeadline[] = [
      { id: "a", label: "A", rule: { baseEvent: "DEADLINE", baseDeadlineId: "b", offsetDays: 1, dayType: "CALENDAR" }, dueDate: d("2026-05-01"), extensionDays: 0 },
      { id: "b", label: "B", rule: { baseEvent: "DEADLINE", baseDeadlineId: "a", offsetDays: 1, dayType: "CALENDAR" }, dueDate: d("2026-05-02"), extensionDays: 0 },
    ];
    const r = computeDeadlineDates(loop, dates);
    expect(r.size).toBe(2); // no crash, no infinite recursion
  });

  it("reports only the deadlines whose date actually changes", () => {
    const list = crookedLake().map((x) => ({ ...x, dueDate: computeDeadlineDates(crookedLake(), dates).get(x.id)! }));
    expect(changedDeadlines(list, dates)).toEqual([]);
    const moved = changedDeadlines(list, { ...dates, acceptanceDate: d("2026-09-02") });
    expect(moved.map((m) => m.id).sort()).toEqual(["closing", "dd", "emd", "fin", "title", "walk"]);
  });
});

describe("extensions (the 60-day option)", () => {
  it("exercising the option moves due diligence and everything counted from it", () => {
    const list = crookedLake();
    const plan = planExtension({ deadlines: list, dates, targetIds: ["dd"], days: 60, dayType: "CALENDAR" });
    expect(plan.shifts).toEqual({ dd: 60 });
    expect(ymd(plan.newDates.get("dd"))).toBe("2027-01-29");
    expect(ymd(plan.newDates.get("closing"))).toBe("2027-02-13");
    expect(ymd(plan.newDates.get("walk"))).toBe("2027-02-12");
    expect(plan.movedWithIt.sort()).toEqual(["closing", "walk"]);
    // Financing and title aren't part of the option and don't move.
    expect(ymd(plan.newDates.get("fin"))).toBe("2026-09-22");
    expect(ymd(plan.newDates.get("title"))).toBe("2026-09-16");
  });

  it("doesn't double-shift a deadline that already moves with its parent", () => {
    const plan = planExtension({ deadlines: crookedLake(), dates, targetIds: ["dd", "closing"], days: 60, dayType: "CALENDAR" });
    expect(plan.shifts).toEqual({ dd: 60 });
    expect(ymd(plan.newDates.get("closing"))).toBe("2027-02-13");
  });

  it("can be undone exactly", () => {
    const list = crookedLake();
    const plan = planExtension({ deadlines: list, dates, targetIds: ["dd"], days: 60, dayType: "CALENDAR" });
    const extended = applyShifts(list, plan.shifts, 1);
    const undone = applyShifts(extended, plan.shifts, -1);
    expect(computeDeadlineDates(undone, dates)).toEqual(computeDeadlineDates(list, dates));
  });

  it("keeps working after the acceptance date changes on an extended contract", () => {
    const extended = applyShifts(crookedLake(), { dd: 60 }, 1);
    const r = computeDeadlineDates(extended, { ...dates, acceptanceDate: d("2026-09-08") });
    expect(ymd(r.get("dd"))).toBe("2027-02-05"); // Dec 7 + 60
    expect(ymd(r.get("closing"))).toBe("2027-02-20");
  });

  it("turns a business-day extension into an exact calendar shift", () => {
    // 5 business days from Wed Nov 25, 2026 skips Thanksgiving and a weekend.
    const list: RuleDeadline[] = [
      { id: "x", label: "Inspection", rule: null, dueDate: d("2026-11-25"), extensionDays: 0 },
    ];
    const plan = planExtension({ deadlines: list, dates, targetIds: ["x"], days: 5, dayType: "BUSINESS" });
    expect(ymd(plan.newDates.get("x"))).toBe("2026-12-03");
    expect(plan.shifts.x).toBe(8);
  });

  it("moves a fixed (hand-entered) date directly", () => {
    const list: RuleDeadline[] = [
      { id: "f", label: "Appraisal", rule: null, dueDate: d("2026-10-01"), extensionDays: 0 },
    ];
    const plan = planExtension({ deadlines: list, dates, targetIds: ["f"], days: 10, dayType: "CALENDAR" });
    expect(ymd(applyShifts(list, plan.shifts, 1)[0].dueDate)).toBe("2026-10-11");
  });

  it("ignores completed deadlines", () => {
    const list = crookedLake().map((x) => (x.id === "fin" ? { ...x, completed: true } : x));
    const plan = planExtension({ deadlines: list, dates, targetIds: ["fin"], days: 10, dayType: "CALENDAR" });
    expect(plan.shifts).toEqual({});
  });

  it("finds dependents, including through the closing deadline", () => {
    expect([...dependentsOf(crookedLake(), "dd")].sort()).toEqual(["closing", "walk"]);
  });
});

describe("describeRule", () => {
  const labelOf = (id: string) => crookedLake().find((x) => x.id === id)?.label;
  it("says it in plain words", () => {
    expect(describeRule({ baseEvent: "ACCEPTANCE", offsetDays: 3, dayType: "BUSINESS" }, labelOf)).toBe(
      "3 business days after acceptance",
    );
    expect(describeRule({ baseEvent: "CLOSING", offsetDays: -1, dayType: "CALENDAR" }, labelOf)).toBe("1 day before closing");
    expect(describeRule({ baseEvent: "DEADLINE", baseDeadlineId: "dd", offsetDays: 15, dayType: "CALENDAR" }, labelOf)).toBe(
      "15 days after Due diligence period ends",
    );
  });
});
