import { describe, expect, it } from "vitest";
import {
  canManageMembership,
  canManageSharedResources,
  isManager,
  roleLabel,
  teamLabel,
  teamOrOwnFilter,
  teamSharedFilter,
  wouldLeaveTeamUnmanaged,
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
// The line between "can see the team's work" (isManager) and "can change who
// is on the team" (this). Getting these backwards would let any team lead
// remove agents from a brokerage.
describe("canManageMembership", () => {
  const brokerage = [
    { role: "BROKER" as const },
    { role: "TEAM_LEAD" as const },
    { role: "AGENT" as const },
  ];

  it("is true for a broker or admin", () => {
    expect(canManageMembership({ id: "u1", role: "BROKER", teamId: "t1" }, brokerage)).toBe(true);
    expect(canManageMembership({ id: "u1", role: "ADMIN", teamId: "t1" }, brokerage)).toBe(true);
  });

  it("is false for a team lead inside a brokerage — full visibility, no roster control", () => {
    expect(canManageMembership({ id: "u1", role: "TEAM_LEAD", teamId: "t1" }, brokerage)).toBe(
      false,
    );
  });

  it("is true for a team lead who owns their own team — nobody above them", () => {
    const ownTeam = [{ role: "TEAM_LEAD" as const }, { role: "AGENT" as const }];
    expect(canManageMembership({ id: "u1", role: "TEAM_LEAD", teamId: "t1" }, ownTeam)).toBe(true);
  });

  it("is false for an agent", () => {
    expect(canManageMembership({ id: "u1", role: "AGENT", teamId: "t1" }, brokerage)).toBe(false);
  });

  it("is false without a team — there's no membership to manage", () => {
    expect(canManageMembership({ id: "u1", role: "BROKER", teamId: null }, brokerage)).toBe(false);
  });
});

// Without this guard a team can lock itself out: remove the last person who
// can manage the roster and nobody is left who can invite, promote, or remove.
describe("wouldLeaveTeamUnmanaged", () => {
  it("blocks removing the only person who can manage the roster", () => {
    const roster = [
      { id: "broker", role: "BROKER" as const },
      { id: "agent", role: "AGENT" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "broker", null)).toBe(true);
  });

  it("blocks demoting that person to agent", () => {
    const roster = [
      { id: "broker", role: "BROKER" as const },
      { id: "agent", role: "AGENT" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "broker", "AGENT")).toBe(true);
  });

  it("allows demoting the last broker to team lead — that lead inherits control", () => {
    const roster = [
      { id: "broker", role: "BROKER" as const },
      { id: "agent", role: "AGENT" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "broker", "TEAM_LEAD")).toBe(false);
  });

  it("allows removing the broker when an admin remains", () => {
    const roster = [
      { id: "broker", role: "BROKER" as const },
      { id: "admin", role: "ADMIN" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "broker", null)).toBe(false);
  });

  it("allows removing an agent", () => {
    const roster = [
      { id: "broker", role: "BROKER" as const },
      { id: "agent", role: "AGENT" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "agent", null)).toBe(false);
  });

  it("blocks removing a solo team lead who owns the team", () => {
    const roster = [
      { id: "lead", role: "TEAM_LEAD" as const },
      { id: "agent", role: "AGENT" as const },
    ];
    expect(wouldLeaveTeamUnmanaged(roster, "lead", null)).toBe(true);
  });
});

describe("teamLabel", () => {
  it("says brokerage when someone holds the broker role", () => {
    expect(teamLabel([{ role: "BROKER" }, { role: "AGENT" }])).toBe("brokerage");
  });

  it("says team otherwise", () => {
    expect(teamLabel([{ role: "TEAM_LEAD" }, { role: "AGENT" }])).toBe("team");
  });
});
