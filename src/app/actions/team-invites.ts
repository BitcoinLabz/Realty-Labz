"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signIn, unstable_update } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMembership, roleLabel } from "@/lib/authorization";
import { isRateLimited } from "@/lib/rate-limit";
import { sendTeamInviteEmail } from "@/lib/email";
import { headers } from "next/headers";
import {
  acceptInviteSchema,
  createInviteSchema,
  inviteByLicenseSchema,
  joinTeamSchema,
} from "@/lib/validation";
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
    licenseNumber: formData.get("licenseNumber"),
    brokerageNumber: formData.get("brokerageNumber") || undefined,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const { inviteId, name, email, password, licenseNumber, brokerageNumber } = parsed.data;

  const invite = await prisma.teamInvite.findUnique({
    where: { id: inviteId },
    include: { team: { select: { brokerageNumber: true } } },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { error: "This invite link is invalid or has expired" };
  }

  // Same confirmation step acceptInviteAction runs, for the same reason --
  // see the long comment there. Skipped when the team never set a number.
  if (invite.team.brokerageNumber) {
    if (!brokerageNumber) {
      return { fieldErrors: { brokerageNumber: "Enter the brokerage's license number" } };
    }
    if (brokerageNumber !== invite.team.brokerageNumber) {
      return {
        fieldErrors: { brokerageNumber: "That doesn't match this brokerage's license number." },
      };
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { fieldErrors: { email: "An account with this email already exists" } };
  }

  const licenseTaken = await prisma.user.findUnique({ where: { licenseNumber } });
  if (licenseTaken) {
    return {
      fieldErrors: {
        licenseNumber:
          "That license number is already on another account. If it's yours, get in touch from the support page.",
      },
    };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        licenseNumber,
        role: invite.role,
        teamId: invite.teamId,
        teamJoinedAt: new Date(),
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

  const parsed = acceptInviteSchema.safeParse({
    inviteId: formData.get("inviteId"),
    licenseNumber: formData.get("licenseNumber") ?? "",
    brokerageNumber: formData.get("brokerageNumber") || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  const invite = await prisma.teamInvite.findUnique({
    where: { id: parsed.data.inviteId },
    include: { team: { select: { brokerageNumber: true } } },
  });
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

  // Confirmation, not authentication. A brokerage licence number is public
  // on Michigan's LARA lookup, so this can't stop someone determined -- what
  // it stops is the accidental join: a forwarded link, the wrong person
  // clicking, accepting into an office you didn't mean to. The real control
  // is still that a manager generated an unguessable invite.
  //
  // Only enforced when the team actually set one. Teams created before this
  // existed have none, and must stay joinable rather than silently bricking.
  if (invite.team.brokerageNumber) {
    if (!parsed.data.brokerageNumber) {
      return { fieldErrors: { brokerageNumber: "Enter the brokerage's license number" } };
    }
    if (parsed.data.brokerageNumber !== invite.team.brokerageNumber) {
      return {
        fieldErrors: {
          brokerageNumber: "That doesn't match this brokerage's license number.",
        },
      };
    }
  }

  // An agent who has never entered a licence gets the field inline on the
  // join screen rather than being sent to Settings, where they'd lose the
  // invite. Only written when they don't already have one -- accepting an
  // invite is not the place to silently overwrite it.
  const existingUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { licenseNumber: true },
  });
  let licenseNumberToSet: string | undefined;
  if (!existingUser?.licenseNumber) {
    if (!parsed.data.licenseNumber) {
      return { fieldErrors: { licenseNumber: "Enter your license number" } };
    }
    const taken = await prisma.user.findFirst({
      where: { licenseNumber: parsed.data.licenseNumber, id: { not: session.user.id } },
      select: { id: true },
    });
    if (taken) {
      return {
        fieldErrors: {
          licenseNumber:
            "That license number is already on another account. If it's yours, get in touch from the support page.",
        },
      };
    }
    licenseNumberToSet = parsed.data.licenseNumber;
  }

  // Both writes use a compound where + a count check rather than a bare
  // update by id. The teamId: null guard means a second click (or a second
  // tab) can't re-run this against a user who has since joined, and the
  // usedAt: null guard means two people opening the same link at the same
  // moment can't both consume it.
  const [userResult, inviteResult] = await prisma.$transaction([
    prisma.user.updateMany({
      where: { id: session.user.id, teamId: null },
      data: {
        teamId: invite.teamId,
        role: invite.role,
        // Stamped so a later departure can tell which of their closed deals
        // actually closed under this brokerage -- see src/lib/team-archive.ts.
        teamJoinedAt: new Date(),
        ...(licenseNumberToSet ? { licenseNumber: licenseNumberToSet } : {}),
      },
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

// Deliberately identical whether or not the licence matched. This is the
// whole security property of the feature: Michigan licence numbers are
// public and roughly sequential, so a response that distinguished "found"
// from "not found" would let anyone walk the range and harvest the name and
// email of every agent using Realty Labz. The broker learns who the person
// is only if they accept.
const NEUTRAL_INVITE_RESULT =
  "If that license number belongs to a Realty Labz account, we've emailed them your invitation.";

/**
 * Invite an agent by their licence number instead of copying a link.
 *
 * Same outcome as createInviteAction -- a TeamInvite row -- but addressed to
 * a specific account and emailed directly, so onboarding a roster doesn't
 * mean generating and chasing links one at a time.
 */
export async function inviteByLicenseNumberAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user?.teamId) {
    return { error: "You must be part of a team to invite teammates" };
  }

  const members = await prisma.user.findMany({
    where: { teamId: session.user.teamId },
    select: { role: true },
  });
  if (!canManageMembership(session.user, members)) {
    return { error: "Only a broker or admin can invite teammates" };
  }

  // A neutral response still leaks under enough volume -- timing, and simply
  // being able to try thousands of numbers. This is what actually makes
  // walking the licence range impractical.
  if (await isRateLimited(`invite-by-license:${session.user.id}`, { max: 20, windowMinutes: 60 })) {
    return { error: "Too many invites sent — please wait a few minutes and try again." };
  }

  const parsed = inviteByLicenseSchema.safeParse({
    licenseNumber: formData.get("licenseNumber"),
    role: formData.get("role"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  if (parsed.data.role === "ADMIN" && session.user.role !== "BROKER") {
    return { fieldErrors: { role: "Only a broker can invite an admin" } };
  }

  const [team, recipient] = await Promise.all([
    prisma.team.findUnique({
      where: { id: session.user.teamId },
      select: { name: true, brokerageNumber: true },
    }),
    prisma.user.findUnique({
      where: { licenseNumber: parsed.data.licenseNumber },
      select: { id: true, name: true, email: true, teamId: true },
    }),
  ]);

  // Every path below returns NEUTRAL_INVITE_RESULT, including the ones that
  // do nothing at all: no such licence, and already on a team (which would
  // otherwise reveal that the number is registered AND that they're taken).
  if (!team || !recipient || recipient.teamId) {
    return { success: NEUTRAL_INVITE_RESULT };
  }

  const invite = await prisma.teamInvite.create({
    data: {
      teamId: session.user.teamId,
      createdBy: session.user.id,
      role: parsed.data.role,
      expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  try {
    await sendTeamInviteEmail({
      to: recipient.email,
      recipientName: recipient.name ?? "there",
      teamName: team.name,
      senderName: session.user.name ?? "Your broker",
      roleLabel: roleLabel(parsed.data.role),
      inviteUrl: `${await getBaseUrl()}/join/${invite.id}`,
      brokerageNumber: team.brokerageNumber,
    });
  } catch (err) {
    // The invite row still exists and its link still works, so this degrades
    // to the copy-and-send flow rather than failing outright -- same
    // philosophy as every other send in this app. Deliberately still the
    // neutral message: naming the delivery failure would confirm the licence
    // matched a real account.
    console.error("[invite-by-license] email failed; invite is still valid", err);
  }

  revalidatePath("/account");
  return { success: NEUTRAL_INVITE_RESULT };
}

// Same host-derived base URL the portal-access action builds -- there's no
// configured site URL env var, and hardcoding one would break local dev.
async function getBaseUrl() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
