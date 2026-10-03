// Referral fees per partner per year, and whether a 1099 is likely due
// (2026-10-03). Pure and tested (referral-1099.test.ts).
//
// A referral fee counts in the year its transaction CLOSED -- that's when it
// is paid out. Dollars come from each deal's gross commission x its referral
// percentage, rounded to cents per deal (the same rule as the commission
// form, src/lib/cda.ts).

// The federal 1099-NEC/MISC reporting threshold for payments made in a given
// year: $600 through 2025, raised to $2,000 for payments made from 2026 by
// the 2025 federal tax law (indexed for inflation after 2026). Shown to the
// agent as a prompt to check with their accountant, never as tax advice --
// update here if it changes.
export function reportingThreshold(year: number): number {
  return year >= 2026 ? 2000 : 600;
}

export type ClosedReferralDeal = {
  referralPartnerId: string | null;
  closingDate: Date | null;
  commissionAmount: number | null;
  referralFeePercent: number | null;
};

// Year is read in UTC: closing dates are date-only values stored at UTC midnight.
export function referralTotalsForYear(deals: ClosedReferralDeal[], year: number): Map<string, number> {
  const totals = new Map<string, number>();
  for (const d of deals) {
    if (!d.referralPartnerId || !d.closingDate || d.closingDate.getUTCFullYear() !== year) continue;
    const cents = Math.round((d.commissionAmount ?? 0) * (d.referralFeePercent ?? 0));
    if (cents <= 0) continue;
    totals.set(d.referralPartnerId, (totals.get(d.referralPartnerId) ?? 0) + cents / 100);
  }
  // Keep sums at cent precision despite floating point.
  for (const [id, total] of totals) totals.set(id, Math.round(total * 100) / 100);
  return totals;
}

export function needs1099(totalForYear: number, year: number): boolean {
  return totalForYear >= reportingThreshold(year);
}
