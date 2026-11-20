"use server";

import bcrypt from "bcryptjs";
import { signIn } from "@/auth";
import { prisma } from "@/lib/db";
import { APP_URL } from "@/lib/app-url";
import {
  PASSWORD_RESET_SENT,
  PASSWORD_RESET_TTL_MS,
  hashToken,
  newToken,
  tokenExpiry,
} from "@/lib/auth-tokens";
import { invalidatePasswordResetTokens } from "@/lib/account-access";
import { sendGoogleAccountEmail, sendPasswordResetEmail } from "@/lib/email";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { emailOnlySchema, newPasswordSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

const TOO_MANY = "Too many attempts — please wait a while and try again.";
const BAD_LINK = "This link is invalid or has expired. Request a new one from the log in page.";

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email address" } };
  }

  const email = parsed.data.email;
  const ip = await getClientIp();
  if (
    (await isRateLimited(`reset:${ip}`, { max: 5, windowMinutes: 60 })) ||
    (await isRateLimited(`reset-email:${email}`, { max: 3, windowMinutes: 60 }))
  ) {
    return { error: TOO_MANY };
  }

  // The reply above is the only thing a caller can see. Whether we email,
  // and which email, stays on the server. A send failure is logged and
  // still looks like success, so a missing inbox isn't distinguishable
  // from an address we don't have.
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  try {
    if (user?.passwordHash) {
      await invalidatePasswordResetTokens(user.id);
      const raw = newToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: tokenExpiry(new Date(), PASSWORD_RESET_TTL_MS),
        },
      });
      await sendPasswordResetEmail({ to: user.email, resetUrl: `${APP_URL}/reset-password/${raw}` });
    } else if (user) {
      await sendGoogleAccountEmail({ to: user.email, loginUrl: `${APP_URL}/login` });
    }
  } catch (err) {
    console.error("[password-reset] send failed", err);
  }

  return { success: PASSWORD_RESET_SENT };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await getClientIp();
  if (await isRateLimited(`reset-use:${ip}`, { max: 10, windowMinutes: 60 })) {
    return { error: TOO_MANY };
  }

  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 20) return { error: BAD_LINK };

  const parsed = newPasswordSchema.safeParse({
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, emailVerifiedAt: true } } },
  });
  if (!row) return { error: BAD_LINK };

  // Claim first. A second click of the same link finds usedAt already set
  // and does not change the password again.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { error: BAD_LINK };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({
    where: { id: row.userId },
    data: {
      passwordHash,
      // Opening the link proves they can read the inbox.
      emailVerifiedAt: row.user.emailVerifiedAt ?? new Date(),
    },
  });
  await invalidatePasswordResetTokens(row.userId);

  await signIn("credentials", { email: row.user.email, password: parsed.data.newPassword, redirectTo: "/dashboard" });
  return {};
}
