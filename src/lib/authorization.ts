import type { Role } from "@/generated/prisma/enums";

// Team Lead, Admin, and Broker share team-wide data visibility in Phase 2
// (see CLAUDE.md Platform Expansion Roadmap) — only Agent is scoped to their
// own records. This is the one place that rule is defined; every query that
// needs "does this user see the whole team" should call this instead of
// re-deriving the same role check inline.
export function isManager(role: Role): boolean {
  return role === "TEAM_LEAD" || role === "ADMIN" || role === "BROKER";
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
