import { Handshake } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SummaryCard } from "@/components/ui/summary-card";
import { YearSelect } from "@/components/ui/year-select";
import { formatCurrency } from "@/lib/format";
import { needs1099, referralTotalsForYear, reportingThreshold } from "@/lib/referral-1099";
import { PartnerList, type PartnerRow } from "./partner-list";

// Referral partners and what you've paid them (2026-10-03). Moved here from a
// tab inside every transaction. Fees count in the year a transaction closed.
// Personal, userId-scoped like everything else under Finances.
export default async function ReferralsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const currentYear = new Date().getFullYear();
  const { year: yearParam } = await searchParams;
  const year = Number(yearParam) || currentYear;

  const [partners, closedDeals] = await Promise.all([
    prisma.referralPartner.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({
      where: { userId, status: "CLOSED", referralPartnerId: { not: null } },
      select: { referralPartnerId: true, closingDate: true, commissionAmount: true, referralFeePercent: true },
    }),
  ]);

  const deals = closedDeals.map((d) => ({
    referralPartnerId: d.referralPartnerId,
    closingDate: d.closingDate,
    commissionAmount: d.commissionAmount ? Number(d.commissionAmount) : null,
    referralFeePercent: d.referralFeePercent ? Number(d.referralFeePercent) : null,
  }));

  const yearTotals = referralTotalsForYear(deals, year);
  // Lifetime: every closed year the deals span.
  const lifetime = new Map<string, number>();
  const years = new Set(deals.filter((d) => d.closingDate).map((d) => d.closingDate!.getUTCFullYear()));
  for (const y of years) {
    for (const [id, total] of referralTotalsForYear(deals, y)) {
      lifetime.set(id, Math.round(((lifetime.get(id) ?? 0) + total) * 100) / 100);
    }
  }

  const rows: PartnerRow[] = partners.map((p) => {
    const yearTotal = yearTotals.get(p.id) ?? 0;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      phone: p.phone,
      notes: p.notes,
      w9Received: p.w9Received,
      yearTotal,
      lifetimeTotal: lifetime.get(p.id) ?? 0,
      needs1099: needs1099(yearTotal, year),
    };
  });

  const yearTotal = rows.reduce((sum, r) => sum + r.yearTotal, 0);
  const flagged = rows.filter((r) => r.needs1099);
  const missingW9 = flagged.filter((r) => !r.w9Received).length;
  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Referral fees count in the year their transaction closed.
        </p>
        <YearSelect year={year} options={yearOptions} basePath="/finances/referrals" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label={`Referral fees (${year})`} value={formatCurrency(yearTotal)} icon={Handshake} tone="violet" />
        <SummaryCard
          label={`1099s likely needed (${year})`}
          value={flagged.length.toString()}
          hint={`Partners paid ${formatCurrency(reportingThreshold(year))} or more in ${year}. Confirm with your accountant — this isn't tax advice.`}
        />
        <SummaryCard label="Still need a W-9" value={missingW9.toString()} />
      </div>

      <Card
        title="Referral partners"
        icon={Handshake}
        tone="violet"
        description="Who you pay (or owe) referral fees, and how much each year. Pick a partner on a transaction's details."
      >
        <PartnerList partners={rows} year={year} />
      </Card>
    </div>
  );
}
