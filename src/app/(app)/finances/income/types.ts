// MILEAGE and HOME_OFFICE are included for type-compatibility with Prisma's
// TransactionCategory enum only — both are reserved, not selectable options
// in the form (mileage lives in MileageLog, home office is a computed
// deduction from User.homeOfficeSqFt — see src/lib/finance-data.ts), so no
// new row should ever actually get either value, but the type has to admit
// them regardless since historical rows may already have them.
export type TransactionCategory =
  | "MILEAGE"
  | "HOME_OFFICE"
  | "PHONE"
  | "MARKETING_ADVERTISING"
  | "MLS_DUES"
  | "CONTINUING_EDUCATION"
  | "CLIENT_GIFTS"
  | "OFFICE_SUPPLIES"
  | "SOFTWARE_SUBSCRIPTIONS"
  | "INSURANCE"
  | "LICENSING_FEES"
  | "MEALS_ENTERTAINMENT"
  | "PROFESSIONAL_SERVICES"
  | "OTHER";
export type TransactionType = "INCOME" | "EXPENSE";
export type TransactionScope = "BUSINESS" | "PERSONAL";

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  scope: TransactionScope;
  category: TransactionCategory | null;
  amount: number;
  description: string | null;
  date: string; // yyyy-mm-dd
  dealId: string | null;
};

export type DealOption = { id: string; propertyAddress: string };
