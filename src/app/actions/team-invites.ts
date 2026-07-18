"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { isManager } from "@/lib/authorization";
import { createInviteSchema, joinTeamSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

const INVITE_EXPIRY_DAYS = 7;

export async function createInviteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user || !isManager(session.user.role) || !session.user.teamId) {
    return { error: "You must be a team manager to invite teammates" };
  }

  const parsed = createInviteSchema.safeParse({ role: formData.get("role") });
  if (!parsed.success) {
    return { fieldErrors: { role: parsed.error.issues[0]?.message ?? "Invalid role" } };
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
  if (!session?.user || !isManager(session.user.role) || !session.user.teamId) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

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
