export type TransactionCategory = "MILEAGE" | "HOME_OFFICE" | "PHONE" | "OTHER";
export type TransactionType = "INCOME" | "EXPENSE";

export type TransactionDTO = {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string | null;
  date: string; // yyyy-mm-dd
};
