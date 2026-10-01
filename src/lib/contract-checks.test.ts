import { describe, expect, it } from "vitest";
import { checkDeadlines, describeFlag, matchExistingDeadlines } from "./contract-checks";

const run = (deadlines: { label: string; dueDate: string }[], closingDate: string | null = null) =>
  checkDeadlines({ deadlines, closingDate, today: "2026-09-27" });

describe("checkDeadlines", () => {
  it("passes an ordinary weekday deadline before closing", () => {
    // Thu Oct 1 2026
    expect(run([{ label: "Inspection", dueDate: "2026-10-01" }], "2026-10-30")).toEqual([[]]);
  });

  it("flags a Saturday and suggests the Monday after", () => {
    // Sat Oct 3 2026 -> Mon Oct 5
    expect(run([{ label: "Inspection", dueDate: "2026-10-03" }])[0]).toEqual([
      { kind: "weekend", weekday: "Saturday", suggestedDate: "2026-10-05" },
    ]);
  });

  it("flags a Sunday and suggests the next day", () => {
    // Sun Oct 4 2026 -> Mon Oct 5
    expect(run([{ label: "Inspection", dueDate: "2026-10-04" }])[0]).toEqual([
      { kind: "weekend", weekday: "Sunday", suggestedDate: "2026-10-05" },
    ]);
  });

  it("flags a deadline after closing, but not one on the closing date", () => {
    const flags = run(
      [
        { label: "Closing", dueDate: "2026-10-30" },
        { label: "Appraisal", dueDate: "2026-11-02" },
      ],
      "2026-10-30",
    );
    expect(flags[0]).toEqual([]);
    expect(flags[1]).toEqual([{ kind: "afterClosing" }]);
  });

  it("flags a date that has already passed, but not today", () => {
    const flags = run([
      { label: "Earnest money", dueDate: "2026-09-25" },
      { label: "Disclosures", dueDate: "2026-09-28" },
    ]);
    // Sep 25 2026 is a Friday, so only the past flag applies.
    expect(flags[0]).toEqual([{ kind: "inPast" }]);
    expect(flags[1]).toEqual([]);
  });

  it("flags the same deadline listed twice, ignoring case and spacing", () => {
    const flags = run([
      { label: "Inspection", dueDate: "2026-10-01" },
      { label: " inspection ", dueDate: "2026-10-01" },
      { label: "Inspection", dueDate: "2026-10-02" },
    ]);
    expect(flags[0]).toEqual([{ kind: "duplicate" }]);
    expect(flags[1]).toEqual([{ kind: "duplicate" }]);
    expect(flags[2]).toEqual([]);
  });

  it("skips a half-typed or blank date instead of throwing", () => {
    expect(run([{ label: "Financing", dueDate: "" }])).toEqual([[]]);
    expect(run([{ label: "Financing", dueDate: "2026-1" }])).toEqual([[]]);
  });
});

describe("describeFlag", () => {
  it("reads calmly", () => {
    expect(describeFlag({ kind: "weekend", weekday: "Sunday", suggestedDate: "2026-10-05" })).toBe(
      "Falls on a Sunday",
    );
    expect(describeFlag({ kind: "afterClosing" })).toBe("After the closing date");
  });
});

describe("matchExistingDeadlines", () => {
  const existing = [
    { id: "a", label: "Inspection contingency", dueDate: "2026-10-01", completed: false },
    { id: "b", label: "Financing", dueDate: "2026-10-15", completed: false },
    { id: "c", label: "Earnest money", dueDate: "2026-09-20", completed: true },
  ];

  it("matches by name and reports a changed date", () => {
    expect(matchExistingDeadlines([{ label: "Inspection contingency", dueDate: "2026-10-03" }], existing)).toEqual([
      { existingId: "a", oldDate: "2026-10-01", changed: true },
    ]);
  });

  it("ignores case and extra spaces in the name", () => {
    expect(matchExistingDeadlines([{ label: "  inspection   CONTINGENCY ", dueDate: "2026-10-01" }], existing)).toEqual([
      { existingId: "a", oldDate: "2026-10-01", changed: false },
    ]);
  });

  it("reports an unchanged date as not changed", () => {
    expect(matchExistingDeadlines([{ label: "Financing", dueDate: "2026-10-15" }], existing)[0]).toEqual({
      existingId: "b",
      oldDate: "2026-10-15",
      changed: false,
    });
  });

  it("leaves completed deadlines alone", () => {
    expect(matchExistingDeadlines([{ label: "Earnest money", dueDate: "2026-09-22" }], existing)).toEqual([null]);
  });

  it("returns null for a brand-new deadline", () => {
    expect(matchExistingDeadlines([{ label: "Appraisal", dueDate: "2026-10-10" }], existing)).toEqual([null]);
  });

  it("lets one existing deadline absorb only one found row", () => {
    const result = matchExistingDeadlines(
      [
        { label: "Financing", dueDate: "2026-10-15" },
        { label: "Financing", dueDate: "2026-10-20" },
      ],
      existing,
    );
    expect(result[0]?.existingId).toBe("b");
    expect(result[1]).toBeNull();
  });
});
