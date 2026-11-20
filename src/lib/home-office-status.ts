import type { HomeOfficeYearResult } from "@/lib/home-office";

// The one-line status at the top of the Home Office page and its PDF
// (2026-11-19), worded the same in both places.
export function homeOfficeStatus(r: HomeOfficeYearResult): { tone: "success" | "warning" | "neutral"; text: string } {
  const fmt = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const carried = r.carryOut.operating + r.carryOut.depreciation;
  // Zero is "no profit yet", not a loss. A loss is income below zero.
  const loss = r.tentativeProfit < 0;

  if (r.tentativeProfit === 0 && r.allowed === 0) {
    return {
      tone: "neutral",
      text: "The home office deduction is limited to business income. Nothing is deducted until the business shows a profit.",
    };
  }

  if (r.method === "SIMPLIFIED") {
    if (r.simplified.lostToIncomeLimit > 0) {
      return {
        tone: "warning",
        text: `${loss ? "Business had a loss" : "Business profit was too small for the full deduction"}. The simplified method has no carryover, so ${fmt(r.simplified.lostToIncomeLimit)} can't be used.${carried > 0 ? ` Your earlier carryover of ${fmt(carried)} is kept for a future regular-method year.` : ""}`,
      };
    }
    return { tone: "success", text: "Business was profitable — full deduction allowed." };
  }
  if (carried > 0) {
    return {
      tone: "warning",
      text: `${loss ? "Business had a loss" : "Business profit didn't cover every home cost"} — ${fmt(carried)} carried forward to future years.`,
    };
  }
  return { tone: "success", text: "Business was profitable — full deduction allowed." };
}
