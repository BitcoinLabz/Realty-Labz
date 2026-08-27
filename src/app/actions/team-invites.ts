"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership } from "@/lib/authorization";
import { createInviteSchema, joinTeamSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

const INVITE_EXPIRY_DAYS = 7;

export async function createInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.teamId) {
    return { error: "You must be part of a team to invite teammates" };
  }

  // Roster-aware: inside a brokerage only a broker or admin controls who
  // joins. A team lead who owns their own team still can -- see
  // canManageMembership for why that fallback exists.
  const members = await prisma.user.findMany({
    where: { teamId: session.user.teamId },
    select: { role: true },
  });
  if (!canManageMembership(session.user, members)) {
    return { error: "Only a broker or admin can invite teammates" };
  }

  const parsed = createInviteSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) {
    return { fieldErrors: { role: parsed.error.issues[0]?.message ?? "Invalid role" } };
  }

  // Inviting an Admin hands over membership control -- the ability to remove
  // people, including the person doing the inviting. Only a broker may do
  // that. Checked here rather than trusting the rendered <option> list.
  if (parsed.data.role === "ADMIN" && session.user.role !== "BROKER") {
    return { fieldErrors: { role: "Only a broker can invite an admin" } };
  }

  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.teamInvite.create({
    data: {
      teamId: session.user.teamId,
      createdBy: session.user.id,
      role: parsed.data.role,
      expiresAt,
    },
  });

  revalidatePath("/account");
  return {};
}

export async function revokeInviteAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.teamId) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  const members = await prisma.user.findMany({
    where: { teamId: session.user.teamId },
    select: { role: true },
  });
  if (!canManageMembership(session.user, members)) return;

  await prisma.teamInvite.deleteMany({
    where: { id, teamId: session.user.teamId, usedAt: null },
  });

  revalidatePath("/account");
}

export async function joinTeamAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = joinTeamSchema.safeParse({
    inviteId: formData.get("inviteId"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { inviteId, name, email, password } = parsed.data;

  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "This invite link is invalid or has expired" };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: invite.role,
        teamId: invite.teamId,
      },
    }),
    prisma.teamInvite.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  return {};
}

/**
 * Links an EXISTING account to a team, as opposed to joinTeamAction above,
 * which creates a brand-new user from an invite.
 *
 * This is the whole point of the broker work: before it, an agent with a
 * year of transactions who joined a brokerage had to abandon their account
 * and start over, because the only join path created a new user.
 *
 * It's a one-column update because of how this app is scoped -- every record
 * hangs off userId, and manager visibility is computed by joining THROUGH
 * user.teamId rather than storing a teamId on each record. So nothing moves:
 * their whole history comes with them and becomes visible to the team's
 * managers at the same instant. That's correct, and it's exactly why
 * /join/[id] states it plainly before they click.
 */
export async function acceptInviteAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in to join a team" };

  const inviteId = formData.get("inviteId");
  if (typeof inviteId !== "string" || !inviteId) return { error: "Missing invite" };

  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "This invite link is invalid or has expired" };
  }

  if (session.user.teamId) {
    return {
      error:
        session.user.teamId === invite.teamId
          ? "You're already part of this team."
          : "You're already part of another team. Ask them to remove you first, then open this link again.",
    };
  }

  // Both writes use a compound where + a count check rather than a bare
  // update by id. The teamId: null guard means a second click (or a second
  // tab) can't re-run this against a user who has since joined, and the
  // usedAt: null guard means two people opening the same link at the same
  // moment can't both consume it.
  const [userResult, inviteResult] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: session.user.id, teamId: null },
      data: { teamId: invite.teamId, role: invite.role },
    }),
    prisma.teamInvite.updateMany({
      where: { id: invite.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  if (userResult.count !== 1 || inviteResult.count !== 1) {
    return { error: "This invite has already been used. Ask for a fresh link." };
  }

  // Patch the live session so the Team nav and manager views appear now
  // rather than whenever the token next refreshes (see the jwt callback in
  // src/auth.ts, which is the durable backstop if this ever no-ops).
  try {
    await unstable_update({ user: { teamId: invite.teamId, role: invite.role } });
  } catch (err) {
    console.error("[accept-invite] session update failed; will refresh on its own", err);
  }

  revalidatePath("/dashboard");
  revalidatePath("/account");
  redirect("/dashboard");
}
