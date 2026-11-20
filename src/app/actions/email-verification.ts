"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/auth-tokens";
import { issueEmailVerification } from "@/lib/account-access";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import type { FormState } from "@/app/actions/auth";

const TOO_MANY = "Too many attempts — please wait a while and try again.";
const BAD_LINK = "This link is invalid or has expired. Sign in and send yourself a new one.";

export async function resendEmailVerificationAction(prev: FormState, formData: FormData): Promise<FormState> {
  // Nothing in the form matters; the session is the account. Keep the
  // useActionState signature without tripping the unused-arg lint.
  void prev;
  void formData;
  const session = await auth();
  if (!session?.user) return { error: "You must be signed in" };

  const ip = await getClientIp();
  if (
    (await isRateLimited(`verify-resend:${session.user.id}`, { max: 5, windowMinutes: 60 })) ||
    (await isRateLimited(`verify-resend-ip:${ip}`, { max: 10, windowMinutes: 60 }))
  ) {
    return { error: TOO_MANY };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerifiedAt: true },
  });
  if (!user) return { error: "You must be signed in" };
  if (user.emailVerifiedAt) return { success: "This email is already confirmed." };

  try {
    await issueEmailVerification(session.user.id);
  } catch (err) {
    console.error("[email-verification] resend failed", err);
    return { error: "Couldn't send the email just now. Try again in a moment." };
  }
  return { success: "Sent. Check your inbox for the confirmation link." };
}

export async function confirmEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (await isRateLimited(`verify-use:${ip}`, { max: 20, windowMinutes: 60 })) {
    return { error: TOO_MANY };
  }

  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 20) return { error: BAD_LINK };

  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true },
  });
  if (!row) return { error: BAD_LINK };

  const claimed = await prisma.emailVerificationToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { error: BAD_LINK };

  await prisma.user.updateMany({
    where: { id: row.userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  });
  await prisma.emailVerificationToken.updateMany({
    where: { userId: row.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  revalidatePath("/", "layout");
  return { success: "Email confirmed. You're all set." };
}
