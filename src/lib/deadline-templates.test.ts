import { describe, expect, it } from "vitest";
import {
  addDaysUtc,
  buildDeadlinesFromTemplate,
  formatDeadlineDate,
  parseAnchorDateUtc,
} from "./deadline-templates";

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe("addDaysUtc", () => {
  it("adds days within a month", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 3, 1), 10))).toBe("2026-03-11");
  });

  it("rolls over a month boundary", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 1, 25), 10))).toBe("2026-02-04");
  });

  it("rolls over a year boundary", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 12, 20), 21))).toBe("2027-01-10");
  });

  it("handles a leap day correctly", () => {
    // 2028 is a leap year: Feb 20 + 10 lands on Mar 1 only if Feb 29 exists.
    expect(formatDeadlineDate(addDaysUtc(utc(2028, 2, 20), 10))).toBe("2028-03-01");
  });

  it("handles a non-leap February", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 2, 20), 10))).toBe("2026-03-02");
  });

  it("supports negative offsets, e.g. a walkthrough before closing", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 3, 2), -3))).toBe("2026-02-27");
  });

  it("returns the anchor itself for an offset of 0", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 6, 15), 0))).toBe("2026-06-15");
  });

  // The case a naive setDate()-on-a-local-date implementation gets wrong.
  // US DST springs forward 2026-03-08; a local-time +7 days across it lands on
  // a 23-hour day and can read back as the previous calendar date.
  it("does not drift a day across the US spring-forward boundary", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 3, 6), 7))).toBe("2026-03-13");
  });

  // And the autumn fall-back, 2026-11-01.
  it("does not drift a day across the US fall-back boundary", () => {
    expect(formatDeadlineDate(addDaysUtc(utc(2026, 10, 30), 7))).toBe("2026-11-06");
  });

  it("stays at exactly UTC midnight so it round-trips through toISOString", () => {
    const result = addDaysUtc(utc(2026, 3, 1), 45);
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });
});

describe("parseAnchorDateUtc", () => {
  it("parses a valid date to UTC midnight", () => {
    expect(parseAnchorDateUtc("2026-07-01")?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("rejects a nonexistent date instead of silently rolling it forward", () => {
    // Date.UTC(2026, 1, 30) would quietly become March 2nd.
    expect(parseAnchorDateUtc("2026-02-30")).toBeNull();
  });

  it("accepts a real leap day", () => {
    expect(parseAnchorDateUtc("2028-02-29")?.toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("rejects a leap day in a non-leap year", () => {
    expect(parseAnchorDateUtc("2026-02-29")).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(parseAnchorDateUtc("")).toBeNull();
    expect(parseAnchorDateUtc("07/01/2026")).toBeNull();
    expect(parseAnchorDateUtc("2026-7-1")).toBeNull();
    expect(parseAnchorDateUtc("not a date")).toBeNull();
  });
});

describe("buildDeadlinesFromTemplate", () => {
  // The standard buyer set the deadline empty state already names.
  const BUYER_SET = [
    { label: "Inspection contingency", offsetDays: 10 },
    { label: "Appraisal", offsetDays: 14 },
    { label: "Financing contingency", offsetDays: 21 },
    { label: "Closing", offsetDays: 45 },
  ];

  it("builds every deadline off one anchor date", () => {
    const built = buildDeadlinesFromTemplate(BUYER_SET, "2026-03-01");

    expect(built.map((d) => [d.label, formatDeadlineDate(d.dueDate)])).toEqual([
      ["Inspection contingency", "2026-03-11"],
      ["Appraisal", "2026-03-15"],
      ["Financing contingency", "2026-03-22"],
      ["Closing", "2026-04-15"],
    ]);
  });

  it("returns nothing for an unparseable anchor rather than bad dates", () => {
    expect(buildDeadlinesFromTemplate(BUYER_SET, "nonsense")).toEqual([]);
  });

  it("returns nothing for an empty set", () => {
    expect(buildDeadlinesFromTemplate([], "2026-03-01")).toEqual([]);
  });

  it("preserves the order the items were given in", () => {
    const built = buildDeadlinesFromTemplate(
      [
        { label: "Later", offsetDays: 30 },
        { label: "Sooner", offsetDays: 5 },
      ],
      "2026-03-01",
    );
    expect(built.map((d) => d.label)).toEqual(["Later", "Sooner"]);
  });
});
