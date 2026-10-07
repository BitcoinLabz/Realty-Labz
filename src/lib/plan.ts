// Free vs Pro (2026-10-05). Pure and tested (plan.test.ts): this decides who
// can use paid features, so it's a rule with one right answer, not a guess
// spread across pages.
//
// Free: everything manual, forever. Pro ($15/mo or $150/yr): what costs money
// to run -- AI contract reading and unlimited storage today, more later (see
// CLAUDE.md's Product Backlog).

export const PRO_PRICE = { monthly: 15, annual: 150 };

export const FREE_STORAGE_BYTES = 250 * 1024 * 1024; // 250 MB

// One source for the upgrade screen.
export const PRO_FEATURES = [
  "AI contract reading — every deadline found and set up for you",
  "Unlimited document storage",
  "Everything new that's paid as it ships (automatic mileage is next)",
];

type PlanFields = {
  plan: "FREE" | "PRO";
  subscriptionStatus: string | null;
  compedPro: boolean;
};

// Statuses that keep Pro on. past_due is included on purpose: Stripe retries
// a failed card for a while, and cutting someone off mid-retry over an
// expired card is the wrong first move. "canceled"/"unpaid"/"incomplete"
// end it.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function hasPro(user: PlanFields): boolean {
  if (user.compedPro) return true;
  return user.plan === "PRO" && !!user.subscriptionStatus && ACTIVE_STATUSES.has(user.subscriptionStatus);
}

// Null = unlimited.
export function storageLimitBytes(user: PlanFields): number | null {
  return hasPro(user) ? null : FREE_STORAGE_BYTES;
}

export function wouldExceedStorage(usedBytes: number, addingBytes: number, limit: number | null): boolean {
  return limit !== null && usedBytes + addingBytes > limit;
}

// What a Stripe subscription means for the account. The webhook stores this
// verbatim; cancelling "at period end" keeps Pro until that date because
// Stripe keeps the status "active" until then.
export function planFromSubscription(status: string): "FREE" | "PRO" {
  return ACTIVE_STATUSES.has(status) ? "PRO" : "FREE";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 1024 ? `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB` : `${(mb / 1024).toFixed(1)} GB`;
}
