import type { Role } from "@/generated/prisma/enums";

// Team Lead, Admin, and Broker share team-wide data visibility in Phase 2
// (see CLAUDE.md Platform Expansion Roadmap) — only Agent is scoped to their
// own records. This is the one place that rule is defined; every query that
// needs "does this user see the whole team" should call this instead of
// re-deriving the same role check inline.
export function isManager(role: Role): boolean {
  return role === "TEAM_LEAD" || role === "ADMIN" || role === "BROKER";
}

type SessionUser = { id: string; role: Role; teamId: string | null };

// Prisma where-fragment for any model with a `userId` + `user` relation
// (Deal today, others later): managers get every record on their team,
// everyone else is scoped to their own. Use this instead of hand-rolling an
// OR clause per feature — see the "load-bearing security boundary" note in
// CLAUDE.md's Architecture Principles.
export function teamOrOwnFilter(sessionUser: SessionUser) {
  if (isManager(sessionUser.role) && sessionUser.teamId) {
    return { user: { teamId: sessionUser.teamId } };
  }
  return { userId: sessionUser.id };
}

// Prisma where-fragment for models that are shared with the *whole* team,
// not just visible to managers (DocumentTemplate today) — every teammate,
// agents included, sees everything anyone on the team created. Contrast with
// teamOrOwnFilter, where only managers get team-wide visibility. Solo users
// (no teamId) fall back to seeing only their own records either way.
export function teamSharedFilter(sessionUser: SessionUser) {
  if (sessionUser.teamId) {
    return { user: { teamId: sessionUser.teamId } };
  }
  return { userId: sessionUser.id };
}

// Who may upload/delete a shared team resource like DocumentTemplate:
// managers, or a solo agent (no team, so no one else to share with/from).
// A non-manager on a team can see team templates but not add or remove them.
export function canManageSharedResources(sessionUser: SessionUser): boolean {
  return isManager(sessionUser.role) || !sessionUser.teamId;
}

export function roleLabel(role: Role): string {
  switch (role) {
    case "TEAM_LEAD":
      return "team lead";
    case "ADMIN":
      return "admin";
    case "BROKER":
      return "broker";
    case "AGENT":
    default:
      return "agent";
  }
}

// Who may change WHO IS ON the team, as opposed to who can see the team's
// work. That split is the whole difference between a Broker and a Team Lead
// in this app: membership control, not deeper data access. A broker sees
// exactly what a team lead sees.
//
// Roster-aware on purpose. Inside a real brokerage (one that has a broker or
// an admin) a team lead has no membership control -- that's the point. But a
// team lead who created their own team at signup has nobody above them, and
// locking them out of their own roster would leave the team with no one who
// can invite anybody, ever, with no way to recover.
export function canManageMembership(
  sessionUser: SessionUser,
  members: { role: Role }[],
): boolean {
  if (!sessionUser.teamId) return false;
  if (sessionUser.role === "BROKER" || sessionUser.role === "ADMIN") return true;
  if (sessionUser.role === "TEAM_LEAD") {
    return !members.some((m) => m.role === "BROKER" || m.role === "ADMIN");
  }
  return false;
}
// A team must always keep at least one person who can manage its membership,
// or it locks itself out with no recovery path -- nobody left who can invite,
// promote, or remove. Called before any removal or demotion.
//
// `members` is the team's full roster; `changingUserId` is the person about
// to be removed or demoted, and `newRole` is what they'd become (null when
// they're leaving the team entirely).
//
// Deliberately asks canManageMembership rather than re-listing which roles
// count, so the two rules can never drift apart. Demoting the last broker to
// team lead is fine, for instance -- that team lead inherits control, because
// no broker or admin remains above them.
export function wouldLeaveTeamUnmanaged(
  members: { id: string; role: Role }[],
  changingUserId: string,
  newRole: Role | null,
): boolean {
  const remaining = members.filter((m) => m.id !== changingUserId);
  if (newRole) remaining.push({ id: changingUserId, role: newRole });
  return !remaining.some((m) =>
    canManageMembership({ id: m.id, role: m.role, teamId: "team" }, remaining),
  );
}

// "team" vs "brokerage" is a copy decision, not a data one -- there is
// deliberately no Team.kind column (see CLAUDE.md: Team IS the tenant,
// whatever its size). Derived from the roster, which every page that needs
// this label already loads.
export function teamLabel(members: { role: Role }[]): "brokerage" | "team" {
  return members.some((m) => m.role === "BROKER") ? "brokerage" : "team";
}
