import { redirect } from "next/navigation";

// The income/expense ledger is now called "Income & expenses" so the word
// "transaction" can mean a real estate transaction throughout the app.
export default function LegacyFinancesTransactionsRedirect() {
  redirect("/finances/income");
}
