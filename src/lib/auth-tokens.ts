import { createHash, randomBytes } from "node:crypto";

// Password reset and email verification (2026-11-20). The raw token only
// ever lives in the email link. The database stores its SHA-256 hash, so a
// leaked table isn't a pile of working links.

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_VERIFY_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// Shown for every forgot-password submit: a real account, a Google-only
// account, an unknown address, and a failed send all look the same.
export const PASSWORD_RESET_SENT =
  "If an account exists for that email, we sent a link to reset the password. It expires in one hour.";

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenExpiry(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + ttlMs);
}

export function tokenIsUsable(token: { expiresAt: Date; usedAt: Date | null }, now: Date): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}
