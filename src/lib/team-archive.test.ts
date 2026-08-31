import { describe, expect, it } from "vitest";
import { selectDealsToArchive, type ArchivableDeal } from "./team-archive";

const joined = new Date("2026-01-01T00:00:00Z");

function deal(over: Partial<ArchivableDeal> & { id: string }): ArchivableDeal {
  return { status: "CLOSED", closingDate: new Date("2026-06-01T00:00:00Z"), ...over };
}

describe("selectDealsToArchive", () => {
  it("keeps a deal that closed after the agent joined", () => {
    expect(selectDealsToArchive([deal({ id: "a" })], joined)).toEqual(["a"]);
  });

  it("does not keep a deal that closed at a previous brokerage", () => {
    const earlier = deal({ id: "a", closingDate: new Date("2025-06-01T00:00:00Z") });
    expect(selectDealsToArchive([earlier], joined)).toEqual([]);
  });

  it("keeps a deal that closed exactly on the join date", () => {
    const sameDay = deal({ id: "a", closingDate: new Date("2026-01-01T00:00:00Z") });
    expect(selectDealsToArchive([sameDay], joined)).toEqual(["a"]);
  });

  it("never keeps a deal that is still open — that follows the agent", () => {
    const open = [
      deal({ id: "a", status: "ACTIVE" }),
      deal({ id: "b", status: "UNDER_CONTRACT" }),
      deal({ id: "c", status: "PENDING" }),
      deal({ id: "d", status: "FELL_THROUGH" }),
    ];
    expect(selectDealsToArchive(open, joined)).toEqual([]);
  });

  it("falls back to every closed deal when the join date is unknown", () => {
    const mixed = [
      deal({ id: "a", closingDate: new Date("2020-06-01T00:00:00Z") }),
      deal({ id: "b" }),
      deal({ id: "c", status: "ACTIVE" }),
    ];
    expect(selectDealsToArchive(mixed, null)).toEqual(["a", "b"]);
  });

  it("keeps a closed deal with no closing date rather than dropping the record", () => {
    const undated = deal({ id: "a", closingDate: null });
    expect(selectDealsToArchive([undated], joined)).toEqual(["a"]);
  });

  it("returns nothing for an agent with no deals", () => {
    expect(selectDealsToArchive([], joined)).toEqual([]);
  });
});
