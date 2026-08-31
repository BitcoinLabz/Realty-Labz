"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership, wouldLeaveTeamUnmanaged } from "@/lib/authorization";
import { changeMemberRoleSchema } from "@/lib/validation";
import { selectDealsToArchive } from "@/lib/team-archive";
import type { FormState } from "@/app/actions/auth";
import type { Role } from "@/generated/prisma/enums";

type Guarded =
  | { ok: false; error: string }
  | {
      ok: true;
      teamId: string;
      actorId: string;
      members: { id: string; role: Role }[];
      target: { id: string; role: Role; name: string | null };
    };

/**
 * Every membership change runs the same four checks, so they live in one
 * place rather than being re-derived (and eventually diverging) per action:
 *
 *  1. The caller can manage this team's roster at all.
 *  2. The target is on the CALLER'S team -- a bare member id would otherwise
 *     let a broker at one brokerage act on a user at another, the same IDOR
 *     shape already fixed in deal-deadlines.ts and form-templates.ts.
 *  3. Nobody acts on themselves. Self-demotion and self-removal are the two
 *     easiest ways to lock a team out by accident.
 *  4. Whatever the change is, someone is still left who can manage the team.
 */
async function guardMembershipChange(targetUserId: unknown, newRole: Role | null): Promise<Guarded> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You must be signed in" };
  if (typeof targetUserId !== "string" || !targetUserId) {
    return { ok: false, error: "Missing member" };
  }

  const teamId = session.user.teamId;
  if (!teamId) return { ok: false, error: "You're not part of a team" };

  const members = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, role: true, name: true },
  });

  if (!canManageMembership(session.user, members)) {
    return { ok: false, error: "Only a broker or admin can change who's on the team" };
  }

  const target = members.find((m) => m.id === targetUserId);
  if (!target) return { ok: false, error: "That person isn't on your team" };

  if (target.id === session.user.id) {
    return { ok: false, error: "You can't change your own role or remove yourself" };
  }

  // The broker owns the organisation and can't be demoted or removed by
  // anyone, including an admin they promoted themselves. Enforced here and
  // not only by hiding the control -- a hidden button is not a permission.
  if (target.role === "BROKER") {
    return { ok: false, error: "The broker can't be changed or removed." };
  }

  if (wouldLeaveTeamUnmanaged(members, target.id, newRole)) {
    return {
      ok: false,
      error: "Someone has to be able to manage the team. Promote someone else first.",
    };
  }

  return { ok: true, teamId, actorId: session.user.id, members, target };
}

export async function changeMemberRoleAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = changeMemberRoleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid role" };
  }

  const guard = await guardMembershipChange(parsed.data.userId, parsed.data.role);
  if (!guard.ok) return { error: guard.error };

  // Compound where, not a bare id -- the team check from the guard is
  // re-asserted at the write itself so a slow request can't land against a
  // member who left in the meantime.
  await prisma.user.updateMany({
    where: { id: guard.target.id, teamId: guard.teamId },
    data: { role: parsed.data.role },
  });

  revalidatePath("/account");
  revalidatePath("/team");
  return { success: `${guard.target.name ?? "They"} are now ${roleArticle(parsed.data.role)}.` };
}

/**
 * Removes someone from the team. Nothing is deleted and nothing transfers --
 * they keep their account and every record on it, exactly as it was. The
 * team simply stops being able to see it, because manager visibility is
 * computed by joining through user.teamId (see teamOrOwnFilter).
 *
 * Their role resets to AGENT so they don't carry manager powers into a
 * solo account or the next team they join.
 */
export async function removeMemberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await guardMembershipChange(formData.get("userId"), null);
  if (!guard.ok) return { error: guard.error };

  await detachFromTeam(guard.target.id, guard.teamId);

  revalidatePath("/account");
  revalidatePath("/team");
  return { success: `${guard.target.name ?? "They"} have been removed. Their own data is untouched.` };
}

/**
 * An agent leaving of their own accord.
 *
 * Deliberately needs nobody's approval. An agent who moves brokerages
 * shouldn't have to ask their old broker's permission to unhook their own
 * account, and their clients and finances were never the brokerage's to
 * begin with. The brokerage keeps what it's legally required to keep --
 * see detachFromTeam.
 *
 * The one thing it can't do is orphan a team: the last person who can manage
 * the roster can't walk out and leave nobody able to invite or remove.
 */
export async function leaveTeamAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const teamId = session.user.teamId;
  if (!teamId) return { error: "You're not part of a team" };

  // Typed back by the user, same shape as every other destructive
  // confirmation in this app -- leaving costs a brokerage its visibility and
  // shouldn't be one stray click.
  if (formData.get("confirm") !== "LEAVE") {
    return { error: "Type LEAVE to confirm." };
  }

  const members = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, role: true },
  });

  if (wouldLeaveTeamUnmanaged(members, session.user.id, null)) {
    return {
      error:
        "You're the only person who can manage this team. Promote someone to admin first, or ask support to close the team.",
    };
  }

  await detachFromTeam(session.user.id, teamId);

  try {
    await unstable_update({ user: { teamId: null, role: "AGENT" } });
  } catch (err) {
    console.error("[leave-team] session update failed; will refresh on its own", err);
  }

  revalidatePath("/account");
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/**
 * Detaches a user from a team, whichever direction it came from, and leaves
 * the brokerage with the records it's required to keep.
 *
 * Michigan brokers have record-retention obligations, so a departure must
 * not vaporise the transaction history that closed under them. But nothing
 * is copied and nothing moves: `userId` is untouched, so the agent keeps
 * full ownership of every deal. The brokerage gets a read-only reference via
 * `archivedTeamId`, which only /team's archive section ever queries.
 *
 * Which deals qualify is decided by the pure, separately tested
 * selectDealsToArchive -- closed under this brokerage, never the active ones
 * that follow the agent to their next office.
 */
async function detachFromTeam(userId: string, teamId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamJoinedAt: true },
  });

  const deals = await prisma.deal.findMany({
    where: { userId },
    select: { id: true, status: true, closingDate: true },
  });

  const toArchive = selectDealsToArchive(deals, user?.teamJoinedAt ?? null);

  await prisma.$transaction([
    ...(toArchive.length > 0
      ? [
          prisma.deal.updateMany({
            where: { id: { in: toArchive }, userId },
            data: { archivedTeamId: teamId },
          }),
        ]
      : []),
    prisma.user.updateMany({
      where: { id: userId, teamId },
      data: { teamId: null, role: "AGENT", teamJoinedAt: null },
    }),
    // Any unused invite they created is now orphaned authority -- someone who
    // just lost the right to add people shouldn't have live links that still
    // do it.
    prisma.teamInvite.deleteMany({
      where: { teamId, createdBy: userId, usedAt: null },
    }),
  ]);
}

function roleArticle(role: Role): string {
  return role === "AGENT" ? "an agent" : role === "TEAM_LEAD" ? "a team lead" : "an admin";
}
