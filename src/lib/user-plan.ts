import { prisma } from "@/lib/db";
import { hasPro, storageLimitBytes, wouldExceedStorage, formatBytes, FREE_STORAGE_BYTES } from "@/lib/plan";

// Server-side plan lookups. The session token doesn't carry the plan on
// purpose: an upgrade (or a cancellation) must take effect on the next
// request, not when a 30-day token happens to refresh.

export async function getUserPlan(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      plan: true,
      subscriptionStatus: true,
      compedPro: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
      stripeCustomerId: true,
    },
  });
  if (!user) return null;
  return { ...user, isPro: hasPro(user), storageLimit: storageLimitBytes(user) };
}

export async function userIsPro(userId: string): Promise<boolean> {
  return (await getUserPlan(userId))?.isPro ?? false;
}

// Every file the account owns: its documents (including ones the office
// filed under it), shared templates and fillable-form templates.
export async function storageUsedBytes(userId: string): Promise<number> {
  const [docs, docTemplates, formTemplates] = await Promise.all([
    prisma.document.aggregate({ where: { userId }, _sum: { size: true } }),
    prisma.documentTemplate.aggregate({ where: { userId }, _sum: { size: true } }),
    prisma.formTemplate.aggregate({ where: { userId }, _sum: { size: true } }),
  ]);
  return (docs._sum.size ?? 0) + (docTemplates._sum.size ?? 0) + (formTemplates._sum.size ?? 0);
}

// The check every upload path runs before saving a file. Returns a message to
// show, or null when it fits.
export async function storageBlockMessage(userId: string, addingBytes: number): Promise<string | null> {
  const plan = await getUserPlan(userId);
  if (!plan || plan.storageLimit === null) return null;
  const used = await storageUsedBytes(userId);
  if (!wouldExceedStorage(used, addingBytes, plan.storageLimit)) return null;
  return `You've used ${formatBytes(used)} of your ${formatBytes(FREE_STORAGE_BYTES)} free storage. Upgrade to Pro for unlimited storage, or delete files you no longer need.`;
}
