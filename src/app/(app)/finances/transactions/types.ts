// MILEAGE is included for type-compatibility with Prisma's TransactionCategory
// enum only — it's reserved, not a selectable option in the form (mileage
// lives in its own MileageLog-backed section), so no row should ever actually
// have it, but the type has to admit the value regardless.
export type TransactionCategory = "MILEAGE" | "HOME_OFFICE" | "PHONE" | "OTHER";
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
};
