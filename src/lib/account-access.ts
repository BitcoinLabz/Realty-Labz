import { prisma } from "@/lib/db";
import { APP_URL } from "@/lib/app-url";
import { EMAIL_VERIFY_TTL_MS, hashToken, newToken, tokenExpiry } from "@/lib/auth-tokens";
import { sendEmailVerificationEmail } from "@/lib/email";

// Not a server action. Lives here so a browser can't call it with someone
// else's user id. The public actions in app/actions import it.

export async function invalidatePasswordResetTokens(userId: string) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

// Creates a fresh single-use link and emails it. Older unused links for
// the same account stop working. No-ops once the address is confirmed.
// Throws if the email can't be sent.
export async function issueEmailVerification(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerifiedAt: true },
  });
  if (!user || user.emailVerifiedAt) return;

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });
  const raw = newToken();
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: tokenExpiry(new Date(), EMAIL_VERIFY_TTL_MS),
    },
  });
  await sendEmailVerificationEmail({ to: user.email, verifyUrl: `${APP_URL}/verify-email/${raw}` });
}
