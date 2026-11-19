// Display names for home office expense kinds -- prisma-free so client
// components can import it (see the CATEGORY_LABELS note in CLAUDE.md).
import type { ExpenseKind } from "@/lib/home-office";

export const HOME_OFFICE_EXPENSE_LABELS: Record<ExpenseKind, string> = {
  MORTGAGE_INTEREST: "Mortgage interest",
  REAL_ESTATE_TAX: "Real estate taxes",
  INSURANCE: "Homeowners / renters insurance",
  UTILITIES: "Utilities (water, gas, electric)",
  RENT: "Rent",
  REPAIRS: "Repairs & maintenance",
  HOA: "HOA dues",
  OTHER: "Other home cost",
};

// Kinds that only make sense for one kind of home.
export const OWNER_ONLY_KINDS: ExpenseKind[] = ["MORTGAGE_INTEREST", "REAL_ESTATE_TAX"];
export const RENTER_ONLY_KINDS: ExpenseKind[] = ["RENT"];
