import { isPlausibleEmail } from "@/lib/email-format";

// Changing the sign-in email (2026-11-28). Pure rules, tested in
// email-change.test.ts; the database steps live in
// src/app/actions/email-change.ts.

/** How long the confirmation link sent to the new address works. */
export const EMAIL_CHANGE_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Null when the new address is acceptable, otherwise what to tell the user. */
export function emailChangeProblem(currentEmail: string, newEmail: string): string | null {
  const next = normalizeEmail(newEmail);
  if (!next) return "Enter the new email address";
  if (!isPlausibleEmail(next) || next.length > 254) return "That doesn't look like an email address";
  if (next === normalizeEmail(currentEmail)) return "That's already your sign-in email";
  return null;
}

// Shown when the new address already belongs to a different account. The
// person asking is signed in and rate-limited, so naming the clash is worth
// the small leak: it's exactly the case of a second, empty account made by
// signing in with another Google login, and silence would leave them stuck.
export const EMAIL_IN_USE =
  "Another Realty Labz account already uses that email. If it's an extra account you made by mistake (for example by signing in with a different Google account), contact us from the Support page and we'll remove it so you can switch.";
