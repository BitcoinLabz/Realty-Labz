import { describe, expect, it } from "vitest";
import { shouldApplyOfficeChecklist } from "./office-checklist";

describe("shouldApplyOfficeChecklist", () => {
  const base = { agentOnTeam: true, existingTasks: 0 };

  it("applies when a team agent's file goes under contract or pending", () => {
    expect(shouldApplyOfficeChecklist({ ...base, status: "UNDER_CONTRACT" })).toBe(true);
    expect(shouldApplyOfficeChecklist({ ...base, status: "PENDING" })).toBe(true);
  });

  it("doesn't apply to files that aren't under contract", () => {
    for (const status of ["ACTIVE", "CLOSED", "FELL_THROUGH"] as const) {
      expect(shouldApplyOfficeChecklist({ ...base, status })).toBe(false);
    }
  });

  it("never duplicates, and respects an office that removed items", () => {
    expect(shouldApplyOfficeChecklist({ ...base, status: "UNDER_CONTRACT", existingTasks: 1 })).toBe(false);
  });

  it("doesn't apply for a solo agent with no office", () => {
    expect(shouldApplyOfficeChecklist({ ...base, status: "UNDER_CONTRACT", agentOnTeam: false })).toBe(false);
  });
});
