"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership, wouldLeaveTeamUnmanaged } from "@/lib/authorization";
import { changeMemberRoleSchema } from "@/lib/validation";
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

  await prisma.user.updateMany({
    where: { id: guard.target.id, teamId: guard.teamId },
    data: { teamId: null, role: "AGENT" },
  });

  // Any unused invite they created is now orphaned authority -- someone who
  // just lost the right to add people shouldn't have live links that still
  // do it.
  await prisma.teamInvite.deleteMany({
    where: { teamId: guard.teamId, createdBy: guard.target.id, usedAt: null },
  });

  revalidatePath("/account");
  revalidatePath("/team");
  return { success: `${guard.target.name ?? "They"} have been removed. Their own data is untouched.` };
}

function roleArticle(role: Role): string {
  return role === "AGENT" ? "an agent" : role === "TEAM_LEAD" ? "a team lead" : "an admin";
}
