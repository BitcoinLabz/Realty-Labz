import { describe, expect, it } from "vitest";
import {
  canManageSharedResources,
  isManager,
  roleLabel,
  teamOrOwnFilter,
  teamSharedFilter,
} from "./authorization";

describe("isManager", () => {
  it("is true for TEAM_LEAD, ADMIN, and BROKER", () => {
    expect(isManager("TEAM_LEAD")).toBe(true);
    expect(isManager("ADMIN")).toBe(true);
    expect(isManager("BROKER")).toBe(true);
  });

  it("is false for AGENT", () => {
    expect(isManager("AGENT")).toBe(false);
  });
});

// This is the crux of the whole multi-tenant boundary — see this project's
// own two real IDOR bugs, both adjacent to exactly this logic. The single
// most important case here is that team-wide visibility requires BOTH
// isManager(role) AND a non-null teamId — regressing the `&&` into just
// `isManager(role)` would leak team-wide access to a manager with no team.
describe("teamOrOwnFilter", () => {
  it("gives a manager with a team the team-wide filter", () => {
    expect(teamOrOwnFilter({ id: "u1", role: "TEAM_LEAD", teamId: "t1" })).toEqual({
      user: { teamId: "t1" },
    });
    expect(teamOrOwnFilter({ id: "u1", role: "ADMIN", teamId: "t1" })).toEqual({
      user: { teamId: "t1" },
    });
    expect(teamOrOwnFilter({ id: "u1", role: "BROKER", teamId: "t1" })).toEqual({
      user: { teamId: "t1" },
    });
  });

  it("falls back to own-records-only for a manager with no team", () => {
    expect(teamOrOwnFilter({ id: "u1", role: "ADMIN", teamId: null })).toEqual({
      userId: "u1",
    });
  });

  it("always scopes a non-manager (AGENT) to their own records, team or not", () => {
    expect(teamOrOwnFilter({ id: "u1", role: "AGENT", teamId: "t1" })).toEqual({
      userId: "u1",
    });
    expect(teamOrOwnFilter({ id: "u1", role: "AGENT", teamId: null })).toEqual({
      userId: "u1",
    });
  });
});

// Contrast with teamOrOwnFilter: here ANY teammate (agents included) gets
// team-wide visibility once teamId is set — role doesn't matter at all. This
// is what makes DocumentTemplate/FormTemplate's "shared library" visibility
// correct, so it's worth pinning the AGENT-with-team case explicitly since
// that's the behavioral difference from teamOrOwnFilter.
describe("teamSharedFilter", () => {
  it("gives any teammate — including a plain AGENT — the team-wide filter", () => {
    expect(teamSharedFilter({ id: "u1", role: "AGENT", teamId: "t1" })).toEqual({
      user: { teamId: "t1" },
    });
  });

  it("gives a manager with a team the team-wide filter too", () => {
    expect(teamSharedFilter({ id: "u1", role: "ADMIN", teamId: "t1" })).toEqual({
      user: { teamId: "t1" },
    });
  });

  it("falls back to own-records-only for a solo user (no team), regardless of role", () => {
    expect(teamSharedFilter({ id: "u1", role: "AGENT", teamId: null })).toEqual({
      userId: "u1",
    });
    expect(teamSharedFilter({ id: "u1", role: "ADMIN", teamId: null })).toEqual({
      userId: "u1",
    });
  });
});

// Gates upload/delete authority on shared team resources (DocumentTemplate,
// FormTemplate) — a three-way branch that's easy to get subtly backwards.
describe("canManageSharedResources", () => {
  it("is true for any manager, regardless of team", () => {
    expect(canManageSharedResources({ id: "u1", role: "TEAM_LEAD", teamId: "t1" })).toBe(true);
    expect(canManageSharedResources({ id: "u1", role: "ADMIN", teamId: null })).toBe(true);
  });

  it("is true for a solo (no-team) non-manager — no one else to share with/from", () => {
    expect(canManageSharedResources({ id: "u1", role: "AGENT", teamId: null })).toBe(true);
  });

  it("is false for a non-manager who has a team — can view/download but not manage", () => {
    expect(canManageSharedResources({ id: "u1", role: "AGENT", teamId: "t1" })).toBe(false);
  });
});

describe("roleLabel", () => {
  it("maps every role to its lowercase label", () => {
    expect(roleLabel("AGENT")).toBe("agent");
    expect(roleLabel("TEAM_LEAD")).toBe("team lead");
    expect(roleLabel("ADMIN")).toBe("admin");
    expect(roleLabel("BROKER")).toBe("broker");
  });
});
