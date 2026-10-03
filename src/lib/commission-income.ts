import { prisma } from "@/lib/db";
import { calculateNetCommission } from "@/lib/commission";
import { dealDisplayName } from "@/app/(app)/transactions/types";

// Log a closed transaction's net commission as business income -- once.
// Shared by the "Log this commission as income" button and, since
// 2026-10-03, by marking a transaction Closed (so it happens without the
// agent having to remember). Not in a "use server" file on purpose: every
// export there is a public endpoint, and this trusts its caller to have
// checked who's asking.
//
// Plain userId: a ledger entry is strictly personal, so you only ever log
// YOUR commission against YOUR transaction. Returns whether a row was made.
export async function logCommissionIncome(dealId: string, userId: string): Promise<boolean> {
  const deal = await prisma.deal.findFirst({ where: { id: dealId, userId } });
  if (!deal || deal.status !== "CLOSED") return false;

  // Idempotency: an indexed relational check rather than a fuzzy
  // date+amount match, so it survives the agent later editing the amount.
  const existing = await prisma.transaction.findFirst({
    where: { userId, dealId, type: "INCOME" },
    select: { id: true },
  });
  if (existing) return false;

  const gross = deal.commissionAmount ? Number(deal.commissionAmount) : 0;
  const net = calculateNetCommission(gross, {
    brokerageSplitPercent: deal.brokerageSplitPercent ? Number(deal.brokerageSplitPercent) : null,
    referralFeePercent: deal.referralFeePercent ? Number(deal.referralFeePercent) : null,
    teamSplitPercent: deal.teamSplitPercent ? Number(deal.teamSplitPercent) : null,
    otherDeductionsPercent: deal.otherDeductionsPercent ? Number(deal.otherDeductionsPercent) : null,
  });

  // Splits can legitimately exceed the gross; nothing to log then.
  const amount = Math.round(net * 100) / 100;
  if (amount <= 0) return false;

  await prisma.transaction.create({
    data: {
      userId,
      type: "INCOME",
      scope: "BUSINESS",
      // Null for every INCOME row -- the category enum is expense-only.
      category: null,
      amount,
      description: `Commission — ${dealDisplayName(deal.propertyAddress)}`,
      date: deal.closingDate ?? new Date(),
      dealId,
    },
  });
  return true;
}
