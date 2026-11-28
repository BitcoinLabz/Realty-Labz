"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_URL } from "@/lib/app-url";
import { hashToken, newToken, tokenExpiry } from "@/lib/auth-tokens";
import { EMAIL_CHANGE_TTL_MS, EMAIL_IN_USE, emailChangeProblem, normalizeEmail } from "@/lib/email-change";
import { sendEmailChangeConfirmEmail, sendEmailChangeRequestedNotice, sendEmailChangedNotice } from "@/lib/email";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import type { FormState } from "@/app/actions/auth";

// Changing the sign-in email (2026-11-28).
//
// 1. A signed-in user asks for a new address (re-entering their password if
//    the account has one -- a borrowed, unlocked laptop shouldn't be enough
//    to take an account over).
// 2. A single-use link goes to the NEW address; the OLD address is told.
// 3. Clicking the link makes the switch. Nothing changes before that, so a
//    typo can't lock anyone out.
//
// Google sign-in finds accounts by email (src/auth.ts), so after the switch
// the Google account for the new address signs in to this account.

const TOO_MANY = "Too many attempts — please wait a while and try again.";
const BAD_LINK = "This link is invalid, already used, or expired. Start the change again from Settings.";

export async function requestEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true },
  });
  if (!user) return { error: "You must be signed in" };

  const raw = formData.get("newEmail");
  const newEmail = normalizeEmail(typeof raw === "string" ? raw : "");
  const problem = emailChangeProblem(user.email, newEmail);
  if (problem) return { fieldErrors: { newEmail: problem } };

  const ip = await getClientIp();
  if (
    (await isRateLimited(`email-change:${userId}`, { max: 5, windowMinutes: 60 })) ||
    (await isRateLimited(`email-change-ip:${ip}`, { max: 10, windowMinutes: 60 }))
  ) {
    return { error: TOO_MANY };
  }

  if (user.passwordHash) {
    const password = formData.get("currentPassword");
    if (typeof password !== "string" || !password) {
      return { fieldErrors: { currentPassword: "Enter your current password" } };
    }
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      return { fieldErrors: { currentPassword: "That password isn't right" } };
    }
  }

  const taken = await prisma.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, id: { not: userId } },
    select: { id: true },
  });
  if (taken) return { fieldErrors: { newEmail: EMAIL_IN_USE } };

  // One pending change at a time: a new request replaces the old link.
  await prisma.emailChangeToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
  const token = newToken();
  await prisma.emailChangeToken.create({
    data: { userId, newEmail, tokenHash: hashToken(token), expiresAt: tokenExpiry(new Date(), EMAIL_CHANGE_TTL_MS) },
  });

  try {
    await sendEmailChangeConfirmEmail({ to: newEmail, confirmUrl: `${APP_URL}/confirm-email-change/${token}` });
  } catch (err) {
    console.error("[email-change] confirmation email failed", err);
    await prisma.emailChangeToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
    revalidatePath("/account");
    return { error: "Couldn't send the confirmation email just now. Try again in a moment." };
  }
  try {
    await sendEmailChangeRequestedNotice({ to: user.email, newEmail, settingsUrl: `${APP_URL}/account` });
  } catch (err) {
    // The heads-up to the old address is a courtesy; the change still needs
    // the new address to confirm, so a failure here doesn't block it.
    console.error("[email-change] notice to old address failed", err);
  }

  revalidatePath("/account");
  return { success: `Check ${newEmail} for a confirmation link. Your email won't change until you click it.` };
}

export async function cancelEmailChangeAction(): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  await prisma.emailChangeToken.updateMany({
    where: { userId: session.user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  revalidatePath("/account");
}

// Public on purpose: the link may be opened on a phone that isn't signed in.
// Having the link proves control of the new address; the request itself
// already required being signed in (and the password, if there is one).
export async function confirmEmailChangeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (await isRateLimited(`email-change-use:${ip}`, { max: 20, windowMinutes: 60 })) {
    return { error: TOO_MANY };
  }

  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 20) return { error: BAD_LINK };

  const row = await prisma.emailChangeToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, newEmail: true, user: { select: { email: true } } },
  });
  if (!row) return { error: BAD_LINK };

  // Claim it atomically so the same link can't be used twice at once.
  const claimed = await prisma.emailChangeToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { error: BAD_LINK };

  // Someone else may have taken the address since the link was sent.
  const taken = await prisma.user.findFirst({
    where: { email: { equals: row.newEmail, mode: "insensitive" }, id: { not: row.userId } },
    select: { id: true },
  });
  if (taken) return { error: EMAIL_IN_USE };

  const oldEmail = row.user.email;
  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: { email: row.newEmail, emailVerifiedAt: new Date() },
      }),
      // Links sent to the old address (password reset, verification) and any
      // other pending change stop working.
      prisma.emailChangeToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
      prisma.emailVerificationToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
    ]);
  } catch (err) {
    // The unique index on users.email is the last word if two changes race.
    console.error("[email-change] switch failed", err);
    return { error: EMAIL_IN_USE };
  }

  try {
    await sendEmailChangedNotice({ to: oldEmail, newEmail: row.newEmail, supportUrl: `${APP_URL}/support` });
  } catch (err) {
    console.error("[email-change] changed notice failed", err);
  }

  revalidatePath("/", "layout");
  return {
    success: `Done. Your account now signs in with ${row.newEmail}. If you use Google, sign in with the Google account for that address.`,
  };
}
